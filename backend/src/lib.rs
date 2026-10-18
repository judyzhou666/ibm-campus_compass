pub mod interpreter;
pub mod model;
pub mod planner;

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

type ApiError = (StatusCode, Json<Value>);
fn bad_request(message: &str) -> ApiError {
    (StatusCode::BAD_REQUEST, Json(json!({"error":message})))
}

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
    State(events): State<Arc<Vec<Event>>>,
    Json(request): Json<PlanRequest>,
) -> Result<Json<Value>, ApiError> {
    if request.message.trim().is_empty() || request.message.len() > 2000 {
        return Err(bad_request("Message must contain 1–2000 bytes"));
    }
    request.state.validate(&events).map_err(bad_request)?;
    request.previous.validate().map_err(bad_request)?;
    let interpretation = SimulatedInterpreter
        .interpret(&request.message, request.previous)
        .await;
    let constraints = interpretation.constraints;
    // This validation is also required for any future watsonx-generated constraints.
    constraints.validate().map_err(bad_request)?;
    let ids: Vec<_> = if interpretation.understood {
        planner::recommend(&request.state, &constraints, &events)
    } else {
        Vec::new()
    }
    .iter()
    .map(|e| &e.id)
    .collect();
    Ok(Json(
        json!({"mode":"simulated", "provider":"rust-rules", "constraints":constraints, "understood":interpretation.understood, "event_ids":ids}),
    ))
}

async fn validate(
    State(events): State<Arc<Vec<Event>>>,
    Json(request): Json<ValidateRequest>,
) -> Result<Json<Value>, ApiError> {
    request.state.validate(&events).map_err(bad_request)?;
    let event = events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    let issue = planner::issue(event, &request.state, &events);
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
    State(events): State<Arc<Vec<Event>>>,
    Json(request): Json<EnrollmentRequest>,
) -> Result<Json<Value>, ApiError> {
    request.state.validate(&events).map_err(bad_request)?;
    let event = events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    if let Some(problem) = planner::issue(event, &request.state, &events) {
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

pub fn app() -> Router {
    let events: Vec<Event> = serde_json::from_str(include_str!("../../data/events.json"))
        .expect("valid embedded demo events");
    Router::new()
        .route("/api/health",get(|| async { Json(json!({"status":"ok","mode":"simulated","provider":"rust-rules","watsonx_connected":false})) }))
        .route("/api/plan",post(plan))
        .route("/api/validate",post(validate))
        .route("/api/enroll",post(enroll))
        .layer(DefaultBodyLimit::max(32*1024))
        .with_state(Arc::new(events))
        .fallback_service(ServeDir::new(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist")))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn interpreter_reset_clears_followup_constraints() {
        let previous = Constraints {
            days: Some(vec![1]),
            food: Some("Free meal".into()),
            ..Default::default()
        };
        let actual = SimulatedInterpreter.interpret("start over", previous).await;
        assert_eq!(actual.constraints, Constraints::default());
        assert!(actual.understood);
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
