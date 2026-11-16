// Run against a built app with CAMPUS_TEST_URL and the optional external
// PLAYWRIGHT_MODULE / CHROMIUM_PATH tooling (see docs/backend.md).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const config = JSON.parse(
  await readFile(new URL("../data/demo.json", import.meta.url)),
);
const key = `campus-compass-demo-v1:${config.campus_id}:${config.week_start}:${config.time_zone}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1440, 390]) {
    for (const role of ["student", "admin"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(
        ({ key, role }) => {
          if (!localStorage.getItem(key))
            localStorage.setItem(
              key,
              JSON.stringify({
                signedIn: true,
                onboarded: true,
                name: "Casey",
                role,
                studentStatus: "Visiting researcher",
                university: "",
                major: "",
              }),
            );
        },
        { key, role },
      );
      await page.goto(process.env.CAMPUS_TEST_URL || "http://127.0.0.1:4173");
      const open = async () => {
        await page
          .getByRole("button", {
            name: `Account: Casey, signed in as ${role === "admin" ? "Admin" : "Student"}`,
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Edit profile", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Edit Profile", exact: true })
          .waitFor();
      };
      const stored = () =>
        page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
      const select = page.getByLabel("Student Status", { exact: true });
      const custom = page.getByLabel("Specify your student status", {
        exact: true,
      });
      const save = page.getByRole("button", {
        name: "Save Changes",
        exact: true,
      });
      const preview = page.locator(".profile-preview-details dd").first();
      const cancel = () =>
        page.getByRole("button", { name: "Cancel", exact: true }).click();
      await open();
      assert.equal(await select.inputValue(), "other");
      assert.equal(await custom.inputValue(), "Visiting researcher");
      assert.equal(await save.isDisabled(), true);
      const before = await stored();
      for (const status of [
        "Undergraduate student",
        "Graduate student",
        "Master's student",
        "PhD student",
        "Exchange student",
      ]) {
        await select.selectOption(status);
        assert.equal(await preview.textContent(), status);
        assert.equal(await custom.count(), 0);
        assert.equal(await save.isEnabled(), true);
      }
      await select.selectOption("other");
      assert.equal(await custom.inputValue(), "Visiting researcher");
      assert.equal(await save.isDisabled(), true);
      await custom.fill("Independent scholar");
      await select.selectOption("PhD student");
      await select.selectOption("other");
      assert.equal(await custom.inputValue(), "Independent scholar");
      assert.equal(await preview.textContent(), "Independent scholar");
      assert.deepEqual(await stored(), before);
      assert.equal(
        await page
          .locator(".sidebar")
          .getByText("Independent scholar", { exact: true })
          .count(),
        0,
      );
      await custom.fill("x".repeat(80));
      assert.equal(await custom.getAttribute("maxlength"), "80");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await custom.fill("Independent scholar");
      // A status draft still participates in the existing leave guard.
      if (width < 800) {
        await page
          .getByRole("button", { name: "Toggle navigation", exact: true })
          .click();
      }
      await page
        .locator(".nav")
        .getByRole("button", { name: "Explore Events", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Stay and continue editing", exact: true })
        .click();
      assert.equal(await custom.inputValue(), "Independent scholar");
      if (
        width < 800 &&
        (await page
          .locator(".sidebar")
          .evaluate((el) => el.classList.contains("open")))
      ) {
        await page
          .getByRole("button", { name: "Toggle navigation", exact: true })
          .click();
      }
      await cancel();
      assert.deepEqual(await stored(), before);
      await open();
      assert.equal(await custom.inputValue(), "Visiting researcher");
      await custom.fill("Independent scholar");
      await save.click();
      await page.getByText("Profile updated.", { exact: true }).waitFor();
      const saved = await stored();
      assert.equal(saved.studentStatus, "Independent scholar");
      assert.equal(saved.role, role);
      assert.equal(saved.signedIn, true);
      await page.reload();
      await open();
      assert.equal(await select.inputValue(), "other");
      assert.equal(await custom.inputValue(), "Independent scholar");
      assert.equal(await save.isDisabled(), true);
      await select.selectOption("Master's student");
      await save.click();
      await page.reload();
      await open();
      assert.equal(await select.inputValue(), "Master's student");
      assert.equal(await custom.count(), 0);
      await select.selectOption("other");
      await custom.fill("");
      assert.equal(await preview.textContent(), "Not added yet");
      await save.click();
      assert.equal((await stored()).studentStatus, "");
      assert.equal((await stored()).role, role);
      await open();
      assert.equal(await select.inputValue(), "other");
      assert.equal(await custom.inputValue(), "");
      assert.equal(await save.isDisabled(), true);
      await cancel();
      await page
        .getByRole("button", {
          name: `Account: Casey, signed in as ${role === "admin" ? "Admin" : "Student"}`,
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Team data review", exact: true })
          .count(),
        role === "admin" ? 1 : 0,
      );
      assert.deepEqual(errors, []);
      console.log(`PASS Profile status: ${role}, ${width}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
