import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
for (const { width, offline } of [
  { width: 1280, offline: false },
  { width: 390, offline: true },
]) {
  const page = await browser.newPage({ viewport: { width, height: 950 } }),
    errors = [],
    payloads = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.postData()) payloads.push(r.postData());
  });
  if (offline) await page.route("**/api/**", (r) => r.abort());
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
    );
  const go = async (hash) => {
    await page.goto(base + "/#" + hash);
  };
  await go("profile");
  await page
    .getByRole("button", { name: "Use sample preferences", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "My Preferences", exact: true })
    .waitFor();
  await page
    .getByLabel("Why does this matter to you right now?")
    .fill("PRIVATE_REFLECTION");
  await page
    .getByLabel("How many suggestions would you like to consider at a time?")
    .selectOption("1");
  assert.equal((await state()).preferences.count, 3);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Why does this matter to you right now?")
      .inputValue(),
    "",
  );
  assert.equal(
    await page
      .getByLabel("How many suggestions would you like to consider at a time?")
      .inputValue(),
    "3",
  );
  await page
    .getByLabel("What have you been learning or trying recently?")
    .fill("PRIVATE_LEARNING unrelated custom text");
  await page
    .getByLabel("Why does this matter to you right now?")
    .fill("PRIVATE_REFLECTION");
  for (const topic of ["AI & education", "Career", "Social"])
    await page.getByRole("checkbox", { name: topic, exact: true }).uncheck();
  await page.getByLabel("Learning topic to confirm").selectOption("Career");
  await page
    .getByRole("button", {
      name: "Confirm topic for recommendations",
      exact: true,
    })
    .click();
  await page
    .getByLabel("How many suggestions would you like to consider at a time?")
    .selectOption("1");
  await page
    .getByLabel("What kind of guidance would help?")
    .selectOption("steps");
  assert.deepEqual((await state()).preferences.learning_topics, []);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).preferences
        .use_learning,
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "My Preferences", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("What have you been learning or trying recently?")
      .inputValue(),
    "PRIVATE_LEARNING unrelated custom text",
  );
  await go("dashboard");
  await page.locator(".event-card").waitFor();
  assert.equal(await page.locator(".event-card").count(), 1);
  assert.match(
    await page.locator(".event-card h3").textContent(),
    /Networking without/,
  );
  await page.getByText("This Week's Briefing", { exact: true }).waitFor();
  await go("profile");
  await page
    .getByLabel("Use confirmed learning topics in recommendations")
    .uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await go("dashboard");
  await page.locator(".event-card").waitFor();
  assert.match(
    await page.locator(".event-card h3").textContent(),
    /Mindful movement/,
  );
  await go("profile");
  await page
    .getByRole("checkbox", { name: "AI & education", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Explore independently", exact: true })
    .check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await go("dashboard");
  await page.locator(".event-card").waitFor();
  assert.match(
    await page.locator(".event-card h3").textContent(),
    /Creative coding/,
  );
  assert.equal(await page.locator(".event-card .event-guidance li").count(), 3);
  await go("profile");
  await page
    .getByRole("checkbox", { name: "Explore independently", exact: true })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Join a small group", exact: true })
    .check();
  await page
    .getByLabel("What kind of guidance would help?")
    .selectOption("few");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await go("dashboard");
  await page.locator(".event-card").waitFor();
  assert.match(
    await page.locator(".event-card h3").textContent(),
    /Learning with AI/,
  );
  assert.match(
    await page.locator(".event-card").textContent(),
    /not an attendance target/,
  );
  await go("planner");
  const before = (await state()).preferences;
  const send = async (text) => {
    await page.getByLabel("Message your AI planner").fill(text);
    await page.getByLabel("Message your AI planner").press("Enter");
  };
  await send("I’m interested in UX research now.");
  await page
    .getByRole("button", { name: "This search only", exact: true })
    .click();
  await page.locator(".chat-event").first().waitFor();
  assert.deepEqual((await state()).preferences, before);
  assert.deepEqual((await state()).plan, []);
  await send("I’m interested in UX research on Tuesday after 3 PM");
  await page
    .getByRole("button", { name: "This search only", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("campus-compass-demo-v1")).constraints
        .after === 900,
  );
  assert.deepEqual((await state()).constraints.days, [1]);
  assert.deepEqual((await state()).preferences, before);

  await send("I’m interested in UX research now.");
  await page
    .getByRole("button", { name: "Review and save", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    await page
      .getByRole("button", { name: "Review and save", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  assert.deepEqual((await state()).preferences, before);
  await page
    .getByRole("button", { name: "Review and save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm and save topics", exact: true })
    .click();
  assert.ok(
    (await state()).preferences.learning_topics.some(
      (t) =>
        t.topic === "AI & education" &&
        t.source === "Confirmed from a conversation",
    ),
  );
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await send("AI on Tuesday afternoon");
  await page.locator(".chat-event").first().waitFor();
  await page
    .locator(".chat-event")
    .first()
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  assert.deepEqual((await state()).plan, []);
  await page
    .locator(".chat-event")
    .first()
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
    JSON.parse(localStorage.getItem("campus-compass-demo-v1")).plan.includes(
      "e1",
    ),
  );
  await go("profile");
  await page
    .getByRole("button", { name: "Clear personalization…", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm clear personalization", exact: true })
    .click();
  assert.deepEqual((await state()).plan, ["e1"]);
  assert.deepEqual((await state()).rsvps, ["e1"]);
  assert.deepEqual((await state()).interests, []);
  assert.deepEqual((await state()).preferences.learning_topics, []);
  await page.getByLabel("Only free admission (hard requirement)").check();
  await page.getByLabel("Available-only day").selectOption("2");
  await page.getByLabel("Available-only from").fill("17:00");
  await page.getByLabel("Available-only until").fill("20:00");
  await page
    .getByRole("button", { name: "Add available-only window", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.deepEqual((await state()).plan, ["e1"]);
  await go("calendar");
  await page.getByText(/Some existing choices no longer fit/).waitFor();
  await go("planner");
  await send("arts on Wednesday evening");
  await page.getByText(/couldn’t find an eligible/).waitFor();
  assert.deepEqual((await state()).draft, []);
  await page
    .getByRole("button", { name: "Explore beyond my interests", exact: true })
    .click();
  await page.waitForTimeout(200);
  assert.deepEqual((await state()).plan, ["e1"]);
  for (const hash of ["profile", "dashboard", "planner", "calendar"]) {
    await go(hash);
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${hash} overflow ${width}`,
    );
  }
  assert.ok(
    !payloads.some(
      (p) => p.includes("PRIVATE_REFLECTION") || p.includes("PRIVATE_LEARNING"),
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${width}px offline=${offline}: Save/Cancel, confirmed learning, disable, two participation/guidance profiles, one-off/confirmed chat, RSVP, preserved plan, hard empty results, privacy and overflow.`,
  );
  await page.close();
}
await browser.close();
