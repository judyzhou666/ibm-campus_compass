/**
 * Notifications for the Campus Compass demo.
 *
 * Two fictional sources feed one list:
 * - a fixed set of demo notifications (invitations, community activity,
 *   reminders), dated before the frozen demo "now" of Monday 9:00 AM;
 * - synthetic event updates the student has applied with "Check for updates"
 *   (see updates.ts), one notification per update.
 *
 * Read state is browser-local (`readNotificationIds` in the demo state).
 */
import { EVENTS } from "./data.ts";
import { COMMUNITIES } from "./communities.ts";
import { ALL_UPDATES } from "./updates.ts";
import type { EventUpdate } from "./types.ts";

export type NotificationKind = "update" | "event" | "community" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO timestamp. */
  sentAt: string;
  /** Related catalog event, opened with "View event". */
  eventId?: string;
  /** Related community, opened with "Open community". */
  communityId?: string;
  /** Offers an "Explore events" button. */
  opensExplore?: boolean;
  /** True for notifications produced by the synthetic update loop. */
  synthetic?: boolean;
}

export const KIND_LABELS: Record<NotificationKind, string> = {
  update: "Event updates",
  event: "Events & invitations",
  community: "Communities",
  system: "Campus Compass",
};

const eventTitle = (id: string) =>
  EVENTS.find((e) => e.id === id)?.title ?? "A campus event";
const communityName = (id: string) =>
  COMMUNITIES.find((c) => c.id === id)?.name ?? "A community";

/** Fixed fictional notifications present in every demo. */
export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    kind: "system",
    title: "Welcome to Campus Compass",
    body: "Your demo week starts today. Save events you like, add classes to My Calendar, and ask the AI Planner to fit events around them. Every event, community and notification in this demo is fictional.",
    sentAt: "2026-11-02T13:30:00Z",
  },
  {
    id: "n2",
    kind: "event",
    title: `Coming up this week: ${eventTitle("e1")}`,
    body: `${eventTitle("e1")} is on Tuesday afternoon. Add it to My Calendar if it fits around your classes.`,
    sentAt: "2026-11-01T23:00:00Z",
    eventId: "e1",
  },
  {
    id: "n3",
    kind: "community",
    title: `New discussion in ${communityName("ai")}`,
    body: `A member of ${communityName("ai")} started a thread asking how classmates use AI tools for study planning. Open the community to read and reply.`,
    sentAt: "2026-11-01T00:15:00Z",
    communityId: "ai",
  },
  {
    id: "n4",
    kind: "event",
    title: `Event invitation: ${eventTitle("e11")}`,
    body: `${communityName("global")} invites you to ${eventTitle("e11")} on Thursday. Bring a favourite tea or snack from home to share.`,
    sentAt: "2026-10-31T23:48:00Z",
    eventId: "e11",
    communityId: "global",
  },
  {
    id: "n5",
    kind: "community",
    title: `New in ${communityName("social")}: weekend trail meetup`,
    body: `${communityName("social")} posted a weekend trail meetup thread. Members are comparing times and meeting points.`,
    sentAt: "2026-10-30T21:20:00Z",
    communityId: "social",
  },
  {
    id: "n6",
    kind: "community",
    title: `Reply to a thread in ${communityName("career")}`,
    body: `Someone replied to "Questions for alumni mentors" in ${communityName("career")}. Open the community to see the conversation.`,
    sentAt: "2026-10-29T16:05:00Z",
    communityId: "career",
  },
  {
    id: "n7",
    kind: "event",
    title: `Event invitation: ${eventTitle("e13")}`,
    body: `${communityName("arts")} invites you to ${eventTitle("e13")} on Friday evening. Snacks are provided.`,
    sentAt: "2026-10-28T18:30:00Z",
    eventId: "e13",
    communityId: "arts",
  },
  {
    id: "n8",
    kind: "system",
    title: "Your weekly digest is ready",
    body: "New events matching your interests were added for next week. Open Explore Events to browse them.",
    sentAt: "2026-10-26T12:00:00Z",
    opensExplore: true,
  },
];

/** Demo notifications that start as already read, so both states show. */
export const DEFAULT_READ_IDS = ["n7", "n8"];

const UPDATE_TITLES: Record<EventUpdate["kind"], string> = {
  cancelled: "Event cancelled",
  full: "Event full",
  time_moved: "Time changed",
  room_changed: "Room changed",
};

export function fromUpdate(u: EventUpdate): AppNotification {
  return {
    id: `update-${u.id}`,
    kind: "update",
    title: `${UPDATE_TITLES[u.kind]}: ${eventTitle(u.event_id)}`,
    body: u.details,
    sentAt: u.timestamp,
    eventId: u.event_id,
    synthetic: true,
  };
}

/** Every notification the student has received, newest first. */
export function allNotifications(appliedUpdateIds: string[]): AppNotification[] {
  const updates = ALL_UPDATES.filter((u) => appliedUpdateIds.includes(u.id)).map(
    fromUpdate,
  );
  return [...DEMO_NOTIFICATIONS, ...updates].sort((a, b) =>
    b.sentAt.localeCompare(a.sentAt),
  );
}

export const unreadOf = (list: AppNotification[], readIds: string[]) =>
  list.filter((n) => !readIds.includes(n.id));

export interface NotificationFilter {
  unreadOnly: boolean;
  kind: NotificationKind | "all";
  /** Inclusive campus-time date, `YYYY-MM-DD`; empty for no limit. */
  after: string;
  /** Inclusive campus-time date, `YYYY-MM-DD`; empty for no limit. */
  before: string;
  sort: "newest" | "oldest";
}

export const NO_FILTER: NotificationFilter = {
  unreadOnly: false,
  kind: "all",
  after: "",
  before: "",
  sort: "newest",
};

/** `YYYY-MM-DD` of an ISO timestamp in the given time zone. */
export const dateIn = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

export function filterNotifications(
  list: AppNotification[],
  readIds: string[],
  f: NotificationFilter,
  timeZone: string,
): AppNotification[] {
  const kept = list.filter((n) => {
    if (f.unreadOnly && readIds.includes(n.id)) return false;
    if (f.kind !== "all" && n.kind !== f.kind) return false;
    const day = dateIn(n.sentAt, timeZone);
    if (f.after && day < f.after) return false;
    if (f.before && day > f.before) return false;
    return true;
  });
  return kept.sort((a, b) =>
    f.sort === "newest"
      ? b.sentAt.localeCompare(a.sentAt)
      : a.sentAt.localeCompare(b.sentAt),
  );
}

/** e.g. "Sat, Oct 31, 2026, 7:48 PM EDT" in the given time zone. */
export const formatSentAt = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
