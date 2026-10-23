use serde::{Deserialize, Serialize};

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
    #[serde(default)]
    pub preferences: Option<PreferenceInput>,
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

#[cfg(test)]
mod contract_tests {
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
