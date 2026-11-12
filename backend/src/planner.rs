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
    ranking_with_topics(e, state, c, selected, &active_topics(state))
}

#[derive(Clone, Copy)]
#[repr(usize)]
enum RankingReason {
    Topic,
    Diversity,
    Learning,
    Goal,
    Primary,
    Participation,
    PreferredTime,
    Free,
}
impl RankingReason {
    fn definition(self) -> (&'static str, u8) {
        RANKING_WEIGHTS[self as usize]
    }
    fn explanation(self, e: &Event, state: &Schedule, c: &Constraints) -> String {
        match self {
            Self::Topic if c.topics.as_ref().is_some_and(|t| !t.is_empty()) => {
                format!("Matches this search topic: {}", e.topic)
            }
            Self::Topic => format!("Matches saved interests or enabled topics: {}", e.topic),
            Self::Diversity => {
                "Adds a requested or saved topic not yet represented in these suggestions".into()
            }
            Self::Learning => format!("Connects to your enabled confirmed {} topic", e.topic),
            Self::Goal => format!(
                "Connects to an enabled structured goal mapped to {}",
                e.topic
            ),
            Self::Primary => format!("Connects to your enabled primary-goal topic: {}", e.topic),
            Self::Participation => format!(
                "Matches your chosen fictional participation format: {}",
                e.participation.as_str()
            ),
            Self::PreferredTime => format!("Matches your preferred {} time", state.preferred_time),
            Self::Free => "Free admission".into(),
        }
    }
}
type RankingFacts = [(RankingReason, bool); 8];
fn ranking_facts(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    selected: &[&Event],
    active: &[String],
) -> RankingFacts {
    let topics = c
        .topics
        .as_deref()
        .filter(|t| !t.is_empty())
        .unwrap_or(active);
    let topic_match = topics.contains(&e.topic);
    let prefs = state.preferences.as_ref();
    [
        (RankingReason::Topic, topic_match),
        (
            RankingReason::Diversity,
            topic_match && !selected.iter().any(|other| other.topic == e.topic),
        ),
        (
            RankingReason::Learning,
            prefs.is_some_and(|p| p.learning_topics.contains(&e.topic)),
        ),
        (
            RankingReason::Goal,
            prefs.is_some_and(|p| p.goal_topics.contains(&e.topic)),
        ),
        (
            RankingReason::Primary,
            prefs.is_some_and(|p| p.primary_topics.contains(&e.topic)),
        ),
        (
            RankingReason::Participation,
            e.participation != crate::model::ParticipationFormat::Unknown
                && prefs.is_some_and(|p| {
                    p.participation
                        .iter()
                        .any(|s| s == e.participation.as_str())
                }),
        ),
        (RankingReason::PreferredTime, preferred(e, state)),
        (RankingReason::Free, e.cost == 0),
    ]
}
fn numerical_score(facts: &RankingFacts) -> u8 {
    facts
        .iter()
        .filter(|(_, matched)| *matched)
        .map(|(reason, _)| reason.definition().1)
        .sum()
}
#[cfg(test)]
std::thread_local! { static DETAIL_BUILDS: std::cell::Cell<usize> = const {std::cell::Cell::new(0)}; }
fn details_from_facts(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    facts: &RankingFacts,
    score: u8,
) -> RankingDetails {
    #[cfg(test)]
    DETAIL_BUILDS.with(|count| count.set(count.get() + 1));
    let matches = facts
        .iter()
        .filter(|(_, matched)| *matched)
        .map(|(reason, _)| {
            let (kind, points) = reason.definition();
            RecommendationMatch {
                kind,
                points,
                explanation: reason.explanation(e, state, c),
            }
        })
        .collect();
    RankingDetails { score, matches }
}
fn ranking_with_topics(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    selected: &[&Event],
    active: &[String],
) -> RankingDetails {
    let facts = ranking_facts(e, state, c, selected, active);
    details_from_facts(e, state, c, &facts, numerical_score(&facts))
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

// Recommendation-only filters never determine eligibility for an explicit Add/RSVP.
fn preference_issue(event: &Event, state: &Schedule) -> Option<String> {
    if let Some(p) = &state.preferences {
        if p.free_only && event.cost != 0 {
            return Some("Outside your saved free-admission recommendation preference".into());
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
    None
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

enum DiscoveryExclusion {
    View,
    Exploration,
    Dismissed,
}
fn discovery_exclusion(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    active: &[String],
) -> Option<DiscoveryExclusion> {
    if state.view_excluded.contains(&e.id) {
        Some(DiscoveryExclusion::View)
    } else if c.explore == Some(true) && active.contains(&e.topic) {
        Some(DiscoveryExclusion::Exploration)
    } else if state
        .preferences
        .as_ref()
        .is_some_and(|p| p.dismissed.contains(&e.id))
    {
        Some(DiscoveryExclusion::Dismissed)
    } else {
        None
    }
}

pub struct RankedRecommendation<'a> {
    pub event: &'a Event,
    pub details: RankingDetails,
}

#[derive(Default)]
pub struct RecommendationBatch<'a> {
    pub recommendations: Vec<RankedRecommendation<'a>>,
    pub active_topics: Vec<String>,
}

/// Preserve the event-only API for existing callers.
pub fn recommend<'a>(state: &Schedule, c: &Constraints, events: &'a [Event]) -> Vec<&'a Event> {
    recommend_with_details(state, c, events)
        .recommendations
        .into_iter()
        .map(|r| r.event)
        .collect()
}

pub fn recommend_with_details<'a>(
    state: &Schedule,
    c: &Constraints,
    events: &'a [Event],
) -> RecommendationBatch<'a> {
    let active = active_topics(state);
    let mut candidates: Vec<_> = events
        .iter()
        .filter(|e| {
            !state.plan.contains(&e.id)
                && issue(e, state, events).is_none()
                && preference_issue(e, state).is_none()
                && matches_constraints(e, c)
                && discovery_exclusion(e, state, c, &active).is_none()
        })
        .collect();
    let mut selected: Vec<&Event> = Vec::new();
    let mut recommendations = Vec::new();
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
            .map(|(index, event)| {
                let facts = ranking_facts(event, state, c, &selected, &active);
                let score = numerical_score(&facts);
                (index, *event, facts, score)
            })
            .max_by(|(li, left, _, ls), (ri, right, _, rs)| {
                ls.cmp(rs)
                    .then_with(|| right.day.cmp(&left.day))
                    .then_with(|| right.start.cmp(&left.start))
                    .then_with(|| right.id.cmp(&left.id))
                    .then_with(|| ri.cmp(li))
            });
        let Some((index, event, facts, score)) = best else {
            break;
        };
        selected.push(candidates.remove(index));
        recommendations.push(RankedRecommendation {
            event,
            details: details_from_facts(event, state, c, &facts, score),
        });
    }
    RecommendationBatch {
        recommendations,
        active_topics: active,
    }
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
    evidence_with_topics(e, state, c, events, &active_topics(state))
}

pub fn evidence_with_topics(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    events: &[Event],
    active: &[String],
) -> serde_json::Value {
    let topics = c
        .topics
        .as_deref()
        .filter(|t| !t.is_empty())
        .unwrap_or(active);
    let comparison = events_comparison(e, state, c, events, active);
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

fn events_comparison(
    e: &Event,
    state: &Schedule,
    c: &Constraints,
    events: &[Event],
    active: &[String],
) -> String {
    let other = events.iter().find(|other| {
        other.id != e.id
            && other.topic == e.topic
            && issue(other, state, events).is_none()
            && preference_issue(other, state).is_none()
            && matches_constraints(other, c)
            && discovery_exclusion(other, state, c, active).is_none()
            && !state.plan.contains(&other.id)
    });
    match other {
        Some(other) => format!("Compared with {}: ${} vs ${}; {} vs {} minutes; {} vs {}. These are feasible record-level trade-offs, not a claim of a universally better choice. Topic diversity and preferred times also affect ranking. Major and free-text goals are not interpreted. Only enabled structured goal and confirmed learning topics affect ranking.",other.title,e.cost,other.cost,e.end-e.start,other.end-other.start,e.rsvp,other.rsvp),
        None => "No other eligible option in this topic meets the same time/food/cost filters. Other topics may offer broader exploration. Major and free-text goals are not interpreted. Only enabled structured goal and confirmed learning topics affect ranking.".into(),
    }
}

const DAY_NAMES: [&str; 5] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

fn alt_count(state: &Schedule, c: &Constraints, events: &[Event]) -> usize {
    let mut c4 = c.clone();
    c4.limit = Some(4);
    recommend(state, &c4, events).len()
}

pub fn no_match_reason(state: &Schedule, c: &Constraints, events: &[Event]) -> String {
    let active = active_topics(state);
    let eligible: Vec<_> = events
        .iter()
        .filter(|e| {
            matches_constraints(e, c)
                && preference_issue(e, state).is_none()
                && !state.plan.contains(&e.id)
                && issue(e, state, events).is_none()
        })
        .collect();
    let view = eligible
        .iter()
        .filter(|e| {
            matches!(
                discovery_exclusion(e, state, c, &active),
                Some(DiscoveryExclusion::View)
            )
        })
        .count();
    let dismissed = eligible
        .iter()
        .filter(|e| {
            matches!(
                discovery_exclusion(e, state, c, &active),
                Some(DiscoveryExclusion::Dismissed)
            )
        })
        .count();
    let explored = eligible
        .iter()
        .filter(|e| {
            matches!(
                discovery_exclusion(e, state, c, &active),
                Some(DiscoveryExclusion::Exploration)
            )
        })
        .count();
    if view + dismissed + explored > 0 {
        let mut reasons = Vec::new();
        if view > 0 {
            reasons.push(format!("{view} events were hidden by the current category/search filters. Change the category or search query to include them."));
        }
        if dismissed > 0 {
            reasons.push(format!("{dismissed} events were hidden by saved or current-search dismissals. Restore hidden events in My Preferences or start a new search to clear session skips."));
        }
        if explored > 0 {
            reasons.push(format!("{explored} events were excluded because beyond-interest exploration excludes your active saved topics. Use a normal search or start over to include those topics."));
        }
        return reasons.join(" ");
    }
    let topic_prefix = match c.topics.as_deref() {
        Some(ts) if !ts.is_empty() => format!("{} ", ts.join(" or ")),
        _ => String::new(),
    };
    let n1 = |n: usize| {
        if n == 1 {
            "is 1 option".to_owned()
        } else {
            format!("are {n} options")
        }
    };
    let day_str_fn = |c: &Constraints| match c.days.as_deref() {
        Some([d]) if (*d as usize) < DAY_NAMES.len() => {
            format!(" on {}", DAY_NAMES[*d as usize])
        }
        _ => String::new(),
    };
    let time_str_fn = |c: &Constraints| match (c.after, c.before) {
        (Some(t), _) if t >= 1020 => " in the evening".to_owned(),
        (Some(t), _) if t >= 720 => " in the afternoon".to_owned(),
        (_, Some(t)) if t <= 720 => " in the morning".to_owned(),
        _ => String::new(),
    };
    // When events match every filter but none can be recommended, they are blocked by the
    // student's plan or are unavailable. Say so instead of claiming no events match.
    let blocked_lead = events.iter().any(|e| matches_constraints(e, c)).then(|| {
        format!(
            "The matching {topic_prefix}events{}{} are already in your plan, conflict with it, or aren't open.",
            day_str_fn(c),
            time_str_fn(c)
        )
    });
    let say = |lead: String, tail: String| match &blocked_lead {
        Some(blocked) => format!("{blocked} {tail}"),
        None => format!("{lead} {tail}"),
    };

    // 1. Drop food filter
    if c.food.is_some() {
        let mut no_food = c.clone();
        no_food.food = None;
        let alt = alt_count(state, &no_food, events);
        if alt > 0 {
            let food_label = match c.food.as_deref() {
                Some("Free meal") => "free food".to_owned(),
                Some(f) => f.to_lowercase(),
                None => "food".to_owned(),
            };
            let day_str = day_str_fn(c);
            let time_str = time_str_fn(c);
            return say(
                format!("No {topic_prefix}events{day_str}{time_str} have {food_label}."),
                format!("Here {} without the {food_label} filter.", n1(alt)),
            );
        }
    }
    // 2. Drop free-admission filter
    if c.free.is_some_and(|f| f) {
        let mut no_free = c.clone();
        no_free.free = None;
        let alt = alt_count(state, &no_free, events);
        if alt > 0 {
            let day_str = day_str_fn(c);
            let time_str = time_str_fn(c);
            return say(
                format!("No {topic_prefix}events{day_str}{time_str} are free admission."),
                format!("Here {} including paid ones.", n1(alt)),
            );
        }
    }
    // 3. Drop day filter
    if c.days.as_ref().is_some_and(|d| !d.is_empty()) {
        let mut no_day = c.clone();
        no_day.days = None;
        let alt = alt_count(state, &no_day, events);
        if alt > 0 {
            let day_names: Vec<&str> = c
                .days
                .as_deref()
                .unwrap_or(&[])
                .iter()
                .filter_map(|&d| DAY_NAMES.get(d as usize).copied())
                .collect();
            let day_str = if day_names.is_empty() {
                "that day".to_owned()
            } else {
                day_names.join("/")
            };
            return say(
                format!("No {topic_prefix}events on {day_str} match."),
                format!("Here {} on other days.", n1(alt)),
            );
        }
    }
    // 4. Drop time filter
    if c.after.is_some() || c.before.is_some() {
        let mut no_time = c.clone();
        no_time.after = None;
        no_time.before = None;
        let alt = alt_count(state, &no_time, events);
        if alt > 0 {
            return say(
                format!("No {topic_prefix}events match that time window."),
                format!("Here {} at other times.", n1(alt)),
            );
        }
    }
    // 5. Drop topic filter
    if c.topics.as_ref().is_some_and(|t| !t.is_empty()) {
        let mut no_topic = c.clone();
        no_topic.topics = None;
        let alt = alt_count(state, &no_topic, events);
        if alt > 0 {
            return say(
                format!("No {topic_prefix}events fit the other filters."),
                format!("Here {} from other areas.", n1(alt)),
            );
        }
    }
    say(
        "Nothing matched in this demo week.".into(),
        "Try a different day, topic, or time, or say \"start over\" to clear all filters.".into(),
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
        c.mode = None;
        let legacy = recommend(&state, &c, &events);
        assert_eq!(
            legacy.iter().map(|e| &e.id).collect::<Vec<_>>(),
            plan.iter().map(|e| &e.id).collect::<Vec<_>>()
        );
        for (index, event) in legacy.iter().enumerate() {
            for other in legacy.iter().skip(index + 1) {
                assert!(!overlap(
                    event.day,
                    event.start,
                    event.end,
                    other.day,
                    other.start,
                    other.end,
                    state.buffer
                ));
            }
        }
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

#[cfg(test)]
mod soft_preference_tests {
    use super::*;
    use crate::model::{PreferenceInput, Window};

    #[test]
    fn saved_preferences_filter_suggestions_not_explicit_eligibility() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let paid = events.iter().find(|e| e.id == "e29").unwrap();
        let rsvp = events.iter().find(|e| e.id == "e1").unwrap();
        let mut state = Schedule {
            preferences: Some(PreferenceInput {
                free_only: true,
                ..Default::default()
            }),
            ..Default::default()
        };
        assert_eq!(issue(paid, &state, &events), None);
        assert!(preference_issue(paid, &state).is_some());
        assert!(
            recommend(&state, &Constraints::default(), &events)
                .iter()
                .all(|e| e.cost == 0)
        );
        state.plan.push(paid.id.clone());
        assert_eq!(issue(paid, &state, &events), None);
        state.plan.clear();
        state.preferences.as_mut().unwrap().windows = vec![Window {
            day: 0,
            start: 480,
            end: 540,
        }];
        assert_eq!(issue(rsvp, &state, &events), None);
        assert!(preference_issue(rsvp, &state).is_some());
        assert!(recommend(&state, &Constraints::default(), &events).is_empty());
        state.plan.push(rsvp.id.clone());
        let overlapping = events.iter().find(|e| e.id == "e17").unwrap();
        assert!(
            issue(overlapping, &state, &events)
                .unwrap()
                .starts_with("Conflicts")
        );
        for event in events
            .iter()
            .filter(|e| e.access == "members" || e.access == "full")
        {
            assert!(issue(event, &state, &events).is_some());
        }
    }
}

#[cfg(test)]
mod ranking_optimization_tests {
    use super::*;
    use crate::model::PreferenceInput;
    use serde_json::{Value, json};

    #[test]
    fn cached_ranking_matches_original_api_responses_and_standalone_helpers() {
        // Captured from the original Rust binary at 89a405f before optimization.
        let cases: Vec<Value> = serde_json::from_str(include_str!(
            "../../tests/fixtures/rust-ranking-before-optimization.json"
        ))
        .unwrap();
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../tests/fixtures/pre-merge-events.json"))
                .unwrap();
        for case in cases {
            let state: Schedule = serde_json::from_value(case["state"].clone()).unwrap();
            let constraints: Constraints =
                serde_json::from_value(case["response"]["constraints"].clone()).unwrap();
            let batch = recommend_with_details(&state, &constraints, &events);
            let ids: Vec<_> = batch.recommendations.iter().map(|r| &r.event.id).collect();
            assert_eq!(
                json!(ids),
                case["response"]["event_ids"],
                "{}",
                case["name"]
            );
            let reasons: Vec<_> = batch.recommendations.iter().map(|r|json!({"event_id":r.event.id,"score":r.details.score,"matches":r.details.matches})).collect();
            assert_eq!(
                json!(reasons),
                case["response"]["match_reasons"],
                "{}",
                case["name"]
            );
            let evidence: Vec<_> = batch
                .recommendations
                .iter()
                .map(|r| {
                    evidence_with_topics(
                        r.event,
                        &state,
                        &constraints,
                        &events,
                        &batch.active_topics,
                    )
                })
                .collect();
            assert_eq!(
                json!(evidence),
                case["response"]["recommendations"],
                "{}",
                case["name"]
            );
            let selected = recommend(&state, &constraints, &events);
            assert_eq!(
                json!(selected.iter().map(|e| &e.id).collect::<Vec<_>>()),
                json!(ids)
            );
            for (index, item) in batch.recommendations.iter().enumerate() {
                assert_eq!(
                    item.details,
                    ranking_details(item.event, &state, &constraints, &selected[..index])
                );
                assert_eq!(
                    evidence[index],
                    super::evidence(item.event, &state, &constraints, &events)
                );
            }
        }
    }

    #[test]
    fn explanations_are_built_only_for_selected_recommendations() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        DETAIL_BUILDS.with(|count| count.set(0));
        let c = Constraints {
            limit: Some(5),
            mode: Some(crate::model::RecommendationMode::Discovery),
            ..Default::default()
        };
        let batch = recommend_with_details(&Schedule::default(), &c, &events);
        assert_eq!(batch.recommendations.len(), 5);
        assert_eq!(DETAIL_BUILDS.with(|count| count.get()), 5);
        assert!(
            batch
                .recommendations
                .iter()
                .all(|r| r.details.score == r.details.matches.iter().map(|m| m.points).sum::<u8>())
        );
    }
    #[test]
    fn snapshots_do_not_cache_preferences_across_calls() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let mut state = Schedule {
            preferences: Some(PreferenceInput {
                count: 1,
                ..Default::default()
            }),
            ..Default::default()
        };
        let c = Constraints::default();
        let before = recommend_with_details(&state, &c, &events);
        state.preferences.as_mut().unwrap().learning_topics = vec!["Career".into()];
        let after = recommend_with_details(&state, &c, &events);
        assert_ne!(
            before.recommendations[0].event.id,
            after.recommendations[0].event.id
        );
        assert_eq!(after.recommendations[0].event.id, "e20");
        assert!(
            after.recommendations[0]
                .details
                .matches
                .iter()
                .any(|r| r.kind == "learning")
        );
        state.plan = vec!["e20".into()];
        assert!(recommend(&state, &c, &events).iter().all(|e| e.id != "e20"));
    }

    #[test]
    fn borrowed_id_tie_breaks_preserve_ordinal_order_and_first_duplicate() {
        let mut events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let mut first = events.remove(0);
        first.id = "tie-b".into();
        let mut second = first.clone();
        second.id = "tie-a".into();
        let mut duplicate = second.clone();
        duplicate.title = "Later duplicate".into();
        let catalog = [first, second, duplicate];
        let c = Constraints {
            limit: Some(1),
            ..Default::default()
        };
        let batch = recommend_with_details(&Schedule::default(), &c, &catalog);
        assert!(std::ptr::eq(batch.recommendations[0].event, &catalog[1]));
    }
}

#[cfg(test)]
mod review_filter_tests {
    use super::*;
    use crate::model::PreferenceInput;
    fn event() -> Event {
        serde_json::from_str::<Vec<Event>>(include_str!("../../data/events.json"))
            .unwrap()
            .remove(0)
    }
    #[test]
    fn comparisons_exclude_hidden_and_exploration_filtered_alternatives() {
        let original = event();
        let mut other = original.clone();
        other.id = "comparison-only".into();
        other.title = "Hidden comparison candidate".into();
        let events = vec![original, other];
        let mut state = Schedule {
            preferences: Some(PreferenceInput {
                dismissed: vec![events[1].id.clone()],
                ..Default::default()
            }),
            ..Default::default()
        };
        let c = Constraints::default();
        assert!(
            !events_comparison(&events[0], &state, &c, &events, &active_topics(&state))
                .contains(&events[1].title)
        );
        state.preferences.as_mut().unwrap().dismissed.clear();
        assert!(
            events_comparison(&events[0], &state, &c, &events, &active_topics(&state))
                .contains(&events[1].title)
        );
        state.preferences.as_mut().unwrap().learning_topics = vec![events[0].topic.clone()];
        let exploration = Constraints {
            explore: Some(true),
            ..Default::default()
        };
        assert!(
            !events_comparison(
                &events[0],
                &state,
                &exploration,
                &events,
                &active_topics(&state)
            )
            .contains(&events[1].title)
        );
    }
    #[test]
    fn no_match_explains_dismissed_only_candidates() {
        let events = vec![event()];
        let state = Schedule {
            preferences: Some(PreferenceInput {
                dismissed: vec![events[0].id.clone()],
                ..Default::default()
            }),
            ..Default::default()
        };
        let c = Constraints::default();
        assert!(
            recommend_with_details(&state, &c, &events)
                .recommendations
                .is_empty()
        );
        let reason = no_match_reason(&state, &c, &events);
        assert!(reason.contains("1 events were hidden"));
        assert!(reason.contains("Restore hidden events"));
    }
    #[test]
    fn no_match_explains_exploration_only_candidates() {
        let events = vec![event()];
        let state = Schedule {
            interests: vec![events[0].topic.clone()],
            ..Default::default()
        };
        let c = Constraints {
            explore: Some(true),
            ..Default::default()
        };
        assert!(
            recommend_with_details(&state, &c, &events)
                .recommendations
                .is_empty()
        );
        let reason = no_match_reason(&state, &c, &events);
        assert!(reason.contains("1 events were excluded"));
        assert!(reason.contains("normal search or start over"));
    }
}
