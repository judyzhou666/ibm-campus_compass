import {
  activeTopics,
  GUIDANCE,
  PARTICIPATION,
  wirePreferences,
} from "./preferences.ts";
import { issue, rankingDetails } from "./planner.ts";
import type { RecommendationMatch } from "./planner.ts";
import type { CampusEvent, DemoState } from "./types.ts";

export function UsingPreferences({
  state,
  onEdit,
}: {
  state: DemoState;
  onEdit: () => void;
}) {
  const p = wirePreferences(state);
  return (
    <aside className="using-preferences" aria-label="Using your preferences">
      <strong>Using your preferences</strong>
      <p>
        {activeTopics(state).join(" · ") || "General browsing"} ·{" "}
        {GUIDANCE[p.guidance]} · Up to {p.count} suggestions
      </p>
      <p className="fineprint">
        {p.goal_topics.length ? "Goals enabled" : "No active goal topics"} ·{" "}
        {p.learning_topics.length
          ? "Confirmed learning enabled"
          : "No active learning topics"}{" "}
        ·{" "}
        {p.participation.map((x) => PARTICIPATION[x]).join(" / ") ||
          "No participation preference"}
        . {p.free_only ? "Free admission only. " : ""}
        {p.windows.length ? `${p.windows.length} available-only windows. ` : ""}
        Entered commitments and {state.buffer}-minute travel buffer apply.
      </p>
      <button className="btn" type="button" onClick={onEdit}>
        Edit preferences
      </button>
    </aside>
  );
}

export function EventGuidance({
  event: e,
  state,
}: {
  event: CampusEvent;
  state: DemoState;
}) {
  const { guidance } = wirePreferences(state);
  if (guidance === "first")
    return (
      <p className="fineprint">
        First step (optional): view the event details before deciding.
      </p>
    );
  if (guidance === "steps")
    return (
      <div className="event-guidance">
        <p>Optional decision checklist — not official event requirements:</p>
        <ol>
          <li>Review the recorded time, access and requirements.</li>
          <li>Decide whether this fits your situation.</li>
          <li>
            If you choose to add it, use the demo calendar flow; confirm demo
            RSVP only when the record requires it.
          </li>
        </ol>
        <p className="fineprint">
          Recorded requirement: {e.rsvp || "Unknown"}. No real registration is
          performed.
        </p>
      </div>
    );
  if (guidance === "information")
    return (
      <div className="event-guidance">
        <p>
          Recorded requirements (fictional catalog): {e.rsvp || "Unknown"}.
          Eligibility: {e.eligibility || "Unknown"}.
        </p>
        <p>
          Admission: ${e.cost}. Location: {e.location || "Unknown"}. Food:{" "}
          {e.food || "Unknown"}.
        </p>
        <p>
          Unknowns:{" "}
          {e.access === "full"
            ? "the record is marked full"
            : "capacity is not confirmed"}
          ; records are fictional and externally unverified. Participation
          format: {e.participation || "unknown"}.
        </p>
        <p className="fineprint">
          Optional preparation: review details or note questions. This is not an
          official event requirement.
        </p>
      </div>
    );
  return (
    <p className="fineprint">
      {guidance === "none"
        ? "Choose what works for you; every suggestion is optional."
        : "Suggestions, not an attendance target. Review the details; adding is optional."}
    </p>
  );
}

export function RecommendationInfo({
  event,
  state,
  matches,
  previousSettings = false,
}: {
  event: CampusEvent;
  state: DemoState;
  matches?: RecommendationMatch[];
  previousSettings?: boolean;
}) {
  const problem = issue(event, state),
    guidance = wirePreferences(state).guidance;
  const facts =
    matches ?? (previousSettings ? [] : rankingDetails(event, state).matches);
  const limit =
    guidance === "first"
      ? 1
      : guidance === "few" || guidance === "none"
        ? 2
        : 8;
  const reasons = facts
    .filter((m) => !["diversity", "free"].includes(m.kind))
    .slice(0, limit);
  return (
    <div className="recommendation-info">
      <div className="reason">
        <strong>
          {previousSettings ? "Why it was suggested" : "Why this fits"}
        </strong>
        {reasons.map((m) => (
          <p key={m.kind}>{m.explanation}</p>
        ))}
        {!reasons.length && (
          <p>
            {previousSettings
              ? "Earlier matching details are unavailable. Refresh suggestions to use your saved settings."
              : "An option to explore in this fictional catalog."}
          </p>
        )}
        {problem && <p className="event-problem">Current check: {problem}</p>}
      </div>
      <EventGuidance event={event} state={state} />
    </div>
  );
}
