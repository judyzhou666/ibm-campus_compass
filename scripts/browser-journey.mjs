const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#planner");
  await page
    .getByRole("button", { name: "Use sample preferences", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare scenario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep current demo", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("campus-compass-demo-v1")).name,
    ),
    "Judy",
  );
  await page
    .getByRole("button", { name: "Prepare scenario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare guided demo", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
  );
  assert.equal(saved.plan.length, 0);
  assert.equal(saved.rsvps.length, 0);
  assert.equal(saved.name, "Demo explorer");
  await page
    .getByRole("button", { name: "Recommend across interests", exact: true })
    .click();
  await page.locator(".chat-event").nth(2).waitFor();
  await page
    .locator(".chat-event .evidence")
    .first()
    .getByText(/Compared with|No other eligible/)
    .waitFor();
  const titles = await page.locator(".chat-event h3").allTextContents();
  console.log(width, "Initial recommendations:", titles.join(" / "));
  await page
    .locator(".chat-event")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await page.getByText("Verification", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  for (const index of [0, 1, 2]) {
    const card = page.locator(".chat-event").nth(index);
    await card
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    if (await page.getByRole("dialog").isVisible()) {
      await page.getByLabel("Demo attendee name").fill("Fictional student");
      await page
        .getByLabel("I confirm I’d like to attend this demo event.")
        .check();
      await page
        .getByRole("button", { name: "Complete RSVP & add", exact: true })
        .click();
    }
    await page.waitForFunction(
      (n) =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).plan
          .length === n,
      index + 1,
    );
  }
  await page
    .getByRole("button", { name: "Simulate cancellation", exact: true })
    .click();
  const prior = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
  );
  await page
    .getByRole("button", { name: "Suggest replacement", exact: true })
    .click();
  await page.getByText(/I removed the cancelled entry/).waitFor();
  const proposed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
  );
  assert.equal(proposed.plan.length, 2);
  assert.equal(proposed.draft.length, 1);
  assert.ok(!proposed.plan.includes(proposed.draft[0]));
  assert.deepEqual(
    proposed.plan,
    prior.plan.filter((id) => !prior.cancelled.includes(id)),
  );
  await page
    .locator(".chat-event")
    .last()
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();
  if (await page.getByRole("dialog").isVisible()) {
    await page.getByLabel("Demo attendee name").fill("Fictional student");
    await page
      .getByLabel("I confirm I’d like to attend this demo event.")
      .check();
    await page
      .getByRole("button", { name: "Complete RSVP & add", exact: true })
      .click();
  }
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).plan.length ===
      3,
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export final calendar", exact: true })
    .click();
  assert.match((await download).suggestedFilename(), /\.ics$/);
  // Reset through the launcher preserves the original archive and still grants no consent.
  await page
    .getByRole("button", { name: "Prepare scenario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare guided demo", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).plan.length,
    ),
    0,
  );
  await page
    .getByRole("button", { name: "Restore previous demo", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).name ===
      "Judy",
  );
  await page.goto(base + "/#settings");
  await page
    .getByRole("button", { name: "Open synthetic-data review", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Synthetic-data review", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Unknown eligibility: 1", exact: true })
    .click();
  assert.equal(await page.locator(".review-record").count(), 1);
  await page
    .getByRole("button", { name: "Missing original URL: 30", exact: true })
    .click();
  assert.equal(await page.locator(".review-record").count(), 30);
  for (const hash of [
    "dashboard",
    "planner",
    "calendar",
    "explore",
    "forum",
    "profile",
    "review",
  ]) {
    await page.goto(base + "/#" + hash);
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width} ${hash} overflows`,
    );
  }
  await page.goto(base + "/#planner");
  await page.getByLabel("Message your AI planner").fill("events near me");
  await page.getByLabel("Message your AI planner").press("Enter");
  await page.getByText(/Which weekdays\/times/).waitFor();
  await page.getByLabel("Message your AI planner").fill("career after 3");
  await page.getByLabel("Message your AI planner").press("Enter");
  await page.getByText(/Do you mean AM or PM/).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${width}px: full guided journey, comparison evidence, manual RSVP, cancellation/replacement consent, ICS, archive/restore, review filters, seven-page overflow and clarification.`,
  );
  await page.close();
}
await browser.close();
