use serde::{Deserialize, Serialize};

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
}

#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Block {
    pub title: String,
    pub day: u8,
    pub start: u16,
    pub end: u16,
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
        if self
            .food
            .as_ref()
            .is_some_and(|s| !["Free meal", "Coffee & snacks"].contains(&s.as_str()))
        {
            return Err("Unknown food preference");
        }
        Ok(())
    }
}

impl Schedule {
    pub fn validate(&self, events: &[Event]) -> Result<(), &'static str> {
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
        Ok(())
    }
}
