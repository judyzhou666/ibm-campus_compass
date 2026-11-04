//! Live IBM watsonx.ai interpreter. It sends only the student's message and the previous
//! structured constraints to watsonx.ai, and accepts only a `Constraints` object back.
//! The returned object must pass `deny_unknown_fields` and `Constraints::validate`;
//! deterministic matching in `planner.rs` still chooses every event.
//!
//! Credentials come from server-side environment variables and never reach the browser,
//! API responses or logs.
use crate::interpreter::{InterpretError, Interpreter};
use crate::model::{Constraints, TOPICS};
use serde::Deserialize;
use serde_json::json;
use std::{
    env,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

pub const DEFAULT_URL: &str = "https://us-south.ml.cloud.ibm.com";
pub const DEFAULT_IAM_URL: &str = "https://iam.cloud.ibm.com/identity/token";
pub const DEFAULT_MODEL_ID: &str = "ibm/granite-3-3-8b-instruct";
pub const DEFAULT_API_VERSION: &str = "2024-03-14";
/// Below the browser's 8-second request timeout, so a slow model still leaves time for
/// the labelled simulated fallback to answer.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(6);

#[derive(Clone)]
pub struct WatsonxConfig {
    pub api_key: String,
    pub project_id: String,
    pub url: String,
    pub iam_url: String,
    pub model_id: String,
    pub api_version: String,
    pub timeout: Duration,
}

impl std::fmt::Debug for WatsonxConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WatsonxConfig")
            .field("api_key", &"[redacted]")
            .field("project_id", &self.project_id)
            .field("url", &self.url)
            .field("model_id", &self.model_id)
            .finish_non_exhaustive()
    }
}

fn non_empty(name: &str) -> Option<String> {
    env::var(name).ok().filter(|v| !v.trim().is_empty())
}

impl WatsonxConfig {
    /// Reads `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` (required) plus optional
    /// `WATSONX_URL`, `WATSONX_IAM_URL`, `WATSONX_MODEL_ID` and `WATSONX_API_VERSION`.
    pub fn from_env() -> Result<Self, String> {
        let missing: Vec<_> = ["WATSONX_API_KEY", "WATSONX_PROJECT_ID"]
            .into_iter()
            .filter(|name| non_empty(name).is_none())
            .collect();
        if !missing.is_empty() {
            return Err(format!(
                "PLANNER_PROVIDER=watsonx needs {} in the server environment; see docs/backend.md.",
                missing.join(" and ")
            ));
        }
        Ok(Self {
            api_key: non_empty("WATSONX_API_KEY").unwrap_or_default(),
            project_id: non_empty("WATSONX_PROJECT_ID").unwrap_or_default(),
            url: non_empty("WATSONX_URL")
                .unwrap_or_else(|| DEFAULT_URL.into())
                .trim_end_matches('/')
                .into(),
            iam_url: non_empty("WATSONX_IAM_URL").unwrap_or_else(|| DEFAULT_IAM_URL.into()),
            model_id: non_empty("WATSONX_MODEL_ID").unwrap_or_else(|| DEFAULT_MODEL_ID.into()),
            api_version: non_empty("WATSONX_API_VERSION")
                .unwrap_or_else(|| DEFAULT_API_VERSION.into()),
            timeout: DEFAULT_TIMEOUT,
        })
    }
}

pub struct WatsonxInterpreter {
    config: WatsonxConfig,
    client: reqwest::Client,
    token: Mutex<Option<(String, Instant)>>,
    connected: AtomicBool,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}
#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}
#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

fn system_prompt() -> String {
    format!(
        r#"You convert a student's campus-event request into JSON search constraints.
Reply with exactly one JSON object and nothing else. Allowed keys (omit any that do not apply):
- "topics": array of interests to include, chosen only from {topics}
- "excluded": array of interests to avoid, chosen only from the same list
- "days": array of weekday numbers, 0 = Monday ... 6 = Sunday
- "after": earliest start, minutes after midnight (0-1440)
- "before": latest end, minutes after midnight (0-1440)
- "food": "Free meal" or "Coffee & snacks"
- "free": true when the student wants no-cost events
- "limit": number of suggestions, 1-5
Start from "previous" and return the complete updated object: keep earlier constraints the
student did not change, and remove a key when the student lifts that preference.
"start over" or "reset" means return {{}}. Never include event names, IDs or other keys."#,
        topics = serde_json::to_string(&TOPICS).unwrap_or_default()
    )
}

/// Accepts a bare JSON object, optionally wrapped in a Markdown code fence.
fn parse_constraints(content: &str) -> Result<Constraints, InterpretError> {
    let text = content.trim();
    let text = text
        .strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .and_then(|t| t.strip_suffix("```"))
        .unwrap_or(text)
        .trim();
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|_| InterpretError::Malformed)?;
    if !value.is_object() {
        return Err(InterpretError::Malformed);
    }
    let constraints: Constraints =
        serde_json::from_value(value).map_err(|_| InterpretError::Malformed)?;
    constraints.validate().map_err(InterpretError::Invalid)?;
    Ok(constraints)
}

fn http_error(status: reqwest::StatusCode) -> InterpretError {
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        InterpretError::Auth
    } else {
        InterpretError::Upstream(status.as_u16())
    }
}

fn network_error(error: reqwest::Error) -> InterpretError {
    if error.is_timeout() {
        InterpretError::Timeout
    } else {
        InterpretError::Network
    }
}

impl WatsonxInterpreter {
    pub fn new(config: WatsonxConfig) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(config.timeout)
            .build()
            .map_err(|_| "Could not create the watsonx HTTP client".to_string())?;
        Ok(Self {
            config,
            client,
            token: Mutex::new(None),
            connected: AtomicBool::new(false),
        })
    }

    pub fn model_id(&self) -> &str {
        &self.config.model_id
    }

    /// True only after the most recent live call succeeded.
    pub fn connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    async fn token(&self) -> Result<String, InterpretError> {
        if let Some((token, expires)) = self.token.lock().expect("token lock").clone()
            && Instant::now() < expires
        {
            return Ok(token);
        }
        let response = self
            .client
            .post(&self.config.iam_url)
            .header("Accept", "application/json")
            .form(&[
                ("grant_type", "urn:ibm:params:oauth:grant-type:apikey"),
                ("apikey", self.config.api_key.as_str()),
            ])
            .send()
            .await
            .map_err(network_error)?;
        if !response.status().is_success() {
            return Err(InterpretError::Auth);
        }
        let body: TokenResponse = response.json().await.map_err(|_| InterpretError::Auth)?;
        // Refresh a minute early so a token never expires mid-request.
        let expires = Instant::now() + Duration::from_secs(body.expires_in.saturating_sub(60));
        *self.token.lock().expect("token lock") = Some((body.access_token.clone(), expires));
        Ok(body.access_token)
    }

    async fn call(
        &self,
        message: &str,
        previous: &Constraints,
    ) -> Result<Constraints, InterpretError> {
        let token = self.token().await?;
        let user = json!({"previous": previous, "message": message}).to_string();
        let response = self
            .client
            .post(format!("{}/ml/v1/text/chat", self.config.url))
            .query(&[("version", self.config.api_version.as_str())])
            .bearer_auth(token)
            .json(&json!({
                "model_id": self.config.model_id,
                "project_id": self.config.project_id,
                "messages": [
                    {"role": "system", "content": system_prompt()},
                    {"role": "user", "content": user},
                ],
                "max_tokens": 300,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "time_limit": self.config.timeout.as_millis() as u64,
            }))
            .send()
            .await
            .map_err(network_error)?;
        if !response.status().is_success() {
            if matches!(http_error(response.status()), InterpretError::Auth) {
                *self.token.lock().expect("token lock") = None;
            }
            return Err(http_error(response.status()));
        }
        let body: ChatResponse = response
            .json()
            .await
            .map_err(|_| InterpretError::Malformed)?;
        let content = body
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .ok_or(InterpretError::Malformed)?;
        parse_constraints(&content)
    }
}

impl Interpreter for WatsonxInterpreter {
    async fn interpret(
        &self,
        message: &str,
        previous: Constraints,
    ) -> Result<Constraints, InterpretError> {
        let result = tokio::time::timeout(self.config.timeout, self.call(message, &previous))
            .await
            .unwrap_or(Err(InterpretError::Timeout));
        self.connected.store(result.is_ok(), Ordering::Relaxed);
        result
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use axum::{
        Json, Router,
        extract::{Query, State},
        http::{HeaderMap, StatusCode},
        routing::post,
    };
    use serde_json::Value;
    use std::{
        collections::HashMap,
        sync::{Arc, atomic::AtomicUsize},
    };

    pub const TEST_KEY: &str = "test-only-fake-key-7f3a";

    #[derive(Clone, Copy)]
    pub enum Behavior {
        Reply(&'static str),
        IamRejects,
        ChatStatus(u16),
        Slow,
    }

    #[derive(Clone)]
    pub struct Mock {
        pub behavior: Behavior,
        pub iam_calls: Arc<AtomicUsize>,
        pub chat_bodies: Arc<Mutex<Vec<Value>>>,
    }

    async fn iam(State(mock): State<Mock>, body: String) -> Result<Json<Value>, StatusCode> {
        mock.iam_calls.fetch_add(1, Ordering::SeqCst);
        if matches!(mock.behavior, Behavior::IamRejects) || !body.contains(TEST_KEY) {
            return Err(StatusCode::BAD_REQUEST);
        }
        Ok(Json(
            json!({"access_token": "mock-token", "expires_in": 3600}),
        ))
    }

    async fn chat(
        State(mock): State<Mock>,
        Query(query): Query<HashMap<String, String>>,
        headers: HeaderMap,
        Json(body): Json<Value>,
    ) -> Result<Json<Value>, StatusCode> {
        assert_eq!(
            query.get("version").map(String::as_str),
            Some(DEFAULT_API_VERSION)
        );
        assert_eq!(
            headers.get("authorization").and_then(|v| v.to_str().ok()),
            Some("Bearer mock-token")
        );
        mock.chat_bodies.lock().unwrap().push(body);
        match mock.behavior {
            Behavior::Reply(content) => Ok(Json(
                json!({"choices": [{"message": {"role": "assistant", "content": content}}]}),
            )),
            Behavior::ChatStatus(code) => Err(StatusCode::from_u16(code).unwrap()),
            Behavior::Slow => {
                tokio::time::sleep(Duration::from_secs(2)).await;
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
            Behavior::IamRejects => unreachable!(),
        }
    }

    /// Starts a local stand-in for IAM and watsonx.ai and returns a config pointing at it.
    pub async fn mock(behavior: Behavior) -> (WatsonxConfig, Mock) {
        let mock = Mock {
            behavior,
            iam_calls: Arc::default(),
            chat_bodies: Arc::default(),
        };
        let router = Router::new()
            .route("/identity/token", post(iam))
            .route("/ml/v1/text/chat", post(chat))
            .with_state(mock.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        let config = WatsonxConfig {
            api_key: TEST_KEY.into(),
            project_id: "test-project".into(),
            url: format!("http://{addr}"),
            iam_url: format!("http://{addr}/identity/token"),
            model_id: DEFAULT_MODEL_ID.into(),
            api_version: DEFAULT_API_VERSION.into(),
            timeout: Duration::from_millis(500),
        };
        (config, mock)
    }

    async fn run(behavior: Behavior) -> (Result<Constraints, InterpretError>, Mock) {
        let (config, mock) = mock(behavior).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let previous = Constraints {
            food: Some("Free meal".into()),
            ..Default::default()
        };
        (
            interpreter.interpret("career on Tuesday", previous).await,
            mock,
        )
    }

    #[tokio::test]
    async fn valid_model_output_becomes_constraints() {
        let (result, mock) = run(Behavior::Reply(
            r#"{"topics":["Career"],"days":[1],"food":"Free meal"}"#,
        ))
        .await;
        assert_eq!(
            result.unwrap(),
            Constraints {
                topics: Some(vec!["Career".into()]),
                days: Some(vec![1]),
                food: Some("Free meal".into()),
                ..Default::default()
            }
        );
        let bodies = mock.chat_bodies.lock().unwrap();
        let body = bodies[0].to_string();
        assert_eq!(bodies[0]["project_id"], "test-project");
        assert_eq!(bodies[0]["model_id"], DEFAULT_MODEL_ID);
        assert!(body.contains("career on Tuesday") && body.contains("Free meal"));
        assert!(!body.contains(TEST_KEY), "API key must go only to IAM");
    }

    #[tokio::test]
    async fn fenced_output_is_accepted_and_token_is_reused() {
        let (config, mock) = mock(Behavior::Reply("```json\n{\"limit\":2}\n```")).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        for _ in 0..2 {
            let c = interpreter
                .interpret("2 options", Constraints::default())
                .await;
            assert_eq!(c.unwrap().limit, Some(2));
        }
        assert_eq!(mock.iam_calls.load(Ordering::SeqCst), 1);
        assert!(interpreter.connected());
    }

    #[tokio::test]
    async fn authentication_failure_is_reported() {
        assert_eq!(run(Behavior::IamRejects).await.0, Err(InterpretError::Auth));
        assert_eq!(
            run(Behavior::ChatStatus(401)).await.0,
            Err(InterpretError::Auth)
        );
        assert_eq!(
            run(Behavior::ChatStatus(503)).await.0,
            Err(InterpretError::Upstream(503))
        );
    }

    #[tokio::test]
    async fn malformed_or_unsafe_output_is_rejected() {
        for content in [
            "Sure! Here are some events.",
            r#"{"event_ids":["e1"]}"#,
            r#"{"topics":["Career"],"reason":"x"}"#,
            "[]",
        ] {
            assert_eq!(
                run(Behavior::Reply(content)).await.0,
                Err(InterpretError::Malformed)
            );
        }
    }

    #[tokio::test]
    async fn out_of_range_constraints_fail_validation() {
        for content in [
            r#"{"limit":99}"#,
            r#"{"topics":["Gaming"]}"#,
            r#"{"days":[9]}"#,
            r#"{"food":"Pizza"}"#,
        ] {
            assert!(matches!(
                run(Behavior::Reply(content)).await.0,
                Err(InterpretError::Invalid(_))
            ));
        }
    }

    #[tokio::test]
    async fn slow_model_times_out() {
        let (config, _) = mock(Behavior::Slow).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let result = interpreter.interpret("AI", Constraints::default()).await;
        assert_eq!(result, Err(InterpretError::Timeout));
        assert!(!interpreter.connected());
    }

    #[test]
    fn secrets_are_redacted_from_debug_output() {
        let config = WatsonxConfig {
            api_key: TEST_KEY.into(),
            project_id: "p".into(),
            url: DEFAULT_URL.into(),
            iam_url: DEFAULT_IAM_URL.into(),
            model_id: DEFAULT_MODEL_ID.into(),
            api_version: DEFAULT_API_VERSION.into(),
            timeout: DEFAULT_TIMEOUT,
        };
        assert!(!format!("{config:?}").contains(TEST_KEY));
    }
}
