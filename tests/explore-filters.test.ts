/** Explore Events: two-level categories and the combinable Filters panel. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DATES, EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import {
  ALL,
  FREE_FOOD,
  HOSTS,
  activeChips,
  matchesExplore,
  panelCount,
  selectionFor,
  timeOfDay,
  type ExploreSelection,
} from "../frontend/src/filters.ts";
import {
  SUB_CATEGORIES,
  TOP_CATEGORIES,
  eventCategories,
  legacyCategory,
  subCategory,
  subsOf,
} from "../frontend/src/taxonomy.ts";
import { HOME_CATEGORIES, categoryCount } from "../frontend/src/home.ts";
import { restoreDrafts } from "../frontend/src/eventDrafts.ts";

const event = (id: string) => EVENTS.find((e) => e.id === id)!;
const ids = (s: ExploreSelection, state = fresh()) =>
  EVENTS.filter((e) => matchesExplore(e, s, state)).map((e) => e.id);

test("every event has at least one known sub-category", () => {
  for (const e of EVENTS) {
    assert.ok(e.subcategories?.length, `${e.id} has no sub-category`);
    for (const id of e.subcategories!)
      assert.ok(subCategory(id), `${e.id}: unknown sub-category ${id}`);
  }
});

test("every sub-category sits under at least one of the six categories", () => {
  assert.equal(TOP_CATEGORIES.length, 6);
  for (const s of SUB_CATEGORIES) {
    assert.ok(s.parents.length);
    for (const p of s.parents) assert.ok(TOP_CATEGORIES.includes(p));
  }
  // CPT/OPT is listed under both Career and International Students.
  assert.ok(subsOf("Career & Jobs").some((s) => s.id === "cpt-opt"));
  assert.ok(subsOf("International Students").some((s) => s.id === "cpt-opt"));
});

test("the catalog's original category, topic and food fields are untouched", () => {
  const legacy = new Set([
    "Academic",
    "Career",
    "Social",
    "Workshops",
    "Wellbeing",
    "Arts",
  ]);
  for (const e of EVENTS)
    assert.ok(legacy.has(e.category), `${e.id}: ${e.category}`);
});

test("legacy names map to the new categories (Workshops by topic)", () => {
  assert.equal(legacyCategory("Academic"), "Academic & Research");
  assert.equal(legacyCategory("Career"), "Career & Jobs");
  assert.equal(legacyCategory("Social"), "Community & Social");
  assert.equal(legacyCategory("Social", "Arts & culture"), "Arts & Creative");
  assert.equal(legacyCategory("Social", "Wellbeing"), "Wellbeing");
  assert.equal(
    legacyCategory("Workshops", "AI & education"),
    "Academic & Research",
  );
  assert.equal(legacyCategory("Workshops", "Career"), "Career & Jobs");
  assert.equal(
    legacyCategory("Workshops", "Arts & culture"),
    "Arts & Creative",
  );
  assert.equal(
    legacyCategory("Career & Jobs", "Arts & culture"),
    "Career & Jobs",
  );
  // An event without sub-categories falls back to its legacy category.
  assert.deepEqual(
    eventCategories({ ...event("e7"), subcategories: undefined }),
    ["Career & Jobs"],
  );
  assert.deepEqual(
    eventCategories({ ...event("e7"), subcategories: ["not-a-real-id"] }),
    ["Career & Jobs"],
  );
});

test("Free food is one switch covering every free food value", () => {
  const food = ids({ ...ALL, freeFood: true }).map((id) => event(id).food);
  assert.equal(food.length, 21);
  assert.ok(food.every((f) => FREE_FOOD.includes(f)));
  for (const f of [
    "Free meal",
    "Coffee & snacks",
    "Light refreshments",
    "Popcorn",
  ])
    assert.ok(food.includes(f), f);
  for (const f of ["Paid food", "None", "Unknown"])
    assert.ok(!food.includes(f), f);
});

test("filters combine: AND across groups, OR within a group", () => {
  const career = ids({ ...ALL, category: "Career & Jobs" });
  const careerFood = ids({ ...ALL, category: "Career & Jobs", freeFood: true });
  assert.ok(careerFood.length > 0 && careerFood.length < career.length);
  assert.ok(
    careerFood.every(
      (id) => career.includes(id) && FREE_FOOD.includes(event(id).food),
    ),
  );

  const net = ids({ ...ALL, category: "Career & Jobs", subs: ["networking"] });
  const resume = ids({
    ...ALL,
    category: "Career & Jobs",
    subs: ["resume-interview"],
  });
  const both = ids({
    ...ALL,
    category: "Career & Jobs",
    subs: ["networking", "resume-interview"],
  });
  assert.deepEqual(new Set(both), new Set([...net, ...resume]));

  const tueAfternoon = ids({ ...ALL, days: [1], times: ["afternoon"] });
  assert.ok(tueAfternoon.length);
  for (const id of tueAfternoon) {
    assert.equal(event(id).day, 1);
    assert.equal(timeOfDay(event(id).start), "afternoon");
  }
  assert.equal(timeOfDay(11 * 60 + 59), "morning");
  assert.equal(timeOfDay(12 * 60), "afternoon");
  assert.equal(timeOfDay(17 * 60), "evening");

  const rsvpEither = ids({ ...ALL, rsvp: ["required", "dropin"] });
  assert.equal(rsvpEither.length, EVENTS.length);
});

test("Fits my free time hides clashes with classes and personal items", () => {
  const target = EVENTS.find((e) => e.day === 0)!;
  const base = fresh();
  const sel = { ...ALL, fitsFreeTime: true };
  assert.ok(ids(sel, { ...base, blocks: [] }).includes(target.id));
  const withClass = {
    ...base,
    blocks: [
      {
        id: "b1",
        title: "Class",
        day: 0,
        start: target.start,
        end: target.end,
      },
    ],
  };
  assert.ok(!ids(sel, withClass).includes(target.id));
  const withPersonal = {
    ...base,
    blocks: [],
    personalEvents: [
      {
        id: "pe1",
        title: "Study group",
        date: DATES[0],
        start: target.start,
        end: target.end,
        repeat: "none" as const,
      },
    ],
  };
  assert.ok(!ids(sel, withPersonal).includes(target.id));
  // Unconfirmed eligibility (e15) is not a time clash, so it stays listed.
  assert.ok(ids(sel, { ...base, blocks: [] }).includes("e15"));
  // ...but an access problem must not hide a real clash: a class over e15 hides it.
  const e15 = event("e15");
  const overE15 = {
    ...base,
    blocks: [
      { id: "b2", title: "Class", day: e15.day, start: e15.start, end: e15.end },
    ],
  };
  assert.ok(!ids(sel, overE15).includes("e15"));
  // Without the switch the clashing event is still listed.
  assert.ok(ids(ALL, withClass).includes(target.id));
});

test("host options come from the data; audience filters", () => {
  const hosts = new Set(EVENTS.map((e) => e.host_school).filter(Boolean));
  assert.deepEqual(new Set(HOSTS), hosts);
  const gse = ids({ ...ALL, hosts: ["School of Education"] });
  assert.ok(
    gse.length &&
      gse.every((id) => event(id).host_school === "School of Education"),
  );
  assert.ok(ids({ ...ALL, audience: ["first-gen"] }).includes("e38"));
  assert.ok(ids({ ...ALL, audience: ["international"] }).includes("e11"));
});

test("active filter chips describe and remove each choice", () => {
  const s: ExploreSelection = {
    ...ALL,
    category: "Career & Jobs",
    subs: ["networking"],
    freeFood: true,
    times: ["afternoon"],
  };
  const chips = activeChips(s);
  assert.deepEqual(
    chips.map((c) => c.label),
    ["Career & Jobs › Networking & alumni", "Afternoon", "Free food"],
  );
  assert.equal(panelCount(s), 2);
  const noFood = chips.find((c) => c.label === "Free food")!.remove(s);
  assert.equal(noFood.freeFood, false);
  const noSub = chips[0].remove(s);
  assert.deepEqual(noSub.subs, []);
  assert.deepEqual(activeChips(noSub)[0].label, "Career & Jobs");
  assert.deepEqual(activeChips(ALL), []);
});

test("Home tile counts equal what Explore then shows", () => {
  assert.equal(HOME_CATEGORIES.length, 7);
  for (const c of HOME_CATEGORIES) {
    const n = categoryCount(c.filter);
    assert.ok(n > 0, `${c.label} has no events`);
    assert.equal(
      n,
      EVENTS.filter((e) => matchesExplore(e, selectionFor(c.filter))).length,
    );
  }
  assert.equal(categoryCount("Free food"), 21);
});

test("drafts saved with a retired category name still load", () => {
  const old = {
    id: "d1",
    title: "Old draft",
    topic: "AI & education",
    category: "Workshops",
    day: 1,
    start: 900,
    end: 960,
    location: "Learning Studio",
    host: "",
    description: "",
    food: "None",
    cost: 0,
    rsvp: "Drop-in welcome",
    access: "open",
    createdAt: "2026-11-12T10:00:00Z",
  };
  const [d] = restoreDrafts([old]);
  assert.equal(d.category, "Academic & Research");
});
