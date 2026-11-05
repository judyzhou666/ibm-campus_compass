import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173";
try {
  for (const { width, offline } of [
    { width: 1280, offline: false },
    { width: 390, offline: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (offline) await page.route("**/api/**", (route) => route.abort());
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const go = (hash) =>
      page.evaluate((hash) => {
        location.hash = hash;
      }, hash);
    await page.goto(base + "/#profile");
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    await page.evaluate(() => {
      const key = "campus-compass-demo-v1",
        s = JSON.parse(localStorage.getItem(key));
      s.plan = ["e1"];
      s.rsvps = ["e1"];
      s.messages = [{ role: "user", text: "Keep my earlier conversation" }];
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    for (const topic of ["AI & education", "Social"])
      await page.getByRole("checkbox", { name: topic, exact: true }).uncheck();
    await page
      .getByLabel("How many suggestions would you like to consider at a time?")
      .selectOption("1");
    await page
      .getByLabel("What kind of guidance would help?")
      .selectOption("first");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await go("dashboard");
    await page.locator(".event-card").waitFor();
    assert.equal(await page.locator(".event-card").count(), 1);
    await page
      .getByRole("complementary", { name: "Using your preferences" })
      .getByRole("button", { name: "Edit preferences", exact: true })
      .waitFor();
    assert.match(
      await page.locator(".event-card").textContent(),
      /First step \(optional\)/,
    );
    const briefing = page.locator(".briefing");
    await briefing
      .getByText(
        "First step (optional): view the event details before deciding.",
      )
      .first()
      .waitFor();
    await go("planner");
    await page.getByLabel("Message your AI planner").fill("career events");
    await page.getByLabel("Message your AI planner").press("Enter");
    await page.locator(".chat-event").waitFor();
    assert.equal(await page.locator(".previous-settings").count(), 0);
    const history = (await state()).messages;
    assert.ok(history.at(-1).matchReasons.length);
    await page
      .getByRole("complementary", { name: "Using your preferences" })
      .getByRole("button", { name: "Edit preferences", exact: true })
      .click();
    await page.getByRole("checkbox", { name: "Career", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "Social", exact: true }).check();
    await page
      .getByLabel("What kind of guidance would help?")
      .selectOption("information");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.deepEqual((await state()).messages, history);
    assert.deepEqual((await state()).plan, ["e1"]);
    assert.deepEqual((await state()).rsvps, ["e1"]);
    await go("dashboard");
    await page.locator(".event-card").waitFor();
    assert.match(
      await page.locator(".event-card .reason").textContent(),
      /Social/,
    );
    assert.match(
      await page.locator(".event-card").textContent(),
      /Recorded requirements \(fictional catalog\)/,
    );
    await page
      .locator(".briefing")
      .getByText(/Matches saved interests or enabled topics: Social/)
      .waitFor();
    await go("planner");
    await page
      .getByText(
        "Based on previous settings. These earlier suggestions have not been refreshed.",
      )
      .waitFor();
    assert.match(
      await page.locator(".chat-event .reason").first().textContent(),
      /Career/,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Refresh suggestions", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).messages
          .length > n,
      history.length,
    );
    assert.deepEqual(
      (await state()).messages.slice(0, history.length),
      history,
    );
    assert.deepEqual((await state()).plan, ["e1"]);
    assert.deepEqual((await state()).rsvps, ["e1"]);
    assert.match(
      await page.locator(".chat-event .reason").last().textContent(),
      /Social/,
    );
    await go("profile");
    await page
      .getByLabel("What kind of guidance would help?")
      .selectOption("steps");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await go("dashboard");
    await page.locator(".event-card .event-guidance li").last().waitFor();
    assert.equal(
      await page.locator(".event-card .event-guidance li").count(),
      3,
    );
    assert.match(
      await page.locator(".event-card").textContent(),
      /not official event requirements/,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    if (!offline) {
      // A response for obsolete preferences must not restore the old five-card list.
      let held = false,
        start,
        release;
      const started = new Promise((resolve) => {
        start = resolve;
      });
      const released = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/api/plan", async (route) => {
        const body = route.request().postDataJSON();
        if (!held && body.state.preferences?.count === 5) {
          held = true;
          const response = await route.fetch();
          start();
          await released;
          await route.fulfill({ response });
        } else await route.continue();
      });
      await go("profile");
      await page
        .getByLabel(
          "How many suggestions would you like to consider at a time?",
        )
        .selectOption("5");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await started;
      await page
        .getByLabel(
          "How many suggestions would you like to consider at a time?",
        )
        .selectOption("1");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      release();
      await go("dashboard");
      await page.locator(".event-card").waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.locator(".event-card").count(), 1);
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${width}px offline=${offline}: shared Dashboard/briefing/Planner summary/reasons, guidance, Save refresh, historical labels, refresh/reload and preserved plans/history.`,
    );
  }
} finally {
  await browser.close();
}
