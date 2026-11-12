import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO } from "../frontend/src/config.ts";
import { COMMUNITIES } from "../frontend/src/communities.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { NEWS, newsDate, newsFeed } from "../frontend/src/news.ts";

test("every news post links to a catalog event or a demo community", () => {
  for (const post of NEWS) {
    assert.ok(post.eventId || post.communityId, post.id);
    if (post.eventId)
      assert.ok(
        EVENTS.some((e) => e.id === post.eventId),
        post.id,
      );
    if (post.communityId)
      assert.ok(
        COMMUNITIES.some((c) => c.id === post.communityId),
        post.id,
      );
  }
});

test("news is dated on or before the demo's Monday and listed newest first", () => {
  for (const post of NEWS) assert.ok(post.date <= DEMO.week_start, post.id);
  const dates = newsFeed().map((p) => p.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("news dates read as a full weekday and date", () => {
  assert.equal(newsDate("2026-11-02"), "Monday, November 2, 2026");
});
