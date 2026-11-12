import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(new URL("../data/demo.json", import.meta.url), "utf8"),
);
const key =
  config.campus_id === "fictional-campus" &&
  config.week_start === "2026-10-19" &&
  config.time_zone === "America/New_York"
    ? "campus-compass-demo-v1"
    : `campus-compass-demo-v1:${config.campus_id}:${config.week_start}:${config.time_zone}`;
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      if (route.request().url().endsWith("/api/plan"))
        requests.push(route.request().postDataJSON());
      return route.abort();
    });
    await page.goto(
      (process.env.CAMPUS_TEST_URL || "http://127.0.0.1:5183") + "/#planner",
    );
    await page
      .getByRole("button", { name: "Default Preference", exact: true })
      .click();
    const stored = () =>
      page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    const send = async (text) => {
      const before = (await stored()).messages.length;
      const box = page.getByLabel("Message your AI planner");
      await box.fill(text);
      await box.press("Enter");
      await page.waitForFunction(
        ({ key, before }) =>
          JSON.parse(localStorage.getItem(key)).messages.length > before,
        { key, before },
      );
      await page.waitForTimeout(100);
    };
    await send("Career on Monday after 5 PM");
    const career = page
      .locator(".chat-event")
      .filter({
        has: page.getByRole("heading", {
          name: "Networking without the awkwardness",
          exact: true,
        }),
      })
      .first();
    await career.waitFor();
    await send("Explore beyond my interests after 3");
    assert.match((await stored()).messages.at(-1).text, /AM.*PM|AM\/PM/);
    await career
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    await page.waitForFunction(
      (k) => JSON.parse(localStorage.getItem(k)).plan.includes("e20"),
      key,
    );
    await page
      .getByRole("button", { name: "Close calendar panel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simulate event cancellation", exact: true })
      .click();
    await send("PM");
    assert.equal((await stored()).constraints.explore, true);
    assert.equal((await stored()).constraints.mode, "discovery");
    assert.equal((await stored()).constraints.after, 900);
    assert.equal(requests.at(-1).continuation, true);
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await send("AI on Tuesday after 1 PM");
    const ai = page
      .locator(".chat-event")
      .filter({
        has: page.getByRole("heading", {
          name: "Learning with AI: a hands-on lab",
          exact: true,
        }),
      })
      .last();
    await ai.getByRole("button", { name: "Show another", exact: true }).click();
    await page.waitForTimeout(150);
    await send("after 3");
    await page.evaluate(() => (location.hash = "#calendar"));
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await page.evaluate(() => (location.hash = "#planner"));
    await page.getByLabel("Message your AI planner").waitFor();
    await send("PM");
    assert.equal((await stored()).constraints.after, 900);
    assert.equal((await stored()).constraints.topics[0], "AI & education");
    assert.ok(!(await stored()).draft.includes("e1"));
    assert.ok(requests.at(-1).state.preferences.dismissed.includes("e1"));
    await send("Build my weekly plan to explore career options");
    assert.equal((await stored()).constraints.mode, "plan-building");
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px: schedule add/cancel/remove preserves pending context and session skips; structured continuation, default/explicit modes; no browser errors.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
