import type { CampusEvent, Constraints } from "./types.ts";
export function replacementConstraints(
  previous: Constraints,
  cancelled: CampusEvent,
): Constraints {
  return {
    ...previous,
    topics: previous.topics?.length ? previous.topics : [cancelled.topic],
    limit: 1,
  };
}
export function constraintSummary(c: Constraints): string {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return [
    c.topics?.join(" / "),
    c.days && `days: ${c.days.map((d) => days[d]).join(", ")}`,
    c.after != null &&
      `start after ${Math.floor(c.after / 60)}:${String(c.after % 60).padStart(2, "0")}`,
    c.before != null &&
      `finish before ${Math.floor(c.before / 60)}:${String(c.before % 60).padStart(2, "0")}`,
    c.food && `food: ${c.food}`,
    c.free && "free admission",
    c.excluded?.length && `excluding ${c.excluded.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");
}
