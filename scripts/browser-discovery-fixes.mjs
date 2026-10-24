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
  for (const [width, offline] of [
    [1280, false],
    [390, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    if (offline) await page.route("**/api/**", (route) => route.abort());
    await page.goto(base + "/#profile");
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const before = await stored();
    const navigate = async (hash) => {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForFunction((h) => location.hash === h, hash);
    };
    await navigate("#dashboard");
    await page.getByRole("button", { name: "Academic", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".event-grid .event-card").length === 3,
    );
    assert.equal(await page.locator(".event-grid .event-card").count(), 3);
    for (const text of await page
      .locator(".event-grid .event-card .tag")
      .allTextContents())
      assert.ok(text.includes("Academic"));
    await navigate("#explore");
    const title = "Learning with AI: a hands-on lab";
    const card = () =>
      page
        .locator(".event-card")
        .filter({
          has: page.getByRole("heading", { name: title, exact: true }),
        });
    await card().waitFor();
    await card()
      .getByRole("button", { name: "Not for me", exact: true })
      .click();
    assert.equal(await card().count(), 0);
    const other = page.locator(".event-card").first();
    const otherTitle = await other.locator("h3").textContent();
    await other
      .getByRole("button", { name: "Show another", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".event-card h3")
        .filter({ hasText: otherTitle })
        .count(),
      0,
    );
    // Save a remaining event then hide it on Saved without deleting its bookmark.
    const remaining = page.locator(".event-card").first();
    const savedTitle = await remaining.locator("h3").textContent();
    await remaining
      .getByRole("button", { name: `Save ${savedTitle}`, exact: true })
      .click();
    const bookmarks = (await stored()).saved;
    await navigate("#saved");
    const savedCard = page
      .locator(".event-card")
      .filter({
        has: page.getByRole("heading", { name: savedTitle, exact: true }),
      });
    await savedCard
      .getByRole("button", { name: "Not for me", exact: true })
      .click();
    assert.equal(await savedCard.count(), 0);
    assert.deepEqual((await stored()).saved, bookmarks);
    assert.deepEqual((await stored()).preferences, before.preferences);
    assert.deepEqual((await stored()).plan, before.plan);
    await page.close();
    console.log(
      `PASS ${width}px ${offline ? "fallback" : "Rust"}: Academic fills count; Explore/Saved skip controls hide cards without preference/bookmark changes.`,
    );
  }
} finally {
  await browser.close();
}
