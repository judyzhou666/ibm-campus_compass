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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
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
    const goal = (name) => page.getByRole("checkbox", { name, exact: true });
    await goal("Explore career possibilities").check();
    await goal("Find research opportunities").check();
    await page.getByLabel("Primary goal (optional)").selectOption("career");
    await goal("Not sure yet").check();
    assert.equal(await goal("Explore career possibilities").isChecked(), false);
    assert.equal(await goal("Find research opportunities").isChecked(), false);
    assert.equal(
      await page.getByLabel("Primary goal (optional)").inputValue(),
      "",
    );
    await goal("Find research opportunities").check();
    assert.equal(await goal("Not sure yet").isChecked(), false);
    await goal("Explore career possibilities").check();
    await page.getByLabel("Primary goal (optional)").selectOption("research");
    await page
      .getByLabel("Why does this matter to you right now?")
      .fill("PRIVATE_DIRECTION_REFLECTION");
    await page
      .getByLabel("What have you been learning or trying recently?")
      .fill("Unrecognized private study notes");
    await page
      .getByLabel("What would you like to explore next?")
      .fill("An arbitrary private subject");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    let s = await state();
    assert.deepEqual(s.preferences.goals, ["research", "career"]);
    assert.equal(s.preferences.primary_goal, "research");
    assert.deepEqual(s.preferences.learning_topics, []);
    assert.equal(s.preferences.use_learning, false);
    assert.equal(s.preferences.why, "PRIVATE_DIRECTION_REFLECTION");
    await page.getByLabel("Learning topic to confirm").selectOption("Career");
    assert.deepEqual((await state()).preferences.learning_topics, []);
    await page
      .getByRole("button", {
        name: "Confirm topic for recommendations",
        exact: true,
      })
      .click();
    assert.deepEqual((await state()).preferences.learning_topics, []);
    await page
      .getByRole("list", { name: "Confirmed learning topics" })
      .getByText("Career — Added by you")
      .waitFor();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    s = await state();
    assert.deepEqual(s.preferences.learning_topics, [
      { topic: "Career", source: "Added by you" },
    ]);
    assert.equal(s.preferences.use_learning, true);
    // Restore an existing chat-confirmed topic to check provenance survives manual re-confirmation.
    await page.evaluate(() => {
      const key = "campus-compass-demo-v1",
        s = JSON.parse(localStorage.getItem(key));
      s.preferences.learning_topics = [
        { topic: "Career", source: "Confirmed from a conversation" },
      ];
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    await page.getByLabel("Learning topic to confirm").selectOption("Career");
    await page
      .getByRole("button", {
        name: "Confirm topic for recommendations",
        exact: true,
      })
      .click();
    await page
      .getByRole("list", { name: "Confirmed learning topics" })
      .getByText("Career — Confirmed from a conversation")
      .waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Remove Career", exact: true })
      .click();
    assert.equal((await state()).preferences.learning_topics.length, 1);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.reload();
    s = await state();
    assert.deepEqual(s.preferences.learning_topics, []);
    assert.equal(
      s.preferences.learning_note,
      "Unrecognized private study notes",
    );
    assert.equal(s.preferences.next_note, "An arbitrary private subject");
    assert.equal(s.preferences.why, "PRIVATE_DIRECTION_REFLECTION");
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${width}px: goals/primary/unsure, separate local notes, explicit confirmation and Save, provenance, removal and reload.`,
    );
  }
} finally {
  await browser.close();
}
