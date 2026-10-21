//! Replace this interpreter with a Rust watsonx adapter when live access is configured.
//! Interpreters return constraints and recognition status, never event IDs.
//! Trusted event matching always runs after constraint validation.
use crate::model::{Constraints, TOPICS};
use regex::Regex;

pub trait Interpreter {
    fn interpret(
        &self,
        message: &str,
        previous: Constraints,
    ) -> impl std::future::Future<Output = Interpretation> + Send;
}

pub struct SimulatedInterpreter;

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
    async fn interpret(&self, message: &str, mut c: Constraints) -> Interpretation {
        let q = message.to_lowercase();
        if self::matches(
            r"\$|\b(?:under|less than|at most|up to|no more than|budget(?: of)?)\s*-?\d|\b\d+(?:\.\d+)?\s*(?:dollars?|usd|euros?)\b",
            &q,
        ) {
            return Interpretation { constraints: c, understood: true, clarification: Some("Numeric budgets are not supported. Please restate your complete request with ‘free admission’ if required, or omit the budget. No budget-filtered plan was generated.".into()) };
        }

        let mut understood = matches(r"\b(plan|events?|week|options|choices)\b", &q);
        let mut matches = |pattern: &str, text: &str| {
            let found = matches(pattern, text);
            understood |= found;
            found
        };
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
            "career|job|industry|alumni|networking|resume|professional",
            "social|friend|friends|meet|people|dinner|lunch|community",
            "art|arts|culture|cultural|film|museum|creative|sketch|ceramics",
            "wellbeing|wellness|relax|mindful|movement|quiet|balance",
        ];
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
        if matches(r"\b(free food|free meal|meal|dinner|lunch)\b", &q) {
            c.food = Some("Free meal".into());
        }
        if matches(r"\b(coffee|tea|snack|refreshment)", &q) && c.food.is_none() {
            c.food = Some("Coffee & snacks".into());
        }
        if matches(r"\b(free|no cost|no-cost|zero budget)\b", &q) {
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
        let clarification = if ambiguous_clock {
            Some(
                "Do you mean AM or PM? Please include AM/PM, or use an unambiguous 24-hour time."
                    .into(),
            )
        } else if self::matches(
            r"\b(near me|nearby|cheap|sometime|not (?:on )?(?:monday|tuesday|wednesday|thursday|friday)|cannot do|can.t do)\b",
            &q,
        ) {
            Some("Please restate your complete request with the weekdays/times you can attend. I cannot infer location or weekday exclusions. For cost, only free admission is supported; numeric budgets are not supported.".into())
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
