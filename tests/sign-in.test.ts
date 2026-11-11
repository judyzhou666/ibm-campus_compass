import assert from "node:assert/strict";
import { test } from "node:test";
import { fresh, restore } from "../frontend/src/state.ts";

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
