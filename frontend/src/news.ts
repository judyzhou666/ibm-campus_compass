/**
 * Fictional campus news for the My Dashboard "News" section. Every post,
 * author and organization is invented for this demo; each post links to a
 * catalog event or a demo community so a student can follow it up.
 */
import { EVENTS } from "./data.ts";
import { COMMUNITIES } from "./communities.ts";

export interface NewsPost {
  id: string;
  title: string;
  /** Date posted (or last updated), YYYY-MM-DD, on or before the demo "now". */
  date: string;
  /** True when `date` is an update to an earlier post. */
  updated?: boolean;
  author: string;
  /** Who the post is for, e.g. a community or school. */
  org: string;
  summary: string;
  /** Two short lines for the poster art. */
  poster: [string, string];
  /** Poster colour, matching event card tones. */
  tone: "academic" | "career" | "social" | "arts" | "wellbeing";
  eventId?: string;
  communityId?: string;
}

const community = (id: string) =>
  COMMUNITIES.find((c) => c.id === id)?.name ?? "a campus community";

export const NEWS: NewsPost[] = [
  {
    id: "news-1",
    title: "Volunteers wanted for the Friday community lunch",
    date: "2026-11-02",
    author: "Sam T.",
    org: "Graduate Student Center",
    summary:
      "We need a few helpers to set up tables and welcome newcomers at Friday's free lunch, an easy place to meet someone new between classes. The lunch needs an RSVP, so add it from the event details.",
    poster: ["LUNCH", "TOGETHER"],
    tone: "social",
    eventId: "e16",
  },
  {
    id: "news-2",
    title: `${community("social")} newsletter, issue 4`,
    date: "2026-11-01",
    updated: true,
    author: "Maya R.",
    org: community("social"),
    summary:
      "This week: the Wednesday noon run is back, a relaxed 5K loop around campus where all paces are welcome, plus a picnic and lawn games on Monday evening. Suggest next week's plans in the community thread.",
    poster: ["MOVE", "EXPLORE"],
    tone: "wellbeing",
    eventId: "e33",
    communityId: "social",
  },
  {
    id: "news-3",
    title: "Generative art studio opens to every major",
    date: "2026-10-30",
    author: "Lena K.",
    org: "Arts Collective",
    summary:
      "Use AI tools to make images, sounds and text-based art on Thursday afternoon. Drop in with curiosity; no prior art or coding experience is needed.",
    poster: ["MAKE", "PLAY"],
    tone: "arts",
    eventId: "e35",
    communityId: "arts",
  },
  {
    id: "news-4",
    title: "Student research lightning talks this Monday",
    date: "2026-10-28",
    author: "Dr. Imani O.",
    org: community("research"),
    summary:
      "Five short talks on learning, technology and research on Monday afternoon. Drop in to listen, stay for coffee and bring one good question for the speakers.",
    poster: ["FRESH", "IDEAS"],
    tone: "academic",
    eventId: "e14",
    communityId: "research",
  },
  {
    id: "news-5",
    title: `${community("global")} newsletter, issue 2`,
    date: "2026-10-26",
    updated: true,
    author: "Wei L.",
    org: community("global"),
    summary:
      "Thank you to everyone who brought snacks from home last week! The international tea table is back on Thursday; we are collecting favourite recipes for a shared booklet.",
    poster: ["TEA", "TALK"],
    tone: "social",
    eventId: "e11",
    communityId: "global",
  },
  {
    id: "news-6",
    title: "Coffee with alumni: bring one question",
    date: "2026-10-22",
    author: "Jordan P.",
    org: community("career"),
    summary:
      "An informal career chat over coffee on Thursday: come with one question about how alumni found their path. Who can attend is still being confirmed, so check the event details before you go.",
    poster: ["COFFEE", "PATHS"],
    tone: "career",
    eventId: "e15",
    communityId: "career",
  },
];

/** Newest first. */
export const newsFeed = (posts = NEWS) =>
  [...posts].sort((a, b) => b.date.localeCompare(a.date));

/** "Monday, November 2, 2026" */
export const newsDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** Title of a post's linked event, if any. */
export const newsEventTitle = (post: NewsPost) =>
  EVENTS.find((e) => e.id === post.eventId)?.title;
