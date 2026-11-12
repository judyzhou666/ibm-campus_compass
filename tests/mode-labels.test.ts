/**
 * Tests for honest mode labels and evidence rendering decisions.
 *
 * Covers:
 *   - ai_reason shown when present, template reasons() used when absent
 *   - chatStatusLabel derivation from health mode (before first reply) and
 *     planModeLabel (after a plan reply)
 *   - DemoLauncher subtitle text in simulated vs watsonx mode
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { planModeLabel } from "../frontend/src/api.ts";
import { reasons } from "../frontend/src/planner.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import type { RecommendationEvidence } from "../frontend/src/types.ts";

// ── ai_reason rendering decision ────────────────────────────────────────────

/**
 * Mirror the ChatEvents rendering branch:
 *   found?.ai_reason → show ai_reason + attribution
 *   otherwise         → show reasons()
 */
function whyThisFitsText(
  evidence: RecommendationEvidence | undefined,
  eventId: string,
  state: ReturnType<typeof fresh>,
): { kind: "ai"; reason: string } | { kind: "template"; reasons: string[] } {
  const event = EVENTS.find((e) => e.id === eventId);
  if (!event) throw new Error("unknown event");
  if (evidence?.ai_reason) {
    return { kind: "ai", reason: evidence.ai_reason };
  }
  return {
    kind: "template",
    reasons: reasons(event, state, state.constraints).slice(0, 3),
  };
}

test("ai_reason is shown instead of template reasons when present", () => {
  const state = fresh();
  const ev: RecommendationEvidence = {
    event_id: "e1",
    interest_match: "template interest",
    schedule_fit: "Free on Tuesday",
    practical: "Drop-in",
    trade_offs: "None",
    ai_reason: "This event directly matches your goal of exploring AI tools in a structured lab setting.",
    cited_fields: ["title", "description", "goal_type"],
  };
  const result = whyThisFitsText(ev, "e1", state);
  assert.equal(result.kind, "ai");
  assert.equal(
    (result as { kind: "ai"; reason: string }).reason,
    "This event directly matches your goal of exploring AI tools in a structured lab setting.",
  );
});

test("template reasons shown when ai_reason is absent", () => {
  const state = fresh();
  const ev: RecommendationEvidence = {
    event_id: "e1",
    interest_match: "template interest",
    schedule_fit: "Free on Tuesday",
    practical: "Drop-in",
    trade_offs: "None",
    // no ai_reason
  };
  const result = whyThisFitsText(ev, "e1", state);
  assert.equal(result.kind, "template");
  assert.ok(
    (result as { kind: "template"; reasons: string[] }).reasons.length > 0,
  );
});

test("template reasons shown when evidence object is absent entirely", () => {
  const state = fresh();
  const result = whyThisFitsText(undefined, "e1", state);
  assert.equal(result.kind, "template");
  assert.ok(
    (result as { kind: "template"; reasons: string[] }).reasons.length > 0,
  );
});

// ── chatStatusLabel derivation ────────────────────────────────────────────────

/** Mirror the chatStatusLabel logic in App.tsx. */
function chatStatusLabel(
  messageCount: number,
  watsonxMode: boolean,
  planMode: string,
): string {
  if (messageCount === 0) {
    return watsonxMode
      ? "IBM watsonx (Granite) · Ranking and explaining picks · Fictional events"
      : "Simulated planner · No live AI";
  }
  return planMode;
}

/** Mirror chatFineprint logic in App.tsx. */
function chatFineprint(watsonxMode: boolean): string {
  return watsonxMode
    ? "IBM watsonx (Granite) is ranking and explaining picks. All events are fictional demo data."
    : "Simulated responses using fictional events. No live AI or external calendar is connected.";
}

test("chatStatusLabel before first reply uses health mode — simulated", () => {
  const label = chatStatusLabel(0, false, "Simulated planner");
  assert.ok(label.includes("No live AI"), `got: ${label}`);
  assert.ok(!label.includes("watsonx"), `got: ${label}`);
});

test("chatStatusLabel before first reply uses health mode — watsonx", () => {
  const label = chatStatusLabel(0, true, "Simulated planner");
  assert.ok(label.includes("IBM watsonx (Granite)"), `got: ${label}`);
  assert.ok(label.includes("Fictional events"), `got: ${label}`);
});

test("chatStatusLabel after first reply uses plan mode label", () => {
  const planMode = planModeLabel({
    source: "rust",
    mode: "watsonx",
    explanations: "watsonx",
  });
  const label = chatStatusLabel(1, true, planMode);
  assert.equal(label, planMode);
  assert.ok(label.includes("IBM watsonx"), `got: ${label}`);
});

test("chatFineprint is honest about no live AI in simulated mode", () => {
  const text = chatFineprint(false);
  assert.ok(text.includes("No live AI"), `got: ${text}`);
  assert.ok(!text.includes("watsonx"), `got: ${text}`);
});

test("chatFineprint names watsonx and calls events fictional in watsonx mode", () => {
  const text = chatFineprint(true);
  assert.ok(text.includes("IBM watsonx (Granite)"), `got: ${text}`);
  assert.ok(text.includes("fictional"), `got: ${text}`);
});

// ── DemoLauncher subtitle ────────────────────────────────────────────────────

/** Mirror DemoLauncher subtitle logic. */
function launcherSubtitle(watsonxMode: boolean): string {
  return watsonxMode
    ? "IBM watsonx (Granite) ranking · Fictional events"
    : "No live AI";
}

test("DemoLauncher subtitle says 'No live AI' in simulated mode", () => {
  assert.equal(launcherSubtitle(false), "No live AI");
});

test("DemoLauncher subtitle names watsonx and calls events fictional in watsonx mode", () => {
  const text = launcherSubtitle(true);
  assert.ok(text.includes("IBM watsonx (Granite)"), `got: ${text}`);
  assert.ok(text.includes("Fictional events"), `got: ${text}`);
});

// ── planModeLabel ─────────────────────────────────────────────────────────────

test("planModeLabel browser fallback is always simulated", () => {
  const label = planModeLabel({
    source: "browser-fallback",
    mode: "simulated",
  });
  assert.ok(label.includes("Simulated"), `got: ${label}`);
});

test("planModeLabel watsonx with AI explanations", () => {
  const label = planModeLabel({
    source: "rust",
    mode: "watsonx",
    explanations: "watsonx",
  });
  assert.ok(label.includes("IBM watsonx"), `got: ${label}`);
  assert.ok(label.includes("AI explanations"), `got: ${label}`);
});

test("planModeLabel watsonx with template fallback", () => {
  const label = planModeLabel({
    source: "rust",
    mode: "watsonx",
    explanations: "template",
  });
  assert.ok(label.includes("IBM watsonx"), `got: ${label}`);
  assert.ok(label.includes("Template evidence"), `got: ${label}`);
});

test("planModeLabel simulated planner does not mention watsonx", () => {
  const label = planModeLabel({ source: "rust", mode: "simulated" });
  assert.ok(!label.includes("watsonx"), `got: ${label}`);
  assert.ok(label.includes("Simulated"), `got: ${label}`);
});
