import { EVENTS } from "./data.ts";
import { migratePreferences } from "./preferences.ts";
import type { CampusEvent, DemoState } from "./types.ts";

export function matchesDiscoveryFilter(
  event: CampusEvent,
  category = "All",
  query = "",
) {
  return (
    (category === "All" ||
      (category === "Free Food"
        ? event.food === "Free meal"
        : event.category === category)) &&
    (!query ||
      `${event.title} ${event.description} ${event.topic} ${event.food}`
        .toLowerCase()
        .includes(query.toLowerCase()))
  );
}

// Transient candidate exclusions reach both planners before ranking/count limits.
// They never change bookmarks or persisted preferences.
export function discoveryState(
  state: DemoState,
  skipped: readonly string[],
  category = "All",
  query = "",
): DemoState {
  const preferences = migratePreferences(state.preferences);
  return {
    ...state,
    preferences: {
      ...preferences,
      dismissed: [
        ...new Set([
          ...preferences.dismissed,
          ...skipped,
          ...EVENTS.filter(
            (event) => !matchesDiscoveryFilter(event, category, query),
          ).map((event) => event.id),
        ]),
      ],
    },
  };
}
