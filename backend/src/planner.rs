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

pub fn recommend<'a>(state: &Schedule, c: &Constraints, events: &'a [Event]) -> Vec<&'a Event> {
    let explicit = c.topics.as_ref().filter(|t| !t.is_empty());
    let topics = explicit.unwrap_or(&state.interests);
    let mut candidates: Vec<_> = events
        .iter()
        .filter(|e| {
            !state.plan.contains(&e.id)
                && issue(e, state, events).is_none()
                && c.days.as_ref().is_none_or(|d| d.contains(&e.day))
                && c.after.is_none_or(|t| e.start >= t)
                && c.before.is_none_or(|t| e.end <= t)
                && c.food.as_ref().is_none_or(|f| e.food == *f)
                && (c.free != Some(true) || e.cost == 0)
                && c.excluded.as_ref().is_none_or(|t| !t.contains(&e.topic))
                && explicit.is_none_or(|t| t.contains(&e.topic))
        })
        .collect();
    candidates.sort_by_key(|e| {
        (
            std::cmp::Reverse(
                u8::from(topics.contains(&e.topic)) * 10
                    + u8::from(e.cost == 0)
                    + 2 * u8::from(preferred(e, state)),
            ),
            e.day,
            e.start,
        )
    });
    let mut selected: Vec<&Event> = Vec::new();
    while !candidates.is_empty() && selected.len() < c.limit.unwrap_or(3) {
        let best = candidates
            .iter()
            .enumerate()
            .filter(|(_, event)| {
                selected.iter().all(|other| {
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
                let novel = topics.contains(&e.topic)
                    && !selected.iter().any(|other| other.topic == e.topic);
                (
                    u8::from(topics.contains(&e.topic)) * 10
                        + u8::from(novel) * 4
                        + u8::from(preferred(e, state)) * 2
                        + u8::from(e.cost == 0),
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
    let topics = c
        .topics
        .as_ref()
        .filter(|t| !t.is_empty())
        .unwrap_or(&state.interests);
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
        "comparison": comparison,
        "discovery_context":format!("{} / {} opportunity. Open fictional access does not restrict participation by major; department membership and real eligibility are not inferred.", e.category, e.topic),
        "constraints_satisfied": c,
        "interest_match": format!("{}: {} — {}", if topics.contains(&e.topic) { "Interest match" } else { "Explore beyond your interests" }, e.topic, e.description),
        "schedule_fit": format!("{}, {}–{} {}; no current conflicts including a {}-minute buffer. Preferred time {}. {}", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][usize::from(e.day)], clock(e.start), clock(e.end), crate::demo_config()["time_zone"].as_str().unwrap_or("Unknown"), state.buffer, if preferred(e,state) { "matched" } else { "not matched or unspecified" }, filter_summary),
        "practical": format!("${} admission · {} · {} · {} · {}", e.cost, e.location, e.rsvp, e.eligibility, e.food),
        "trade_offs": format!("{} minutes; {}. Food: {}. Capacity is not confirmed unless marked full. {}. Source: {}. Demo eligibility only; no real registration.", e.end-e.start, if e.cost == 0 { "no admission cost" } else { "paid admission" }, e.food, e.verification_status, e.source)
    })
}

fn events_comparison(e: &Event, state: &Schedule, c: &Constraints, events: &[Event]) -> String {
    let other = events.iter().find(|other| {
        other.id != e.id
            && other.topic == e.topic
            && issue(other, state, events).is_none()
            && c.days.as_ref().is_none_or(|d| d.contains(&other.day))
            && c.after.is_none_or(|t| other.start >= t)
            && c.before.is_none_or(|t| other.end <= t)
            && c.food.as_ref().is_none_or(|f| other.food == *f)
            && (c.free != Some(true) || other.cost == 0)
            && !state.plan.contains(&other.id)
    });
    match other {
        Some(other) => format!("Compared with {}: ${} vs ${}; {} vs {} minutes; {} vs {}. These are feasible record-level trade-offs, not a claim of a universally better choice. Topic diversity and preferred times also affect ranking. Major and free-text goals are not interpreted.",other.title,e.cost,other.cost,e.end-e.start,other.end-other.start,e.rsvp,other.rsvp),
        None => "No other eligible option in this topic meets the same time/food/cost filters. Other topics may offer broader exploration. Major and free-text goals are not interpreted.".into(),
    }
}

pub fn no_match_reason(state: &Schedule, c: &Constraints, events: &[Event]) -> String {
    let within: Vec<_> = events
        .iter()
        .filter(|e| {
            c.topics
                .as_ref()
                .is_none_or(|t| t.is_empty() || t.contains(&e.topic))
                && c.days.as_ref().is_none_or(|d| d.contains(&e.day))
                && c.after.is_none_or(|t| e.start >= t)
                && c.before.is_none_or(|t| e.end <= t)
                && c.food.as_ref().is_none_or(|f| e.food == *f)
                && (c.free != Some(true) || e.cost == 0)
                && c.excluded.as_ref().is_none_or(|t| !t.contains(&e.topic))
        })
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
