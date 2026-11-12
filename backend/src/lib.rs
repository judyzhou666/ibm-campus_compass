pub mod interpreter;
pub mod model;
pub mod planner;
pub mod watsonx;
use watsonx::RankError;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    routing::{get, post},
};
use interpreter::{Interpreter, SimulatedInterpreter};
use model::{Constraints, Event, EventUpdate, PlanProfile, Schedule};
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
    all_updates: Vec<EventUpdate>,
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
    #[serde(default)]
    continuation: bool,
    state: Schedule,
    #[serde(default)]
    profile: PlanProfile,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ValidateRequest {
    event_id: String,
    state: Schedule,
}

/// Builds template-evidence (ids + evidence) from the deterministic candidate list.
fn template_evidence(
    selected: &[&Event],
    state: &model::Schedule,
    constraints: &model::Constraints,
    events: &[Event],
) -> (Vec<String>, Vec<Value>) {
    let ids: Vec<_> = selected.iter().map(|e| e.id.clone()).collect();
    let evidence: Vec<_> = selected
        .iter()
        .map(|e| planner::evidence(e, state, constraints, events))
        .collect();
    (ids, evidence)
}

/// Post-checks applied after a successful watsonx ranking step.
///
/// 1. Goal-type coverage: if the student selected goal types and a type is not
///    covered by the ranked picks but a feasible candidate has it, append that
///    candidate with a template reason (total ≤ 5 picks).
/// 2. Host-school disclosure: if an event's host_school differs from the
///    student's major and the reason does not already mention it, append
///    "Hosted by <host_school>." to the reason.
fn apply_post_checks(
    ranked: &[watsonx::RankedPick],
    candidates: &[&Event],
    profile: &model::PlanProfile,
    events: &[Event],
) -> Vec<watsonx::RankedPick> {
    let mut result = ranked.to_vec();

    // 1. Goal-type coverage gap: add one candidate per missing type (max 5 total).
    if !profile.goal_types.is_empty() {
        for goal in &profile.goal_types {
            if result.len() >= 5 {
                break;
            }
            let already_covered = result.iter().any(|r| {
                candidates
                    .iter()
                    .find(|e| e.id == r.id)
                    .map(|e| e.goal_type.contains(goal))
                    .unwrap_or(false)
            });
            if already_covered {
                continue;
            }
            // Find a feasible candidate with this goal_type not already picked.
            let picked_ids: Vec<_> = result.iter().map(|r| r.id.as_str()).collect();
            if let Some(extra) = candidates
                .iter()
                .find(|e| !picked_ids.contains(&e.id.as_str()) && e.goal_type.contains(goal))
            {
                let reason = format!(
                    "{}: {} — {}",
                    if extra.goal_type.contains(goal) {
                        "Covers your goal type"
                    } else {
                        "Added for goal coverage"
                    },
                    goal,
                    extra.description
                );
                result.push(watsonx::RankedPick {
                    id: extra.id.clone(),
                    reason,
                    cited_fields: vec!["goal_type".into(), "description".into()],
                });
            }
        }
    }

    // 2. Host-school disclosure: append "Hosted by <school>." when needed.
    let major_lower = profile.major.to_lowercase();
    for pick in &mut result {
        let event_ref: Option<&Event> = candidates
            .iter()
            .find(|e| e.id == pick.id)
            .copied()
            .or_else(|| events.iter().find(|e| e.id == pick.id));
        if let Some(event) = event_ref {
            if event.host_school.is_empty() {
                continue;
            }
            let school_lower = event.host_school.to_lowercase();
            // Differ: host_school does not match major, and reason doesn't mention it.
            if !major_lower.is_empty()
                && school_lower != major_lower
                && !pick.reason.to_lowercase().contains(&school_lower)
            {
                pick.reason = format!(
                    "{} Hosted by {}.",
                    pick.reason.trim_end_matches('.'),
                    event.host_school
                );
            }
        }
    }

    result
}

/// Folds the browser's applied synthetic updates into the request: update-cancelled events
/// join `cancelled`, and the returned catalog carries moved times and update-full access.
fn effective_inputs<'a>(
    state: &'a Schedule,
    all_updates: &[EventUpdate],
    events: &[Event],
) -> (std::borrow::Cow<'a, Schedule>, Vec<Event>) {
    let ids = &state.applied_update_ids;
    let cancelled = model::unavailable_by_updates(ids, all_updates);
    let effective_state = if cancelled
        .iter()
        .all(|id| state.cancelled.iter().any(|c| c == id))
    {
        std::borrow::Cow::Borrowed(state)
    } else {
        let mut s = state.clone();
        for id in cancelled {
            if !s.cancelled.iter().any(|c| c == id) {
                s.cancelled.push(id.to_string());
            }
        }
        std::borrow::Cow::Owned(s)
    };
    (
        effective_state,
        model::apply_event_updates(ids, all_updates, events),
    )
}

async fn plan(
    State(app): Shared,
    Json(request): Json<PlanRequest>,
) -> Result<Json<Value>, ApiError> {
    let events = &app.events;
    let all_updates = &app.all_updates;
    if request.message.trim().is_empty() || request.message.len() > 2000 {
        return Err(bad_request("Message must contain 1–2000 bytes"));
    }
    request
        .state
        .validate_with_updates(events, all_updates)
        .map_err(bad_request)?;
    request.previous.validate().map_err(bad_request)?;
    request.profile.validate().map_err(bad_request)?;
    let (effective_state, effective_events_owned) =
        effective_inputs(&request.state, all_updates, events);
    let effective_events: &[Event] = &effective_events_owned;
    // Deterministic safety rules (such as refusing unsupported numeric budgets) run before any
    // live model call, so a clarification never depends on the model.
    let simulated = SimulatedInterpreter.parse_with_context(
        &request.message,
        request.previous.clone(),
        request.continuation,
    );
    let (interpretation, mode, provider, notice) = match &app.provider {
        Provider::Watsonx(live) if simulated.clarification.is_none() => match live
            .interpret(&request.message, request.previous.clone())
            .await
        {
            Ok(mut i) => {
                // Model extraction cannot override deterministic selection policy, including
                // explicit continuation/reset decisions or the overlap-free default.
                i.constraints.mode = simulated.constraints.mode;
                i.constraints.explore = simulated.constraints.explore;
                (i, "watsonx", format!("watsonx:{}", live.model_id()), None)
            }
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
    let batch = if interpretation.understood && interpretation.clarification.is_none() {
        planner::recommend_with_details(&effective_state, &constraints, effective_events)
    } else {
        planner::RecommendationBatch::default()
    };
    let selected: Vec<&Event> = batch.recommendations.iter().map(|r| r.event).collect();

    // Second watsonx step: rank feasible candidates and produce narrative reasons.
    // Falls back to template evidence with an honest label when unavailable or invalid.
    let (ranked_ids, evidence, ranking_clarification, explanations) =
        if let Provider::Watsonx(live) = &app.provider {
            if interpretation.understood && interpretation.clarification.is_none() {
                match live
                    .rank_candidates(
                        &request.message,
                        &selected,
                        &request.profile,
                        effective_events,
                    )
                    .await
                {
                    Ok(ranked) => {
                        let ranked = apply_post_checks(
                            &ranked,
                            &selected,
                            &request.profile,
                            effective_events,
                        );
                        let ids: Vec<_> = ranked.iter().map(|r| r.id.clone()).collect();
                        let evidence: Vec<_> = ranked
                            .iter()
                            .filter_map(|r| {
                                selected.iter().find(|e| e.id == r.id).map(|e| {
                                    let mut ev = planner::evidence(
                                        e,
                                        &effective_state,
                                        &constraints,
                                        effective_events,
                                    );
                                    ev["ai_reason"] = json!(r.reason);
                                    ev["cited_fields"] = json!(r.cited_fields);
                                    ev
                                })
                            })
                            .collect();
                        (ids, evidence, None, "watsonx")
                    }
                    Err(RankError::Clarification(q)) => {
                        let (ids, ev) = template_evidence(
                            &selected,
                            &effective_state,
                            &constraints,
                            effective_events,
                        );
                        (ids, ev, Some(q), "template")
                    }
                    Err(_) => {
                        // Ranking unavailable: fall back to template evidence (labelled).
                        let (ids, ev) = template_evidence(
                            &selected,
                            &effective_state,
                            &constraints,
                            effective_events,
                        );
                        (ids, ev, None, "template")
                    }
                }
            } else {
                let (ids, ev) =
                    template_evidence(&selected, &effective_state, &constraints, effective_events);
                (ids, ev, None, "template")
            }
        } else {
            let (ids, ev) =
                template_evidence(&selected, &effective_state, &constraints, effective_events);
            (ids, ev, None, "template")
        };

    // Ranking clarification takes precedence over an empty result diagnostic.
    let clarification = interpretation.clarification.or(ranking_clarification);
    let diagnostic =
        if interpretation.understood && clarification.is_none() && ranked_ids.is_empty() {
            Some(planner::no_match_reason(
                &effective_state,
                &constraints,
                effective_events,
            ))
        } else {
            None
        };
    let mut body = json!({
        "mode":mode, "provider":provider, "constraints":constraints,
        "understood":interpretation.understood, "clarification":clarification,
        "event_ids":ranked_ids, "recommendations":evidence, "diagnostic":diagnostic,
        "explanations":explanations,
        "match_reasons": ranked_ids.iter().filter_map(|id| batch.recommendations.iter().find(|r| r.event.id == *id).map(|r| json!({"event_id":r.event.id,"score":r.details.score,"matches":r.details.matches}))).collect::<Vec<_>>()
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
    let all_updates = &app.all_updates;
    request
        .state
        .validate_with_updates(events, all_updates)
        .map_err(bad_request)?;
    let (effective_state, effective_events_owned) =
        effective_inputs(&request.state, all_updates, events);
    let effective_events: &[Event] = &effective_events_owned;
    let event = effective_events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    let issue = planner::issue(event, &effective_state, effective_events);
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
    let all_updates = &app.all_updates;
    request
        .state
        .validate_with_updates(events, all_updates)
        .map_err(bad_request)?;
    let (effective_state, effective_events_owned) =
        effective_inputs(&request.state, all_updates, events);
    let effective_events: &[Event] = &effective_events_owned;
    let event = effective_events
        .iter()
        .find(|e| e.id == request.event_id)
        .ok_or_else(|| bad_request("Unknown event ID"))?;
    if let Some(problem) = planner::issue(event, &effective_state, effective_events) {
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
    let all_update_batches: Vec<model::UpdateBatch> =
        serde_json::from_str(include_str!("../../data/updates.json"))
            .expect("valid embedded demo updates");
    let all_updates: Vec<EventUpdate> = all_update_batches
        .into_iter()
        .flat_map(|b| b.updates)
        .collect();
    Router::new()
        .route("/api/health", get(health))
        .route("/api/config", get(|| async { Json(demo_config()) }))
        .route("/api/plan", post(plan))
        .route("/api/validate", post(validate))
        .route("/api/enroll", post(enroll))
        .layer(DefaultBodyLimit::max(32 * 1024))
        .with_state(Arc::new(AppState {
            events,
            all_updates,
            provider,
        }))
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
        plan_with_context(behavior, message, json!({}), false).await
    }

    async fn plan_with_context(
        behavior: Behavior,
        message: &str,
        previous: Value,
        continuation: bool,
    ) -> (Value, Value) {
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
            .json(&json!({"message":message,"state":empty,"previous":previous,"continuation":continuation}))
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
        let body: Value = serde_json::from_str(&text).unwrap();
        assert!(body.get("matchReasons").is_none());
        assert_eq!(text.matches("\"match_reasons\":").count(), 1);
        let constraints: Constraints = serde_json::from_value(body["constraints"].clone()).unwrap();
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let batch = if body["understood"] == true && body["clarification"].is_null() {
            planner::recommend_with_details(&Schedule::default(), &constraints, &events)
        } else {
            planner::RecommendationBatch::default()
        };
        let reasons: Vec<_> = batch.recommendations.iter().map(|r| {
            json!({"event_id":r.event.id,"score":r.details.score,"matches":r.details.matches})
        }).collect();
        assert_eq!(body["match_reasons"], json!(reasons));
        (body, health)
    }

    #[tokio::test]
    async fn mocked_watsonx_cannot_replace_rule_based_mode_and_exploration() {
        for (message, previous, continuation, mode, explore) in [
            (
                "Explore beyond my interests",
                json!({}),
                false,
                json!("discovery"),
                json!(true),
            ),
            (
                "Build my weekly plan to explore career options",
                json!({}),
                false,
                json!("plan-building"),
                Value::Null,
            ),
            (
                "Explore social events to make friends this week",
                json!({}),
                false,
                json!("discovery"),
                Value::Null,
            ),
            (
                "after 3 PM",
                json!({"explore":true,"mode":"discovery"}),
                true,
                json!("discovery"),
                json!(true),
            ),
            (
                "Find events",
                json!({"explore":true,"mode":"discovery","after":900}),
                true,
                json!("discovery"),
                json!(true),
            ),
            (
                "Tuesday afternoon events",
                json!({"explore":true,"mode":"discovery"}),
                false,
                Value::Null,
                Value::Null,
            ),
            (
                "reset",
                json!({"explore":true,"mode":"discovery"}),
                true,
                Value::Null,
                Value::Null,
            ),
        ] {
            // Deliberately conflicting selection policy from a fake model.
            let (body, _) = plan_with_context(
                Behavior::Reply(r#"{"mode":"plan-building","explore":false}"#),
                message,
                previous,
                continuation,
            )
            .await;
            assert_eq!(body["mode"], "watsonx", "{message}");
            assert_eq!(body["constraints"]["mode"], mode, "{message}");
            assert_eq!(body["constraints"]["explore"], explore, "{message}");
        }
        let (body, health) =
            plan_with_watsonx(Behavior::Reply("{}"), "Explore beyond my interests after 3").await;
        assert!(body["clarification"].as_str().unwrap().contains("AM"));
        assert_eq!(body["constraints"]["explore"], true);
        assert_eq!(health["watsonx_connected"], false);
    }

    #[tokio::test]
    async fn merged_two_stage_route_preserves_profile_ranking_and_structured_reasons() {
        let (config, handle) = mock(Behavior::Stages(
            r#"{"topics":["Career"],"days":["Tuesday"],"after":780,"limit":1}"#,
            r#"{"picks":[{"id":"e7","reason":"Career discussion; access not confirmed.","cited_fields":["title","goal_type"]}]}"#,
        )).await;
        let router = app_with(Provider::Watsonx(Box::new(
            WatsonxInterpreter::new(config).unwrap(),
        )));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        let response=reqwest::Client::new().post(format!("{base}/api/plan")).json(&json!({
          "message":"Career events on Tuesday after 1 PM",
          "profile":{"major":"Education","goals":"Research opportunities","goal_types":["research"]},
          "state":{"plan":[],"cancelled":[],"interests":[],"blocks":[],"buffer":0}
        })).send().await.unwrap();
        assert_eq!(response.status(), 200);
        let body: Value = response.json().await.unwrap();
        assert_eq!(body["mode"], "watsonx");
        assert_eq!(body["explanations"], "watsonx");
        assert_eq!(body["event_ids"], json!(["e7"]));
        assert_eq!(body["match_reasons"][0]["event_id"], "e7");
        assert!(
            body["recommendations"][0]["ai_reason"]
                .as_str()
                .unwrap()
                .contains("Career discussion")
        );
        assert_eq!(
            body["recommendations"][0]["cited_fields"],
            json!(["title", "goal_type"])
        );
        let calls = handle.chat_bodies.lock().unwrap();
        assert_eq!(calls.len(), 2);
        let user: Value =
            serde_json::from_str(calls[1]["messages"][1]["content"].as_str().unwrap()).unwrap();
        assert_eq!(user["major"], "Education");
        assert_eq!(user["goals"], "Research opportunities");
        assert_eq!(user["goal_types"], json!(["research"]));
        assert!(user.get("name").is_none());
        assert!(user.get("messages").is_none());
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

    // ──────────────────────────────────────────────────────────────────────
    // apply_post_checks unit tests
    // ──────────────────────────────────────────────────────────────────────

    fn make_pick(id: &str, reason: &str) -> watsonx::RankedPick {
        watsonx::RankedPick {
            id: id.into(),
            reason: reason.into(),
            cited_fields: vec!["title".into()],
        }
    }

    fn make_event_with(id: &str, goal_type: Vec<&str>, host_school: &str) -> Event {
        Event {
            id: id.into(),
            title: "Event".into(),
            day: 1,
            start: 900,
            end: 990,
            topic: "Career".into(),
            category: "Career".into(),
            participation: crate::model::ParticipationFormat::Unknown,
            food: "None".into(),
            cost: 0,
            access: "open".into(),
            rsvp: "Drop-in welcome".into(),
            location: "Room 1".into(),
            description: "Sample description.".into(),
            source: "test".into(),
            verification_status: "Fictional".into(),
            eligibility: "Open".into(),
            host_school: host_school.into(),
            goal_type: goal_type.into_iter().map(|s| s.into()).collect(),
            access_conditions: serde_json::json!(null),
        }
    }

    #[test]
    fn post_check_appends_missing_goal_type_candidate() {
        // Ranked pick covers "industry" but not "research".
        let e1 = make_event_with("e1", vec!["industry"], "Engineering");
        let e2 = make_event_with("e2", vec!["research"], "Science");
        let ranked = vec![make_pick("e1", "Good industry event.")];
        let candidates: Vec<&Event> = vec![&e1, &e2];
        let profile = model::PlanProfile {
            major: "Engineering".into(),
            goals: "".into(),
            goal_types: vec!["industry".into(), "research".into()],
        };
        let result = apply_post_checks(&ranked, &candidates, &profile, &[e1.clone(), e2.clone()]);
        // Should append e2 for research coverage.
        assert_eq!(
            result.len(),
            2,
            "should have appended e2 for research coverage"
        );
        assert_eq!(result[1].id, "e2");
        assert!(result[1].reason.contains("research"));
    }

    #[test]
    fn post_check_does_not_exceed_five_picks() {
        let events: Vec<Event> = (0..6)
            .map(|i| make_event_with(&format!("e{i}"), vec!["research"], "Science"))
            .collect();
        // Start with 5 already ranked.
        let ranked: Vec<_> = (0..5)
            .map(|i| make_pick(&format!("e{i}"), "good"))
            .collect();
        let candidates: Vec<&Event> = events.iter().collect();
        let profile = model::PlanProfile {
            major: "".into(),
            goals: "".into(),
            goal_types: vec!["research".into()],
        };
        let result = apply_post_checks(&ranked, &candidates, &profile, &events);
        // Already ≥5 picks — must not grow.
        assert_eq!(result.len(), 5);
    }

    #[test]
    fn post_check_appends_host_school_to_reason() {
        let e1 = make_event_with("e1", vec!["industry"], "School of Design");
        let candidates: Vec<&Event> = vec![&e1];
        let ranked = vec![make_pick("e1", "Great career event.")];
        let profile = model::PlanProfile {
            major: "Engineering".into(),
            goals: "".into(),
            goal_types: vec![],
        };
        let result = apply_post_checks(&ranked, &candidates, &profile, std::slice::from_ref(&e1));
        assert!(
            result[0].reason.contains("School of Design"),
            "reason should mention host_school; got: {}",
            result[0].reason,
        );
    }

    #[test]
    fn post_check_skips_host_school_when_already_mentioned() {
        let e1 = make_event_with("e1", vec!["industry"], "School of Design");
        let candidates: Vec<&Event> = vec![&e1];
        let ranked = vec![make_pick("e1", "From the School of Design, great event.")];
        let profile = model::PlanProfile {
            major: "Engineering".into(),
            goals: "".into(),
            goal_types: vec![],
        };
        let result = apply_post_checks(&ranked, &candidates, &profile, std::slice::from_ref(&e1));
        // Reason already contains school name — must not be appended again.
        let count = result[0].reason.match_indices("School of Design").count();
        assert_eq!(count, 1, "host_school should not be duplicated");
    }

    #[test]
    fn post_check_skips_host_school_when_matches_major() {
        let e1 = make_event_with("e1", vec!["industry"], "Engineering");
        let candidates: Vec<&Event> = vec![&e1];
        let ranked = vec![make_pick("e1", "Good event.")];
        let profile = model::PlanProfile {
            major: "Engineering".into(),
            goals: "".into(),
            goal_types: vec![],
        };
        let result = apply_post_checks(&ranked, &candidates, &profile, std::slice::from_ref(&e1));
        // host_school matches major (case-insensitive) — no need to disclose.
        assert!(!result[0].reason.contains("Hosted by"));
    }

    // ──────────────────────────────────────────────────────────────────────
    // Update-loop integration tests
    // ──────────────────────────────────────────────────────────────────────

    /// Helper: start a plain simulated app() server and post a plan request with given state.
    async fn plan_with_state(state_json: Value) -> reqwest::Response {
        let router = app();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        reqwest::Client::new()
            .post(format!("{base}/api/plan"))
            .json(&json!({"message": "career events", "state": state_json}))
            .send()
            .await
            .unwrap()
    }

    /// Helper: start a plain simulated app() server and post a validate request.
    async fn validate_with_state(event_id: &str, state_json: Value) -> reqwest::Response {
        let router = app();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        reqwest::Client::new()
            .post(format!("{base}/api/validate"))
            .json(&json!({"event_id": event_id, "state": state_json}))
            .send()
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn update_cancelled_event_excluded_from_plan() {
        // u1 cancels e3 ("Your first role in responsible tech")
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": ["Career"],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u1"]
        });
        let resp = plan_with_state(state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        let ids = body["event_ids"].as_array().unwrap();
        assert!(
            !ids.iter().any(|v| v.as_str() == Some("e3")),
            "e3 should be excluded because update u1 cancels it; got {ids:?}"
        );
    }

    #[tokio::test]
    async fn update_full_event_excluded_from_plan() {
        // u2 marks e6 as full
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": ["Social"],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u2"]
        });
        let resp = plan_with_state(state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        let ids = body["event_ids"].as_array().unwrap();
        assert!(
            !ids.iter().any(|v| v.as_str() == Some("e6")),
            "e6 should be excluded because update u2 marks it full; got {ids:?}"
        );
    }

    #[tokio::test]
    async fn unknown_update_id_is_rejected() {
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": [],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u-does-not-exist"]
        });
        let resp = plan_with_state(state).await;
        assert_eq!(resp.status(), 400, "unknown update ID must be rejected");
    }

    #[tokio::test]
    async fn validate_returns_unavailable_for_update_cancelled_event() {
        // u1 cancels e3
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": [],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u1"]
        });
        let resp = validate_with_state("e3", state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        assert_eq!(body["allowed"], false, "e3 must be unavailable after u1");
    }

    #[tokio::test]
    async fn validate_returns_unavailable_for_update_full_event() {
        // u2 marks e6 as full
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": [],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u2"]
        });
        let resp = validate_with_state("e6", state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        assert_eq!(body["allowed"], false, "e6 must be unavailable after u2");
        assert_eq!(body["issue"], "Event is full");
    }

    #[tokio::test]
    async fn update_ids_without_effect_do_not_break_plan() {
        // u3 (time_moved) and u4 (room_changed) do not make events unavailable.
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": ["AI & education"],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u3", "u4"]
        });
        let resp = plan_with_state(state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        // e1 (time_moved by u3) and e9 (room_changed by u4) should still be eligible.
        let ids = body["event_ids"].as_array().unwrap();
        assert!(
            !ids.is_empty(),
            "should still return results with time/room updates"
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fix A: time_moved effective time tests
    // ──────────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn time_moved_event_uses_new_times_for_conflict_detection() {
        // u3 moves e1 (originally Tue 15:00–16:30, start=900, end=990)
        // to 10:30–12:00 (start=630, end=720).
        // A block from 10:00–11:30 (600–690) on Tuesday (day=1) should conflict
        // with the new slot 630–720 but NOT with the original 900–990.
        let state = json!({
            "plan": ["e1"],
            "cancelled": [],
            "interests": [],
            "blocks": [{"title": "Morning seminar", "day": 1, "start": 600, "end": 690}],
            "buffer": 0,
            "applied_update_ids": ["u3"]
        });
        let resp = validate_with_state("e1", state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        assert_eq!(
            body["allowed"], false,
            "e1 after time_moved must conflict with overlapping block; got: {body}"
        );
        assert!(
            body["issue"].as_str().unwrap_or("").contains("Conflicts"),
            "issue should mention Conflicts; got: {}",
            body["issue"]
        );
    }

    #[tokio::test]
    async fn time_moved_event_no_conflict_without_block() {
        // Same u3 update but no overlapping block — e1 should be allowed.
        let state = json!({
            "plan": ["e1"],
            "cancelled": [],
            "interests": [],
            "blocks": [],
            "buffer": 0,
            "applied_update_ids": ["u3"]
        });
        let resp = validate_with_state("e1", state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        assert_eq!(
            body["allowed"], true,
            "e1 after time_moved with no conflicting block must be allowed; got: {body}"
        );
    }

    #[tokio::test]
    async fn time_moved_conflict_excludes_event_from_plan() {
        // u3 moves e1 to 630–720 on Tuesday.
        // A block 600–690 on Tuesday means e1 is now in conflict,
        // so the planner must not recommend it.
        let state = json!({
            "plan": [],
            "cancelled": [],
            "interests": ["AI & education"],
            "blocks": [{"title": "Morning seminar", "day": 1, "start": 600, "end": 690}],
            "buffer": 0,
            "applied_update_ids": ["u3"]
        });
        let resp = plan_with_state(state).await;
        assert_eq!(resp.status(), 200);
        let body: Value = resp.json().await.unwrap();
        let ids = body["event_ids"].as_array().unwrap();
        assert!(
            !ids.iter().any(|v| v.as_str() == Some("e1")),
            "e1 must be excluded after time_moved causes a conflict; got {ids:?}"
        );
    }

    // model.rs unit test for apply_event_updates
    #[test]
    fn apply_event_updates_overrides_start_end() {
        use model::{EventUpdate, apply_event_updates};
        let events: Vec<model::Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let updates: Vec<Vec<EventUpdate>> =
            serde_json::from_str::<Vec<serde_json::Value>>(include_str!("../../data/updates.json"))
                .unwrap()
                .iter()
                .map(|b| serde_json::from_value::<Vec<EventUpdate>>(b["updates"].clone()).unwrap())
                .collect();
        let all_updates: Vec<EventUpdate> = updates.into_iter().flatten().collect();
        // u3 moves e1: new_start=630, new_end=720
        let effective = apply_event_updates(&["u3".to_string()], &all_updates, &events);
        let e1 = effective.iter().find(|e| e.id == "e1").unwrap();
        assert_eq!(e1.start, 630, "e1 start must be 630 after u3");
        assert_eq!(e1.end, 720, "e1 end must be 720 after u3");
        // Without applying u3, original times should be used.
        let original = apply_event_updates(&[], &all_updates, &events);
        let e1_orig = original.iter().find(|e| e.id == "e1").unwrap();
        let catalog_e1 = events.iter().find(|e| e.id == "e1").unwrap();
        assert_eq!(e1_orig.start, catalog_e1.start);
        assert_eq!(e1_orig.end, catalog_e1.end);
    }
}
