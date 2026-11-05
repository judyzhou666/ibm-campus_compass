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
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    await page.goto(
      (process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173") + "/#profile",
    );
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    const reflection = page.getByLabel(
      "Why does this matter to you right now?",
    );
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const unloadIsBlocked = () =>
      page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
    assert.equal(await unloadIsBlocked(), false);
    const initial = await saved();
    const activeTopics = initial.interests;
    await reflection.fill("UNSAVED_SHELL_NOTE");
    await page.getByRole("checkbox", { name: "Career", exact: true }).uncheck();
    assert.equal(await unloadIsBlocked(), true);
    assert.equal((await saved()).preferences.why, initial.preferences.why);
    assert.deepEqual((await saved()).interests, activeTopics);
    assert.equal(
      await page.getByText("Unsaved changes — preview only").count(),
      1,
    );
    const answer = (accept) =>
      page.once("dialog", async (d) => {
        assert.equal(d.type(), "confirm");
        assert.match(d.message(), /Discard unsaved preference changes/);
        await (accept ? d.accept() : d.dismiss());
      });
    answer(false);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await reflection.inputValue(), "UNSAVED_SHELL_NOTE");
    // Hash navigation (including the back/forward route handler) must retain the editor on refusal.
    answer(false);
    await page.evaluate(() => {
      location.hash = "dashboard";
    });
    await page.waitForURL(/#profile$/);
    assert.equal(await reflection.inputValue(), "UNSAVED_SHELL_NOTE");
    // Global search is a separate navigation entry point.
    answer(false);
    await page.getByRole("textbox", { name: "Search events" }).fill("career");
    await page.getByRole("textbox", { name: "Search events" }).press("Enter");
    assert.equal(await reflection.inputValue(), "UNSAVED_SHELL_NOTE");
    answer(true);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await reflection.inputValue(), initial.preferences.why);
    assert.deepEqual((await saved()).interests, activeTopics);
    await reflection.fill("SAVED_SHELL_NOTE");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).preferences
          .why === "SAVED_SHELL_NOTE",
    );
    assert.equal(await unloadIsBlocked(), false);
    await page.reload();
    assert.equal(await reflection.inputValue(), "SAVED_SHELL_NOTE");
    await reflection.fill("LEAVE_SHELL_NOTE");
    answer(true);
    await page.evaluate(() => {
      location.hash = "dashboard";
    });
    await page
      .getByRole("heading", { name: "My Preferences", exact: true })
      .waitFor({ state: "detached" });
    assert.equal((await saved()).preferences.why, "SAVED_SHELL_NOTE");
    await page.close();
    console.log(
      `PASS ${width}px: isolated draft, Cancel/stay/discard, hash/search guards, Save and reload.`,
    );
  }
} finally {
  await browser.close();
}
