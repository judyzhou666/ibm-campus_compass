//! Live IBM watsonx.ai interpreter. Step 1 turns a student message into structured filter
//! constraints. Step 2 (rank_candidates) receives the deterministic candidate list and the
//! fictional profile, and returns narrative reasons + field citations for 3-5 picks.
//! Deterministic matching and conflict checks in planner.rs remain authoritative;
//! the model never fabricates event IDs or eligibility.
//!
//! Credentials come from server-side environment variables and never reach the browser,
//! API responses or logs.
use crate::interpreter::{InterpretError, Interpretation, Interpreter};
use crate::model::{Constraints, Event, PlanProfile, TOPICS};
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
pub const DEFAULT_MODEL_ID: &str = "ibm/granite-4-h-small";
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
- "days": array of full English weekday names, e.g. ["Tuesday", "Thursday"]
- "after": earliest start, minutes after midnight (0-1440)
- "before": latest end, minutes after midnight (0-1440)
- "food": one of "Free meal", "Coffee & snacks", "Paid food", "None", "Unknown"
- "free": true when the student wants no-cost events
- "limit": number of suggestions, 1-5
Start from "previous" and return the complete updated object: keep earlier constraints the
student did not change, and remove a key when the student lifts that preference.
"start over" or "reset" means return {{}}. Never include event names, IDs or other keys."#,
        topics = serde_json::to_string(&TOPICS).unwrap_or_default()
    )
}

fn ranking_system_prompt() -> &'static str {
    r#"You help a student choose campus events from a pre-filtered list of feasible options.
The list was produced by a deterministic planner that already checked schedules, access and
cancellations. Every event on the list is genuinely eligible.

Your task:
1. Pick 3-5 events from the list that best match the student's message, major, goals and
   goal types. Cover goal types where possible (e.g. one research, one industry, one social).
2. For each pick write ONE short reason (under 60 words) that explains why THIS event suits
   THIS student. When the event's host_school differs from the student's major, say so
   explicitly to show cross-school discovery.
3. Cite the event fields you actually used as evidence. Allowed cited_fields values:
   title, description, host_school, goal_type, food, access_conditions.
4. NEVER claim access is confirmed or eligibility is open when any access_conditions value
   is "unknown". State "access not confirmed" or similar.
5. When min_age, ticket or membership apply (non-false, non-"unknown"), mention them in the
   reason.
6. If the student's request is too vague to choose (e.g. "surprise me"), return a single
   short clarification question as: {"clarification":"Your question here"}.

Reply with exactly one JSON object. No markdown. Either:
  {"picks":[{"id":"<id>","reason":"<reason>","cited_fields":["<field>",...]}, ...]}
or
  {"clarification":"<one short question>"}
Never include event IDs that are not in the candidate list."#
}

/// Weekday names exchanged with the model. The app numbers days Monday = 0 ... Sunday = 6;
/// models reliably mis-count that scheme (Tuesday became 2), so only names cross the boundary.
const DAY_NAMES: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

/// Previous constraints as the model sees them, with day numbers written as names.
fn previous_for_model(previous: &Constraints) -> serde_json::Value {
    let mut value = serde_json::to_value(previous).unwrap_or_else(|_| json!({}));
    if let Some(days) = &previous.days {
        let names: Vec<_> = days
            .iter()
            .filter_map(|d| DAY_NAMES.get(usize::from(*d)))
            .collect();
        value["days"] = json!(names);
    }
    value
}

/// Accepts a bare JSON object, optionally wrapped in a Markdown code fence, whose "days"
/// are weekday names. Names are converted to the app's numbering before validation.
fn parse_constraints(content: &str) -> Result<Constraints, InterpretError> {
    let text = content.trim();
    let text = text
        .strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .and_then(|t| t.strip_suffix("```"))
        .unwrap_or(text)
        .trim();
    let mut value: serde_json::Value =
        serde_json::from_str(text).map_err(|_| InterpretError::Malformed)?;
    if !value.is_object() {
        return Err(InterpretError::Malformed);
    }
    if let Some(days) = value.get("days") {
        let names = days.as_array().ok_or(InterpretError::Malformed)?;
        let mut numbers = Vec::with_capacity(names.len());
        for name in names {
            // Numbers are refused rather than guessed: their meaning is exactly what models get wrong.
            let name = name.as_str().ok_or(InterpretError::Malformed)?.trim();
            let day = DAY_NAMES
                .iter()
                .position(|d| d.eq_ignore_ascii_case(name))
                .ok_or(InterpretError::Invalid("Unknown weekday"))?;
            numbers.push(day);
        }
        value["days"] = json!(numbers);
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

    /// Low-level POST to /ml/v1/text/chat; returns the raw content string.
    async fn call_inner(
        &self,
        system: &str,
        user: &str,
        max_tokens: u32,
    ) -> Result<String, InterpretError> {
        let token = self.token().await?;
        let response = self
            .client
            .post(format!("{}/ml/v1/text/chat", self.config.url))
            .query(&[("version", self.config.api_version.as_str())])
            .bearer_auth(token)
            .json(&json!({
                "model_id": self.config.model_id,
                "project_id": self.config.project_id,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
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
        body.choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .ok_or(InterpretError::Malformed)
    }

    /// Step-1 call: message → constraints. Wrapped in the shared timeout.
    async fn call_constraints(
        &self,
        message: &str,
        previous: &Constraints,
    ) -> Result<Constraints, InterpretError> {
        let prompt = system_prompt();
        let user =
            json!({"previous": previous_for_model(previous), "message": message}).to_string();
        let content =
            tokio::time::timeout(self.config.timeout, self.call_inner(&prompt, &user, 300))
                .await
                .unwrap_or(Err(InterpretError::Timeout))?;
        parse_constraints(&content)
    }

    /// Step-2 call: ranked picks with narrative reasons.
    pub async fn rank_candidates(
        &self,
        message: &str,
        candidates: &[&Event],
        profile: &PlanProfile,
        _all_events: &[Event],
    ) -> Result<Vec<RankedPick>, RankError> {
        if candidates.is_empty() {
            return Ok(vec![]);
        }
        let candidate_json: Vec<_> = candidates
            .iter()
            .map(|e| {
                json!({
                    "id": e.id,
                    "title": e.title,
                    "description": e.description,
                    "host_school": e.host_school,
                    "goal_type": e.goal_type,
                    "food": e.food,
                    "access_conditions": e.access_conditions,
                })
            })
            .collect();
        let user = serde_json::to_string(&json!({
            "message": message,
            "major": profile.major,
            "goals": profile.goals,
            "goal_types": profile.goal_types,
            "candidates": candidate_json,
        }))
        .unwrap_or_default();
        let content = tokio::time::timeout(
            self.config.timeout,
            self.call_inner(ranking_system_prompt(), &user, 800),
        )
        .await
        .unwrap_or(Err(InterpretError::Timeout))
        .map_err(RankError::Upstream)?;
        parse_ranking(&content, candidates)
    }
}

/// A validated pick from the ranking step.
#[derive(Debug, Clone)]
pub struct RankedPick {
    pub id: String,
    pub reason: String,
    pub cited_fields: Vec<String>,
}

/// Why the ranking step could not produce a valid response.
#[derive(Debug)]
pub enum RankError {
    /// The model returned a clarification question (not an error).
    Clarification(String),
    /// Invalid, malformed or security-violating output.
    Invalid,
    /// Network/auth/upstream failure; caller falls back to template evidence.
    Upstream(InterpretError),
}

const ALLOWED_CITED: &[&str] = &[
    "title",
    "description",
    "host_school",
    "goal_type",
    "food",
    "access_conditions",
];

/// Validates the ranking JSON and maps model picks to `RankedPick`.
fn parse_ranking(content: &str, candidates: &[&Event]) -> Result<Vec<RankedPick>, RankError> {
    let text = content.trim();
    let text = text
        .strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .and_then(|t| t.strip_suffix("```"))
        .unwrap_or(text)
        .trim();
    let value: serde_json::Value = serde_json::from_str(text).map_err(|_| RankError::Invalid)?;
    if !value.is_object() {
        return Err(RankError::Invalid);
    }
    // Clarification response.
    if let Some(q) = value.get("clarification") {
        let q = q.as_str().ok_or(RankError::Invalid)?.trim();
        if q.is_empty() || q.len() > 300 {
            return Err(RankError::Invalid);
        }
        return Err(RankError::Clarification(q.to_string()));
    }
    let picks = value
        .get("picks")
        .and_then(|p| p.as_array())
        .ok_or(RankError::Invalid)?;
    if picks.is_empty() || picks.len() > 5 {
        return Err(RankError::Invalid);
    }
    let mut result = Vec::with_capacity(picks.len());
    for pick in picks {
        let id = pick
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or(RankError::Invalid)?;
        // Every id must be in the candidate list.
        let event = candidates
            .iter()
            .find(|e| e.id == id)
            .ok_or(RankError::Invalid)?;
        let reason = pick
            .get("reason")
            .and_then(|v| v.as_str())
            .ok_or(RankError::Invalid)?
            .trim();
        if reason.is_empty() || reason.len() > 500 {
            return Err(RankError::Invalid);
        }
        // cited_fields must all be in the allowed list and exist on this event.
        let cited: Vec<String> = pick
            .get("cited_fields")
            .and_then(|v| v.as_array())
            .ok_or(RankError::Invalid)?
            .iter()
            .map(|v| v.as_str().ok_or(RankError::Invalid).map(|s| s.to_string()))
            .collect::<Result<_, _>>()?;
        for field in &cited {
            if !ALLOWED_CITED.contains(&field.as_str()) {
                return Err(RankError::Invalid);
            }
            // Verify the field actually exists and has a non-empty value on this event.
            let present = match field.as_str() {
                "title" => !event.title.is_empty(),
                "description" => !event.description.is_empty(),
                "host_school" => !event.host_school.is_empty(),
                "goal_type" => !event.goal_type.is_empty(),
                "food" => !event.food.is_empty(),
                "access_conditions" => !event.access_conditions.is_null(),
                _ => false,
            };
            if !present {
                return Err(RankError::Invalid);
            }
        }
        // Security: reason must not claim access is open/confirmed when any
        // access_conditions value is "unknown".
        if has_unknown_conditions(event) {
            let lower = reason.to_lowercase();
            let forbidden = [
                "access is open",
                "open access",
                "access confirmed",
                "eligibility confirmed",
                "eligibility is open",
            ];
            if forbidden.iter().any(|f| lower.contains(f)) {
                return Err(RankError::Invalid);
            }
        }
        result.push(RankedPick {
            id: id.to_string(),
            reason: reason.to_string(),
            cited_fields: cited,
        });
    }
    Ok(result)
}

/// Returns true when any access_conditions field is the string "unknown".
fn has_unknown_conditions(event: &Event) -> bool {
    if let Some(obj) = event.access_conditions.as_object() {
        return obj.values().any(|v| v.as_str() == Some("unknown"));
    }
    // Non-object or null access_conditions are treated as unknown.
    true
}

impl Interpreter for WatsonxInterpreter {
    async fn interpret(
        &self,
        message: &str,
        previous: Constraints,
    ) -> Result<Interpretation, InterpretError> {
        let result = self.call_constraints(message, &previous).await;
        self.connected.store(result.is_ok(), Ordering::Relaxed);
        // The model either produced valid constraints (understood) or the call failed and the
        // handler falls back; it never asks for clarification itself.
        result.map(|constraints| Interpretation {
            constraints,
            understood: true,
            clarification: None,
        })
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
            interpreter
                .interpret("career on Tuesday", previous)
                .await
                .map(|i| i.constraints),
            mock,
        )
    }

    #[tokio::test]
    async fn valid_model_output_becomes_constraints() {
        let (result, mock) = run(Behavior::Reply(
            r#"{"topics":["Career"],"days":["tuesday"," Thursday "],"food":"Free meal"}"#,
        ))
        .await;
        assert_eq!(
            result.unwrap(),
            Constraints {
                topics: Some(vec!["Career".into()]),
                days: Some(vec![1, 3]),
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
                .await
                .map(|i| i.constraints);
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
            // Day numbers are refused: Granite returned [2,4] for "Tuesday or Thursday".
            r#"{"days":[1,3]}"#,
            r#"{"days":"Tuesday"}"#,
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
            r#"{"days":["Funday"]}"#,
            r#"{"food":"Pizza"}"#,
        ] {
            assert!(matches!(
                run(Behavior::Reply(content)).await.0,
                Err(InterpretError::Invalid(_))
            ));
        }
    }

    #[tokio::test]
    async fn every_weekday_name_maps_to_the_app_numbering() {
        let (result, _) = run(Behavior::Reply(
            r#"{"days":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]}"#,
        ))
        .await;
        assert_eq!(result.unwrap().days, Some(vec![0, 1, 2, 3, 4, 5, 6]));
    }

    #[tokio::test]
    async fn previous_days_are_sent_to_the_model_as_names() {
        let (config, mock) = mock(Behavior::Reply(r#"{"days":["Thursday"]}"#)).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let previous = Constraints {
            days: Some(vec![1, 3]),
            ..Default::default()
        };
        let result = interpreter
            .interpret("only Thursday", previous)
            .await
            .map(|i| i.constraints);
        assert_eq!(result.unwrap().days, Some(vec![3]));
        let bodies = mock.chat_bodies.lock().unwrap();
        let user = bodies[0]["messages"][1]["content"].as_str().unwrap();
        let sent: Value = serde_json::from_str(user).unwrap();
        assert_eq!(sent["previous"]["days"], json!(["Tuesday", "Thursday"]));
    }

    #[tokio::test]
    async fn slow_model_times_out() {
        let (config, _) = mock(Behavior::Slow).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let result = interpreter
            .interpret("AI", Constraints::default())
            .await
            .map(|i| i.constraints);
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

    // ──────────────────────────────────────────────────────────────────────
    // Ranking step tests
    // ──────────────────────────────────────────────────────────────────────

    fn make_event(id: &str) -> Event {
        use crate::model::Event;
        use serde_json::json;
        Event {
            id: id.into(),
            title: "Sample event".into(),
            day: 1,
            start: 900,
            end: 990,
            topic: "Career".into(),
            category: "Career".into(),
            food: "Coffee & snacks".into(),
            cost: 0,
            access: "open".into(),
            rsvp: "Drop-in welcome".into(),
            location: "Room 1".into(),
            description: "A sample event description.".into(),
            source: "CC-test".into(),
            verification_status: "Fictional record; not externally verified".into(),
            eligibility: "Open".into(),
            host_school: "School of Engineering".into(),
            goal_type: vec!["industry".into()],
            access_conditions: json!({"membership":false,"min_age":"unknown","ticket":false,"capacity":"unknown"}),
        }
    }

    async fn run_ranking(
        behavior: Behavior,
        events: &[Event],
    ) -> Result<Vec<RankedPick>, RankError> {
        let (config, _) = mock(behavior).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let refs: Vec<&Event> = events.iter().collect();
        interpreter
            .rank_candidates("career events", &refs, &PlanProfile::default(), events)
            .await
    }

    #[tokio::test]
    async fn ranking_invented_id_is_rejected() {
        let events = vec![make_event("e1")];
        // Model returns an id not in the candidate list.
        let result = run_ranking(
            Behavior::Reply(
                r#"{"picks":[{"id":"e999","reason":"Looks good.","cited_fields":["title"]}]}"#,
            ),
            &events,
        )
        .await;
        assert!(matches!(result, Err(RankError::Invalid)));
    }

    #[tokio::test]
    async fn ranking_cited_field_not_on_event_is_rejected() {
        let mut e = make_event("e1");
        e.host_school = String::new(); // clear host_school
        let events = vec![e];
        // Model cites host_school but the event has an empty string for it.
        let result = run_ranking(
            Behavior::Reply(r#"{"picks":[{"id":"e1","reason":"From the engineering school.","cited_fields":["host_school"]}]}"#),
            &events,
        )
        .await;
        assert!(matches!(result, Err(RankError::Invalid)));
    }

    #[tokio::test]
    async fn ranking_unknown_access_claimed_open_is_rejected() {
        // Event has "unknown" capacity, so the reason must not claim open/confirmed access.
        let events = vec![make_event("e1")]; // access_conditions has capacity:"unknown"
        let result = run_ranking(
            Behavior::Reply(r#"{"picks":[{"id":"e1","reason":"This event has open access for all.","cited_fields":["title"]}]}"#),
            &events,
        )
        .await;
        assert!(matches!(result, Err(RankError::Invalid)));
    }

    #[tokio::test]
    async fn ranking_malformed_json_is_rejected() {
        let events = vec![make_event("e1")];
        for bad in [
            "not json at all",
            r#"["e1","e2"]"#,
            r#"{"picks":"e1"}"#,
            r#"{"picks":[{"id":"e1","reason":"ok"}]}"#, // missing cited_fields
            r#"{"picks":[{"id":"e1","cited_fields":["title"]}]}"#, // missing reason
            r#"{"picks":[{"id":"e1","reason":"ok","cited_fields":["invented_field"]}]}"#,
        ] {
            let result = run_ranking(Behavior::Reply(bad), &events).await;
            assert!(
                matches!(result, Err(RankError::Invalid)),
                "expected Invalid for: {bad}"
            );
        }
    }

    #[tokio::test]
    async fn ranking_timeout_returns_upstream_error() {
        let events = vec![make_event("e1")];
        let (config, _) = mock(Behavior::Slow).await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let refs: Vec<&Event> = events.iter().collect();
        let result = interpreter
            .rank_candidates("career events", &refs, &PlanProfile::default(), &events)
            .await;
        assert!(matches!(result, Err(RankError::Upstream(_))));
    }

    #[tokio::test]
    async fn ranking_clarification_returned_as_variant() {
        let events = vec![make_event("e1")];
        let result = run_ranking(
            Behavior::Reply(r#"{"clarification":"What kind of events do you prefer?"}"#),
            &events,
        )
        .await;
        match result {
            Err(RankError::Clarification(q)) => {
                assert!(q.contains("prefer") || q.len() > 3);
            }
            other => panic!("expected Clarification, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn ranking_valid_picks_pass_through() {
        let events = vec![make_event("e1"), make_event("e2")];
        // Valid: id in list, cited field present, access not falsely claimed.
        let result = run_ranking(
            Behavior::Reply(r#"{"picks":[{"id":"e1","reason":"Matches your industry goal; access not confirmed.","cited_fields":["title","goal_type"]}]}"#),
            &events,
        )
        .await;
        let picks = result.expect("should be valid");
        assert_eq!(picks.len(), 1);
        assert_eq!(picks[0].id, "e1");
        assert!(picks[0].cited_fields.contains(&"goal_type".to_string()));
    }

    #[tokio::test]
    async fn ranking_profile_and_candidates_sent_to_model() {
        let events = vec![make_event("e1")];
        let (config, mock_handle) = mock(Behavior::Reply(
            r#"{"picks":[{"id":"e1","reason":"Suits your goals; access not confirmed.","cited_fields":["title"]}]}"#,
        ))
        .await;
        let interpreter = WatsonxInterpreter::new(config).unwrap();
        let refs: Vec<&Event> = events.iter().collect();
        let profile = PlanProfile {
            major: "Education".into(),
            goals: "research".into(),
            goal_types: vec!["research".into()],
        };
        let _ = interpreter
            .rank_candidates("show me events", &refs, &profile, &events)
            .await;
        let bodies = mock_handle.chat_bodies.lock().unwrap();
        let user_str = bodies[0]["messages"][1]["content"].as_str().unwrap();
        let user: Value = serde_json::from_str(user_str).unwrap();
        assert_eq!(user["major"], "Education");
        assert_eq!(user["goal_types"][0], "research");
        // Name, calendar and history must NOT be sent.
        assert!(user.get("name").is_none());
        assert!(user.get("plan").is_none());
        assert!(user.get("messages").is_none());
    }
}
