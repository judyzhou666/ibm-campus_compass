/**
 * Explore Events filter chips, shared with the Home category entries so the
 * counts on Home always match what the chip shows in Explore.
 */
import type { CampusEvent } from "./types.ts";

/** Food chips and the catalog `food` value each one selects. */
export const FOOD_FILTERS: Record<string, string> = {
  "Free Food": "Free meal",
  "Coffee & snacks": "Coffee & snacks",
  "Paid food": "Paid food",
  "No food": "None",
  "Food unknown": "Unknown",
};

/**
 * Category chips that also match an event's topic: many arts and wellbeing
 * events are filed under Social but carry that topic.
 */
const TOPIC_FILTERS: Record<string, string> = {
  Arts: "Arts & culture",
  Wellbeing: "Wellbeing",
};

/** True when `e` belongs under the Explore chip `filter`. */
export function matchesFilter(e: CampusEvent, filter: string) {
  if (filter === "All") return true;
  if (filter in FOOD_FILTERS) return e.food === FOOD_FILTERS[filter];
  return e.category === filter || e.topic === TOPIC_FILTERS[filter];
}
