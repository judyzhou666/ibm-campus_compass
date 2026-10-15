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
            std::cmp::Reverse(u8::from(topics.contains(&e.topic)) * 10 + u8::from(e.cost == 0)),
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
