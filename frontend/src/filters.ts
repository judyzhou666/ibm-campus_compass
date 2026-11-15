/**
 * Explore Events filters, shared with the Home category entries so the count
 * on a Home tile is exactly what Explore then shows.
 *
 * A selection has a top-level category (with optional sub-categories, OR'd
 * together) plus combinable panel filters: AND across groups, OR within one.
 */
import { DAYS, EVENTS } from "./data.ts";
import { conflictWith } from "./planner.ts";
import { eventCategories, eventSubs, subCategory } from "./taxonomy.ts";
import type { CampusEvent, DemoState } from "./types.ts";

/** Food values that count as free food. Paid food, None and Unknown do not. */
export const FREE_FOOD = [
  "Free meal",
  "Coffee & snacks",
  "Light refreshments",
  "Popcorn",
];

export const TIMES = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
} as const;
export type TimeOfDay = keyof typeof TIMES;
export const AUDIENCES = {
  international: "International students",
  "first-gen": "First-generation students",
} as const;
export type Audience = keyof typeof AUDIENCES;
export const RSVP = {
  required: "RSVP required",
  dropin: "Drop-in",
} as const;
export type RsvpMode = keyof typeof RSVP;

export interface ExploreSelection {
  /** A top-level category from taxonomy.ts, or "All". */
  category: string;
  /** Sub-category ids of `category`; none = the whole category. */
  subs: string[];
  days: number[];
  times: TimeOfDay[];
  fitsFreeTime: boolean;
  freeFood: boolean;
  freeAdmission: boolean;
  hosts: string[];
  audience: Audience[];
  rsvp: RsvpMode[];
}

export const ALL: ExploreSelection = {
  category: "All",
  subs: [],
  days: [],
  times: [],
  fitsFreeTime: false,
  freeFood: false,
  freeAdmission: false,
  hosts: [],
  audience: [],
  rsvp: [],
};

/** The "Free food" Home tile opens Explore with this filter name. */
export const FREE_FOOD_FILTER = "Free food";

/** Selection a Home tile (category name or "Free food") opens. */
export function selectionFor(filter: string): ExploreSelection {
  if (filter === FREE_FOOD_FILTER) return { ...ALL, freeFood: true };
  return { ...ALL, category: filter };
}

export function timeOfDay(start: number): TimeOfDay {
  return start < 12 * 60
    ? "morning"
    : start < 17 * 60
      ? "afternoon"
      : "evening";
}

/** Host options, built from the catalog rather than a fixed list. */
export const HOSTS = [
  ...new Set(EVENTS.map((e) => e.host_school ?? "").filter(Boolean)),
].sort();

export function isInternational(e: CampusEvent) {
  return (
    eventCategories(e).includes("International Students") ||
    /international/i.test(`${e.intended_audience ?? ""} ${e.eligibility ?? ""}`)
  );
}
export const isFirstGen = (e: CampusEvent) =>
  /first-gen/i.test(`${e.intended_audience ?? ""} ${e.eligibility ?? ""}`);

/** Number of panel filters switched on (for the Filters button badge). */
export function panelCount(s: ExploreSelection) {
  return (
    s.days.length +
    s.times.length +
    s.hosts.length +
    s.audience.length +
    s.rsvp.length +
    Number(s.fitsFreeTime) +
    Number(s.freeFood) +
    Number(s.freeAdmission)
  );
}

/**
 * True when `e` overlaps a class, a personal calendar item or a planned event
 * (with the travel buffer). Eligibility, capacity and RSVP problems are not
 * time clashes, so "Fits my free time" leaves those events listed, but a full
 * or members-only event that also clashes is still hidden.
 */
export const clashes = (e: CampusEvent, state: DemoState) =>
  conflictWith(e, state) !== undefined;

/**
 * True when `e` passes the selection. `state` is needed only for "Fits my free
 * time" (classes, personal calendar items and the plan, via conflictWith()).
 */
export function matchesExplore(
  e: CampusEvent,
  s: ExploreSelection,
  state?: DemoState,
) {
  if (s.category !== "All") {
    if (!eventCategories(e).includes(s.category as never)) return false;
    if (s.subs.length && !eventSubs(e).some((id) => s.subs.includes(id)))
      return false;
  }
  if (s.days.length && !s.days.includes(e.day)) return false;
  if (s.times.length && !s.times.includes(timeOfDay(e.start))) return false;
  if (s.freeFood && !FREE_FOOD.includes(e.food)) return false;
  if (s.freeAdmission && e.cost !== 0) return false;
  if (s.hosts.length && !s.hosts.includes(e.host_school ?? "")) return false;
  if (
    s.audience.length &&
    !s.audience.some((a) =>
      a === "international" ? isInternational(e) : isFirstGen(e),
    )
  )
    return false;
  if (
    s.rsvp.length &&
    !s.rsvp.some((r) =>
      r === "required"
        ? e.rsvp === "RSVP required"
        : e.rsvp !== "RSVP required",
    )
  )
    return false;
  if (
    s.fitsFreeTime &&
    state &&
    !state.plan.includes(e.id) &&
    clashes(e, state)
  )
    return false;
  return true;
}

/** A removable chip describing one active part of the selection. */
export interface ActiveChip {
  key: string;
  label: string;
  remove: (s: ExploreSelection) => ExploreSelection;
}

const without = <T>(list: T[], x: T) => list.filter((y) => y !== x);

export function activeChips(s: ExploreSelection): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (s.category !== "All") {
    if (!s.subs.length)
      out.push({
        key: "cat",
        label: s.category,
        remove: (x) => ({ ...x, category: "All", subs: [] }),
      });
    for (const id of s.subs)
      out.push({
        key: `sub-${id}`,
        label: `${s.category} › ${subCategory(id)?.label ?? id}`,
        remove: (x) => ({ ...x, subs: without(x.subs, id) }),
      });
  }
  for (const d of s.days)
    out.push({
      key: `day-${d}`,
      label: DAYS[d],
      remove: (x) => ({ ...x, days: without(x.days, d) }),
    });
  for (const t of s.times)
    out.push({
      key: `time-${t}`,
      label: TIMES[t],
      remove: (x) => ({ ...x, times: without(x.times, t) }),
    });
  if (s.fitsFreeTime)
    out.push({
      key: "free-time",
      label: "Fits my free time",
      remove: (x) => ({ ...x, fitsFreeTime: false }),
    });
  if (s.freeFood)
    out.push({
      key: "food",
      label: "Free food",
      remove: (x) => ({ ...x, freeFood: false }),
    });
  if (s.freeAdmission)
    out.push({
      key: "cost",
      label: "Free admission",
      remove: (x) => ({ ...x, freeAdmission: false }),
    });
  for (const h of s.hosts)
    out.push({
      key: `host-${h}`,
      label: h,
      remove: (x) => ({ ...x, hosts: without(x.hosts, h) }),
    });
  for (const a of s.audience)
    out.push({
      key: `aud-${a}`,
      label: AUDIENCES[a],
      remove: (x) => ({ ...x, audience: without(x.audience, a) }),
    });
  for (const r of s.rsvp)
    out.push({
      key: `rsvp-${r}`,
      label: RSVP[r],
      remove: (x) => ({ ...x, rsvp: without(x.rsvp, r) }),
    });
  return out;
}

/** Events of the catalog in `cat` that carry sub-category `id`. */
export const subCount = (cat: string, id: string, events = EVENTS) =>
  events.filter((e) => matchesExplore(e, { ...ALL, category: cat, subs: [id] }))
    .length;

/** Words that do not narrow a search ("events for international students"). */
const SEARCH_FILLER = new Set(
  (
    "a an and the for of on in at to with by from or any some all me my i find show search events event student students " +
    "help need want looking like about something anything things thing this week what where when how can get please"
  ).split(" "),
);
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"];

/** Everything a student might type to find this event, lowercased. */
function searchText(e: CampusEvent) {
  const subs = eventSubs(e).map((id) => subCategory(id)?.label ?? "");
  return [
    e.title,
    e.description,
    e.topic,
    e.category,
    e.food,
    e.location,
    e.rsvp,
    e.host_school ?? "",
    ...(e.goal_type ?? []),
    ...eventCategories(e),
    ...subs,
    FREE_FOOD.includes(e.food) ? "free food" : "",
    e.cost === 0 ? "free admission" : "",
    DAY_NAMES[e.day] ?? "",
    TIMES[timeOfDay(e.start)],
  ]
    .join(" ")
    .toLowerCase();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Header search: every meaningful word must appear as a whole word (simple
 * plurals allowed), in any order and any field. So "career workshop", "free
 * food" and "international students" find events, and "AI" no longer matches
 * the "ai" inside other words.
 */
export function matchesSearch(e: CampusEvent, query: string) {
  const words = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => !SEARCH_FILLER.has(w),
  );
  if (!words.length) return true;
  const text = searchText(e);
  return words.every((w) => {
    const stem = w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
    return new RegExp(`\\b${escapeRe(stem)}(?:s|es)?\\b`).test(text);
  });
}
