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
    for event in candidates {
        if selected.iter().all(|other| {
            !overlap(
                event.day,
                event.start,
                event.end,
                other.day,
                other.start,
                other.end,
                state.buffer,
            )
        }) {
            selected.push(event);
        }
        if selected.len() == c.limit.unwrap_or(3) {
            break;
        }
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

pub fn evidence(e: &Event, state: &Schedule, c: &Constraints) -> serde_json::Value {
    let topics = c
        .topics
        .as_ref()
        .filter(|t| !t.is_empty())
        .unwrap_or(&state.interests);
    serde_json::json!({
        "event_id": e.id,
        "interest_match": format!("{}: {} — {}", if topics.contains(&e.topic) { "Interest match" } else { "Explore beyond your interests" }, e.topic, e.description),
        "schedule_fit": format!("{}, {}–{} Eastern; no current conflicts including a {}-minute buffer. Preferred time {}.", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][usize::from(e.day)], clock(e.start), clock(e.end), state.buffer, if preferred(e,state) { "matched" } else { "not matched or unspecified" }),
        "practical": format!("${} admission · {} · {} · {} · {}", e.cost, e.location, e.rsvp, e.eligibility, e.food),
        "trade_offs": format!("{} minutes; {}. Food: {}. Capacity is not confirmed unless marked full. {}. Source: {}. Demo eligibility only; no real registration.", e.end-e.start, if e.cost == 0 { "no admission cost" } else { "paid admission" }, e.food, e.verification_status, e.source)
    })
}

#[cfg(test)]
mod evidence_tests {
    use super::*;
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
            let proof = evidence(e, &state, &Constraints::default());
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
