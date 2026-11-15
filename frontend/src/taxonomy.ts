/**
 * Explore Events categories: six top-level categories, each with
 * sub-categories. Events carry sub-category ids in `subcategories`; an event's
 * top-level categories are the parents of those ids. The catalog's original
 * `category` and `topic` fields are left unchanged because the Rust planner and
 * the frozen evaluation read them; they are only used here as a fallback.
 */
import type { CampusEvent } from "./types.ts";

export const TOP_CATEGORIES = [
  "Academic & Research",
  "Career & Jobs",
  "Community & Social",
  "Wellbeing",
  "Arts & Creative",
  "International Students",
] as const;
export type TopCategory = (typeof TOP_CATEGORIES)[number];

export interface SubCategory {
  id: string;
  label: string;
  /** One sub-category may sit under two categories (CPT/OPT). */
  parents: TopCategory[];
}

export const SUB_CATEGORIES: SubCategory[] = [
  {
    id: "writing-support",
    label: "Writing support",
    parents: ["Academic & Research"],
  },
  {
    id: "research-talks",
    label: "Research talks & seminars",
    parents: ["Academic & Research"],
  },
  {
    id: "course-planning",
    label: "Course & degree planning",
    parents: ["Academic & Research"],
  },
  {
    id: "meet-professors",
    label: "Meet professors",
    parents: ["Academic & Research"],
  },
  {
    id: "teaching-learning",
    label: "Teaching & learning workshops",
    parents: ["Academic & Research"],
  },
  {
    id: "ai-tech-skills",
    label: "AI & tech skills",
    parents: ["Academic & Research"],
  },
  { id: "internships", label: "Internships", parents: ["Career & Jobs"] },
  {
    id: "part-time-jobs",
    label: "Part-time & on-campus jobs",
    parents: ["Career & Jobs"],
  },
  { id: "full-time-jobs", label: "Full-time jobs", parents: ["Career & Jobs"] },
  {
    id: "cpt-opt",
    label: "CPT / OPT & visa sponsorship",
    parents: ["Career & Jobs", "International Students"],
  },
  {
    id: "networking",
    label: "Networking & alumni",
    parents: ["Career & Jobs"],
  },
  {
    id: "resume-interview",
    label: "Resume & interview prep",
    parents: ["Career & Jobs"],
  },
  {
    id: "career-exploration",
    label: "Career exploration & info sessions",
    parents: ["Career & Jobs"],
  },
  {
    id: "cultural-celebrations",
    label: "Cultural celebrations",
    parents: ["Community & Social"],
  },
  {
    id: "student-orgs",
    label: "Student orgs & clubs",
    parents: ["Community & Social"],
  },
  {
    id: "games-trivia",
    label: "Games & trivia",
    parents: ["Community & Social"],
  },
  {
    id: "food-gatherings",
    label: "Food & gatherings",
    parents: ["Community & Social"],
  },
  { id: "mindfulness", label: "Mindfulness & stress", parents: ["Wellbeing"] },
  { id: "fitness", label: "Fitness & movement", parents: ["Wellbeing"] },
  {
    id: "mental-health",
    label: "Mental-health support",
    parents: ["Wellbeing"],
  },
  {
    id: "hands-on-making",
    label: "Hands-on making",
    parents: ["Arts & Creative"],
  },
  {
    id: "performances-film",
    label: "Performances & film",
    parents: ["Arts & Creative"],
  },
  {
    id: "exhibitions",
    label: "Exhibitions & museums",
    parents: ["Arts & Creative"],
  },
  {
    id: "course-load",
    label: "Course load & leave of absence",
    parents: ["International Students"],
  },
  {
    id: "intl-community",
    label: "International student community",
    parents: ["International Students"],
  },
];

const BY_ID = new Map(SUB_CATEGORIES.map((s) => [s.id, s]));

export const subCategory = (id: string) => BY_ID.get(id);

/** Sub-categories listed under `cat`, in display order. */
export const subsOf = (cat: string) =>
  SUB_CATEGORIES.filter((s) => s.parents.includes(cat as TopCategory));

/** Legacy catalog/draft category name → new top-level category. */
export function legacyCategory(category: string, topic = ""): TopCategory {
  if ((TOP_CATEGORIES as readonly string[]).includes(category))
    return category as TopCategory;
  if (topic === "Arts & culture") return "Arts & Creative";
  if (topic === "Wellbeing") return "Wellbeing";
  switch (category) {
    case "Academic":
      return "Academic & Research";
    case "Career":
      return "Career & Jobs";
    case "Arts":
      return "Arts & Creative";
    case "Wellbeing":
      return "Wellbeing";
    case "Workshops":
      return topic === "AI & education"
        ? "Academic & Research"
        : topic === "Career"
          ? "Career & Jobs"
          : "Community & Social";
    default:
      return "Community & Social";
  }
}

/** Valid sub-category ids of an event (unknown ids are ignored). */
export const eventSubs = (e: Pick<CampusEvent, "subcategories">) =>
  (e.subcategories ?? []).filter((id) => BY_ID.has(id));

/** Top-level categories an event belongs to. */
export function eventCategories(
  e: Pick<CampusEvent, "subcategories" | "category" | "topic">,
): TopCategory[] {
  const subs = eventSubs(e);
  if (!subs.length) return [legacyCategory(e.category, e.topic)];
  const out = new Set<TopCategory>();
  for (const id of subs) for (const p of BY_ID.get(id)!.parents) out.add(p);
  return TOP_CATEGORIES.filter((c) => out.has(c));
}
