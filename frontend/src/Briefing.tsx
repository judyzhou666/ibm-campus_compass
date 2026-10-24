import { activeTopics, wirePreferences } from "./preferences.ts";
import { WEEK_LABEL } from "./config.ts";
import { EVENTS } from "./data.ts";
import { useRecommendations } from "./useRecommendations.ts";
import {
  UsingPreferences,
  RecommendationInfo,
} from "./RecommendationPresentation.tsx";
import { issue, overlappingAlternatives } from "./planner.ts";
import { Button } from "./components.tsx";
import type { DemoState } from "./types.ts";
export function Briefing({
  state,
  onDetail,
  onPlanner,
  onCalendar,
  onPreferences,
}: {
  state: DemoState;
  onDetail: (id: string) => void;
  onPlanner: () => void;
  onCalendar: () => void;
  onPreferences: () => void;
}) {
  const result = useRecommendations(state);
  const cross = useRecommendations(state, {
    explore: true,
    limit: Math.min(2, wirePreferences(state).count),
  });
  const links = (
    ids: string[],
    explain = false,
    matches = result.matchReasons,
  ) =>
    ids.length ? (
      ids.map((id) => (
        <li key={id}>
          <button className="text-btn" onClick={() => onDetail(id)}>
            {EVENTS.find((e) => e.id === id)?.title}
          </button>
          {explain && (
            <RecommendationInfo
              event={EVENTS.find((e) => e.id === id)!}
              state={state}
              alternativeIds={overlappingAlternatives(
                EVENTS.find((e) => e.id === id)!,
                [...result.ids, ...cross.ids],
                state,
              )}
              matches={matches.find((r) => r.event_id === id)?.matches}
            />
          )}
        </li>
      ))
    ) : (
      <li>No items this demo week.</li>
    );
  const ready = !result.loading && !cross.loading,
    ids = ready ? result.ids : [];
  return (
    <section className="panel briefing">
      <h2>This Week&apos;s Briefing</h2>
      <p className="fineprint">
        {WEEK_LABEL} · Deterministic simulation · No live updates
      </p>
      <UsingPreferences state={state} onEdit={onPreferences} />
      {!ready ? (
        <p role="status">Checking availability…</p>
      ) : (
        <>
          <p role="status">
            {[...new Set([result.notice, cross.notice].filter(Boolean))].join(
              " ",
            )}
          </p>
          {(result.source === "error" || cross.source === "error") && (
            <Button
              onClick={() => {
                result.retry();
                cross.retry();
              }}
            >
              Retry briefing
            </Button>
          )}
          <div className="briefing-grid">
            <div>
              <h3>Matching your interests</h3>
              <ul>
                {links(
                  ids.filter(
                    (id) =>
                      !activeTopics(state).length ||
                      activeTopics(state).includes(
                        EVENTS.find((e) => e.id === id)!.topic,
                      ),
                  ),
                  true,
                )}
              </ul>
            </div>
            <div>
              <h3>Across disciplines</h3>
              <p>
                Explore topics beyond your selections; departments are not
                verified.
              </p>
              <ul>{links(cross.ids, true, cross.matchReasons)}</ul>
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
