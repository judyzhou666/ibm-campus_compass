use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Profile context passed from the browser to guide watsonx ranking.
/// Never contains the student's real name, chat history or display name.
#[derive(Deserialize, Default, Clone)]
#[serde(deny_unknown_fields)]
pub struct PlanProfile {
    #[serde(default)]
    pub major: String,
    #[serde(default)]
    pub goals: String,
    #[serde(default)]
    pub goal_types: Vec<String>,
}

impl PlanProfile {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.major.chars().count() > 120
            || self.goals.chars().count() > 240
            || self.goal_types.len() > 4
            || self.goal_types.iter().any(|g| {
                ![
                    "research",
                    "industry",
                    "social connection",
                    "cultural exploration",
                ]
                .contains(&g.as_str())
            })
        {
            return Err("Invalid profile ranking context");
        }
        Ok(())
    }
}

pub const TOPICS: [&str; 5] = [
    "AI & education",
    "Career",
    "Social",
    "Arts & culture",
    "Wellbeing",
];

#[derive(Clone, Deserialize, Serialize, Default, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ParticipationFormat {
    Independent,
    OneToOne,
    SmallGroup,
    Open,
    #[default]
    Unknown,
}
impl ParticipationFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Independent => "independent",
            Self::OneToOne => "one-to-one",
            Self::SmallGroup => "small-group",
            Self::Open => "open",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub day: u8,
    pub start: u16,
    pub end: u16,
    pub topic: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub participation: ParticipationFormat,
    pub food: String,
    pub cost: u16,
    pub access: String,
    pub rsvp: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub verification_status: String,
    #[serde(default)]
    pub eligibility: String,
    /// Hosting school, department, or club name.
    #[serde(default)]
    pub host_school: String,
    /// One or more goal categories: "research", "industry", "social connection", "cultural exploration".
    #[serde(default)]
    pub goal_type: Vec<String>,
    /// Structured access conditions; each field is a concrete value or the string "unknown".
    #[serde(default)]
    pub access_conditions: serde_json::Value,
}

fn default_block_title() -> String {
    "Busy commitment".into()
}
#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Block {
    // Accept legacy labels, but new clients send only conflict-checking times.
    #[serde(default = "default_block_title")]
    pub title: String,
    pub day: u8,
    pub start: u16,
    pub end: u16,
}

/// An individual update entry from data/updates.json.
#[derive(Clone, Deserialize)]
pub struct EventUpdate {
    pub id: String,
    pub event_id: String,
    pub kind: String, // "cancelled" | "full" | "time_moved" | "room_changed"
    pub timestamp: String,
    pub details: String,
    #[serde(default)]
    pub new_start: Option<u16>,
    #[serde(default)]
    pub new_end: Option<u16>,
    #[serde(default)]
    pub new_location: Option<String>,
}

/// One batch in data/updates.json.
#[derive(Clone, Deserialize)]
pub struct UpdateBatch {
    pub batch: u32,
    pub label: String,
    pub timestamp: String,
    pub updates: Vec<EventUpdate>,
}

#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Schedule {
    #[serde(default)]
    pub view_excluded: Vec<String>,
    pub plan: Vec<String>,
    pub cancelled: Vec<String>,
    pub interests: Vec<String>,
    pub blocks: Vec<Block>,
    pub buffer: u16,
    #[serde(default)]
    pub preferred_time: String,
    #[serde(default)]
    pub preferences: Option<PreferenceInput>,
    /// IDs of EventUpdate entries already applied in the browser.
    /// Sent to the server so it can treat cancelled/full events as unavailable.
    #[serde(default)]
    pub applied_update_ids: Vec<String>,
}

/// Derive the set of event IDs cancelled by applied updates. (`full` updates are folded into
/// the event itself by `apply_event_updates`, so they report "Event is full".)
pub fn unavailable_by_updates<'a>(
    applied_ids: &[String],
    all_updates: &'a [EventUpdate],
) -> HashSet<&'a str> {
    let applied: HashSet<&str> = applied_ids.iter().map(|s| s.as_str()).collect();
    all_updates
        .iter()
        .filter(|u| applied.contains(u.id.as_str()) && u.kind == "cancelled")
        .map(|u| u.event_id.as_str())
        .collect()
}

/// Apply updates to a catalog snapshot: an applied `time_moved` update overrides start/end
/// and an applied `full` update sets `access` to "full".
/// The returned `Vec<Event>` has the same length and order as `events`.
pub fn apply_event_updates(
    applied_ids: &[String],
    all_updates: &[EventUpdate],
    events: &[Event],
) -> Vec<Event> {
    let applied: HashSet<&str> = applied_ids.iter().map(|s| s.as_str()).collect();
    events
        .iter()
        .map(|e| {
            // Find the last applied time_moved update for this event (if any).
            let moved = all_updates.iter().rfind(|u| {
                u.kind == "time_moved"
                    && u.event_id == e.id
                    && applied.contains(u.id.as_str())
                    && u.new_start.is_some()
                    && u.new_end.is_some()
            });
            let mut next = e.clone();
            if let Some(u) = moved {
                let new_start = u.new_start.unwrap();
                let new_end = u.new_end.unwrap();
                // Only apply if the new times are valid.
                if new_start < new_end && new_end <= 1440 {
                    next.start = new_start;
                    next.end = new_end;
                }
            }
            if all_updates
                .iter()
                .any(|u| u.kind == "full" && u.event_id == e.id && applied.contains(u.id.as_str()))
            {
                next.access = "full".into();
            }
            next
        })
        .collect()
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RecommendationMode {
    Discovery,
    PlanBuilding,
}

#[derive(Clone, Debug, Deserialize, Serialize, Default, PartialEq)]
#[serde(default, deny_unknown_fields)]
pub struct Constraints {
    // Omitted mode preserves legacy, mutually compatible plan-building behavior.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<RecommendationMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topics: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluded: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub before: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub food: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explore: Option<bool>,
}

#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Window {
    pub day: u8,
    pub start: u16,
    pub end: u16,
}
fn default_count() -> usize {
    3
}
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct PreferenceInput {
    pub version: u8,
    pub goal_topics: Vec<String>,
    pub primary_topics: Vec<String>,
    pub learning_topics: Vec<String>,
    pub participation: Vec<String>,
    pub guidance: String,
    pub count: usize,
    pub free_only: bool,
    pub windows: Vec<Window>,
    pub dismissed: Vec<String>,
}
impl Default for PreferenceInput {
    fn default() -> Self {
        Self {
            version: 1,
            goal_topics: vec![],
            primary_topics: vec![],
            learning_topics: vec![],
            participation: vec![],
            guidance: "few".into(),
            count: default_count(),
            free_only: false,
            windows: vec![],
            dismissed: vec![],
        }
    }
}
impl PreferenceInput {
    fn validate(&self, events: &[Event]) -> Result<(), &'static str> {
        if self.version != 1
            || ![1, 3, 5].contains(&self.count)
            || !["few", "first", "steps", "information", "none"].contains(&self.guidance.as_str())
            || self.participation.len() > 4
            || self.participation.iter().any(|s| {
                !["independent", "one-to-one", "small-group", "open"].contains(&s.as_str())
            })
        {
            return Err("Invalid preference enum or count");
        }
        if self
            .primary_topics
            .iter()
            .any(|t| !self.goal_topics.contains(t))
        {
            return Err("Primary topics must belong to enabled goal topics");
        }
        for topics in [
            &self.goal_topics,
            &self.primary_topics,
            &self.learning_topics,
        ] {
            if topics.len() > 5 || topics.iter().any(|s| !TOPICS.contains(&s.as_str())) {
                return Err("Invalid confirmed preference topics");
            }
        }
        if self.windows.len() > 20
            || self
                .windows
                .iter()
                .any(|w| w.day > 4 || w.start >= w.end || w.end > 1440)
            || self.dismissed.len() > events.len()
            || self
                .dismissed
                .iter()
                .any(|id| !events.iter().any(|e| e.id == *id))
        {
            return Err("Invalid practical preference or dismissed event");
        }
        Ok(())
    }
}

impl Constraints {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self
            .days
            .as_ref()
            .is_some_and(|d| d.len() > 7 || d.iter().any(|x| *x > 6))
            || self.after.is_some_and(|x| x > 1440)
            || self.before.is_some_and(|x| x > 1440)
            || self.limit.is_some_and(|x| !(1..=5).contains(&x))
        {
            return Err("Invalid day, time, or event limit");
        }
        for topics in [&self.topics, &self.excluded].into_iter().flatten() {
            if topics.len() > TOPICS.len() || topics.iter().any(|t| !TOPICS.contains(&t.as_str())) {
                return Err("Unknown interest category");
            }
        }
        if self.food.as_ref().is_some_and(|s| {
            ![
                "Free meal",
                "Coffee & snacks",
                "Paid food",
                "None",
                "Unknown",
            ]
            .contains(&s.as_str())
        }) {
            return Err("Unknown food preference");
        }
        Ok(())
    }
}

impl Schedule {
    pub fn validate(&self, events: &[Event]) -> Result<(), &'static str> {
        self.validate_with_updates(events, &[])
    }

    pub fn validate_with_updates(
        &self,
        events: &[Event],
        all_updates: &[EventUpdate],
    ) -> Result<(), &'static str> {
        if let Some(p) = &self.preferences {
            p.validate(events)?;
        }
        if !["", "any", "morning", "afternoon", "evening"].contains(&self.preferred_time.as_str()) {
            return Err("Unknown preferred time");
        }
        if ![0, 15].contains(&self.buffer)
            || self.blocks.len() > 100
            || self.plan.len() > events.len()
            || self.cancelled.len() > events.len()
            || self.view_excluded.len() > events.len()
            || self.interests.len() > TOPICS.len()
        {
            return Err("Invalid schedule size or travel buffer");
        }
        if self
            .plan
            .iter()
            .chain(&self.cancelled)
            .chain(&self.view_excluded)
            .any(|id| !events.iter().any(|e| e.id == *id))
        {
            return Err("Unknown event ID");
        }
        if self.interests.iter().any(|t| !TOPICS.contains(&t.as_str())) {
            return Err("Unknown interest category");
        }
        if self
            .blocks
            .iter()
            .any(|b| b.day > 4 || b.start >= b.end || b.end > 1440 || b.title.len() > 240)
        {
            return Err("Invalid busy commitment");
        }
        // Validate applied_update_ids against the known update catalog (when provided).
        if !all_updates.is_empty() {
            let known_ids: std::collections::HashSet<&str> =
                all_updates.iter().map(|u| u.id.as_str()).collect();
            if self
                .applied_update_ids
                .iter()
                .any(|id| !known_ids.contains(id.as_str()))
            {
                return Err("Unknown update ID");
            }
        }
        // Basic size limit: no more update IDs than there are updates in total.
        if self.applied_update_ids.len() > 200 {
            return Err("Too many applied update IDs");
        }
        Ok(())
    }
}

#[cfg(test)]
mod contract_tests {
    #[test]
    fn profile_context_is_bounded_and_accepts_unicode() {
        let mut profile = super::PlanProfile {
            major: "学".repeat(120),
            goals: "学".repeat(240),
            goal_types: vec!["research".into()],
        };
        assert!(profile.validate().is_ok());
        profile.major.push('学');
        assert!(profile.validate().is_err());
        profile.major.clear();
        profile.goal_types = vec!["unsupported".into()];
        assert!(profile.validate().is_err());
        profile.goal_types = vec!["research".into(); 5];
        assert!(profile.validate().is_err());
    }
    use super::*;

    #[test]
    fn event_participation_is_optional_explicit_and_never_inferred_from_title() {
        let catalog: serde_json::Value =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let mut record = catalog[0].clone();
        record.as_object_mut().unwrap().remove("participation");
        record["title"] = serde_json::json!("One-on-one small-group independent open event");
        let event: Event = serde_json::from_value(record.clone()).unwrap();
        assert!(event.participation == ParticipationFormat::Unknown);
        record["participation"] = serde_json::json!("unknown");
        assert!(serde_json::from_value::<Event>(record.clone()).is_ok());
        record["participation"] = serde_json::json!("inferred-from-title");
        assert!(serde_json::from_value::<Event>(record).is_err());
    }

    #[test]
    fn busy_blocks_accept_minimal_times_and_legacy_labels() {
        let minimal = serde_json::json!({"day": 1, "start": 600, "end": 660});
        let block: Block = serde_json::from_value(minimal.clone()).unwrap();
        assert_eq!(block.title, "Busy commitment");
        let mut legacy = minimal;
        legacy["title"] = serde_json::json!("Legacy commitment");
        let block: Block = serde_json::from_value(legacy).unwrap();
        assert_eq!(block.title, "Legacy commitment");
    }
}
