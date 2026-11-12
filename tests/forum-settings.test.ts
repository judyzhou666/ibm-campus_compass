import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEMO,
  isTimeZone,
  storageKey,
  timeIn,
  TIME_ZONES,
} from "../frontend/src/config.ts";
import { restore } from "../frontend/src/state.ts";

function withStored<T>(stored: unknown, run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  });
  try {
    return run();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("restore drops an invalid stored time zone instead of crashing headings", () => {
  assert.equal(withStored({ timezone: "Mars/Base" }, restore).timezone, "");
  assert.equal(
    withStored({ timezone: "Asia/Tokyo" }, restore).timezone,
    "Asia/Tokyo",
  );
  assert.ok(TIME_ZONES.every(isTimeZone));
  assert.equal(isTimeZone(""), false);
  assert.equal(isTimeZone(42), false);
});

test("event start converts from campus time to the viewer's zone", () => {
  // Tue Nov 3, 3:00 PM EST = Wed Nov 4, 5:00 AM in Tokyo
  assert.equal(timeIn(1, 900, "Asia/Tokyo"), "Wed, Nov 4, 5:00 AM");
  assert.equal(timeIn(1, 900, DEMO.time_zone), "Tue, Nov 3, 3:00 PM");
});

test("the current demo week does not inherit the legacy week's saved state", () => {
  assert.notEqual(storageKey(), "campus-compass-demo-v1");
  assert.equal(
    storageKey({ ...DEMO, week_start: "2026-10-19" }),
    "campus-compass-demo-v1",
  );
});

test("legacy posts get stable ids; comments and drafts survive reload", () => {
  const state = withStored(
    {
      posts: [
        { name: "A", title: "Newer", body: "", tag: "Local demo post" },
        {
          id: "p1",
          name: "B",
          title: "Older",
          body: "",
          tag: "Career connections",
          communityId: "career",
        },
        { name: "C", title: "Bad", body: 1, tag: "x" },
      ],
      comments: [
        { postId: "s1", name: "Judy", text: "See you there" },
        { postId: 3, name: "x", text: "dropped" },
      ],
      postDraft: {
        title: "Half done",
        body: "More later",
        communityId: "nope",
      },
    },
    restore,
  );
  assert.deepEqual(
    state.posts.map((p) => [p.id, p.communityId]),
    [
      ["legacy-2", undefined],
      ["p1", "career"],
    ],
  );
  assert.deepEqual(state.comments, [
    { postId: "s1", name: "Judy", text: "See you there" },
  ]);
  assert.deepEqual(state.postDraft, {
    title: "Half done",
    body: "More later",
    communityId: "",
  });
});

test("restore keeps saved forum likes and drops invalid entries", () => {
  assert.deepEqual(
    withStored({ likes: ["post:p1", "comment:p1:0", 42, "other:x", null] }, restore).likes,
    ["post:p1", "comment:p1:0"],
  );
  assert.deepEqual(withStored({ likes: "post:p1" }, restore).likes, []);
  assert.deepEqual(withStored({}, restore).likes, []);
});
