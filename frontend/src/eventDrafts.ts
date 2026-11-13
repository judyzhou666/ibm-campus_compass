/**
 * Admin event drafts. A draft stays in this browser for team review: it is not
 * added to data/events.json, Explore Events or the AI Planner, which all use the
 * shared catalog that the Rust server builds in.
 */
import { TOPICS } from "./data.ts";
import { TOP_CATEGORIES, legacyCategory } from "./taxonomy.ts";

/** The six Explore categories; older drafts with retired names are mapped. */
export const DRAFT_CATEGORIES = TOP_CATEGORIES;
export const DRAFT_FOOD = [
  "None",
  "Coffee & snacks",
  "Free meal",
  "Paid food",
  "Unknown",
] as const;
export const DRAFT_RSVP = ["Drop-in welcome", "RSVP required"] as const;
export const DRAFT_ACCESS = { open: "Open to all", members: "Members only" } as const;
export const MAX_DRAFTS = 20;

export interface EventDraft {
  id: string;
  title: string;
  topic: string;
  category: string;
  /** Demo-week day, Monday = 0. */
  day: number;
  /** Minutes after midnight. */
  start: number;
  end: number;
  location: string;
  host: string;
  description: string;
  food: string;
  cost: number;
  rsvp: string;
  access: keyof typeof DRAFT_ACCESS;
  createdAt: string;
}

const minutes = (value: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
};

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Builds a draft from form values, or explains the first problem in plain words. */
export function draftFromForm(
  form: Record<string, string>,
  id: string,
  createdAt: string,
): { draft: EventDraft } | { error: string } {
  const text = (key: string, max: number) => (form[key] ?? "").trim().slice(0, max);
  const title = text("title", 80);
  const location = text("location", 60);
  if (!title) return { error: "Add an event title." };
  if (!oneOf(TOPICS, form.topic)) return { error: "Choose a topic." };
  if (!oneOf(DRAFT_CATEGORIES, form.category)) return { error: "Choose a category." };
  const day = Number(form.day);
  if (!Number.isInteger(day) || day < 0 || day > 4)
    return { error: "Choose a day in the demo week." };
  const start = minutes(form.start ?? "");
  const end = minutes(form.end ?? "");
  if (start === null || end === null) return { error: "Enter a start and end time." };
  if (end <= start) return { error: "The end time must be after the start time." };
  if (!location) return { error: "Add a location." };
  const cost = form.cost?.trim() ? Number(form.cost) : 0;
  if (!Number.isInteger(cost) || cost < 0 || cost > 100)
    return { error: "Admission must be a whole number of dollars from 0 to 100." };
  if (!oneOf(DRAFT_FOOD, form.food)) return { error: "Choose a food option." };
  if (!oneOf(DRAFT_RSVP, form.rsvp)) return { error: "Choose how students sign up." };
  if (form.access !== "open" && form.access !== "members")
    return { error: "Choose who can attend." };
  return {
    draft: {
      id,
      title,
      topic: form.topic,
      category: form.category,
      day,
      start,
      end,
      location,
      host: text("host", 60),
      description: text("description", 400),
      food: form.food,
      cost,
      rsvp: form.rsvp,
      access: form.access,
      createdAt,
    },
  };
}

/** Keeps only well-formed drafts from saved browser state. */
export function restoreDrafts(value: unknown): EventDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: EventDraft[] = [];
  for (const d of value) {
    if (!d || typeof d !== "object" || typeof d.id !== "string") continue;
    const r = draftFromForm(
      {
        ...d,
        category:
          typeof d.category === "string"
            ? legacyCategory(d.category, typeof d.topic === "string" ? d.topic : "")
            : d.category,
        day: String(d.day),
        cost: String(d.cost),
        start: clock(d.start),
        end: clock(d.end),
      },
      d.id.slice(0, 40),
      typeof d.createdAt === "string" ? d.createdAt.slice(0, 40) : "",
    );
    if ("draft" in r) drafts.push(r.draft);
    if (drafts.length >= MAX_DRAFTS) break;
  }
  return drafts;
}

function clock(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) return "";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
