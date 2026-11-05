import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.CAMPUS_TEST_URL || "http://127.0.0.1:5173";
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => route.abort());
    await page.goto(base + "/#dashboard");
    await page
      .getByRole("button", { name: "Use sample preferences", exact: true })
      .click();
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("campus-compass-demo-v1")),
      );
    const before = await stored();
    if (width === 390)
      await page
        .getByRole("button", { name: "Toggle navigation", exact: true })
        .click();
    const card = page.getByRole("region", {
      name: "Student profile",
      exact: true,
    });
    await card
      .getByRole("button", { name: "View Profile", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "My Profile", exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).hash, "#my-profile");
    for (const name of [
      "Basic Information",
      "About Me",
      "My Interests",
      "Campus Involvement",
      "My Activity",
    ])
      await page.getByRole("heading", { name, exact: true }).waitFor();
    assert.equal(
      await page
        .getByText("You haven’t joined any demo communities yet.", {
          exact: true,
        })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("Display name", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(
      await page.getByLabel("Student status", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page.getByLabel("University", { exact: true }).inputValue(),
      "",
    );
    await page.getByLabel("Display name", { exact: true }).fill("Demo Student");
    await page.getByLabel("Student status", { exact: true }).fill("Student");
    await page
      .getByLabel("University", { exact: true })
      .fill("Campus Compass fictional university");
    await page
      .getByLabel("Short bio (optional)", { exact: true })
      .fill("A fictional introduction for this classroom demo.");
    assert.equal((await stored()).name, before.name);
    let accepted = false,
      prompts = 0;
    page.on("dialog", (dialog) => {
      prompts++;
      return accepted ? dialog.accept() : dialog.dismiss();
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(prompts, 1);
    assert.equal(
      await page.getByLabel("Display name", { exact: true }).inputValue(),
      "Demo Student",
    );
    await page
      .getByRole("button", {
        name: "Edit interests in My Preferences",
        exact: true,
      })
      .click();
    assert.equal(prompts, 2);
    assert.equal(new URL(page.url()).hash, "#my-profile");
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .waitFor();
    const after = await stored();
    assert.equal(after.name, "Demo Student");
    assert.equal(
      after.studentProfile.bio,
      "A fictional introduction for this classroom demo.",
    );
    for (const key of [
      "preferences",
      "interests",
      "plan",
      "saved",
      "rsvps",
      "joinedCommunities",
      "blocks",
      "messages",
    ])
      assert.deepEqual(after[key], before[key], key);
    assert.equal(
      await page
        .getByRole("button", { name: "Edit Profile", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "My Profile", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Demo Student", exact: true })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .click();
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Discarded draft");
    await page.getByLabel("Student status", { exact: true }).fill("");
    await page.getByLabel("University", { exact: true }).fill("");
    accepted = true;
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal((await stored()).name, "Demo Student");
    assert.equal((await stored()).studentProfile.status, "Student");
    assert.equal(
      (await stored()).studentProfile.university,
      "Campus Compass fictional university",
    );
    await page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .click();
    await page.getByLabel("Student status", { exact: true }).fill("");
    await page.getByLabel("University", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("heading", { name: "My Profile", exact: true })
      .waitFor();
    assert.equal((await stored()).studentProfile.status, "");
    assert.equal((await stored()).studentProfile.university, "");
    const basic = page
      .getByRole("heading", { name: "Basic Information", exact: true })
      .locator("..");
    await basic.getByText("Status not added", { exact: true }).waitFor();
    await basic.getByText("University not added", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: "Edit interests in My Preferences",
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: "My Preferences", exact: true })
      .waitFor();
    await page.goto(base + "/#my-profile");
    await page
      .getByRole("heading", { name: "My Profile", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/student-profile-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${width}px: empty defaults, saved values, blank-value persistence, card keyboard navigation, five sections, draft isolation, discard warnings, Save/Cancel, focus, reload, Preferences route and no horizontal overflow.`,
    );
  }
} finally {
  await browser.close();
}
