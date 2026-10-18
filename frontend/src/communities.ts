import type { DemoState } from "./types.ts";
export const COMMUNITIES = [
  {
    id: "research",
    name: "Research exchange",
    category: "Academic",
    topics: ["AI & education"],
    description: "Explore interdisciplinary research questions.",
  },
  {
    id: "ai",
    name: "AI & learning circle",
    category: "Academic",
    topics: ["AI & education"],
    description: "Discuss learning tools and responsible AI.",
  },
  {
    id: "career",
    name: "Career connections",
    category: "Career",
    topics: ["Career"],
    description: "Explore paths without needing a settled career goal.",
  },
  {
    id: "global",
    name: "Global table",
    category: "Social",
    topics: ["Social", "Arts & culture"],
    description:
      "A welcoming group for international students and campus explorers.",
  },
  {
    id: "arts",
    name: "Arts & culture",
    category: "Arts",
    topics: ["Arts & culture"],
    description: "Share creative interests and cultural discoveries.",
  },
  {
    id: "social",
    name: "Campus explorers",
    category: "Social",
    topics: ["Social", "Wellbeing"],
    description: "Find relaxed activities and make room for wellbeing.",
  },
];

export function toggleCommunityMembership(
  state: DemoState,
  id: string,
): DemoState {
  if (!COMMUNITIES.some((c) => c.id === id)) return state;
  return {
    ...state,
    joinedCommunities: state.joinedCommunities.includes(id)
      ? state.joinedCommunities.filter((joined) => joined !== id)
      : [...state.joinedCommunities, id],
  };
}

export function communityFromHash(hash: string): string | null {
  const [page, query] = hash.replace(/^#/, "").split("?");
  if (page !== "forum") return null;
  const id = new URLSearchParams(query).get("community");
  return COMMUNITIES.some((c) => c.id === id) ? id : null;
}

export function communityHash(id: string): string {
  return COMMUNITIES.some((c) => c.id === id)
    ? "#forum?community=" + encodeURIComponent(id)
    : "#forum";
}
