/**
 * Settings page structure: the sections in its left bar and the settings in
 * each, with the words "Search settings" matches against. Settings.tsx renders
 * each item's control by its id.
 */
export interface SettingItem {
  id: string;
  title: string;
  /** Shown under the title; also searched. */
  text: string;
  /** Extra search terms that are not shown. */
  keywords?: string;
}
export interface SettingsSection {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  items: SettingItem[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    icon: "monitor",
    blurb: "Your demo profile, layout and team tools.",
    items: [
      {
        id: "profile",
        title: "Demo profile",
        text: "Your name and sign-in status. Interests, goals and busy times are edited in Profile.",
        keywords: "name account sign in interests goals major",
      },
      {
        id: "sidebar",
        title: "Compact sidebar",
        text: "Shrink the main sidebar to icons on larger screens.",
        keywords: "collapse navigation menu layout icons",
      },
      {
        id: "review",
        title: "Team tools",
        text: "Read-only review of fictional event quality, separate from student planning.",
        keywords: "synthetic data review quality team",
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "bell",
    blurb: "Messages about events, communities and updates.",
    items: [
      {
        id: "unread",
        title: "Unread notifications",
        text: "Open your notifications or mark them all as read.",
        keywords: "messages inbox bell read",
      },
      {
        id: "updates",
        title: "Synthetic event updates",
        text: "Apply the next batch of fictional cancellations, capacity, time or room changes.",
        keywords: "check for updates cancellation full moved room",
      },
    ],
  },
  {
    id: "sync",
    label: "Sync",
    icon: "refresh",
    blurb: "Getting your plan out of Campus Compass.",
    items: [
      {
        id: "export",
        title: "Calendar export",
        text: "Download the events you chose as an .ics file for any calendar app. Cancelled events are left out.",
        keywords: "ics download calendar file",
      },
      {
        id: "external",
        title: "External calendars",
        text: "This demo does not connect to Google, Outlook or Apple calendars.",
        keywords: "google outlook apple connect account",
      },
      {
        id: "storage",
        title: "Where your data is kept",
        text: "Your profile, plans, saved events and posts stay in this browser. Planner requests go to the local Campus Compass server.",
        keywords: "local storage browser privacy data",
      },
    ],
  },
  {
    id: "ai",
    label: "AI Assistant",
    icon: "spark",
    blurb: "How the AI Planner answers.",
    items: [
      {
        id: "ai-mode",
        title: "AI connection",
        text: "Simulated planner by default. The server can run a live IBM watsonx interpreter when configured; each chat reply is labelled with the mode that answered.",
        keywords: "watsonx granite ibm simulated model",
      },
      {
        id: "planner",
        title: "AI Planner",
        text: "Ask for events that fit your interests and free time.",
        keywords: "chat plan recommend",
      },
    ],
  },
  {
    id: "timezone",
    label: "Time Zone",
    icon: "globe",
    blurb: "The zone dates and times are shown in.",
    items: [
      {
        id: "timezone",
        title: "Time zone",
        text: "Shows the demo date and time, the day marked today and, in event details, each event's start in this zone. Schedules, the planner and calendar export stay in campus time. Resets on demo reset.",
        keywords: "zone clock local",
      },
    ],
  },
  {
    id: "buffer",
    label: "Event Buffer Time",
    icon: "clock",
    blurb: "Room between commitments.",
    items: [
      {
        id: "buffer",
        title: "Leave time to get there",
        text: "Keep a 15-minute buffer between events and busy commitments.",
        keywords: "travel buffer 15 minutes gap",
      },
    ],
  },
  {
    id: "reset",
    label: "Reset Demo",
    icon: "reset",
    blurb: "Start the demonstration again.",
    items: [
      {
        id: "reset",
        title: "Start the demonstration again",
        text: "Clear locally saved plans, messages, posts, and preferences.",
        keywords: "reset restore clear",
      },
    ],
  },
  {
    id: "about",
    label: "About",
    icon: "info",
    blurb: "The project behind this demo.",
    items: [
      {
        id: "about",
        title: "About Campus Compass",
        text: "A higher-education opportunity discovery project for the IBM AI Experiential Learning Lab.",
        keywords: "team version ibm project fictional",
      },
    ],
  },
];

/** Sections with only the items matching every word of `query`. */
export function searchSettings(query: string, sections = SETTINGS_SECTIONS) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        const text =
          `${s.label} ${item.title} ${item.text} ${item.keywords ?? ""}`.toLowerCase();
        return words.every((w) => text.includes(w));
      }),
    }))
    .filter((s) => s.items.length);
}
