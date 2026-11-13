/**
 * The simulated planner understands everyday student words and never silently
 * falls back to the profile interests: different questions used to get the
 * same three cards with no explanation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpretRequest,
  unmatchedWords,
} from "../frontend/src/interpretation.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createStore, fresh } from "../frontend/src/state.ts";
import type { DemoState } from "../frontend/src/types.ts";

const topics = (text: string) =>
  interpretRequest(text).constraints.topics ?? [];

describe("student vocabulary", () => {
  it("maps EdTech / PhD / grad school words to AI & education", () => {
    assert.deepEqual(
      topics("can you help me to plan event for edtech phd path?"),
      ["AI & education"],
    );
    assert.deepEqual(topics("grad school and thesis advice"), [
      "AI & education",
    ]);
    assert.deepEqual(topics("meet professors"), ["AI & education", "Social"]);
  });

  it("maps visa and job-search words to Career", () => {
    assert.deepEqual(topics("how do I apply for OPT"), ["Career"]);
    assert.deepEqual(topics("CPT and visa sponsorship"), ["Career"]);
    assert.deepEqual(topics("interview practice with a mentor"), ["Career"]);
    // "options" is not "opt".
    assert.deepEqual(topics("show me options"), []);
  });

  it("maps social, arts and wellbeing words", () => {
    assert.deepEqual(topics("trivia night"), ["Social"]);
    assert.deepEqual(topics("international student club"), ["Social"]);
    assert.deepEqual(topics("music or a concert"), ["Arts & culture"]);
    assert.deepEqual(topics("yoga to reduce stress"), ["Wellbeing"]);
  });

  it("OPT means Career only as a noun, not the verb (PR #28 review)", () => {
    assert.deepEqual(topics("OPT"), ["Career"]);
    assert.deepEqual(topics("questions about OPT"), ["Career"]);
    assert.deepEqual(topics("OPT application timeline"), ["Career"]);
    assert.deepEqual(topics("I'd opt for something quiet"), ["Wellbeing"]);
    for (const q of ["what is OPT?", "OPT events", "OPT help", "how does OPT work"])
      assert.deepEqual(topics(q), ["Career"], q);
  });

  it("exclusions need whole words (PR #28 review)", () => {
    const c = interpretRequest(
      "career events, attendance not optional",
    ).constraints;
    assert.deepEqual(c.topics, ["Career"]);
    assert.equal(c.excluded, undefined);
    assert.equal(
      interpretRequest("I cannot wait for career events").constraints.excluded,
      undefined,
    );
    assert.deepEqual(interpretRequest("not career").constraints.excluded, [
      "Career",
    ]);
  });

  it("negations still exclude", () => {
    assert.deepEqual(interpretRequest("no yoga").constraints.excluded, [
      "Wellbeing",
    ]);
  });
});

describe("unmatched words", () => {
  it("keeps only words with meaning", () => {
    assert.deepEqual(unmatchedWords("Can you help me find something fun?"), [
      "fun",
    ]);
    assert.deepEqual(unmatchedWords("plan my week please"), []);
    assert.deepEqual(unmatchedWords("purple flying giraffes dancing tonight"), [
      "purple",
      "flying",
      "giraffes",
      "dancing",
    ]);
  });
});

describe("replies say what they are based on", () => {
  const offline = async () => {
    throw Error("offline");
  };
  const lastReply = (demo: { read(): DemoState }) =>
    demo
      .read()
      .messages.filter((m) => m.role === "assistant")
      .at(-1)!.text;

  it("names words it could not match and the profile interests it used", async () => {
    const demo = createStore({ ...fresh(), interests: ["Career", "Social"] });
    await createConversation(demo, () => {}, offline).chat(
      "find something fun on Monday",
    );
    const text = lastReply(demo);
    assert.match(text, /I couldn’t match “fun”/);
    assert.match(text, /your profile interests \(Career, Social\)/);
  });

  it("says no topic was named when the request has none", async () => {
    const demo = createStore({ ...fresh(), interests: ["Career"] });
    await createConversation(demo, () => {}, offline).chat("events on Monday");
    assert.match(
      lastReply(demo),
      /You didn’t name a topic, so these picks follow your profile interests \(Career\)\./,
    );
  });

  it("adds nothing when a topic was understood", async () => {
    const demo = createStore(fresh());
    await createConversation(demo, () => {}, offline).chat("edtech phd events");
    const text = lastReply(demo);
    assert.ok(!text.includes("profile interests"), text);
    assert.ok(!text.includes("couldn’t match"), text);
  });
});
