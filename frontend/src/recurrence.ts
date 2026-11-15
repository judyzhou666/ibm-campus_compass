/**
 * Repeat rules for the student's own calendar items, modelled on Google
 * Calendar / Canvas: Does not repeat, Daily, Weekly on <day>, Monthly on the
 * <nth> <day>, Annually on <date>, Every weekday, or Custom (every N days /
 * weeks / months / years, chosen weekdays, ending never / on a date / after
 * N occurrences).
 *
 * Every place that asks "does this item happen on that date?" uses
 * `occursOn`, so the calendar views, the busy-time check and drag all agree.
 */
import type { PersonalEvent } from "./types.ts";

// Local date helpers (calendarGrid.ts imports this module, so no cycle).
const isoToNoonUTC = (iso: string) => new Date(`${iso}T12:00:00Z`);
function addDays(iso: string, days: number) {
  const d = isoToNoonUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const REPEAT_PRESETS = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "weekdays",
  "custom",
] as const;
export type RepeatPreset = (typeof REPEAT_PRESETS)[number];

export type RepeatUnit = "day" | "week" | "month" | "year";
export interface RepeatRule {
  unit: RepeatUnit;
  /** Every `interval` units, 1–99. */
  interval: number;
  /** For weekly rules: weekdays 0 = Mon … 6 = Sun. */
  weekdays?: number[];
  /** For monthly rules: same day of the month, or the same nth weekday. */
  monthly?: "date" | "weekday";
  /** Last date (inclusive), or the number of occurrences (1–400). */
  until?: string;
  count?: number;
}

export const WEEKDAYS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 0 = Mon … 6 = Sun */
export function weekdayOf(iso: string) {
  const d = isoToNoonUTC(iso).getUTCDay();
  return d === 0 ? 6 : d - 1;
}
const parts = (iso: string) =>
  iso.split("-").map(Number) as [number, number, number];
/** 1 = first … 5 = fifth occurrence of this weekday in its month */
const nthInMonth = (iso: string) => Math.ceil(parts(iso)[2] / 7);
/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (isoToNoonUTC(b).getTime() - isoToNoonUTC(a).getTime()) / 86_400_000,
  );

/** The full rule a preset stands for, anchored on the item's first date. */
export function ruleFor(
  preset: RepeatPreset,
  date: string,
  custom?: RepeatRule,
): RepeatRule | null {
  switch (preset) {
    case "none":
      return null;
    case "daily":
      return { unit: "day", interval: 1 };
    case "weekly":
      return { unit: "week", interval: 1, weekdays: [weekdayOf(date)] };
    case "weekdays":
      return { unit: "week", interval: 1, weekdays: [0, 1, 2, 3, 4] };
    case "monthly":
      return { unit: "month", interval: 1, monthly: "weekday" };
    case "yearly":
      return { unit: "year", interval: 1 };
    case "custom":
      return (
        custom ?? { unit: "week", interval: 1, weekdays: [weekdayOf(date)] }
      );
  }
}

export const ruleOf = (pe: Pick<PersonalEvent, "repeat" | "rule" | "date">) =>
  ruleFor(pe.repeat, pe.date, pe.rule);

/** True when the rule's pattern (ignoring its end) lands on `iso`. */
function matchesPattern(rule: RepeatRule, start: string, iso: string) {
  const n = Math.max(1, rule.interval);
  const [y0, m0, d0] = parts(start);
  const [y, m, d] = parts(iso);
  switch (rule.unit) {
    case "day":
      return daysBetween(start, iso) % n === 0;
    case "week": {
      const days = rule.weekdays?.length ? rule.weekdays : [weekdayOf(start)];
      if (!days.includes(weekdayOf(iso))) return false;
      const weekStart = (x: string) => addDays(x, -weekdayOf(x));
      return (daysBetween(weekStart(start), weekStart(iso)) / 7) % n === 0;
    }
    case "month": {
      if (((y - y0) * 12 + (m - m0)) % n !== 0) return false;
      return rule.monthly === "date"
        ? d === d0
        : weekdayOf(iso) === weekdayOf(start) &&
            nthInMonth(iso) === nthInMonth(start);
    }
    case "year":
      return m === m0 && d === d0 && (y - y0) % n === 0;
  }
}

/** True when the item has an occurrence on `iso`. */
export function occursOn(
  pe: Pick<PersonalEvent, "repeat" | "rule" | "date">,
  iso: string,
): boolean {
  if (iso < pe.date) return false;
  const rule = ruleOf(pe);
  if (!rule) return iso === pe.date;
  if (rule.until && iso > rule.until) return false;
  if (!matchesPattern(rule, pe.date, iso)) return false;
  if (rule.count) {
    // Count occurrences from the first date up to and including `iso`.
    let seen = 0;
    for (let x = pe.date; x <= iso; x = addDays(x, 1)) {
      if (matchesPattern(rule, pe.date, x) && ++seen > rule.count) return false;
    }
  }
  return true;
}

/** The dropdown label for a preset, e.g. "Monthly on the first Tuesday". */
export function presetLabel(preset: RepeatPreset, date: string) {
  const wd = WEEKDAYS_LONG[weekdayOf(date)];
  const [, m, d] = parts(date);
  switch (preset) {
    case "none":
      return "Does not repeat";
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly on ${wd}`;
    case "monthly":
      return `Monthly on the ${ORDINALS[nthInMonth(date) - 1]} ${wd}`;
    case "yearly":
      return `Annually on ${MONTHS[m - 1]} ${d}`;
    case "weekdays":
      return "Every weekday (Monday to Friday)";
    case "custom":
      return "Custom…";
  }
}

/** Plain summary of a custom rule, e.g. "Every 2 weeks on Tue, Thu, 5 times". */
export function describeRule(rule: RepeatRule, date: string) {
  const unit =
    rule.interval === 1 ? rule.unit : `${rule.interval} ${rule.unit}s`;
  let text = `Every ${unit}`;
  if (rule.unit === "week") {
    const days = [
      ...(rule.weekdays?.length ? rule.weekdays : [weekdayOf(date)]),
    ].sort();
    text += ` on ${days.map((x) => WEEKDAYS_SHORT[x]).join(", ")}`;
  }
  if (rule.unit === "month")
    text +=
      rule.monthly === "date"
        ? ` on day ${parts(date)[2]}`
        : ` on the ${ORDINALS[nthInMonth(date) - 1]} ${WEEKDAYS_LONG[weekdayOf(date)]}`;
  if (rule.until) {
    const [y, m, d] = parts(rule.until);
    text += `, until ${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
  } else if (rule.count)
    text += `, ${rule.count} ${rule.count === 1 ? "time" : "times"}`;
  return text;
}

/** A well-formed rule, or null (used when restoring saved state). */
export function cleanRule(value: unknown): RepeatRule | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!["day", "week", "month", "year"].includes(r.unit as string)) return null;
  if (
    !Number.isInteger(r.interval) ||
    (r.interval as number) < 1 ||
    (r.interval as number) > 99
  )
    return null;
  const out: RepeatRule = {
    unit: r.unit as RepeatUnit,
    interval: r.interval as number,
  };
  if (r.weekdays !== undefined) {
    if (
      !Array.isArray(r.weekdays) ||
      !r.weekdays.length ||
      !r.weekdays.every((x) => Number.isInteger(x) && x >= 0 && x <= 6)
    )
      return null;
    out.weekdays = [...new Set(r.weekdays as number[])].sort();
  }
  if (r.monthly !== undefined) {
    if (r.monthly !== "date" && r.monthly !== "weekday") return null;
    out.monthly = r.monthly;
  }
  if (r.until !== undefined) {
    if (typeof r.until !== "string" || !ISO.test(r.until)) return null;
    out.until = r.until;
  }
  if (r.count !== undefined) {
    if (
      !Number.isInteger(r.count) ||
      (r.count as number) < 1 ||
      (r.count as number) > 400
    )
      return null;
    out.count = r.count as number;
  }
  return out;
}

/**
 * Move a whole series by `days` (drag in the calendar). Weekly weekdays move
 * with it, so "Tue, Thu" dragged one day later becomes "Wed, Fri".
 */
export function shiftSeries(pe: PersonalEvent, days: number): PersonalEvent {
  const moved: PersonalEvent = { ...pe, date: addDays(pe.date, days) };
  if (pe.rule) {
    moved.rule = { ...pe.rule };
    if (pe.rule.weekdays)
      moved.rule.weekdays = pe.rule.weekdays
        .map((w) => (((w + days) % 7) + 7) % 7)
        .sort();
    if (pe.rule.until) moved.rule.until = addDays(pe.rule.until, days);
  }
  return moved;
}
