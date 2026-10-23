import {
  activeTopics,
  wirePreferences,
  PARTICIPATION,
  GUIDANCE,
  type Guidance,
} from "./preferences.ts";
import { TOPICS } from "./data.ts";
import { WEEK_LABEL } from "./config.ts";
import { useEffect, useRef, useState } from "react";
import { EVENTS } from "./data.ts";
import { requestPlan, planningKey } from "./api.ts";
import { issue } from "./planner.ts";
import { Button } from "./components.tsx";
import type { DemoState } from "./types.ts";
export function Welcome({
  onStart,
  onSkip,
  onFinish,
  onBrowse,
}: {
  onStart: () => void;
  onSkip: () => void;
  onBrowse: () => void;
  onFinish: (
    topics: string[],
    participation: string[],
    guidance: Guidance,
  ) => void;
}) {
  const [topics, setTopics] = useState<string[]>([]),
    [participation, setParticipation] = useState<string[]>([]),
    [guidance, setGuidance] = useState<Guidance>("few");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="welcome-title" onCancel={onSkip}>
      <h2 id="welcome-title">Make campus feel more familiar.</h2>
      <p>
        Personalize academic, research, career, social and cultural interests
        and preferred times. No career goal is required. Preferences are saved
        in this browser. Recommendation requests are processed by the app’s
        Rust service when available.
      </p>
      <fieldset>
        <legend>1. What would you like to explore?</legend>
        {TOPICS.map((t) => (
          <label className="quick-choice" key={t}>
            <input
              type="checkbox"
              checked={topics.includes(t)}
              onChange={() =>
                setTopics(
                  topics.includes(t)
                    ? topics.filter((x) => x !== t)
                    : [...topics, t],
                )
              }
            />
            {t}
          </label>
        ))}
        <p>No choices? Browse generally — you can decide later.</p>
      </fieldset>
      <label className="field">
        2. Preferred participation
        <select
          value={participation[0] || ""}
          onChange={(e) =>
            setParticipation(e.target.value ? [e.target.value] : [])
          }
        >
          <option value="">No preference</option>
          {Object.entries(PARTICIPATION).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        3. Preferred guidance
        <select
          value={guidance}
          onChange={(e) => setGuidance(e.target.value as Guidance)}
        >
          {Object.entries(GUIDANCE).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={() => onFinish(topics, participation, guidance)}>
        Save quick setup
      </Button>
      <div className="row">
        <Button onClick={onStart}>Personalize my demo</Button>
        <Button onClick={onSkip}>Use sample preferences</Button>
        <Button onClick={onBrowse}>Skip and browse generally</Button>
      </div>
    </dialog>
  );
}
export function Briefing({
  state,
  onDetail,
  onPlanner,
  onCalendar,
}: {
  state: DemoState;
  onDetail: (id: string) => void;
  onPlanner: () => void;
  onCalendar: () => void;
}) {
  const [result, setResult] = useState<{
    key: string;
    ids: string[];
    cross: string[];
    notice: string;
  } | null>(null);
  const key = planningKey(state);
  useEffect(() => {
    let active = true;
    void Promise.all([
      requestPlan("Find events", {}, state),
      requestPlan(
        "Find events",
        { explore: true, limit: Math.min(2, wirePreferences(state).count) },
        state,
      ),
    ])
      .then(([r, c]) => {
        if (active)
          setResult({
            key,
            ids: r.ids,
            cross: c.ids,
            notice: r.notice || c.notice,
          });
      })
      .catch(() => {
        if (active)
          setResult({
            key,
            ids: [],
            cross: [],
            notice: "Briefing unavailable. Review your schedule and retry.",
          });
      });
    return () => {
      active = false;
    };
  }, [key]);
  const links = (ids: string[]) =>
    ids.length ? (
      ids.map((id) => (
        <li key={id}>
          <button className="text-btn" onClick={() => onDetail(id)}>
            {EVENTS.find((e) => e.id === id)?.title}
          </button>
        </li>
      ))
    ) : (
      <li>No items this demo week.</li>
    );
  const ready = result?.key === key,
    ids = ready ? result.ids : [];
  return (
    <section className="panel briefing">
      <h2>This Week&apos;s Briefing</h2>
      <p className="fineprint">
        {WEEK_LABEL} · Deterministic simulation · No live updates
      </p>
      {!ready ? (
        <p role="status">Checking availability…</p>
      ) : (
        <>
          <p role="status">{result.notice}</p>
          <div className="briefing-grid">
            <div>
              <h3>Matching your interests</h3>
              <ul>
                {links(
                  ids.filter((id) =>
                    activeTopics(state).includes(
                      EVENTS.find((e) => e.id === id)!.topic,
                    ),
                  ),
                )}
              </ul>
            </div>
            <div>
              <h3>Across disciplines</h3>
              <p>
                Explore topics beyond your selections; departments are not
                verified.
              </p>
              <ul>{links(result.cross)}</ul>
            </div>
            <div>
              <h3>Saved, not yet added</h3>
              <ul>
                {links(state.saved.filter((id) => !state.plan.includes(id)))}
              </ul>
            </div>
            <div>
              <h3>Uncertainties</h3>
              <p>
                All records are fictional and externally unverified. Capacity is
                unknown unless marked full.
              </p>
              <ul>
                {links(
                  EVENTS.filter(
                    (e) =>
                      [...state.saved, ...state.plan, ...ids].includes(e.id) &&
                      (e.food === "Unknown" ||
                        !e.rsvp ||
                        e.rsvp === "Unknown" ||
                        e.access === "unknown"),
                  ).map((e) => e.id),
                )}
              </ul>
            </div>
            <div>
              <h3>Plan changes and conflicts</h3>
              {state.plan
                .filter((id) =>
                  issue(
                    EVENTS.find((e) => e.id === id)!,
                    state,
                  ),
                )
                .map((id) => (
                  <p key={id}>
                    <button className="text-btn" onClick={() => onDetail(id)}>
                      {EVENTS.find((e) => e.id === id)!.title}
                    </button>
                    :{" "}
                    {issue(
                      EVENTS.find((e) => e.id === id)!,
                      state,
                    )}
                  </p>
                ))}
              {!state.plan.some((id) =>
                issue(
                  EVENTS.find((e) => e.id === id)!,
                  state,
                ),
              ) && <p>No current plan warnings.</p>}
            </div>
          </div>
        </>
      )}
      <div className="row">
        <Button onClick={onPlanner}>Open AI Planner</Button>
        <Button onClick={onCalendar}>Review Calendar</Button>
      </div>
    </section>
  );
}
