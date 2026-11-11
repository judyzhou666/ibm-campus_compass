import configured from "../../data/demo.json";
export interface DemoConfig {
  campus_id: string;
  campus_name: string;
  week_start: string;
  time_zone: string;
}
export function validateDemoConfig(c: DemoConfig): DemoConfig {
  const date = new Date(`${c.week_start}T12:00:00Z`);
  if (
    !c.campus_id.trim() ||
    !c.campus_name.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(c.week_start) ||
    !Number.isFinite(+date) ||
    date.toISOString().slice(0, 10) !== c.week_start ||
    date.getUTCDay() !== 1
  )
    throw new Error(
      "Demo week must start on a valid Monday; campus identity is required.",
    );
  new Intl.DateTimeFormat("en-US", { timeZone: c.time_zone }).format(date);
  return c;
}
export const DEMO = validateDemoConfig(configured);
export function weekDates(c = DEMO) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(`${c.week_start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
export function dayLabel(day: number, c = DEMO) {
  if (!Number.isInteger(day) || day < 0 || day >= 5) return "Date needs review";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${weekDates(c)[day]}T12:00:00Z`));
}
/** The demo clock: Monday of the demo week at 9:00 AM campus time. */
export const DEMO_NOW_MINUTE = 9 * 60;
export const WEEK_LABEL = `${dayLabel(0)}–${dayLabel(4)}, ${DEMO.week_start.slice(0, 4)}`;
export function storageKey(c = DEMO) {
  // Keep legacy default state; another configuration gets a separate preserved namespace.
  return c.campus_id === "fictional-campus" &&
    c.week_start === "2026-10-19" &&
    c.time_zone === "America/New_York"
    ? "campus-compass-demo-v1"
    : `campus-compass-demo-v1:${c.campus_id}:${c.week_start}:${c.time_zone}`;
}
export const TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];
export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !zone || zone.length > 60) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
/** Formats a campus-time event start in another time zone, e.g. "Fri, Nov 6, 5:00 AM". */
export function timeIn(day: number, minute: number, zone: string, c = DEMO) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(eventEpoch(day, minute, c));
}
/**
 * Which demo-week day (0–4) the demo clock falls on in a viewer's time zone, or
 * -1 if it lands outside Monday–Friday. Far-east zones see the campus Monday
 * morning as Monday evening or Tuesday.
 */
export function demoTodayIndex(zone: string, c = DEMO) {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zone,
  }).format(eventEpoch(0, DEMO_NOW_MINUTE, c));
  return weekDates(c).indexOf(date);
}
export function utcStamp(day: number, minute: number, c = DEMO) {
  return new Date(eventEpoch(day, minute, c))
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
function eventEpoch(day: number, minute: number, c = DEMO) {
  const date = weekDates(c)[day];
  if (!date || !Number.isInteger(minute) || minute < 0 || minute > 1440)
    throw new Error("Invalid event date/time");
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60000;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: c.time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const local = (epoch: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(epoch).map((p) => [p.type, p.value]),
    );
    return Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
  };
  let epoch = target;
  for (let i = 0; i < 4; i++) epoch += target - local(epoch);
  if (local(epoch) !== target)
    throw new Error("Local event time does not exist in configured zone");
  return epoch;
}
