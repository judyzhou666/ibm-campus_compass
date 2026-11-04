import assert from "node:assert/strict";
import { test } from "node:test";
import {
  communityFromHash,
  communityHash,
  toggleCommunityMembership,
} from "../frontend/src/communities.ts";
import { fresh, restore } from "../frontend/src/state.ts";

test("a community and a conversation with the same ID remain independent", () => {
  const conversation = { ...fresh(), joined: ["ai"] };
  assert.deepEqual(conversation.joinedCommunities, []);
  const member = toggleCommunityMembership(conversation, "ai");
  assert.deepEqual(member.joinedCommunities, ["ai"]);
  assert.deepEqual(member.joined, ["ai"]);
  const left = toggleCommunityMembership(member, "ai");
  assert.deepEqual(left.joinedCommunities, []);
  assert.deepEqual(left.joined, ["ai"]);
  assert.deepEqual(conversation.joinedCommunities, []);
});

test("named community links round-trip through navigation and reject unknown groups", () => {
  assert.equal(communityFromHash(communityHash("ai")), "ai");
  assert.equal(communityFromHash(communityHash("global")), "global");
  assert.equal(communityFromHash("#forum"), null);
  assert.equal(communityFromHash("#forum?community=missing"), null);
  assert.equal(communityFromHash("#dashboard?community=ai"), null);
  assert.equal(communityHash("missing"), "#forum");
});

test("restore preserves independent memberships without inferring them from old post titles", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored: { joined: string[]; joinedCommunities?: string[] } = {
    joined: ["ai"],
    joinedCommunities: ["global", "missing"],
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  });
  try {
    assert.deepEqual(restore().joinedCommunities, ["global"]);
    assert.deepEqual(restore().joined, ["ai"]);
    stored = { joined: ["ai"] };
    assert.deepEqual(restore().joinedCommunities, []);
    assert.deepEqual(restore().joined, ["ai"]);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
