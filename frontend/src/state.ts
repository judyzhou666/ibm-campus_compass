import { COMMUNITIES } from "./communities.ts";
import { DEFAULT_BLOCKS, EVENTS, TOPICS } from "./data.ts";
import type { DemoState } from "./types.ts";

export const STORAGE_KEY = "campus-compass-demo-v1";
export const fresh = (): DemoState => ({
  onboarded: false,
  major: "",
  goals: "",
  preferred_time: "any",
  plan: [],
  rsvps: [],
  saved: ["e1"],
  blocks: structuredClone(DEFAULT_BLOCKS),
  interests: ["AI & education", "Career", "Social"],
  buffer: 15,
  cancelled: [],
  joined: [],
  joinedCommunities: [],
  posts: [],
  draft: [],
  constraints: {},
  messages: [],
  name: "Judy",
});

export function restore(): DemoState {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return fresh();
    const base = fresh();
    const ids = (input: unknown): string[] =>
      Array.isArray(input)
        ? input.filter((id) => EVENTS.some((e) => e.id === id))
        : [];
    return {
      ...base,
      onboarded: value.onboarded === true,
      major: typeof value.major === "string" ? value.major.slice(0, 120) : "",
      goals: typeof value.goals === "string" ? value.goals.slice(0, 240) : "",
      preferred_time: ["any", "morning", "afternoon", "evening"].includes(
        value.preferred_time,
      )
        ? value.preferred_time
        : "any",
      plan: ids(value.plan),
      rsvps: ids(value.rsvps).filter((id) => ids(value.plan).includes(id)),
      saved: ids(value.saved),
      cancelled: ids(value.cancelled),
      draft: ids(value.draft),
      name:
        typeof value.name === "string" ? value.name.slice(0, 30) : base.name,
      buffer: value.buffer === 0 ? 0 : 15,
      interests: Array.isArray(value.interests)
        ? value.interests.filter(
            (t: unknown) => typeof t === "string" && TOPICS.includes(t),
          )
        : base.interests,
      blocks: Array.isArray(value.blocks)
        ? value.blocks
            .filter(
              (b: DemoState["blocks"][number]) =>
                b &&
                typeof b.id === "string" &&
                typeof b.title === "string" &&
                Number.isInteger(b.day) &&
                b.day >= 0 &&
                b.day < 5 &&
                Number.isInteger(b.start) &&
                Number.isInteger(b.end) &&
                b.start >= 0 &&
                b.end <= 1440 &&
                b.start < b.end,
            )
            .slice(0, 100)
        : base.blocks,
      messages: Array.isArray(value.messages)
        ? value.messages
            .filter(
              (m: DemoState["messages"][number]) =>
                m &&
                ["user", "assistant"].includes(m.role) &&
                typeof m.text === "string",
            )
            .slice(-100)
            .map((m: DemoState["messages"][number]) => ({
              role: m.role,
              text: m.text,
              eventIds: ids(m.eventIds),
            }))
        : [],
      posts: Array.isArray(value.posts)
        ? value.posts
            .filter(
              (p: DemoState["posts"][number]) =>
                p &&
                ["name", "title", "body", "tag"].every(
                  (key) => typeof p[key as keyof typeof p] === "string",
                ),
            )
            .slice(0, 100)
        : [],
      joinedCommunities: Array.isArray(value.joinedCommunities)
        ? value.joinedCommunities.filter((id: unknown) =>
            COMMUNITIES.some((c) => c.id === id),
          )
        : [],
      joined: Array.isArray(value.joined)
        ? value.joined.filter((s: unknown) => typeof s === "string")
        : [],
      // Chat filters restart after reload; saved plans and availability are retained.
      constraints: {},
    };
  } catch {
    return fresh();
  }
}
