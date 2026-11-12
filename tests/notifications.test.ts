import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allNotifications,
  DEFAULT_READ_IDS,
  DEMO_NOTIFICATIONS,
  filterNotifications,
  formatSentAt,
  fromUpdate,
  NO_FILTER,
  unreadOf,
} from "../frontend/src/notifications.ts";
import { ALL_BATCHES, applyNextBatch } from "../frontend/src/updates.ts";
import { fresh, restore } from "../frontend/src/state.ts";
import { COMMUNITIES } from "../frontend/src/communities.ts";
import { EVENTS } from "../frontend/src/data.ts";

const TZ = "America/New_York";

test("demo notifications link only to catalog events and communities", () => {
  for (const n of DEMO_NOTIFICATIONS) {
    if (n.eventId) assert.ok(EVENTS.some((e) => e.id === n.eventId), n.id);
    if (n.communityId)
      assert.ok(COMMUNITIES.some((c) => c.id === n.communityId), n.id);
  }
});

test("demo notifications are dated before the demo's Monday 9:00 AM", () => {
  const demoNow = "2026-11-02T14:00:00Z"; // 9:00 AM EST
  for (const n of DEMO_NOTIFICATIONS) assert.ok(n.sentAt < demoNow, n.id);
});

test("a fresh demo has both read and unread notifications", () => {
  const state = fresh();
  const list = allNotifications(state.appliedUpdateIds);
  const unread = unreadOf(list, state.readNotificationIds);
  assert.deepEqual(state.readNotificationIds, DEFAULT_READ_IDS);
  assert.ok(unread.length > 0);
  assert.ok(unread.length < list.length);
});

test("applied synthetic updates become unread notifications, newest first", () => {
  const { nextState } = applyNextBatch(fresh());
  const list = allNotifications(nextState.appliedUpdateIds);
  const fromBatch = ALL_BATCHES[0].updates.map((u) => `update-${u.id}`);
  for (const id of fromBatch) {
    const n = list.find((x) => x.id === id);
    assert.ok(n, id);
    assert.equal(n.kind, "update");
    assert.equal(n.synthetic, true);
  }
  const unreadIds = unreadOf(list, nextState.readNotificationIds).map((n) => n.id);
  for (const id of fromBatch) assert.ok(unreadIds.includes(id));
  const times = list.map((n) => n.sentAt);
  assert.deepEqual(times, [...times].sort().reverse());
});

test("update notifications name the event and the kind of change", () => {
  const u = ALL_BATCHES[0].updates[0];
  const n = fromUpdate(u);
  const title = EVENTS.find((e) => e.id === u.event_id)!.title;
  assert.ok(n.title.includes(title));
  assert.equal(n.body, u.details);
  assert.equal(n.eventId, u.event_id);
});

test("filters: unread only, type, inclusive campus-time date range, and sort", () => {
  const list = allNotifications([]);
  const read = ["n7", "n8"];
  const unread = filterNotifications(list, read, { ...NO_FILTER, unreadOnly: true }, TZ);
  assert.ok(unread.every((n) => !read.includes(n.id)));

  const community = filterNotifications(list, read, { ...NO_FILTER, kind: "community" }, TZ);
  assert.ok(community.length > 0);
  assert.ok(community.every((n) => n.kind === "community"));

  // n4 is sent 2026-10-31T23:48Z, which is Oct 31 at 7:48 PM in New York.
  const oct31 = filterNotifications(
    list,
    read,
    { ...NO_FILTER, after: "2026-10-31", before: "2026-10-31" },
    TZ,
  ).map((n) => n.id);
  assert.ok(oct31.includes("n4"));
  // n3 is 2026-11-01T00:15Z, still Oct 31 (8:15 PM) in New York.
  assert.ok(oct31.includes("n3"));
  assert.ok(!oct31.includes("n2"));

  const oldest = filterNotifications(list, read, { ...NO_FILTER, sort: "oldest" }, TZ);
  assert.equal(oldest[0].id, "n8");
  const newest = filterNotifications(list, read, NO_FILTER, TZ);
  assert.equal(newest[0].id, "n1");
});

test("sent time is shown in campus time with a zone abbreviation", () => {
  assert.equal(
    formatSentAt("2026-10-31T23:48:00Z", TZ),
    "Sat, Oct 31, 2026, 7:48 PM EDT",
  );
});

test("restore keeps saved read IDs and defaults older saves", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored: Record<string, unknown> = { readNotificationIds: ["n1", 4, "update-u1"] };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  });
  try {
    assert.deepEqual(restore().readNotificationIds, ["n1", "update-u1"]);
    stored = { onboarded: true };
    assert.deepEqual(restore().readNotificationIds, DEFAULT_READ_IDS);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
