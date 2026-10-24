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
    await page.evaluate(() => {
      const key = "campus-compass-demo-v1",
        s = JSON.parse(localStorage.getItem(key));
      s.preferences.learning_topics = [
        { topic: "Career", source: "Added by you" },
      ];
      s.preferences.use_learning = false;
      s.preferences.free_only = true;
      s.plan = ["e1"];
      s.rsvps = ["e1"];
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const send = async (text) => {
      await page.getByLabel("Message your AI planner").fill(text);
      await page.getByLabel("Message your AI planner").press("Enter");
    };
    const before = (await state()).preferences;
    await send("events on Tuesday after 3 PM before 5 PM");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
          .after === 900,
    );
    await send("I'm interested in UX research now");
    await page
      .getByRole("button", { name: "This search only", exact: true })
      .click();
    await page.waitForFunction(() =>
      JSON.parse(
        localStorage.getItem("campus-compass-demo-v1"),
      ).constraints.topics?.includes("AI & education"),
    );
    assert.deepEqual((await state()).preferences, before);
    assert.deepEqual((await state()).constraints.days, [1]);
    assert.equal((await state()).constraints.after, 900);
    assert.deepEqual((await state()).plan, ["e1"]);
    await send("I'm interested in UX research now");
    await page
      .getByRole("button", { name: "Review and save", exact: true })
      .click();
    const review = page.getByRole("dialog", {
      name: "Review preference change",
    });
    assert.match(
      await review.textContent(),
      /Enable all confirmed learning topics for recommendations: Career, AI & education/,
    );
    assert.deepEqual((await state()).preferences, before);
    await review.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    assert.equal(
      await page
        .getByRole("region", { name: "Proposed preference change" })
        .count(),
      0,
    );
    assert.deepEqual((await state()).preferences, before);
    await send("I'm learning about quantum gardening");
    assert.equal(
      await page
        .getByRole("button", { name: "This search only", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("button", {
        name: "Choose a topic in My Preferences",
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await send("I'm interested in UX research now");
    await send("Find social events");
    await page
      .getByRole("button", { name: "Review and save", exact: true })
      .waitFor({ state: "detached" });
    await page
      .getByLabel("Message your AI planner")
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="Message your AI planner"]')
          .disabled,
    );
    await send("I'm interested in UX research now");
    await page
      .getByRole("button", { name: "Review and save", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Confirm and save topics", exact: true })
      .click();
    const saved = await state();
    assert.deepEqual(saved.preferences.learning_topics, [
      { topic: "Career", source: "Added by you" },
      { topic: "AI & education", source: "Confirmed from a conversation" },
    ]);
    assert.equal(saved.preferences.use_learning, true);
    assert.equal(saved.preferences.free_only, true);
    assert.deepEqual(saved.plan, ["e1"]);
    assert.deepEqual(saved.rsvps, ["e1"]);
    await send("I'm interested in UX research now");
    await page
      .getByRole("button", { name: "Review and save", exact: true })
      .click();
    await page.evaluate(() => {
      location.hash = "profile";
    });
    await review.waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "Remove AI & education", exact: true })
      .click({ trial: true });
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Remove AI & education", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.evaluate(() => {
      location.hash = "planner";
    });
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm and save topics", exact: true })
        .count(),
      0,
    );
    assert.ok(
      !(await state()).preferences.learning_topics.some(
        (t) => t.topic === "AI & education",
      ),
    );
    await page.close();
    console.log(
      `PASS ${width}px offline=${offline}: use-once filters/hard constraints, exact review, cancel/dismiss, unsupported manual, supersession, confirmed provenance and deletion/navigation invalidation.`,
    );
  }
} finally {
  await browser.close();
}
