use crate::model::{Constraints, Event, Schedule};

pub fn overlap(
    day: u8,
    start: u16,
    end: u16,
    other_day: u8,
    other_start: u16,
    other_end: u16,
    buffer: u16,
) -> bool {
    day == other_day && start < other_end + buffer && other_start < end + buffer
}

pub fn active_topics(state: &Schedule) -> Vec<String> {
    let mut topics = state.interests.clone();
    if let Some(p) = &state.preferences {
        topics.extend(p.goal_topics.clone());
        topics.extend(p.learning_topics.clone());
    }
    topics.sort();
    topics.dedup();
    topics
}
pub const RANKING_WEIGHTS: [(&str, u8); 8] = [
    ("topic", 10),
    ("diversity", 4),
    ("learning", 6),
    ("goal", 3),
    ("primary", 2),
    ("participation", 2),
    ("preferred_time", 2),
    ("free", 1),
];

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct RecommendationMatch {
    pub kind: &'static str,
    pub points: u8,
    pub explanation: String,
}
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct RankingDetails {
    pub score: u8,
    pub matches: Vec<RecommendationMatch>,
}

/// Ranking facts only: eligibility, hard filters and pairwise buffers remain authoritative.
pub fn ranking_details(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    selected: &[&Event],
) -> RankingDetails {
    let active = active_topics(state);
    let current = c.topics.as_ref().filter(|t| !t.is_empty());
    let topics = current.unwrap_or(&active);
    let topic_match = topics.contains(&e.topic);
    let mut matches = Vec::new();
    let mut add = |kind: &'static str, condition: bool, explanation: String| {
        if condition {
            let points = RANKING_WEIGHTS
                .iter()
                .find(|(key, _)| *key == kind)
                .expect("known ranking reason")
                .1;
            matches.push(RecommendationMatch {
                kind,
                points,
                explanation,
            });
        }
    };
    add(
        "topic",
        topic_match,
        if current.is_some() {
            format!("Matches this search topic: {}", e.topic)
        } else {
            format!("Matches saved interests or enabled topics: {}", e.topic)
        },
    );
    add(
        "diversity",
        topic_match && !selected.iter().any(|other| other.topic == e.topic),
        "Adds a requested or saved topic not yet represented in these suggestions".into(),
    );
    add(
        "learning",
        state
            .preferences
            .as_ref()
            .is_some_and(|p| p.learning_topics.contains(&e.topic)),
        format!("Connects to your enabled confirmed {} topic", e.topic),
    );
    add(
        "goal",
        state
            .preferences
            .as_ref()
            .is_some_and(|p| p.goal_topics.contains(&e.topic)),
        format!(
            "Connects to an enabled structured goal mapped to {}",
            e.topic
        ),
    );
    add(
        "primary",
        state
            .preferences
            .as_ref()
            .is_some_and(|p| p.primary_topics.contains(&e.topic)),
        format!("Connects to your enabled primary-goal topic: {}", e.topic),
    );
    add(
        "participation",
        e.participation != crate::model::ParticipationFormat::Unknown
            && state.preferences.as_ref().is_some_and(|p| {
                p.participation
                    .iter()
                    .any(|s| s == e.participation.as_str())
            }),
        format!(
            "Matches your chosen fictional participation format: {}",
            e.participation.as_str()
        ),
    );
    add(
        "preferred_time",
        preferred(e, state),
        format!("Matches your preferred {} time", state.preferred_time),
    );
    add("free", e.cost == 0, "Free admission".into());
    RankingDetails {
        score: matches.iter().map(|m| m.points).sum(),
        matches,
    }
}

pub fn issue(event: &Event, state: &Schedule, events: &[Event]) -> Option<String> {
    if event.day > 4 || event.start >= event.end || event.end > 1440 {
        return Some("Invalid event metadata; team review required".into());
    }
    if !["RSVP required", "Drop-in welcome"].contains(&event.rsvp.as_str()) {
        return Some("RSVP requirements unknown; team review required".into());
    }
    if state.cancelled.contains(&event.id) {
        return Some("Cancelled in demo".into());
    }
    match event.access.as_str() {
        "full" => return Some("Event is full".into()),
        "members" => return Some("Membership not verified".into()),
        "open" => {}
        _ => return Some("Eligibility not confirmed".into()),
    }
    if let Some(p) = &state.preferences {
        if p.free_only && event.cost != 0 {
            return Some("Outside your saved free-admission requirement".into());
        }
        if !p.windows.is_empty()
            && !p
                .windows
                .iter()
                .any(|w| w.day == event.day && event.start >= w.start && event.end <= w.end)
        {
            return Some("Outside your saved available-only windows".into());
        }
    }
    let conflict = state
        .blocks
        .iter()
        .map(|b| (b.day, b.start, b.end, &b.title))
        .chain(
            events
                .iter()
                .filter(|e| {
                    state.plan.contains(&e.id)
                        && e.id != event.id
                        && !state.cancelled.contains(&e.id)
                })
                .map(|e| (e.day, e.start, e.end, &e.title)),
        )
        .find(|(d, s, e, _)| overlap(event.day, event.start, event.end, *d, *s, *e, state.buffer));
    conflict.map(|(_, _, _, title)| {
        format!(
            "Conflicts with {title}{}",
            if state.buffer > 0 {
                " (including travel time)"
            } else {
                ""
            }
        )
    })
}

fn matches_constraints(e: &Event, c: &Constraints) -> bool {
    c.topics
        .as_ref()
        .is_none_or(|t| t.is_empty() || t.contains(&e.topic))
        && c.days.as_ref().is_none_or(|d| d.contains(&e.day))
        && c.after.is_none_or(|t| e.start >= t)
        && c.before.is_none_or(|t| e.end <= t)
        && c.food.as_ref().is_none_or(|f| e.food == *f)
        && (c.free != Some(true) || e.cost == 0)
        && c.excluded.as_ref().is_none_or(|t| !t.contains(&e.topic))
}

pub fn recommend<'a>(state: &Schedule, c: &Constraints, events: &'a [Event]) -> Vec<&'a Event> {
    let active = active_topics(state);
    let mut candidates: Vec<_> = events
        .iter()
        .filter(|e| {
            !state.plan.contains(&e.id)
                && issue(e, state, events).is_none()
                && matches_constraints(e, c)
                && (c.explore != Some(true) || !active.contains(&e.topic))
                && state
                    .preferences
                    .as_ref()
                    .is_none_or(|p| !p.dismissed.contains(&e.id))
        })
        .collect();
    let mut selected: Vec<&Event> = Vec::new();
    while !candidates.is_empty()
        && selected.len()
            < c.limit
                .unwrap_or_else(|| state.preferences.as_ref().map_or(3, |p| p.count))
    {
        let best = candidates
            .iter()
            .enumerate()
            .filter(|(_, event)| {
                c.mode == Some(crate::model::RecommendationMode::Discovery)
                    || selected.iter().all(|other| {
                        !overlap(
                            event.day,
                            event.start,
                            event.end,
                            other.day,
                            other.start,
                            other.end,
                            state.buffer,
                        )
                    })
            })
            .max_by_key(|(index, e)| {
                (
                    ranking_details(e, state, c, &selected).score,
                    std::cmp::Reverse(e.day),
                    std::cmp::Reverse(e.start),
                    std::cmp::Reverse(e.id.clone()),
                    std::cmp::Reverse(*index),
                )
            })
            .map(|(index, _)| index);
        let Some(index) = best else {
            break;
        };
        selected.push(candidates.remove(index));
    }
    selected
}

fn preferred(e: &Event, state: &Schedule) -> bool {
    match state.preferred_time.as_str() {
        "morning" => e.end <= 720,
        "afternoon" => e.start >= 720 && e.end <= 1020,
        "evening" => e.start >= 1020,
        _ => false,
    }
}

fn clock(minutes: u16) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

pub fn evidence(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    events: &[Event],
) -> serde_json::Value {
    let active = active_topics(state);
    let topics = c
        .topics
        .as_ref()
        .filter(|t| !t.is_empty())
        .unwrap_or(&active);
    let comparison = events_comparison(e, state, c, events);
    let mut filters = Vec::new();
    if let Some(days) = &c.days {
        filters.push(format!(
            "days: {}",
            days.iter()
                .map(|d| [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday"
                ][usize::from(*d)])
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(t) = c.after {
        filters.push(format!("start at/after {}", clock(t)));
    }
    if let Some(t) = c.before {
        filters.push(format!("finish at/before {}", clock(t)));
    }
    if let Some(food) = &c.food {
        filters.push(format!("food: {food}"));
    }
    if c.free == Some(true) {
        filters.push("free admission".into());
    }
    let filter_summary = if filters.is_empty() {
        "No additional chat time/cost/food filters.".to_owned()
    } else {
        format!("Satisfied explicit filters: {}.", filters.join("; "))
    };
    serde_json::json!({
        "event_id": e.id,
        "learning_connection": if state.preferences.as_ref().is_some_and(|p|p.learning_topics.contains(&e.topic)){format!("Connects to your confirmed {} topic; this does not establish what you learned in class.",e.topic)}else{"No confirmed learning-topic connection used.".into()},
        "participation_fit": if e.participation.as_str()=="unknown" {"Participation format: Unknown; confirm before deciding.".into()}else{format!("Fictional participation format: {}. No belonging or ability is inferred.",e.participation.as_str())},
        "comparison": comparison,
        "discovery_context":format!("{} / {} opportunity. Open fictional access does not restrict participation by major; department membership and real eligibility are not inferred.", e.category, e.topic),
        "constraints_satisfied": c,
        "interest_match": format!("{}: {} — {}", if topics.contains(&e.topic) { "Interest match" } else { "Explore beyond your interests" }, e.topic, e.description),
        "schedule_fit": format!("{}, {}–{} {}; No conflict with the commitments you entered, including a {}-minute buffer. Preferred time {}. {}", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][usize::from(e.day)], clock(e.start), clock(e.end), crate::demo_config()["time_zone"].as_str().unwrap_or("Unknown"), state.buffer, if preferred(e,state) { "matched" } else { "not matched or unspecified" }, filter_summary),
        "practical": format!("${} admission · {} · {} · {} · {}", e.cost, e.location, e.rsvp, e.eligibility, e.food),
        "trade_offs": format!("{} minutes; {}. Food: {}. Capacity is not confirmed unless marked full. {}. Source: {}. Demo eligibility only; no real registration.", e.end-e.start, if e.cost == 0 { "no admission cost" } else { "paid admission" }, e.food, e.verification_status, e.source)
    })
}

fn events_comparison(e: &Event, state: &Schedule, c: &Constraints, events: &[Event]) -> String {
    let other = events.iter().find(|other| {
        other.id != e.id
            && other.topic == e.topic
            && issue(other, state, events).is_none()
            && matches_constraints(other, c)
            && !state.plan.contains(&other.id)
    });
    match other {
        Some(other) => format!("Compared with {}: ${} vs ${}; {} vs {} minutes; {} vs {}. These are feasible record-level trade-offs, not a claim of a universally better choice. Topic diversity and preferred times also affect ranking. Major and free-text goals are not interpreted. Only enabled structured goal and confirmed learning topics affect ranking.",other.title,e.cost,other.cost,e.end-e.start,other.end-other.start,e.rsvp,other.rsvp),
        None => "No other eligible option in this topic meets the same time/food/cost filters. Other topics may offer broader exploration. Major and free-text goals are not interpreted. Only enabled structured goal and confirmed learning topics affect ranking.".into(),
    }
}

pub fn no_match_reason(state: &Schedule, c: &Constraints, events: &[Event]) -> String {
    let within: Vec<_> = events
        .iter()
        .filter(|e| matches_constraints(e, c))
        .collect();
    if within.is_empty() {
        return "No synthetic catalog records satisfy these topic/day/time/cost/food filters. State which filter you want to change; none will be relaxed automatically.".into();
    }
    let mut conflicts = 0;
    let mut restrictions = 0;
    let mut cancelled = 0;
    let mut missing = 0;
    let mut already = 0;
    for e in within {
        if state.plan.contains(&e.id) {
            already += 1;
        }
        match issue(e, state, events).as_deref() {
            Some(s) if s.starts_with("Conflicts") => conflicts += 1,
            Some("Cancelled in demo") => cancelled += 1,
            Some(s) if s.contains("RSVP") || s.contains("metadata") => missing += 1,
            Some(_) => restrictions += 1,
            None => {}
        }
    }
    format!(
        "Within your filters: {conflicts} scheduling conflicts, {restrictions} full/restricted/unknown-eligibility records, {cancelled} cancellations, {missing} incomplete/invalid records, and {already} already-chosen events. No calendar changes made. Please explicitly choose which filter to change."
    )
}

#[cfg(test)]
mod evidence_tests {
    use super::*;
    #[test]
    fn diversity_never_overrides_eligibility_or_explicit_days() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let state = Schedule::default();
        let mut constraints = Constraints {
            topics: Some(vec![
                "AI & education".into(),
                "Career".into(),
                "Social".into(),
            ]),
            ..Default::default()
        };
        let selected = recommend(&state, &constraints, &events);
        assert_eq!(
            selected
                .iter()
                .map(|e| &e.topic)
                .collect::<std::collections::BTreeSet<_>>()
                .len(),
            3
        );
        assert!(selected.iter().all(|e| issue(e, &state, &events).is_none()));
        constraints.days = Some(vec![5, 6]);
        assert!(recommend(&state, &constraints, &events).is_empty());
    }
    #[test]
    fn invalid_records_and_unknown_rsvp_fail_closed() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let mut event = events[0].clone();
        event.rsvp = "Unknown".into();
        assert!(
            issue(&event, &Schedule::default(), &events)
                .unwrap()
                .contains("RSVP")
        );
        event.end = event.start;
        assert!(
            issue(&event, &Schedule::default(), &events)
                .unwrap()
                .contains("metadata")
        );
    }
    #[test]
    fn evidence_uses_catalog_facts_without_claiming_live_verification() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let state = Schedule {
            interests: vec!["AI & education".into()],
            buffer: 15,
            ..Default::default()
        };
        let selected = recommend(&state, &Constraints::default(), &events);
        assert!(!selected.is_empty());
        for e in selected {
            let proof = evidence(e, &state, &Constraints::default(), &events);
            assert_eq!(proof["event_id"], e.id);
            assert!(
                proof["interest_match"]
                    .as_str()
                    .unwrap()
                    .contains(&e.description)
            );
            assert!(proof["practical"].as_str().unwrap().contains(&e.rsvp));
            assert!(
                proof["trade_offs"]
                    .as_str()
                    .unwrap()
                    .contains("not externally verified")
            );
            assert!(issue(e, &state, &events).is_none());
        }
    }
}

#[cfg(test)]
mod preference_parity_tests {
    use super::*;
    use crate::model::{ParticipationFormat, PreferenceInput};

    fn catalog() -> Vec<Event> {
        serde_json::from_str(include_str!("../../data/events.json")).unwrap()
    }

    #[test]
    fn exact_weights_and_sequential_diversity_are_explained() {
        let mut e = catalog().remove(0);
        e.topic = "Career".into();
        e.participation = ParticipationFormat::OneToOne;
        e.start = 780;
        e.end = 840;
        e.cost = 0;
        let state = Schedule {
            interests: vec!["Career".into()],
            preferred_time: "afternoon".into(),
            preferences: Some(PreferenceInput {
                goal_topics: vec!["Career".into()],
                primary_topics: vec!["Career".into()],
                learning_topics: vec!["Career".into()],
                participation: vec!["one-to-one".into()],
                ..Default::default()
            }),
            ..Default::default()
        };
        let details = ranking_details(&e, &state, &Constraints::default(), &[]);
        assert_eq!(details.score, 30);
        assert_eq!(
            details
                .matches
                .iter()
                .map(|m| (m.kind, m.points))
                .collect::<Vec<_>>(),
            RANKING_WEIGHTS
        );
        assert_eq!(
            ranking_details(&e, &state, &Constraints::default(), &[&e]).score,
            26
        );
    }

    #[test]
    fn unknown_participation_never_receives_a_bonus() {
        let mut e = catalog().remove(0);
        e.participation = ParticipationFormat::Unknown;
        let state = Schedule {
            preferences: Some(PreferenceInput {
                participation: vec!["unknown".into(), "open".into()],
                ..Default::default()
            }),
            ..Default::default()
        };
        assert!(
            !ranking_details(&e, &state, &Constraints::default(), &[])
                .matches
                .iter()
                .any(|m| m.kind == "participation")
        );
    }

    #[test]
    fn equal_scores_use_event_id_independently_of_catalog_order() {
        let mut a = catalog().remove(0);
        a.id = "tie-a".into();
        let mut b = a.clone();
        b.id = "tie-b".into();
        for events in [vec![a.clone(), b.clone()], vec![b, a]] {
            let selected = recommend(&Schedule::default(), &Constraints::default(), &events);
            assert_eq!(selected.len(), 1);
            assert_eq!(selected[0].id, "tie-a");
        }
    }

    #[test]
    fn saved_counts_current_limits_and_legacy_defaults_agree() {
        let events = catalog();
        for count in [1, 3, 5] {
            let state = Schedule {
                preferences: Some(PreferenceInput {
                    count,
                    ..Default::default()
                }),
                ..Default::default()
            };
            assert_eq!(
                recommend(&state, &Constraints::default(), &events).len(),
                count
            );
            assert_eq!(
                recommend(
                    &state,
                    &Constraints {
                        limit: Some(2),
                        ..Default::default()
                    },
                    &events
                )
                .len(),
                2
            );
        }
        assert_eq!(
            recommend(&Schedule::default(), &Constraints::default(), &events).len(),
            3
        );
    }
}

#[cfg(test)]
mod mode_tests {
    use super::*;
    use crate::model::RecommendationMode;
    #[test]
    fn discovery_allows_alternatives_but_both_modes_respect_chosen_commitments() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let mut state = Schedule::default();
        let mut c = Constraints {
            days: Some(vec![1]),
            after: Some(900),
            before: Some(1020),
            limit: Some(5),
            mode: Some(RecommendationMode::Discovery),
            ..Default::default()
        };
        let found = recommend(&state, &c, &events);
        assert!(found.iter().any(|e| e.id == "e1") && found.iter().any(|e| e.id == "e17"));
        c.mode = Some(RecommendationMode::PlanBuilding);
        let plan = recommend(&state, &c, &events);
        assert!(!(plan.iter().any(|e| e.id == "e1") && plan.iter().any(|e| e.id == "e17")));
        for mode in [
            RecommendationMode::Discovery,
            RecommendationMode::PlanBuilding,
        ] {
            c.mode = Some(mode);
            state.plan = vec!["e1".into()];
            assert!(
                recommend(&state, &c, &events)
                    .iter()
                    .all(|e| e.id != "e1" && e.id != "e17")
            );
        }
    }
}
