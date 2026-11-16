import type { DemoState } from "./types.ts";

/** The saved snapshot used by the preferences form after its existing time default. */
export type Preferences = Pick<
  DemoState,
  "interests" | "goal_types" | "goals"
> & {
  preferred_time: string;
};

/** Sort a string array for order-insensitive comparison. */
function sortedCopy(arr: string[]): string[] {
  return [...arr].sort();
}
export function prefsDiffer(
  interests: string[],
  goalTypes: string[],
  goals: string,
  preferredTime: string,
  saved: Preferences,
): boolean {
  const a = sortedCopy(interests).join("\0");
  const b = sortedCopy(saved.interests).join("\0");
  const c = sortedCopy(goalTypes).join("\0");
  const d = sortedCopy(saved.goal_types).join("\0");
  // Save trims goals, so whitespace alone is not an unsaved change.
  return (
    a !== b ||
    c !== d ||
    goals.trim() !== saved.goals.trim() ||
    preferredTime !== saved.preferred_time
  );
}
