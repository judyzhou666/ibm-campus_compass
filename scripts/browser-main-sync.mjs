import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(new URL("../data/demo.json", import.meta.url), "utf8"),
);
const key = `campus-compass-demo-v1:${config.campus_id}:${config.week_start}:${config.time_zone}`;
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4217";
try {
  for (const [width, offline] of [
    [1280, false],
    [390, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let allowDialog = false;
    page.on("dialog", (d) => (allowDialog ? d.accept() : d.dismiss()));
    page.on("request", (req) => {
      if (req.url().endsWith("/api/plan")) requests.push(req.postDataJSON());
    });
    if (offline) await page.route("**/api/**", (r) => r.abort());
    await page.goto(base + "/#home");
    await page
      .getByRole("button", { name: "Personalize my demo", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: /Shape your campus|My Preferences|Quick preference/,
      })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    const stored = () =>
      page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    const nav = async (hash) => {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(120);
    };
    const send = async (text) => {
      const n = (await stored()).messages.length;
      const box = page.getByLabel("Message your AI planner");
      await box.fill(text);
      await box.press("Enter");
      await page.waitForFunction(
        ({ key, n }) =>
          JSON.parse(localStorage.getItem(key)).messages.length >= n + 2,
        { key, n },
      );
      await page.getByLabel("Message your AI planner").isEnabled();
      await page.waitForTimeout(120);
    };
    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    await page
      .getByRole("heading", { name: "Browse by category", exact: true })
      .waitFor();
    await nav("#dashboard");
    await page.getByRole("heading", { name: "News", exact: true }).waitFor();
    await page.locator(".news-card").first().click();
    const details = page.getByRole("dialog");
    await details
      .getByRole("button", { name: "Back to events", exact: true })
      .waitFor();
    await details
      .getByRole("button", { name: "Follow", exact: true })
      .first()
      .click();
    assert.ok(
      (await details
        .getByRole("button", { name: "Following", exact: true })
        .count()) > 0,
    );
    await details.getByRole("button", { name: "Contact", exact: true }).click();
    await details
      .getByRole("button", { name: "Back to events", exact: true })
      .click();

    await nav("#settings");
    await page
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor();
    await nav("#forum");
    await page
      .getByRole("heading", {
        name: "Good things start with a hello.",
        exact: true,
      })
      .waitFor();
    await nav("#my-profile");
    await page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Student status", { exact: true }).inputValue(),
      "",
    );
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Fictional Merge Student");
    await page
      .getByLabel("University", { exact: true })
      .fill("Fictional demo university");
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click();
    await page.reload();
    assert.equal((await stored()).name, "Fictional Merge Student");
    await nav("#profile");
    const major = page.getByLabel(
      "Major or interdisciplinary interests (optional)",
      { exact: true },
    );
    await major.fill("Education");
    await page
      .getByLabel("Research / career exploration goals (optional)", {
        exact: true,
      })
      .fill("Research opportunities");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await nav("#planner");
    await send("Career on Tuesday after 1 PM");
    assert.deepEqual(requests.at(-1).profile, {
      major: "",
      goals: "",
      goal_types: [],
    });
    await nav("#profile");
    await page
      .getByLabel(
        "Allow my saved major, free-text goals and profile goal types to be sent to IBM watsonx for profile-based event ranking",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await nav("#planner");
    await send("Career on Tuesday after 1 PM");
    assert.equal(requests.at(-1).profile.major, "Education");
    assert.equal(requests.at(-1).profile.goals, "Research opportunities");
    await nav("#profile");
    await page
      .getByLabel(
        "Allow my saved major, free-text goals and profile goal types to be sent to IBM watsonx for profile-based event ranking",
        { exact: true },
      )
      .uncheck();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await nav("#planner");
    await send("Explore beyond my interests after 3");
    await send("PM");
    assert.equal((await stored()).constraints.explore, true);
    assert.equal((await stored()).constraints.mode, "discovery");
    assert.equal((await stored()).constraints.after, 900);
    assert.equal(requests.at(-1).continuation, true);
    assert.equal(requests.at(-1).profile.major, "");
    await send("Build my weekly plan to explore career options");
    assert.equal((await stored()).constraints.mode, "plan-building");
    await send("Explore social events to make friends this week");
    assert.equal((await stored()).constraints.mode, "discovery");
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await send("AI events on Tuesday after 1 PM");
    const ai = page
      .locator(".chat-event")
      .filter({
        has: page.getByRole("heading", {
          name: "Learning with AI: a hands-on lab",
          exact: true,
        }),
      })
      .first();
    await ai
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    await page.getByLabel("Demo attendee name").fill("Fictional Merge Student");
    await page
      .getByLabel("I confirm I’d like to attend this demo event.")
      .check();
    await page
      .getByRole("button", { name: "Complete RSVP & add", exact: true })
      .click();
    await page.waitForFunction(
      (k) => JSON.parse(localStorage.getItem(k)).plan.includes("e1"),
      key,
    );
    assert.ok((await stored()).rsvps.includes("e1"));
    await nav("#calendar");
    for (const view of ["Day", "Week", "Month", "Year"]) {
      await page
        .getByRole("group", { name: "Calendar view" })
        .getByRole("button", { name: view, exact: true })
        .click();
    }
    await nav("#planner");
    if (
      await page
        .getByRole("button", { name: "Close calendar panel", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Close calendar panel", exact: true })
        .click();
    await nav("#settings");
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Check for updates", exact: true })
      .click();
    assert.ok((await stored()).appliedUpdateIds.includes("u2"));
    assert.ok((await stored()).plan.includes("e1"));
    await nav("#notifications");
    await page
      .getByRole("heading", { name: "Notifications", exact: true })
      .waitFor();
    await nav("#profile");
    await page
      .getByLabel("Commitment title", { exact: true })
      .fill("Unadded input to discard");
    await page
      .getByRole("button", { name: "Clear personalization…", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Confirm clear personalization",
        exact: true,
      })
      .click();
    assert.equal(
      await page.getByLabel("Commitment title", { exact: true }).inputValue(),
      "",
    );
    assert.ok((await stored()).plan.includes("e1"));
    assert.ok((await stored()).rsvps.includes("e1"));
    assert.equal((await stored()).profileRankingConsent, false);
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      "responsive viewport has no horizontal document overflow",
    );
    console.log(
      `PASS ${width}px ${offline ? "fallback" : "simulated Rust"}: main pages/calendar/updates; profile persistence; preference consent opt-in/revocation; clarification/modes; RSVP; full personalization clear preserves plans.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
