import assert from "node:assert/strict";
import test from "node:test";
import { validateBasicInformation } from "../frontend/src/profile.ts";

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
