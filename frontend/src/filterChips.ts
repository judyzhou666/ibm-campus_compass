import type { Constraints } from "./types.ts";

export interface FilterChip {
  label: string;
  /** The key(s) this chip removes from constraints. */
  keys: (keyof Constraints)[];
}

/**
 * Build the list of active filter chips for the current constraints.
 * Each chip has a human-readable label and the constraint keys it covers.
 * Exported for unit testing.
 */
export function filterChips(c: Constraints): FilterChip[] {
  const chips: FilterChip[] = [];
  if (c.topics?.length)
    chips.push({ label: c.topics.join(", "), keys: ["topics"] });
  if (c.days?.length) {
    const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const label = c.days
      .map((d) => DAY_NAMES[d] ?? String(d))
      .join("/");
    chips.push({ label, keys: ["days"] });
  }
  if (c.after !== undefined || c.before !== undefined) {
    let label: string;
    if (c.after !== undefined && c.after >= 1020) label = "Evening";
    else if (c.after !== undefined && c.after >= 720) label = "Afternoon";
    else if (c.before !== undefined && c.before <= 720) label = "Morning";
    else if (c.after !== undefined)
      label = `After ${Math.floor(c.after / 60)}:${String(c.after % 60).padStart(2, "0")}`;
    else
      label = `Before ${Math.floor((c.before ?? 0) / 60)}:${String((c.before ?? 0) % 60).padStart(2, "0")}`;
    chips.push({ label, keys: ["after", "before"] });
  }
  if (c.food)
    chips.push({
      label: c.food === "Free meal" ? "Free food" : c.food,
      keys: ["food"],
    });
  if (c.free) chips.push({ label: "Free admission", keys: ["free"] });
  if (c.excluded?.length)
    chips.push({ label: `Not ${c.excluded.join(", ")}`, keys: ["excluded"] });
  return chips;
}

/** Remove one chip's keys from a constraints object. */
export function removeChip(c: Constraints, chip: FilterChip): Constraints {
  const next = { ...c };
  for (const key of chip.keys) delete next[key];
  return next;
}
