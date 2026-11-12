import assert from "node:assert/strict";
import test from "node:test";
import { validateBasicInformation } from "../frontend/src/profile.ts";
import { restore } from "../frontend/src/state.ts";

test("basic profile information trims values and permits empty optional fields", () => {
  assert.deepEqual(
    validateBasicInformation({
      name: "  Alex Rivera  ",
      studentStatus: "  ",
      university: "",
      major: "  ",
    }),
    {
      valid: true,
      value: {
        name: "Alex Rivera",
        studentStatus: "",
        university: "",
        major: "",
      },
    },
  );
});

test("basic profile information requires a display name", () => {
  assert.deepEqual(
    validateBasicInformation({
      name: "   ",
      studentStatus: "Graduate student",
      university: "",
      major: "",
    }),
    { valid: false, error: "Enter a display name to continue." },
  );
});

test("basic profile information rejects values beyond field limits", () => {
  assert.deepEqual(
    validateBasicInformation({
      name: "Judy",
      studentStatus: "Graduate student",
      university: "U".repeat(121),
      major: "",
    }),
    {
      valid: false,
      error: "One or more fields exceed the maximum length.",
    },
  );
});

test("basic profile fields restore from the existing browser-local state", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify({
          name: "Casey Morgan",
          studentStatus: "Undergraduate student",
          university: "",
          major: "Environmental Studies",
        }),
    },
  });
  try {
    const state = restore();
    assert.equal(state.name, "Casey Morgan");
    assert.equal(state.studentStatus, "Undergraduate student");
    assert.equal(state.university, "");
    assert.equal(state.major, "Environmental Studies");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
