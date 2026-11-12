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

pub const TOPICS: [&str; 5] = [
    "AI & education",
    "Career",
    "Social",
    "Arts & culture",
    "Wellbeing",
];

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

#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Block {
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
    pub plan: Vec<String>,
    pub cancelled: Vec<String>,
    pub interests: Vec<String>,
    pub blocks: Vec<Block>,
    pub buffer: u16,
    #[serde(default)]
    pub preferred_time: String,
    /// IDs of EventUpdate entries already applied in the browser.
    /// Sent to the server so it can treat cancelled/full events as unavailable.
    #[serde(default)]
    pub applied_update_ids: Vec<String>,
}

/// Derive the effective set of cancelled/full event IDs from applied update IDs.
pub fn unavailable_by_updates<'a>(
    applied_ids: &[String],
    all_updates: &'a [EventUpdate],
) -> HashSet<&'a str> {
    let applied: HashSet<&str> = applied_ids.iter().map(|s| s.as_str()).collect();
    all_updates
        .iter()
        .filter(|u| applied.contains(u.id.as_str()) && (u.kind == "cancelled" || u.kind == "full"))
        .map(|u| u.event_id.as_str())
        .collect()
}

/// Apply `time_moved` updates to a catalog snapshot, returning cloned events with overridden
/// start/end times for any event that has an applied `time_moved` update.
/// The returned `Vec<Event>` has the same length and order as `events`.
pub fn apply_time_moves(
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
            if let Some(u) = moved {
                let new_start = u.new_start.unwrap();
                let new_end = u.new_end.unwrap();
                // Only apply if the new times are valid.
                if new_start < new_end && new_end <= 1440 {
                    return Event {
                        start: new_start,
                        end: new_end,
                        ..e.clone()
                    };
                }
            }
            e.clone()
        })
        .collect()
}

#[derive(Clone, Debug, Deserialize, Serialize, Default, PartialEq)]
#[serde(default, deny_unknown_fields)]
pub struct Constraints {
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
        if !["", "any", "morning", "afternoon", "evening"].contains(&self.preferred_time.as_str()) {
            return Err("Unknown preferred time");
        }
        if ![0, 15].contains(&self.buffer)
            || self.blocks.len() > 100
            || self.plan.len() > events.len()
            || self.cancelled.len() > events.len()
            || self.interests.len() > TOPICS.len()
        {
            return Err("Invalid schedule size or travel buffer");
        }
        if self
            .plan
            .iter()
            .chain(&self.cancelled)
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
