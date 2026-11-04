import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fresh, restore, STORAGE_KEY } from "../frontend/src/state.ts";
import { DEMO } from "../frontend/src/config.ts";
import {
  readStudentProfile,
  saveStudentProfile,
  profileInitials,
} from "../frontend/src/studentProfile.ts";
import {
  StudentProfilePage,
  StudentProfileCard,
} from "../frontend/src/StudentProfile.tsx";
import { schedulePayload } from "../frontend/src/api.ts";

test("legacy profiles reuse existing fictional defaults without inventing a bio", () => {
  for (const input of [undefined, null, [], "invalid"])
    assert.deepEqual(readStudentProfile(input), {
      status: "Graduate student",
      university: DEMO.campus_name,
      bio: "",
    });
  assert.equal(
    readStudentProfile({ status: "", university: "", bio: "" }).university,
    "",
  );
  assert.equal(profileInitials("  Demo Student  "), "DS");
});
test("editing profile preserves preferences, plans, memberships, conversations and minimal payloads", () => {
  const previous = {
    ...fresh(),
    plan: ["e1"],
    rsvps: ["e1"],
    joinedCommunities: ["ai"],
    messages: [{ role: "user" as const, text: "Previous search" }],
  };
  const next = saveStudentProfile(previous, " Demo Student ", {
    status: "Student",
    university: "Fictional university",
    bio: "LOCAL_BIO",
  });
  assert.equal(next.name, "Demo Student");
  const { name: _, studentProfile: __, ...retained } = next;
  const { name: ___, ...original } = previous;
  assert.deepEqual(retained, original);
  assert.deepEqual(schedulePayload(next), schedulePayload(previous));
  assert.throws(
    () => saveStudentProfile(previous, " ", readStudentProfile(undefined)),
    /display name/,
  );
});
test("profile fields restore with bounds and preserve saved activity", () => {
  const stored = {
    ...fresh(),
    onboarded: true,
    plan: ["e1"],
    rsvps: ["e1"],
    studentProfile: {
      status: "a".repeat(80),
      university: "b".repeat(140),
      bio: "c".repeat(350),
    },
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) =>
        key === STORAGE_KEY ? JSON.stringify(stored) : null,
    },
  });
  try {
    const result = restore();
    assert.equal(result.studentProfile?.status.length, 60);
    assert.equal(result.studentProfile?.university.length, 120);
    assert.equal(result.studentProfile?.bio.length, 280);
    assert.deepEqual(result.plan, ["e1"]);
    assert.deepEqual(result.rsvps, ["e1"]);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("profile sections show real demo state and escape biography text", () => {
  const state = saveStudentProfile(
    { ...fresh(), joinedCommunities: ["ai"], plan: ["e1"], rsvps: ["e1"] },
    "Demo Student",
    {
      status: "Student",
      university: DEMO.campus_name,
      bio: "<script>no</script>",
    },
  );
  const markup = renderToStaticMarkup(
    createElement(StudentProfilePage, {
      state,
      update: () => {},
      notify: () => {},
      onPreferences: () => {},
      onActivity: () => {},
      onDirtyChange: () => {},
    }),
  );
  for (const heading of [
    "Basic Information",
    "About Me",
    "My Interests",
    "Campus Involvement",
    "My Activity",
  ])
    assert.ok(markup.includes(heading));
  assert.match(markup, /AI &amp; learning circle/);
  assert.match(markup, /&lt;script&gt;no&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>/);
  const card = renderToStaticMarkup(
    createElement(StudentProfileCard, { state, onView: () => {} }),
  );
  assert.match(card, /View Profile/);
  assert.match(card, /Demo Student/);
});
