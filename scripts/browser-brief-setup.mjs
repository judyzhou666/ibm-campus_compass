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
const stored = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
  );
try {
  for (const { width, offline } of [
    { width: 1280, offline: false },
    { width: 390, offline: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (offline) await page.route("**/api/**", (r) => r.abort());
    await page.goto(base + "/#dashboard");
    const dialog = page.getByRole("dialog", {
      name: "Quick preference setup",
      exact: true,
    });
    await dialog.waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement.tagName),
      "H1",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Skip for now",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute("type")),
      "checkbox",
    );
    await page.keyboard.press("Space");
    assert.deepEqual((await stored(page)).preferences.goals, []);
    await dialog
      .getByRole("checkbox", { name: "Join a small group", exact: true })
      .check();
    await dialog
      .getByLabel("What kind of guidance would help?")
      .selectOption("first");
    assert.equal(
      await dialog
        .getByLabel(
          "How many suggestions would you like to consider at a time?",
        )
        .count(),
      0,
    );
    await dialog
      .getByRole("button", { name: "Save quick setup", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement.id === "main");
    assert.deepEqual((await stored(page)).preferences.goals, ["career"]);
    assert.deepEqual((await stored(page)).preferences.participation, [
      "small-group",
    ]);
    assert.equal((await stored(page)).preferences.guidance, "first");
    await page
      .getByText("Quick setup saved. You can edit My Preferences anytime.", {
        exact: true,
      })
      .waitFor();
    await page.locator(".event-card").first().waitFor();
    const before = (await stored(page)).preferences;
    const rejected = await page.locator(".event-card h3").first().textContent();
    await page
      .locator(".event-card")
      .first()
      .getByRole("button", { name: "Not for me", exact: true })
      .click();
    await page.waitForLoadState("networkidle");
    assert.ok(
      !(await page.locator(".event-card h3").allTextContents()).includes(
        rejected,
      ),
    );
    assert.deepEqual((await stored(page)).preferences, before);
    assert.equal(
      await page
        .getByRole("heading", { name: "Matching your interests", exact: true })
        .locator("..")
        .getByRole("button", { name: rejected, exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("complementary", { name: "Using your preferences" })
      .getByRole("button", { name: "Edit preferences", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "My Preferences", exact: true })
      .waitFor();
    await page.waitForFunction(() => document.activeElement.id === "main");
    await page.evaluate(() => {
      location.hash = "planner";
    });
    await page
      .getByRole("button", { name: "Discover alternatives", exact: true })
      .click();
    await page.locator(".chat-event").first().waitFor();
    const n = (await stored(page)).messages.length;
    await page
      .locator(".chat-event")
      .first()
      .getByRole("button", { name: "Not for me", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).messages
          .length > n,
      n,
    );
    assert.deepEqual((await stored(page)).preferences, before);
    await page
      .locator(".chat-event")
      .last()
      .getByRole("button", { name: "View details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close details", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.close();
    const skip = await browser.newPage({ viewport: { width, height: 950 } });
    await skip.goto(base + "/#dashboard");
    const original = (await stored(skip)).preferences;
    await skip
      .getByRole("dialog", { name: "Quick preference setup", exact: true })
      .getByRole("checkbox", {
        name: "Find research opportunities",
        exact: true,
      })
      .check();
    skip.once("dialog", (d) => d.dismiss());
    await skip
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    assert.equal(
      await skip
        .getByRole("dialog", { name: "Quick preference setup", exact: true })
        .isVisible(),
      true,
    );
    skip.once("dialog", (d) => d.accept());
    await skip.keyboard.press("Escape");
    await skip
      .getByRole("dialog", { name: "Quick preference setup", exact: true })
      .waitFor({ state: "detached" });
    assert.deepEqual((await stored(skip)).preferences, original);
    await skip.waitForFunction(() => document.activeElement.id === "main");
    await skip.close();
    console.log(
      `PASS ${width}px offline=${offline}: shared setup keyboard/focus/labels, Save/Skip feedback, discard guard, full editor access, responsive actions and session-only Not for me.`,
    );
  }
  const error = await browser.newPage();
  let fail = true,
    release;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  await error.route("**/api/plan", async (r) => {
    if (fail)
      await r.fulfill({ status: 400, json: { error: "test rejection" } });
    else {
      await released;
      await r.continue();
    }
  });
  await error.goto(base + "/#dashboard");
  await error
    .getByRole("button", { name: "Skip for now", exact: true })
    .click();
  await error
    .getByRole("button", { name: "Retry suggestions", exact: true })
    .waitFor();
  fail = false;
  await error
    .getByRole("button", { name: "Retry suggestions", exact: true })
    .click();
  await error
    .getByText("Checking your saved preferences…", { exact: true })
    .waitFor();
  assert.equal(
    await error.getByText("Try another category", { exact: true }).count(),
    0,
  );
  release();
  await error.locator(".event-card").first().waitFor();
  await error
    .getByRole("button", { name: "Retry briefing", exact: true })
    .click();
  await error.locator(".briefing .recommendation-info").first().waitFor();
  await error.close();
  console.log(
    "PASS request loading/error/retry: no false empty state while loading; cards and briefing recover.",
  );
} finally {
  await browser.close();
}
