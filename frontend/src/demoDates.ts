import { DEMO } from "./config.ts";

// Month-day dates in a planner request, e.g. "Nov 6", "November 3-5",
// "Nov 6 to 12", "Oct 30 – Nov 3". Mirrored in backend/src/interpreter.rs.
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
export const DATE_PATTERN = new RegExp(
  `\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to|through|until)\\s*(?:${MONTH}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?)?\\b`,
);
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_MS = 86_400_000;

export interface DemoDates {
  /** Demo-week days (Monday = 0) inside the requested dates, in order. */
  days: number[];
  /** True when some requested dates fall outside the demo week. */
  partial: boolean;
  /** The requested dates as written back to the student, e.g. "Nov 6–12". */
  requested: string;
}

const short = (month: number, day: number) =>
  `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${day}`;

function utc(year: number, month: number, day: number) {
  const t = Date.UTC(year, month, day);
  // Reject dates such as "Nov 31" instead of rolling them into the next month.
  return new Date(t).getUTCDate() === day ? t : null;
}

export function parseDemoDates(text: string): DemoDates | null {
  const m = text.toLowerCase().match(DATE_PATTERN);
  if (!m) return null;
  const year = +DEMO.week_start.slice(0, 4);
  const m1 = MONTHS.indexOf(m[1]);
  const d1 = +m[2];
  const m2 = m[3] ? MONTHS.indexOf(m[3]) : m1;
  const d2 = m[4] ? +m[4] : d1;
  const from = utc(year, m1, d1);
  if (from === null) return null;
  let to = utc(year, m2, d2);
  if (to === null || to < from) to = from;
  const start = Date.parse(`${DEMO.week_start}T00:00:00Z`);
  const days = [0, 1, 2, 3, 4].filter((i) => {
    const t = start + i * DAY_MS;
    return t >= from && t <= to;
  });
  const requested =
    to === from
      ? short(m1, d1)
      : m2 === m1
        ? `${short(m1, d1)}–${d2}`
        : `${short(m1, d1)} – ${short(m2, d2)}`;
  return {
    days,
    partial: to - from + DAY_MS > days.length * DAY_MS,
    requested,
  };
}

function demoDay(i: number) {
  const d = new Date(Date.parse(`${DEMO.week_start}T00:00:00Z`) + i * DAY_MS);
  return `${LABELS[i]} ${short(d.getUTCMonth(), d.getUTCDate())}`;
}

/** "Mon Nov 2 – Fri Nov 6, 2026" */
export const DEMO_WEEK_RANGE = `${demoDay(0)} – ${demoDay(4)}, ${DEMO.week_start.slice(0, 4)}`;

/** Clarification when none of the requested dates are in the demo week. */
export function outsideWeekMessage(requested: string) {
  return `Campus Compass only has fictional events for the demo week, ${DEMO_WEEK_RANGE}, so there is nothing on ${requested}. Ask about a day in that week, for example “AI events on Friday”.`;
}

/** Reply lead when only some of the requested dates are in the demo week. */
export function partialWeekNote(dates: DemoDates) {
  if (!dates.partial || !dates.days.length) return undefined;
  const first = dates.days[0];
  const last = dates.days[dates.days.length - 1];
  const searched =
    first === last ? demoDay(first) : `${demoDay(first)} – ${demoDay(last)}`;
  return `The demo week is ${DEMO_WEEK_RANGE}, so for ${dates.requested} I searched ${searched} only.`;
}
