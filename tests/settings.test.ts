import assert from "node:assert/strict";
import { test } from "node:test";
import { paths } from "../frontend/src/icons.ts";
import { SETTINGS_SECTIONS, searchSettings } from "../frontend/src/settings.ts";

test("the settings bar lists the requested sections, each with its own icon", () => {
  assert.deepEqual(
    SETTINGS_SECTIONS.map((s) => s.label),
    [
      "General",
      "Notifications",
      "Sync",
      "AI Assistant",
      "Time Zone",
      "Event Buffer Time",
      "Reset Demo",
      "About",
    ],
  );
  const icons = SETTINGS_SECTIONS.map((s) => s.icon);
  assert.equal(new Set(icons).size, icons.length, "icons are distinct");
  for (const icon of icons) assert.ok(paths[icon], `missing icon ${icon}`);
});

test("existing settings are all still present", () => {
  const ids = SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
  for (const id of [
    "timezone",
    "buffer",
    "ai-mode",
    "reset",
    "about",
    "review",
  ])
    assert.ok(ids.includes(id), id);
});

test("search matches titles, descriptions and keywords across sections", () => {
  assert.deepEqual(
    searchSettings("buffer").flatMap((s) => s.items.map((i) => i.id)),
    ["buffer"],
  );
  assert.ok(
    searchSettings("ics").some((s) => s.items.some((i) => i.id === "export")),
  );
  assert.ok(
    searchSettings("watsonx").some((s) => s.id === "ai"),
    "keywords are searched",
  );
  // Every word must match; case is ignored.
  assert.deepEqual(
    searchSettings("TIME zone").map((s) => s.id),
    ["timezone"],
  );
  assert.deepEqual(searchSettings("zzz-nothing"), []);
  assert.equal(searchSettings("  ").length, SETTINGS_SECTIONS.length);
});
