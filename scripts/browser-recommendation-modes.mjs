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
  const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
  await page.goto(
    (process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173") + "/#planner",
  );
  await page
    .getByRole("button", { name: "Use sample preferences", exact: true })
    .click();
  await page
    .getByLabel("Message your AI planner")
    .fill("events on Tuesday after 3 PM before 5 PM");
  await page.getByLabel("Message your AI planner").press("Enter");
  await page.locator(".chat-event").nth(1).waitFor();
  assert.equal((await page.locator(".alternative-warning").count()) >= 2, true);
  assert.match(
    await page.locator(".alternative-warning").first().textContent(),
    /cannot both fit/,
  );
  await page
    .getByRole("button", { name: "Build weekly plan", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).messages.at(-1)
        ?.recommendationMode === "plan-building",
  );
  assert.equal(
    await page
      .locator(".messages .message")
      .last()
      .locator(".chat-event")
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator(".messages .message")
      .last()
      .locator(".alternative-warning")
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Discover alternatives", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).messages.at(-1)
        ?.recommendationMode === "discovery",
  );
  assert.equal(
    await page
      .locator(".messages .message")
      .last()
      .locator(".chat-event")
      .count(),
    2,
  );
  assert.deepEqual(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("campus-compass-demo-v1")).plan,
    ),
    [],
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  console.log(
    "PASS mobile: actual overlap labels, explicit compatible weekly plan, discovery switch, no automatic calendar changes.",
  );
} finally {
  await browser.close();
}
