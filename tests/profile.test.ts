import assert from "node:assert/strict";
import test from "node:test";
import {
  basicInformationPreview,
  hasBasicInformationChanges,
  profileAvatarInitial,
  validateBasicInformation,
} from "../frontend/src/profile.ts";
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

test("profile preview follows the current draft values as fields change", () => {
  const saved = {
    name: "Judy",
    studentStatus: "Graduate student",
    university: "",
    major: "",
  };
  const initialPreview = basicInformationPreview(saved);
  assert.equal(initialPreview.avatar, "J");
  assert.equal(initialPreview.name, "Judy");
  assert.equal(initialPreview.university, "Not added yet");
  assert.equal(initialPreview.major, "Not added yet");

  const updatedDraft = {
    name: "Alex Rivera",
    studentStatus: "Undergraduate student",
    university: "Example University",
    major: "Environmental Studies",
  };
  assert.deepEqual(basicInformationPreview(updatedDraft), {
    avatar: "A",
    name: "Alex Rivera",
    studentStatus: "Undergraduate student",
    university: "Example University",
    major: "Environmental Studies",
  });
  assert.deepEqual(saved, {
    name: "Judy",
    studentStatus: "Graduate student",
    university: "",
    major: "",
  });
});

test("profile dirty detection clears when draft values return to saved values", () => {
  const saved = {
    name: "Judy",
    studentStatus: "Graduate student",
    university: "Example University",
    major: "Learning Sciences",
  };
  assert.equal(hasBasicInformationChanges(saved, saved), false);
  for (const field of ["name", "studentStatus", "university", "major"] as const) {
    const changed = { ...saved, [field]: `${saved[field]} updated` };
    assert.equal(hasBasicInformationChanges(changed, saved), true, field);
    assert.equal(
      hasBasicInformationChanges(
        { ...changed, [field]: saved[field] },
        saved,
      ),
      false,
      field,
    );
  }
  assert.deepEqual(saved, {
    name: "Judy",
    studentStatus: "Graduate student",
    university: "Example University",
    major: "Learning Sciences",
  });
});

test("profile dirty detection ignores whitespace removed when saving", () => {
  const saved = {
    name: "Judy",
    studentStatus: "Graduate student",
    university: "Example University",
    major: "Learning Sciences",
  };
  assert.equal(
    hasBasicInformationChanges(
      {
        ...saved,
        name: "Judy ",
        studentStatus: " Graduate student  ",
        university: "Example University ",
        major: "  Learning Sciences",
      },
      saved,
    ),
    false,
  );
  assert.equal(
    hasBasicInformationChanges({ ...saved, university: "Example University 2" }, saved),
    true,
  );
  assert.deepEqual(
    validateBasicInformation({
      ...saved,
      name: "Judy ",
      studentStatus: " Graduate student  ",
    }),
    {
      valid: true,
      value: { ...saved },
    },
  );
});

test("preview and sidebar avatar initials share uppercase formatting and fallbacks", () => {
  for (const name of ["judy", " Judy "]) {
    const preview = basicInformationPreview({
      name,
      studentStatus: "Graduate student",
      university: "",
      major: "",
    });
    assert.equal(preview.avatar, "J");
    assert.equal(preview.avatar, profileAvatarInitial(name, "J"));
  }
  assert.equal(profileAvatarInitial("  ", "J"), "J");
  assert.equal(basicInformationPreview({
    name: "  ",
    studentStatus: "",
    university: "",
    major: "",
  }).avatar, "?");
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

test("status choices preserve every saved non-predefined value exactly", async () => {
  const { STUDENT_STATUSES, studentStatusChoice } =
    await import("../frontend/src/profile.ts");
  for (const status of STUDENT_STATUSES)
    assert.equal(studentStatusChoice(status), status);
  for (const status of [
    "",
    "Visiting researcher",
    "graduate student",
    " Graduate student ",
    "other",
  ])
    assert.equal(studentStatusChoice(status), "other");
});

test("custom status retains the existing optional-field and length validation", () => {
  const input = {
    name: "Casey",
    studentStatus: "Visiting researcher",
    university: "",
    major: "",
  };
  assert.equal(validateBasicInformation(input).valid, true);
  assert.equal(
    validateBasicInformation({ ...input, studentStatus: "x".repeat(80) }).valid,
    true,
  );
  assert.equal(
    validateBasicInformation({ ...input, studentStatus: "x".repeat(81) }).valid,
    false,
  );
  assert.equal(
    validateBasicInformation({ ...input, studentStatus: "" }).valid,
    true,
  );
});
