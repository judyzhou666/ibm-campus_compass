import type { CampusEvent } from "./types.ts";
import { DEMO } from "./config.ts";
export const REVIEW_CATEGORIES = [
  "Missing source",
  "Missing original URL",
  "Unverified or stale",
  "Unknown eligibility",
  "Unclear RSVP",
  "Unknown food",
  "Invalid metadata",
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];
export function qualityIssues(
  e: CampusEvent,
  reference = DEMO.week_start,
): ReviewCategory[] {
  const issues: ReviewCategory[] = [];
  if (!e.source?.trim()) issues.push("Missing source");
  if (!e.source_url) issues.push("Missing original URL");
  const stamp = e.last_checked_at ? Date.parse(e.last_checked_at) : NaN;
  const now = Date.parse(reference + "T23:59:59Z");
  if (!Number.isFinite(stamp) || stamp > now || now - stamp > 30 * 86400000)
    issues.push("Unverified or stale");
  if (!["open", "members", "full"].includes(e.access))
    issues.push("Unknown eligibility");
  if (!["RSVP required", "Drop-in welcome"].includes(e.rsvp))
    issues.push("Unclear RSVP");
  if (
    e.food === "Unknown" ||
    !["Free meal", "Coffee & snacks", "Paid food", "None"].includes(e.food)
  )
    issues.push("Unknown food");
  if (
    !e.id ||
    !e.title?.trim() ||
    !e.location?.trim() ||
    !Number.isInteger(e.day) ||
    e.day < 0 ||
    e.day > 4 ||
    !Number.isInteger(e.start) ||
    !Number.isInteger(e.end) ||
    e.start < 0 ||
    e.end > 1440 ||
    e.start >= e.end ||
    !Number.isFinite(e.cost) ||
    e.cost < 0 ||
    (e.source_url && !/^https:\/\//.test(e.source_url)) ||
    (e.access === "full" && e.availability !== "Full") ||
    (e.access !== "full" && e.availability === "Full")
  )
    issues.push("Invalid metadata");
  return issues;
}
