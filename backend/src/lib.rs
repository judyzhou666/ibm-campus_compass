pub mod interpreter;
pub mod model;
pub mod planner;
pub mod watsonx;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    routing::{get, post},
};
use interpreter::{Interpreter, SimulatedInterpreter};
use model::{Constraints, Event, Schedule};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{path::PathBuf, sync::Arc};
use tower_http::services::ServeDir;
use watsonx::WatsonxInterpreter;

pub fn demo_config() -> Value {
    serde_json::from_str(include_str!("../../data/demo.json")).expect("demo configuration")
}

type ApiError = (StatusCode, Json<Value>);
fn bad_request(message: &str) -> ApiError {
    (StatusCode::BAD_REQUEST, Json(json!({"error":message})))
}

/// Which interpreter turns chat messages into constraints.
pub enum Provider {
    Simulated,
    /// Live IBM watsonx.ai, with the simulated interpreter as a labelled per-request fallback.
    Watsonx(Box<WatsonxInterpreter>),
}

struct AppState {
    events: Vec<Event>,
    provider: Provider,
}
type Shared = State<Arc<AppState>>;

pub const WATSONX_FALLBACK_NOTICE: &str =
    "IBM watsonx was unavailable, so this answer used the simulated demo planner.";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PlanRequest {
    message: String,
    #[serde(default)]
    previous: Constraints,
    state: Schedule,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ValidateRequest {
    event_id: String,
    state: Schedule,
}

async fn plan(
    State(app): Shared,
    Json(request): Json<PlanRequest>,
) -> Result<Json<Value>, ApiError> {
    let events = &app.events;
    if request.message.trim().is_empty() || request.message.len() > 2000 {
        return Err(bad_request("Message must contain 1–2000 bytes"));
    }
    request.state.validate(events).map_err(bad_request)?;
    request.previous.validate().map_err(bad_request)?;
    // Deterministic safety rules (such as refusing unsupported numeric budgets) run before any
    // live model call, so a clarification never depends on the model.
    let simulated = SimulatedInterpreter.parse(&request.message, request.previous.clone());
    let (interpretation, mode, provider, notice) = match &app.provider {
        Provider::Watsonx(live) if simulated.clarification.is_none() => match live
            .interpret(&request.message, request.previous.clone())
            .await
        {
            Ok(i) => (i, "watsonx", format!("watsonx:{}", live.model_id()), None),
            Err(error) => {
                // Log the failure kind only: never the message, key, token or upstream body.
                eprintln!("watsonx interpreter unavailable ({error}); using simulated planner");
                (
                    simulated,
                    "simulated",
                    "rust-rules".to_string(),
                    Some(WATSONX_FALLBACK_NOTICE),
                )
            }
        },
        _ => (simulated, "simulated", "rust-rules".to_string(), None),
    };
    let constraints = interpretation.constraints;
    // Required for every interpreter, including watsonx-generated constraints.
    constraints.validate().map_err(bad_request)?;
    let selected = if interpretation.understood && interpretation.clarification.is_none() {
        planner::recommend(&request.state, &constraints, events)
    } else {
        Vec::new()
    };
    let evidence: Vec<_> = selected
        .iter()
        .map(|e| planner::evidence(e, &request.state, &constraints, events))
        .collect();
    let ids: Vec<_> = selected.iter().map(|e| &e.id).collect();
    let diagnostic = if interpretation.understood
        && interpretation.clarification.is_none()
        && selected.is_empty()
    {
        Some(planner::no_match_reason(
            &request.state,
            &constraints,
            events,
        ))
    } else {
        None
    };
    let mut body = json!({
        "mode":mode, "provider":provider, "constraints":constraints,
        "understood":interpretation.understood, "clarification":interpretation.clarification,
        "event_ids":ids, "recommendations":evidence, "diagnostic":diagnostic
    });
    if let Some(notice) = notice {
        body["notice"] = json!(notice);
    }
    Ok(Json(body))
}

async fn health(State(app): Shared) -> Json<Value> {
    Json(match &app.provider {
        Provider::Simulated => json!({
            "status":"ok", "mode":"simulated", "provider":"rust-rules",
            "watsonx_configured":false, "watsonx_connected":false
        }),
        Provider::Watsonx(live) => json!({
            "status":"ok", "mode":"watsonx", "provider":format!("watsonx:{}", live.model_id()),
            "watsonx_configured":true, "watsonx_connected":live.connected()
        }),
    })
}

async fn validate(
    State(app): Shared,
    Json(request): Json<ValidateRequest>,
) -> Result<Json<Value>, ApiError> {
    let events = &app.events;
    request.state.validate(events).map_err(bad_request)?;
    let event = events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    let issue = planner::issue(event, &request.state, events);
    Ok(Json(json!({"allowed":issue.is_none(),"issue":issue})))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Rsvp {
    display_name: String,
    attending: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EnrollmentRequest {
    event_id: String,
    state: Schedule,
    rsvp: Option<Rsvp>,
}

async fn enroll(
    State(app): Shared,
    Json(request): Json<EnrollmentRequest>,
) -> Result<Json<Value>, ApiError> {
    let events = &app.events;
    request.state.validate(events).map_err(bad_request)?;
    let event = events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    if let Some(problem) = planner::issue(event, &request.state, events) {
        return Err((StatusCode::CONFLICT, Json(json!({"error":problem}))));
    }
    let required = event.rsvp == "RSVP required";
    if required
        && !request.rsvp.as_ref().is_some_and(|r| {
            r.attending && !r.display_name.trim().is_empty() && r.display_name.len() <= 120
        })
    {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error":"Complete the required RSVP before adding this event."})),
        ));
    }
    // Demo confirmation only: no organizer is contacted and no shared booking is persisted.
    Ok(Json(
        json!({"event_id":event.id,"demo":true,"status":"enrolled","rsvp_confirmed":required}),
    ))
}

/// The simulated demo app (no credentials, no network calls).
pub fn app() -> Router {
    app_with(Provider::Simulated)
}

pub fn app_with(provider: Provider) -> Router {
    let events: Vec<Event> = serde_json::from_str(include_str!("../../data/events.json"))
        .expect("valid embedded demo events");
    Router::new()
        .route("/api/health", get(health))
        .route("/api/config", get(|| async { Json(demo_config()) }))
        .route("/api/plan", post(plan))
        .route("/api/validate", post(validate))
        .route("/api/enroll", post(enroll))
        .layer(DefaultBodyLimit::max(32 * 1024))
        .with_state(Arc::new(AppState { events, provider }))
        .fallback_service(ServeDir::new(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist"),
        ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use watsonx::tests::{Behavior, TEST_KEY, mock};

    #[tokio::test]
    async fn interpreter_reset_clears_followup_constraints() {
        let previous = Constraints {
            days: Some(vec![1]),
            food: Some("Free meal".into()),
            ..Default::default()
        };
        let actual = SimulatedInterpreter.interpret("start over", previous).await;
        let actual = actual.unwrap();
        assert_eq!(actual.constraints, Constraints::default());
        assert!(actual.understood);
    }

    /// Serves `app_with` a watsonx provider backed by a local mock and posts one plan request.
    async fn plan_with_watsonx(behavior: Behavior, message: &str) -> (Value, Value) {
        let (config, _) = mock(behavior).await;
        let router = app_with(Provider::Watsonx(Box::new(
            WatsonxInterpreter::new(config).unwrap(),
        )));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        let client = reqwest::Client::new();
        let empty = json!({"plan":[],"cancelled":[],"interests":[],"blocks":[],"buffer":0});
        let response = client
            .post(format!("{base}/api/plan"))
            .json(&json!({"message":message,"state":empty}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let text = response.text().await.unwrap();
        assert!(!text.contains(TEST_KEY) && !text.contains("mock-token"));
        let health: Value = client
            .get(format!("{base}/api/health"))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        (serde_json::from_str(&text).unwrap(), health)
    }

    #[tokio::test]
    async fn watsonx_constraints_drive_trusted_matching() {
        let (body, health) = plan_with_watsonx(
            Behavior::Reply(r#"{"topics":["Career"],"limit":1}"#),
            "jobs",
        )
        .await;
        assert_eq!(body["mode"], "watsonx");
        assert_eq!(
            body["provider"],
            format!("watsonx:{}", watsonx::DEFAULT_MODEL_ID)
        );
        assert!(body.get("notice").is_none());
        let state = Schedule::default();
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let expected: Vec<_> = planner::recommend(
            &state,
            &Constraints {
                topics: Some(vec!["Career".into()]),
                limit: Some(1),
                ..Default::default()
            },
            &events,
        )
        .iter()
        .map(|e| json!(e.id))
        .collect();
        assert_eq!(body["event_ids"], json!(expected));
        assert_eq!(health["watsonx_connected"], true);
    }

    #[tokio::test]
    async fn numeric_budget_clarification_does_not_depend_on_the_model() {
        // The mock would answer with a valid plan; the rules must stop the request first.
        let (body, health) = plan_with_watsonx(
            Behavior::Reply(r#"{"topics":["Arts & culture"]}"#),
            "arts on Wednesday evening under $5",
        )
        .await;
        assert_eq!(body["mode"], "simulated");
        assert!(
            body["clarification"]
                .as_str()
                .unwrap()
                .contains("Numeric budgets")
        );
        assert_eq!(body["event_ids"], json!([]));
        assert!(body.get("notice").is_none());
        assert_eq!(health["watsonx_connected"], false, "model was not called");
    }

    #[tokio::test]
    async fn watsonx_failures_fall_back_with_a_visible_label() {
        for behavior in [
            Behavior::IamRejects,
            Behavior::ChatStatus(500),
            Behavior::Slow,
            Behavior::Reply(r#"{"event_ids":["e1"]}"#),
            Behavior::Reply(r#"{"limit":99}"#),
        ] {
            let (body, health) = plan_with_watsonx(behavior, "AI on Tuesday").await;
            assert_eq!(body["mode"], "simulated");
            assert_eq!(body["provider"], "rust-rules");
            assert_eq!(body["notice"], WATSONX_FALLBACK_NOTICE);
            let simulated = SimulatedInterpreter
                .parse("AI on Tuesday", Constraints::default())
                .constraints;
            assert_eq!(body["constraints"], json!(simulated));
            assert_eq!(health["mode"], "watsonx");
            assert_eq!(health["watsonx_connected"], false);
        }
    }
    #[test]
    fn travel_buffer_boundary_is_non_overlapping() {
        assert!(planner::overlap(0, 600, 660, 0, 670, 720, 15));
        assert!(!planner::overlap(0, 600, 660, 0, 675, 720, 15));
    }
    #[test]
    fn model_output_cannot_set_arbitrary_limits_or_fields() {
        assert!(serde_json::from_str::<Constraints>(r#"{"event_ids":["invented"]}"#).is_err());
        assert!(
            Constraints {
                limit: Some(99),
                ..Default::default()
            }
            .validate()
            .is_err()
        );
    }
}
