import { WEEK_LABEL } from "./config.ts";
import { useEffect, useRef, useState } from "react";
import { EVENTS } from "./data.ts";
import { requestPlan, planningKey } from "./api.ts";
import { issue } from "./planner.ts";
import { Button, Icon } from "./components.tsx";
import type { DemoState } from "./types.ts";
import {
  nextBatch,
  updatesInLatestBatch,
  hasConflict,
  effectiveUpdate,
  kindLabel,
  relativeTime,
} from "./updates.ts";

export function Welcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="welcome-dialog"
      aria-labelledby="welcome-title"
      onCancel={onSkip}
    >
      <button
        type="button"
        className="welcome-close icon-btn"
        aria-label="Close and use default preferences"
        onClick={onSkip}
      >
        <Icon name="close" />
      </button>
      <h2 id="welcome-title">Make campus feel more familiar.</h2>
      <p>
        Personalize academic, research, career, social and cultural interests
        and preferred times. No career goal is required. Your fictional profile
        stays in this browser.
      </p>
      <div className="row">
        <Button onClick={onStart}>Personalize my demo</Button>
        <Button onClick={onSkip}>Default Preference</Button>
      </div>
    </dialog>
  );
}

/** What-changed feed shown in the Briefing panel and bell menu after a check. */
export function UpdateFeed({
  state,
  onDetail,
}: {
  state: DemoState;
  onDetail: (id: string) => void;
}) {
  const { updates } = updatesInLatestBatch(state.appliedUpdateIds);
  if (!updates.length) return null;
  return (
    <div className="update-feed" aria-live="polite">
      <h3>
        <Icon name="bell" /> What changed since your last check
      </h3>
      <ul className="update-list">
        {updates.map((u) => {
          const event = EVENTS.find((e) => e.id === u.event_id);
          const conflict = hasConflict(u.event_id, state.appliedUpdateIds);
          const affected = state.plan.includes(u.event_id);
          return (
            <li
              key={u.id}
              className={`update-item${affected ? " update-item--planned" : ""}${conflict ? " update-item--conflict" : ""}`}
            >
              <span className={`tag update-tag update-tag--${u.kind}`}>
                {kindLabel(u.kind)}
              </span>
              {event ? (
                <button className="text-btn" onClick={() => onDetail(event.id)}>
                  {event.title}
                </button>
              ) : (
                <span>{u.event_id}</span>
              )}
              {conflict ? (
                <span className="badge badge--conflict" role="status">
                  Needs confirmation — conflicting notices received
                </span>
              ) : null}
              {affected && !conflict ? (
                <span className="badge badge--planned">In your plan</span>
              ) : null}
              <p className="update-detail">{u.details}</p>
            </li>
          );
        })}
      </ul>
      <p className="fineprint">Synthetic update · Last checked {relativeTime(state.lastUpdateCheck!)}</p>
    </div>
  );
}

export function Briefing({
  state,
  onDetail,
  onPlanner,
  onCalendar,
  onCheckUpdates,
}: {
  state: DemoState;
  onDetail: (id: string) => void;
  onPlanner: () => void;
  onCalendar: () => void;
  onCheckUpdates: () => void;
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
        { excluded: state.interests, limit: 2 },
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
      ids.map((id) => {
        const ev = EVENTS.find((e) => e.id === id);
        if (!ev) return null;
        const conflict = hasConflict(id, state.appliedUpdateIds);
        const upd = !conflict ? effectiveUpdate(id, state.appliedUpdateIds) : null;
        return (
          <li key={id} className={conflict ? "item--conflict" : upd ? "item--updated" : ""}>
            <button className="text-btn" onClick={() => onDetail(id)}>
              {ev.title}
            </button>
            {conflict ? (
              <span className="badge badge--conflict">Needs confirmation</span>
            ) : upd ? (
              <span className="badge badge--updated">{kindLabel(upd.kind)}</span>
            ) : null}
          </li>
        );
      })
    ) : (
      <li>No items this demo week.</li>
    );
  const ready = result?.key === key,
    ids = ready ? result.ids : [];
  const hasPending = !!nextBatch(state.appliedUpdateIds);
  const hasChanges = state.lastUpdateCheck !== null && updatesInLatestBatch(state.appliedUpdateIds).updates.length > 0;
  return (
    <section className="panel briefing">
      <h2>This Week&apos;s Briefing</h2>
      <p className="fineprint">
        {WEEK_LABEL} · Deterministic simulation · No live updates
      </p>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <Button onClick={onCheckUpdates} className={hasPending ? "primary" : ""}>
          <Icon name="bell" />
          {hasPending
            ? "Check for updates"
            : "No more batches · Synthetic update"}
        </Button>
        {state.lastUpdateCheck ? (
          <span className="fineprint" style={{ alignSelf: "center" }}>
            Last checked {relativeTime(state.lastUpdateCheck)}
          </span>
        ) : null}
      </div>
      {hasChanges && (
        <UpdateFeed state={state} onDetail={onDetail} />
      )}
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
                    state.interests.includes(
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
