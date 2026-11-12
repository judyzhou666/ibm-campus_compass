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

const MONTHS: [&str; 12] = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];
const MONTH: &str = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?";
const WEEKDAY_LABELS: [&str; 5] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/// Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's algorithm).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// The month (0-based) and day of a day number from `days_from_civil`.
fn civil_from_days(z: i64) -> (usize, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    ((m - 1) as usize, d)
}

/// A real calendar date in `year`, rejecting values such as "Nov 31".
fn valid_date(year: i64, month: usize, day: i64) -> Option<i64> {
    let n = days_from_civil(year, month as i64 + 1, day);
    (day >= 1 && civil_from_days(n) == (month, day)).then_some(n)
}

fn short_date(month: usize, day: i64) -> String {
    let name = MONTHS[month];
    format!("{}{} {day}", name[..1].to_uppercase(), &name[1..])
}

/// First weekday of the demo week as a day number, plus its year.
fn demo_week_start() -> (i64, i64) {
    let config = crate::demo_config();
    let start = config["week_start"].as_str().expect("demo week_start");
    let part = |r: std::ops::Range<usize>| start[r].parse::<i64>().expect("demo date");
    let year = part(0..4);
    (days_from_civil(year, part(5..7), part(8..10)), year)
}

fn demo_day_label(i: usize) -> String {
    let (start, _) = demo_week_start();
    let (month, day) = civil_from_days(start + i as i64);
    format!("{} {}", WEEKDAY_LABELS[i], short_date(month, day))
}

/// "Mon Nov 2 – Fri Nov 6, 2026"; mirrors `DEMO_WEEK_RANGE` in frontend/src/demoDates.ts.
fn demo_week_range() -> String {
    let (_, year) = demo_week_start();
    format!("{} – {}, {year}", demo_day_label(0), demo_day_label(4))
}

/// Month-day dates in a request ("Nov 6", "Nov 6-12", "Oct 30 – Nov 3"), mirroring
/// `parseDemoDates` in frontend/src/demoDates.ts. Returns the demo-week days inside the
/// requested dates and the dates as written back to the student.
fn parse_demo_dates(q: &str) -> Option<(Vec<u8>, String)> {
    let pattern = Regex::new(&format!(
        r"\b{MONTH}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*(?:-|–|—|to|through|until)\s*(?:{MONTH}\s+)?(\d{{1,2}})(?:st|nd|rd|th)?)?\b"
    ))
    .expect("static date pattern");
    let m = pattern.captures(q)?;
    let (week_start, year) = demo_week_start();
    let month_index = |s: &str| MONTHS.iter().position(|x| *x == s).expect("month");
    let m1 = month_index(&m[1]);
    let d1: i64 = m[2].parse().ok()?;
    let m2 = m.get(3).map_or(m1, |x| month_index(x.as_str()));
    let d2: i64 = m.get(4).map_or(Some(d1), |x| x.as_str().parse().ok())?;
    let from = valid_date(year, m1, d1)?;
    let to = valid_date(year, m2, d2)
        .filter(|to| *to >= from)
        .unwrap_or(from);
    let days = (0..5u8)
        .filter(|i| (from..=to).contains(&(week_start + i64::from(*i))))
        .collect();
    let requested = if to == from {
        short_date(m1, d1)
    } else if m2 == m1 {
        format!("{}–{d2}", short_date(m1, d1))
    } else {
        format!("{} – {}", short_date(m1, d1), short_date(m2, d2))
    };
    Some((days, requested))
}

fn outside_week_message(requested: &str) -> String {
    format!(
        "Campus Compass only has fictional events for the demo week, {}, so there is nothing on {requested}. Ask about a day in that week, for example “AI events on Friday”.",
        demo_week_range()
    )
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
    pub fn parse(&self, message: &str, mut c: Constraints) -> Interpretation {
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
        let mut topics = Vec::new();
        let mut excluded = Vec::new();
        for (topic, words) in TOPICS.iter().zip(&keywords) {
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
            // Words that chose the topics; mirrors `focusTerms` in interpretation.ts.
            let mut focus: Vec<String> = Vec::new();
            for (topic, words) in TOPICS.iter().zip(&keywords) {
                if excluded.iter().any(|t| t == topic) {
                    continue;
                }
                let re = Regex::new(&format!(r"\b({words})\b")).expect("static topic pattern");
                for m in re.find_iter(&q) {
                    let term = m.as_str().split_whitespace().collect::<Vec<_>>().join(" ");
                    // A word that names the whole category ("career") does not narrow it.
                    if term == topic.to_lowercase() {
                        continue;
                    }
                    if !focus.contains(&term) && focus.len() < 12 {
                        focus.push(term);
                    }
                }
            }
            c.focus = (!focus.is_empty()).then_some(focus);
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
        // Month-day dates override weekday words and are limited to the demo week.
        let mut outside_week = None;
        let dates = parse_demo_dates(&q);
        let dates_found = dates.is_some();
        if let Some((days, requested)) = dates {
            if days.is_empty() {
                outside_week = Some(outside_week_message(&requested));
            } else {
                c.days = Some(days);
            }
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
        if dates_found {
            understood = true;
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
        let clarification = if let Some(message) = outside_week {
            Some(message)
        } else if restatement {
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

#[cfg(test)]
mod date_and_focus_tests {
    use super::*;
    use crate::model::Event;
    use crate::planner::{recommend, relevance};

    fn parse(msg: &str) -> Interpretation {
        SimulatedInterpreter.parse(msg, Default::default())
    }

    #[test]
    fn date_range_keeps_only_demo_week_days() {
        let r = parse("AI in education relevant events for week Nov 6-12");
        assert_eq!(r.constraints.days, Some(vec![4]));
        assert_eq!(r.clarification, None);
        assert_eq!(
            parse("career on november 3rd to 4th").constraints.days,
            Some(vec![1, 2])
        );
        assert_eq!(
            parse("AI Oct 30 - Nov 3").constraints.days,
            Some(vec![0, 1])
        );
        assert_eq!(parse("AI on Monday Nov 5").constraints.days, Some(vec![3]));
    }

    #[test]
    fn dates_outside_demo_week_ask_for_a_day_in_it() {
        let r = parse("events for Nov 7-12");
        assert!(r.understood);
        assert_eq!(r.constraints.days, None);
        assert_eq!(
            r.clarification.as_deref(),
            Some(
                "Campus Compass only has fictional events for the demo week, Mon Nov 2 – Fri Nov 6, 2026, so there is nothing on Nov 7–12. Ask about a day in that week, for example “AI events on Friday”."
            )
        );
    }

    #[test]
    fn impossible_dates_are_ignored() {
        assert_eq!(parse("AI on Nov 31").constraints.days, None);
        assert_eq!(parse("AI on Nov 31").clarification, None);
    }

    #[test]
    fn focus_keeps_narrowing_words_only() {
        assert_eq!(
            parse("AI in education events").constraints.focus,
            Some(vec!["ai".to_string(), "education".to_string()])
        );
        assert_eq!(parse("career events").constraints.focus, None);
        assert_eq!(
            parse("AI career social").constraints.focus,
            Some(vec!["ai".to_string()])
        );
        assert_eq!(parse("no AI events").constraints.focus, None);
    }

    #[test]
    fn ai_in_education_ranks_matching_events_first() {
        let events: Vec<Event> =
            serde_json::from_str(include_str!("../../data/events.json")).expect("catalog");
        let state: crate::model::Schedule = serde_json::from_value(serde_json::json!({
            "plan": [], "cancelled": [], "interests": ["AI & education"], "buffer": 15,
            "blocks": [
                {"title": "Learning Sciences", "day": 0, "start": 600, "end": 720},
                {"title": "Research Methods", "day": 1, "start": 600, "end": 720},
                {"title": "Project studio", "day": 2, "start": 780, "end": 960},
                {"title": "Learning Sciences", "day": 3, "start": 600, "end": 720},
                {"title": "Independent study", "day": 4, "start": 540, "end": 660}
            ]
        }))
        .expect("schedule");
        let c = parse("AI in education events").constraints;
        let focus = c.focus.clone().unwrap();
        let picks = recommend(&state, &c, &events);
        assert_eq!(picks.len(), 3);
        assert!(picks.iter().all(|e| relevance(e, &focus) == 2));
    }
}
