import assert from "node:assert/strict";
import { test } from "node:test";
import { fresh, restore } from "../frontend/src/state.ts";
import { ROLE_INFO, isRole, profileMenuItems } from "../frontend/src/identity.ts";

test("a new demo starts signed out; only an explicit true restores sign-in", () => {
  assert.equal(fresh().signedIn, false);
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored: Record<string, unknown> = { signedIn: true, name: "Ada" };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  });
  try {
    assert.equal(restore().signedIn, true);
    assert.equal(restore().name, "Ada");
    stored = { signedIn: "yes" };
    assert.equal(restore().signedIn, false);
    stored = {};
    assert.equal(restore().signedIn, false);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("identity defaults to Student; only a known role is restored", () => {
  assert.equal(fresh().role, "student");
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored: Record<string, unknown> = { signedIn: true, role: "admin" };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  });
  try {
    assert.equal(restore().role, "admin");
    stored = { signedIn: true, role: "superuser" };
    assert.equal(restore().role, "student");
    stored = { signedIn: true };
    assert.equal(restore().role, "student");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("profile menu shows the other identity and admin-only review", () => {
  assert.deepEqual(
    profileMenuItems("student").map((i) => i.label),
    ["View profile", "Sign in as Admin", "Sign out"],
  );
  assert.deepEqual(
    profileMenuItems("admin").map((i) => i.label),
    [
      "Create event",
      "Team data review",
      "View profile",
      "Sign in as Student",
      "Sign out",
    ],
  );
  assert.equal(ROLE_INFO.admin.label, "Admin");
  assert.match(ROLE_INFO.admin.summary, /Drafts stay in this browser/);
  assert.equal(isRole("admin"), true);
  assert.equal(isRole("Admin"), false);
});
