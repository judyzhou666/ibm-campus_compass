import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:5173";
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const requests = [];
    let hold = false,
      held;
    await page.route("**/api/plan", (route) => {
      requests.push(route.request().postDataJSON());
      if (hold) {
        held = route;
        return;
      }
      return route.abort();
    });
    await page.goto(base + "/#explore");
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const go = async (hash) => {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(100);
    };
    for (const text of ["AI", "career", "social"]) {
      await page.getByLabel("Search events", { exact: true }).fill(text);
      await page.getByLabel("Search events", { exact: true }).press("Enter");
    }
    await page.waitForTimeout(150);
    assert.equal(
      requests.length,
      0,
      "hidden Dashboard must not request recommendations during Explore searches",
    );
    await go("#planner");
    const send = async (text) => {
      await page.getByLabel("Message your AI planner").fill(text);
      await page.getByLabel("Message your AI planner").press("Enter");
    };
    await send("career events");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .topics?.[0] === "Career",
    );
    hold = true;
    await send("after 3 PM");
    await page.waitForTimeout(100);
    assert.ok(held);
    const count = requests.length;
    const before = (await stored()).constraints;
    await go("#profile");
    await page
      .getByLabel("Why does this matter to you right now?")
      .fill("Local reflection only");
    await page
      .getByLabel("What kind of guidance would help?")
      .selectOption("steps");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.deepEqual(
      (await stored()).constraints,
      before,
      "text-only Save preserves active filters",
    );
    assert.equal(requests.length, count);
    hold = false;
    await held.abort();
    held = undefined;
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .after === 900,
    );
    assert.ok(
      !(await stored()).messages
        .at(-1)
        .text.includes("changed while I was planning"),
    );
    await page
      .getByLabel("How many suggestions would you like to consider at a time?")
      .selectOption("1");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await go("#dashboard");
    await page.locator(".event-card").first().waitFor();
    assert.ok(
      requests.slice(count).some((r) => r.state.preferences.count === 1),
    );
    assert.equal(await page.locator(".event-card").count(), 1);
    await go("#planner");
    await page
      .getByRole("button", { name: "Explore beyond my interests", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .explore === true,
    );
    await send("Tuesday afternoon events");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .days?.[0] === 1 &&
        !JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .explore,
    );
    assert.ok(
      (await stored()).messages
        .at(-1)
        .matchReasons.some((r) => r.matches.some((m) => m.kind === "topic")),
    );
    await send("explore social events to make friends this week");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .mode === "discovery",
    );
    await send("start over");
    await page.waitForFunction(() => {
      const c = JSON.parse(
        localStorage.getItem("campus-compass-demo-v1"),
      ).constraints;
      return !c.mode && !c.explore && !c.days;
    });
    await page.close();
    console.log(
      `PASS ${width}px: no hidden Dashboard POSTs, latest Dashboard preferences, note/guidance Save preserves inflight chat and filters, temporary exploration/reset and explicit discovery.`,
    );
  }
} finally {
  await browser.close();
}
