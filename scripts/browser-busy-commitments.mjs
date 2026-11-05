import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const { width, offline } of [
    { width: 1280, offline: false },
    { width: 390, offline: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    if (offline) await page.route("**/api/**", (r) => r.abort());
    await page.goto(
      (process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173") + "/#planner",
    );
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const go = (hash) =>
      page.evaluate((hash) => {
        location.hash = hash;
      }, hash);
    await page
      .getByLabel("Message your AI planner")
      .fill("AI on Tuesday afternoon");
    await page.getByLabel("Message your AI planner").press("Enter");
    const event = page.getByRole("article", {
      name: "Learning with AI: a hands-on lab",
      exact: true,
    });
    await event
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    await page.getByLabel("Demo attendee name").fill("Fictional learner");
    await page
      .getByLabel("I confirm I’d like to attend this demo event.")
      .check();
    await page
      .getByRole("button", { name: "Complete RSVP & add", exact: true })
      .click();
    await page.waitForFunction(() =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).rsvps.includes(
        "e1",
      ),
    );
    const before = await state();
    await go("profile");
    await page.getByLabel("Commitment title").fill("Actual seminar");
    await page.getByLabel("Busy day").selectOption("1");
    await page.getByLabel("Busy from", { exact: true }).fill("15:00");
    await page.getByLabel("Busy until", { exact: true }).fill("16:15");
    await page
      .getByRole("button", { name: "Add busy commitment", exact: true })
      .click();
    await page
      .getByRole("status", { name: "Unsaved busy-time conflicts" })
      .waitFor();
    assert.deepEqual((await state()).blocks, before.blocks);
    page.once("dialog", async (d) => {
      assert.equal(d.type(), "confirm");
      assert.match(d.message(), /Learning with AI/);
      assert.match(d.message(), /RSVP records will stay/);
      await d.dismiss();
    });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.deepEqual((await state()).blocks, before.blocks);
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.ok((await state()).blocks.some((b) => b.title === "Actual seminar"));
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    assert.deepEqual((await state()).cancelled, before.cancelled);
    await go("calendar");
    await page
      .getByRole("heading", { name: "Your campus plans", exact: true })
      .waitFor();
    assert.ok(
      (await page
        .getByText(/Conflict: Conflicts with Actual seminar/)
        .count()) >= 2,
    );
    await page.getByRole("button", { name: "Remove", exact: true }).waitFor();
    await page.reload();
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    await go("planner");
    await page
      .getByLabel("Message your AI planner")
      .fill("events on Tuesday after 3 PM before 5 PM");
    await page.getByLabel("Message your AI planner").press("Enter");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .before === 1020,
    );
    assert.deepEqual((await state()).draft, []);
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page.close();
    console.log(
      `PASS ${width}px offline=${offline}: real RSVP flow, unsaved warning, decline/confirm busy Save, conflict markers, explicit removal available, preserved records/reload and blocked future suggestions.`,
    );
  }
} finally {
  await browser.close();
}
