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
    await page.evaluate(() => {
      const key = "campus-compass-demo-v1",
        s = JSON.parse(localStorage.getItem(key));
      Object.assign(s, {
        plan: ["e1"],
        rsvps: ["e1"],
        saved: ["e3"],
        messages: [{ role: "user", text: "Keep my conversation" }],
        joinedCommunities: ["ai"],
        joined: ["Keep discussion"],
      });
      Object.assign(s.preferences, {
        goals: ["career"],
        primary_goal: "career",
        learning_note: "Private learning",
        next_note: "Private next",
        why: "Private reflection",
        learning_topics: [{ topic: "Career", source: "Added by you" }],
        use_goals: true,
        use_learning: true,
      });
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const initial = await state();
    await page
      .getByLabel("Use saved structured goals in recommendations")
      .uncheck();
    await page
      .getByLabel("Use confirmed learning topics in recommendations")
      .uncheck();
    assert.equal((await state()).preferences.use_learning, true);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    let s = await state();
    assert.equal(s.preferences.use_goals, false);
    assert.equal(s.preferences.use_learning, false);
    assert.deepEqual(
      s.preferences.learning_topics,
      initial.preferences.learning_topics,
    );
    assert.deepEqual(s.preferences.goals, initial.preferences.goals);
    page.once("dialog", (d) => d.dismiss());
    await page
      .getByRole("button", {
        name: "Remove learning notes and topics",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByLabel("What have you been learning or trying recently?")
        .inputValue(),
      "Private learning",
    );
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", {
        name: "Remove learning notes and topics",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByLabel("What have you been learning or trying recently?")
        .inputValue(),
      "",
    );
    assert.equal((await state()).preferences.learning_note, "Private learning");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Clear personalization…", exact: true })
      .click();
    assert.equal((await state()).preferences.learning_note, "Private learning");
    await page
      .getByRole("button", { name: "Keep preferences", exact: true })
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
    await page.reload();
    s = await state();
    for (const key of [
      "plan",
      "rsvps",
      "saved",
      "messages",
      "joinedCommunities",
      "joined",
      "blocks",
      "buffer",
    ])
      assert.deepEqual(s[key], initial[key]);
    assert.equal(s.preferences.learning_note, "");
    assert.equal(s.preferences.why, "");
    assert.deepEqual(s.preferences.learning_topics, []);
    assert.deepEqual(s.preferences.goals, []);
    assert.equal(s.preferences.use_learning, false);
    await page.close();
    console.log(
      `PASS ${width}px: disable without deletion, removal confirmation/Cancel, clear confirmation and preservation across reload.`,
    );
  }
} finally {
  await browser.close();
}
