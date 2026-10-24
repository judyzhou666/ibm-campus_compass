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
    let prompts = 0,
      accept = false;
    page.on("dialog", async (dialog) => {
      prompts++;
      await (accept ? dialog.accept() : dialog.dismiss());
    });
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
    const before = await state();
    await page.getByLabel("Commitment title").fill("Unadded actual class");
    await page.getByLabel("Busy day").selectOption("1");
    await page.getByLabel("Busy from", { exact: true }).fill("15:00");
    await page.getByLabel("Busy until", { exact: true }).fill("16:15");
    await page
      .getByText("Unsaved changes — preview only", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isEnabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByText(
        "Add or clear the unfinished busy commitment or available-only window before saving.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .getByLabel("Commitment title")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.deepEqual((await state()).blocks, before.blocks);
    if (width < 960)
      await page
        .getByRole("button", { name: "Toggle navigation", exact: true })
        .click();
    await page.locator("a.brand").click();
    await page.waitForLoadState("networkidle");
    assert.equal(prompts, 1);
    if (width < 960) await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => location.hash), "#profile");
    assert.equal(
      await page.getByLabel("Commitment title").inputValue(),
      "Unadded actual class",
    );
    await page
      .getByRole("button", { name: "Clear busy entry", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByLabel("Available-only from", { exact: true }).fill("14:30");
    await page
      .getByText("Unsaved changes — preview only", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("Available-only day")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    accept = true;
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      await page
        .getByLabel("Available-only from", { exact: true })
        .inputValue(),
      "13:00",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByLabel("Commitment title").fill("Added actual class");
    await page
      .getByRole("button", { name: "Add busy commitment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.ok(
      (await state()).blocks.some((b) => b.title === "Added actual class"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isDisabled(),
      true,
    );
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    await page.getByLabel("Commitment title").fill("Discard on clear");
    await page.getByLabel("Available-only from", { exact: true }).fill("12:00");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear personalization…", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Confirm clear personalization",
        exact: true,
      })
      .click();
    assert.equal(await page.getByLabel("Commitment title").inputValue(), "");
    assert.equal(
      await page
        .getByLabel("Available-only from", { exact: true })
        .inputValue(),
      "13:00",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.getByRole("alert").filter({ hasText: "unfinished" }).count(),
      0,
    );
    assert.ok(
      (await state()).blocks.some((b) => b.title === "Added actual class"),
    );
    assert.deepEqual((await state()).plan, before.plan);
    assert.deepEqual((await state()).rsvps, before.rsvps);
    // Repeated clear still resets auxiliary fields when persisted settings are already empty.
    await page.getByLabel("Commitment title").fill("Discard again");
    await page
      .getByRole("checkbox", { name: "Join a small group", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Clear personalization…", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Confirm clear personalization",
        exact: true,
      })
      .click();
    assert.equal(await page.getByLabel("Commitment title").inputValue(), "");
    assert.equal(
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Join a small group", exact: true })
        .isChecked(),
      false,
    );
    await page.close();
    console.log(
      `PASS ${width}px: staged busy/window dirty tracking, blocked partial Save, focus, one declined brand prompt, clearing/Cancel and successful added-entry Save.`,
    );
  }
} finally {
  await browser.close();
}
