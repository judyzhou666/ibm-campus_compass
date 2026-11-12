//! Interpreters turn a student message into constraints and recognition status, never
//! event IDs. Trusted event matching always runs after constraint validation.
//! `SimulatedInterpreter` is the deterministic demo parser;
//! `crate::watsonx::WatsonxInterpreter` is the live IBM watsonx.ai adapter.
use crate::model::{Constraints, TOPICS};
use regex::Regex;

/// Why a live interpreter could not produce constraints. Messages never contain secrets
/// or upstream response bodies.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterpretError {
    Timeout,
    Auth,
    Upstream(u16),
    Network,
    Malformed,
    Invalid(&'static str),
}

impl std::fmt::Display for InterpretError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Timeout => write!(f, "request timed out"),
            Self::Auth => write!(f, "authentication failed"),
            Self::Upstream(code) => write!(f, "upstream returned HTTP {code}"),
            Self::Network => write!(f, "network error"),
            Self::Malformed => write!(f, "model output was not a constraints object"),
            Self::Invalid(reason) => write!(f, "model constraints rejected: {reason}"),
        }
    }
}

impl std::error::Error for InterpretError {}

pub trait Interpreter {
    fn interpret(
        &self,
        message: &str,
        previous: Constraints,
    ) -> impl std::future::Future<Output = Result<Interpretation, InterpretError>> + Send;
}

pub struct SimulatedInterpreter;

#[derive(Debug, Clone, PartialEq)]
pub struct Interpretation {
    pub constraints: Constraints,
    pub understood: bool,
    pub clarification: Option<String>,
}

fn matches(pattern: &str, text: &str) -> bool {
    Regex::new(pattern)
        .expect("static parser pattern")
        .is_match(text)
}

impl Interpreter for SimulatedInterpreter {
    async fn interpret(
        &self,
        message: &str,
        previous: Constraints,
    ) -> Result<Interpretation, InterpretError> {
        Ok(self.parse(message, previous))
    }
}

impl SimulatedInterpreter {
    /// Deterministic rules shared in spirit with `frontend/src/planner.ts`.
    pub fn parse(&self, message: &str, c: Constraints) -> Interpretation {
        self.parse_with_context(message, c, false)
    }

    pub fn parse_with_context(
        &self,
        message: &str,
        mut c: Constraints,
        continuation: bool,
    ) -> Interpretation {
        let q = message.to_lowercase();
        let budget_text =
            Regex::new(r"\b(?:at most|up to|no more than)\s+[1-5]\s+(?:events|options|choices)\b")
                .unwrap()
                .replace_all(&q, "");
        if self::matches(
            r"\$|\b(?:under|less than|at most|up to|no more than|budget(?: of)?)\s*-?\d|\b\d+(?:\.\d+)?\s*(?:dollars?|usd|euros?)\b",
            &budget_text,
        ) {
            return Interpretation { constraints: c, understood: true, clarification: Some("Numeric budgets are not supported. Please restate your complete request with ‘free admission’ if required, or omit the budget. No budget-filtered plan was generated.".into()) };
        }

        let mut understood = matches(r"\b(plan|events?|week|options|choices)\b", &q);
        let mut matches = |pattern: &str, text: &str| {
            let found = matches(pattern, text);
            understood |= found;
            found
        };
        if c.explore == Some(true) && !continuation {
            c.explore = None;
            if c.mode == Some(crate::model::RecommendationMode::Discovery) {
                c.mode = None;
            }
        }
        if matches(r"\b(reset|start over)\b", &q) {
            c = Constraints::default();
        }
        if matches(r"\b(reset|start over|any time|any day)\b", &q) {
            c.days = None;
            c.after = None;
            c.before = None;
            c.food = None;
            c.free = None;
            c.excluded = None;
        }
        let keywords = [
            "ai|education|research|learning|tech|coding|data",
            r"career|jobs?|internships?|industry|alumni|networking|resume|professional|work experience|hiring|find\s+(?:a\s+)?(?:job|internship|work)|get\s+(?:a\s+)?job|land\s+(?:a\s+)?(?:job|internship)",
            r"social|friends?|meet|people|dinner|lunch|community|language exchange|practice\s+(?:my\s+|some\s+|their\s+)?english|make\s+(?:some\s+|new\s+)?friends?|meet\s+(?:some\s+|new\s+|other\s+)?people|talk\s+to\s+(?:new\s+|other\s+)?people",
            "art|arts|culture|cultural|film|museum|creative|sketch|ceramics",
            "wellbeing|wellness|relax|mindful|movement|quiet|balance",
        ];
        if matches(
            r"^(?:please\s+)?(?:build|create|make|plan)\s+(?:(?:me|my|a|the|our|this)\s+){0,3}(?:weekly\s+)?(?:plan|schedule|week)\b",
            &q,
        ) {
            c.mode = Some(crate::model::RecommendationMode::PlanBuilding);
        } else if matches(
            r"\b(discover|browse|explore)\b|\bshow\b.*\balternatives\b",
            &q,
        ) {
            c.mode = Some(crate::model::RecommendationMode::Discovery);
        } else if matches(
            r"\bweekly plan\b|\b(?:plan|build|create|make)\s+(?:(?:me|my|a|the|our|this)\s+){0,3}(?:weekly\s+)?(?:plan|schedule|week)\b",
            &q,
        ) {
            c.mode = Some(crate::model::RecommendationMode::PlanBuilding);
        }
        if matches(r"\b(?:beyond|outside) (?:my|your|saved) interests\b", &q) {
            c.explore = Some(true);
            c.mode
                .get_or_insert(crate::model::RecommendationMode::Discovery);
        }
        let mut topics = Vec::new();
        let mut excluded = Vec::new();
        for (topic, words) in TOPICS.iter().zip(keywords) {
            if matches(&format!(r"\b({words})\b"), &q) {
                topics.push(topic.to_string());
            }
            if matches(
                &format!(r"(?:no|not|avoid|without)\s+(?:any\s+)?(?:{words})"),
                &q,
            ) {
                excluded.push(topic.to_string());
            }
        }
        if !topics.is_empty() {
            c.explore = None;
            c.topics = Some(
                topics
                    .into_iter()
                    .filter(|t| !excluded.contains(t))
                    .collect(),
            );
        }
        if !excluded.is_empty() {
            c.excluded = Some(excluded);
        }
        let days: Vec<u8> = ["mon", "tue", "wed", "thu", "fri"]
            .iter()
            .enumerate()
            .filter(|(_, day)| matches(&format!(r"\b{day}(?:day|sday|nesday|rsday)?\b"), &q))
            .map(|(i, _)| i as u8)
            .collect();
        if !days.is_empty() {
            c.days = Some(days);
        }
        if matches(r"\bweekend|saturday|sunday\b", &q) {
            c.days = Some(vec![5, 6]);
        }
        if matches(r"\bweekday", &q) {
            c.days = Some(vec![0, 1, 2, 3, 4]);
        }
        if matches(r"\bafternoon", &q) {
            c.after = Some(720);
            c.before = Some(1020);
        }
        if matches(r"\bevening", &q) {
            c.after = Some(1020);
            c.before = None;
        }
        if matches(r"\bmorning", &q) {
            c.before = Some(720);
            c.after = None;
        }
        for kind in ["after", "before"] {
            let re = Regex::new(&format!(r"\b{kind}\s+(\d+)(?::(\d+))?\s*(am|pm)?\b")).unwrap();
            let recognized = matches(re.as_str(), &q);
            if let Some(m) = re.captures(&q).filter(|_| recognized) {
                let mut hour = m[1].parse::<u32>().unwrap_or(u32::MAX);
                let suffix = m.get(3).map(|x| x.as_str());
                let invalid_hour = suffix.is_some() && !(1..=12).contains(&hour);
                if suffix == Some("pm") && hour < 12 {
                    hour += 12;
                }
                if suffix == Some("am") && hour == 12 {
                    hour = 0;
                }
                if suffix.is_none() && hour < 8 {
                    hour += 12;
                }
                let minute = m
                    .get(2)
                    .map_or(0, |x| x.as_str().parse::<u32>().unwrap_or(u32::MAX));
                // An invalid time is rejected by constraint validation, not guessed.
                let value = if invalid_hour
                    || minute >= 60
                    || hour > 23
                    || m.get(2).is_some_and(|x| x.as_str().len() != 2)
                {
                    1441
                } else {
                    (hour * 60 + minute) as u16
                };
                if kind == "after" {
                    c.after = Some(value);
                } else {
                    c.before = Some(value);
                }
            }
        }
        if matches(
            r"\b(free food|free meal|free lunch|free dinner|free snacks|free coffee|free pizza|free breakfast|meal|dinner|lunch)\b",
            &q,
        ) {
            c.food = Some("Free meal".into());
        }
        if matches(r"\b(coffee|tea|snack|refreshment)", &q) && c.food.is_none() {
            c.food = Some("Coffee & snacks".into());
        }
        // "free" next to an event/topic word means FREE ADMISSION ("free ceramics",
        // "ceramics free on Wednesday"). "free" describing a person's *availability*
        // ("I'm free", "free time", "I'm only free Friday") sets no cost filter.
        // "free food/meal/…" is handled above (food filter only).
        // Drop the `matches` closure borrow before checking free so we can assign `understood`.
        let has_free = self::matches(r"\bfree\b", &q);
        let is_person_free = self::matches(
            r"(?i)\b(?:i(?:'m| am)|we(?:'re| are)|you(?:'re| are)|they(?:'re| are))(?:\s+\w+)?\s+free\b|\bwhen\s+(?:i(?:'m| am)|you(?:'re| are))\s+free\b|\bif\s+(?:i(?:'m| am)|you(?:'re| are))\s+free\b|\bfree\s+(?:time|slot|period|hour|day)\b",
            &q,
        );
        let free_admission_explicit = self::matches(
            r"\b(free admission|free entry|free to attend|free of charge|no cost|no-cost|costs? nothing|without paying|zero cost|zero budget)\b",
            &q,
        );
        // Use the `matches` closure (which borrows `understood`) to also flag explicit phrases.
        // We've computed the booleans above; now just mutate through the closure for consistent
        // `understood` tracking.
        if has_free && !is_person_free && c.food.is_none() {
            let _ = matches(r"\bfree\b", &q); // registers in `understood`
            c.free = Some(true);
        }
        if free_admission_explicit {
            let _ = matches(
                r"\b(free admission|free entry|free to attend|free of charge|no cost|no-cost|costs? nothing|without paying|zero cost|zero budget)\b",
                &q,
            );
            c.free = Some(true);
        }
        if matches(r"\b(any food|food doesn.t matter|no food preference)\b", &q) {
            c.food = None;
        }
        if let Some(m) = Regex::new(r"\b([1-5])\s+(?:events|choices|options)")
            .unwrap()
            .captures(&q)
        {
            understood = true;
            c.limit = Some(m[1].parse().unwrap());
        }
        let clock_pattern =
            Regex::new(r"\b(after|before)\s+(\d+)(?::(\d+))?\s*(am|pm)?\b").unwrap();
        let ambiguous: Vec<_> = clock_pattern
            .captures_iter(&q)
            .filter(|m| {
                m.get(4).is_none() && m[2].parse::<u16>().is_ok_and(|h| (1..=12).contains(&h))
            })
            .collect();
        let ambiguous_clock = !ambiguous.is_empty();
        for m in ambiguous {
            let bound = if &m[1] == "after" {
                &mut c.after
            } else {
                &mut c.before
            };
            if bound.is_some_and(|t| t <= 1440) {
                *bound = None;
            }
        }
        let restatement = self::matches(
            r"\b(near me|nearby|cheap|sometime|not (?:on )?(?:monday|tuesday|wednesday|thursday|friday)|cannot do|can.t do)\b",
            &q,
        );
        if restatement {
            c.days = None;
        }
        let clarification = if restatement {
            Some("Please restate your complete request with the topic, weekdays you CAN attend, and AM/PM for every time. I cannot infer location or weekday exclusions. For cost, only free admission is supported; numeric budgets are not supported.".into())
        } else if ambiguous_clock {
            Some(
                "Do you mean AM or PM? Please include AM/PM, or use an unambiguous 24-hour time."
                    .into(),
            )
        } else {
            None
        };
        Interpretation {
            constraints: c,
            understood,
            clarification,
        }
    }
}

#[cfg(test)]
mod exploration_lifecycle_tests {
    use super::*;
    use crate::model::RecommendationMode;
    #[test]
    fn temporary_exploration_and_reset_do_not_leak() {
        let previous = Constraints {
            explore: Some(true),
            mode: Some(RecommendationMode::Discovery),
            ..Default::default()
        };
        let normal = SimulatedInterpreter
            .parse("Tuesday afternoon events", previous.clone())
            .constraints;
        assert_eq!(normal.explore, None);
        assert_eq!(normal.mode, None);
        assert_eq!(normal.days, Some(vec![1]));
        assert_eq!(
            SimulatedInterpreter
                .parse("start over", previous.clone())
                .constraints,
            Constraints::default()
        );
        let explicit = SimulatedInterpreter
            .parse("Explore beyond my interests", previous)
            .constraints;
        assert_eq!(explicit.explore, Some(true));
        assert_eq!(explicit.mode, Some(RecommendationMode::Discovery));
    }
    #[test]
    fn discovery_words_win_over_incidental_week_and_schedule_words() {
        use crate::model::RecommendationMode;
        for text in [
            "explore social events to make friends this week",
            "browse events to create connections this week",
            "discover events for my weekly plan",
        ] {
            assert_eq!(
                SimulatedInterpreter
                    .parse(text, Constraints::default())
                    .constraints
                    .mode,
                Some(RecommendationMode::Discovery)
            );
        }
        assert_eq!(
            SimulatedInterpreter
                .parse("build my weekly schedule", Constraints::default())
                .constraints
                .mode,
            Some(RecommendationMode::PlanBuilding)
        );
        assert_eq!(
            SimulatedInterpreter
                .parse(
                    "social events to make friends this week",
                    Constraints::default()
                )
                .constraints
                .mode,
            None
        );
    }
}

#[cfg(test)]
mod structured_continuation_tests {
    use super::*;
    use crate::model::RecommendationMode;
    #[test]
    fn continuation_preserves_policy_but_normal_requests_and_reset_do_not() {
        let pending = SimulatedInterpreter.parse(
            "Explore beyond my interests after 3",
            Constraints::default(),
        );
        assert!(pending.clarification.is_some());
        let answer = SimulatedInterpreter
            .parse_with_context("after 3 PM", pending.constraints.clone(), true)
            .constraints;
        assert_eq!(answer.explore, Some(true));
        assert_eq!(answer.mode, Some(RecommendationMode::Discovery));
        assert_eq!(answer.after, Some(900));
        let ordinary = SimulatedInterpreter
            .parse("Tuesday afternoon events", answer.clone())
            .constraints;
        assert_eq!(ordinary.explore, None);
        assert_eq!(
            SimulatedInterpreter
                .parse_with_context("reset", answer, true)
                .constraints,
            Constraints::default()
        );
    }
}

#[cfg(test)]
mod round2_tests {
    use super::*;

    fn parse(msg: &str) -> Interpretation {
        SimulatedInterpreter.parse(msg, Default::default())
    }

    // --- free-admission wording ---

    #[test]
    fn free_food_does_not_set_free_admission() {
        let r = parse("free food");
        assert_eq!(r.constraints.food.as_deref(), Some("Free meal"));
        assert_eq!(
            r.constraints.free, None,
            "'free food' must not set free admission"
        );
    }

    #[test]
    fn im_free_wednesday_does_not_set_free_admission() {
        let r = parse("I'm free Wednesday evening");
        assert_eq!(r.constraints.days.as_deref(), Some(&[2u8][..]));
        assert_eq!(r.constraints.after, Some(1020));
        assert_eq!(
            r.constraints.free, None,
            "'I'm free' must not set free admission"
        );
    }

    #[test]
    fn free_admission_sets_free() {
        let r = parse("free admission");
        assert_eq!(r.constraints.free, Some(true));
        assert_eq!(r.constraints.food, None);
    }

    #[test]
    fn free_entry_sets_free() {
        let r = parse("free entry");
        assert_eq!(r.constraints.free, Some(true));
    }

    #[test]
    fn no_cost_sets_free() {
        let r = parse("no cost events");
        assert_eq!(r.constraints.free, Some(true));
    }

    // --- phrase synonyms ---

    #[test]
    fn internship_maps_to_career() {
        let r = parse("internship");
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Career".to_string()),
            "internship must map to Career"
        );
    }

    #[test]
    fn find_an_internship_maps_to_career() {
        let r = parse("find an internship");
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Career".to_string()),
            "find an internship must map to Career"
        );
    }

    #[test]
    fn practice_my_english_maps_to_social() {
        let r = parse("I want to practice my English");
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Social".to_string()),
            "practice my English must map to Social"
        );
    }

    #[test]
    fn make_new_friends_maps_to_social() {
        let r = parse("make new friends");
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Social".to_string()),
            "make new friends must map to Social"
        );
    }

    #[test]
    fn meet_new_people_maps_to_social() {
        let r = parse("meet new people");
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Social".to_string()),
            "meet new people must map to Social"
        );
    }

    // --- no-match alternatives ---

    #[test]
    fn no_match_reason_drops_food_first() {
        let events: Vec<crate::model::Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let state = crate::model::Schedule::default();
        // Arts & culture + food: Arts events exist but none have free food.
        // Dropping food should expose Arts alternatives.
        let c = Constraints {
            topics: Some(vec!["Arts & culture".into()]),
            food: Some("Free meal".into()),
            ..Default::default()
        };
        let reason = crate::planner::no_match_reason(&state, &c, &events);
        // Should mention topic and dropped filter, not jargon.
        assert!(
            !reason.contains("synthetic catalog records"),
            "Must not use jargon, got: {reason}"
        );
        assert!(
            reason.contains("Arts & culture"),
            "Should name the topic, got: {reason}"
        );
        assert!(
            reason.contains("free food"),
            "Should name the dropped filter, got: {reason}"
        );
        // Should NOT be duplicated — the full sentence should appear only once.
        assert!(
            reason.len() < 300,
            "Reason should be a single sentence, not duplicated, got: {reason}"
        );
    }

    #[test]
    fn no_match_reason_names_blocked_matches_instead_of_denying_them() {
        let events: Vec<crate::model::Event> =
            serde_json::from_str(include_str!("../../data/events.json")).unwrap();
        let chosen = &events[0];
        let state = crate::model::Schedule {
            plan: vec![chosen.id.clone()],
            ..Default::default()
        };
        // Only the already-chosen event fits these filters.
        let c = Constraints {
            topics: Some(vec![chosen.topic.clone()]),
            days: Some(vec![chosen.day]),
            after: Some(chosen.start),
            before: Some(chosen.end),
            ..Default::default()
        };
        let reason = crate::planner::no_match_reason(&state, &c, &events);
        assert!(
            reason.starts_with("The matching"),
            "must not claim nothing matches when the plan blocks a match, got: {reason}"
        );
        assert!(!reason.starts_with("No "), "got: {reason}");
    }

    #[test]
    fn zero_budget_sets_free_admission() {
        assert_eq!(parse("zero budget events").constraints.free, Some(true));
    }

    #[test]
    fn free_ceramics_sets_free_admission() {
        let r = parse("free ceramics");
        assert_eq!(
            r.constraints.free,
            Some(true),
            "free ceramics must set free admission"
        );
        assert!(
            r.constraints
                .topics
                .as_deref()
                .unwrap_or(&[])
                .contains(&"Arts & culture".to_string())
        );
    }

    #[test]
    fn ceramics_free_on_wednesday_sets_free_admission() {
        let r = parse("ceramics free on Wednesday evening");
        assert_eq!(r.constraints.free, Some(true), "must set free admission");
        assert_eq!(r.constraints.days.as_deref(), Some(&[2u8][..]));
        assert_eq!(r.constraints.after, Some(1020));
    }

    #[test]
    fn im_only_free_on_friday_no_admission() {
        let r = parse("I'm only free on Friday");
        assert_eq!(
            r.constraints.free, None,
            "I'm only free must not set free admission"
        );
        assert_eq!(r.constraints.days.as_deref(), Some(&[4u8][..]));
    }

    // --- fresh-search carry-over ---

    #[test]
    fn fresh_question_does_not_inherit_food_filter() {
        // When previous is {food: "Free meal"} but message is a fresh question,
        // the interpreter (given an EMPTY previous) must not carry the food.
        let r = parse("Wednesday evening");
        assert_eq!(r.constraints.food, None, "fresh parse must not set food");
        assert_eq!(r.constraints.days.as_deref(), Some(&[2u8][..]));
    }
}
