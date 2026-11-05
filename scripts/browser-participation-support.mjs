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
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const initial = (await state()).preferences;
    const formats = page.getByRole("group", {
      name: "How would you like to participate?",
    });
    const noPreference = formats.getByRole("checkbox", {
      name: "No preference",
      exact: true,
    });
    assert.equal(await noPreference.isChecked(), true);
    for (const name of [
      "Explore independently",
      "Connect one-on-one",
      "Join a small group",
      "Attend larger or open events",
    ])
      await formats.getByRole("checkbox", { name, exact: true }).check();
    assert.equal(await noPreference.isChecked(), false);
    assert.equal(await formats.locator("input:checked").count(), 4);
    await noPreference.check();
    assert.equal(await formats.locator("input:checked").count(), 1);
    await formats
      .getByRole("checkbox", { name: "Join a small group", exact: true })
      .check();
    assert.equal(await noPreference.isChecked(), false);
    const guidance = page.getByLabel("What kind of guidance would help?");
    for (const value of ["few", "first", "steps", "information", "none"]) {
      await guidance.selectOption(value);
      assert.equal(await guidance.inputValue(), value);
    }
    await guidance.selectOption("steps");
    const count = page.getByLabel(
      "How many suggestions would you like to consider at a time?",
    );
    for (const n of [1, 3, 5]) {
      await count.selectOption(String(n));
      await page
        .getByRole("complementary", { name: "Preference summary" })
        .getByText(`A step-by-step plan · Up to ${n} suggestions`)
        .waitFor();
    }
    assert.deepEqual((await state()).preferences, initial);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await count.inputValue(), String(initial.count));
    assert.equal(await guidance.inputValue(), initial.guidance);
    assert.equal(await noPreference.isChecked(), true);
    await formats
      .getByRole("checkbox", { name: "Explore independently", exact: true })
      .check();
    await formats
      .getByRole("checkbox", { name: "Connect one-on-one", exact: true })
      .check();
    await guidance.selectOption("information");
    await count.selectOption("1");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.reload();
    const saved = (await state()).preferences;
    assert.deepEqual(saved.participation, ["independent", "one-to-one"]);
    assert.equal(saved.guidance, "information");
    assert.equal(saved.count, 1);
    assert.equal(await guidance.inputValue(), "information");
    await page.close();
    console.log(
      `PASS ${width}px: optional formats/exclusive no-preference, all guidance/counts, draft summary, Cancel, Save/reload.`,
    );
  }
} finally {
  await browser.close();
}
