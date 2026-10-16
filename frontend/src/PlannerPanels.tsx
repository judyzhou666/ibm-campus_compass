import { useEffect, useRef, useState } from "react";
import { DAYS, EVENTS, time, when } from "./data.ts";
import { Button, Icon } from "./components.tsx";
import { issue } from "./planner.ts";
import type { CampusEvent, DemoState, Rsvp } from "./types.ts";

export function ChatEvents({
  ids,
  state,
  onDetails,
  onAdd,
}: {
  ids: string[];
  state: DemoState;
  onDetails: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  return (
    <div className="chat-event-list">
      {ids.map((id) => {
        const event = EVENTS.find((e) => e.id === id);
        if (!event) return null;
        const added = state.plan.includes(id),
          problem = issue(event, state);
        return (
          <article className="chat-event" key={id} aria-label={event.title}>
            <span className="tag">{event.category}</span>
            <h3>{event.title}</h3>
            <p className="meta">{when(event)}</p>
            <p className="meta">
              {event.location} · {event.rsvp}
            </p>
            {problem ? <p className="event-problem">{problem}</p> : null}
            <div className="row">
              <Button className="small" onClick={() => onDetails(id)}>
                View details
              </Button>
              <Button
                className="small primary"
                disabled={added || Boolean(problem)}
                onClick={() => onAdd(id)}
              >
                {added ? "Added to calendar" : "Add to calendar"}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PlannerCalendar({
  state,
  onClose,
  onDetails,
}: {
  state: DemoState;
  onClose: () => void;
  onDetails: (id: string) => void;
}) {
  return (
    <aside
      className="panel planner-calendar"
      id="planner-calendar"
      aria-label="Calendar beside chat"
    >
      <div className="section-bar">
        <h2>My calendar</h2>
        <button
          className="icon-btn"
          aria-label="Close calendar panel"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="sub">October 19–23, 2026 · Eastern Time</p>
      <div className="calendar-legend">
        <span>● Your events</span>
        <span>○ Busy commitments</span>
      </div>
      <p className="fineprint" role="status">
        {state.plan.filter((id) => !state.cancelled.includes(id)).length} events
        added · Updates as you plan
      </p>
      <div className="planner-agenda">
        {DAYS.map((day, index) => {
          const entries = [
            ...state.blocks
              .filter((b) => b.day === index)
              .map((b) => ({
                ...b,
                event: undefined as CampusEvent | undefined,
              })),
            ...EVENTS.filter(
              (e) => e.day === index && state.plan.includes(e.id),
            ).map((e) => ({ ...e, event: e })),
          ].sort((a, b) => a.start - b.start);
          return (
            <section
              className="agenda-day"
              key={day}
              aria-label={`${day}, October ${19 + index}`}
            >
              <h3>
                {day}
                <span>Oct {19 + index}</span>
              </h3>
              {entries.length ? (
                entries.map((entry) =>
                  entry.event ? (
                    <button
                      className={`agenda-entry chosen ${state.cancelled.includes(entry.id) ? "cancelled" : ""}`}
                      key={`event-${entry.id}`}
                      onClick={() => onDetails(entry.id)}
                    >
                      <span>
                        {time(entry.start)}–{time(entry.end)}
                      </span>
                      <strong>{entry.title}</strong>
                      <small>
                        {state.cancelled.includes(entry.id)
                          ? "Cancelled"
                          : state.rsvps.includes(entry.id)
                            ? "Demo RSVP confirmed"
                            : "Added to calendar"}
                      </small>
                    </button>
                  ) : (
                    <div
                      className="agenda-entry commitment"
                      key={`block-${entry.id}`}
                    >
                      <span>
                        {time(entry.start)}–{time(entry.end)}
                      </span>
                      <strong>{entry.title}</strong>
                      <small>Busy commitment</small>
                    </div>
                  ),
                )
              ) : (
                <p className="fineprint">Open for possibilities</p>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export function RsvpDialog({
  event,
  name,
  busy,
  onClose,
  onSubmit,
}: {
  event: CampusEvent;
  name: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (rsvp: Rsvp) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [displayName, setDisplayName] = useState(name);
  const [attending, setAttending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rsvp-dialog"
      aria-labelledby="rsvp-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <span className="tag">RSVP required · Demo registration</span>
      <h2 id="rsvp-title">Reserve your spot</h2>
      <h3>{event.title}</h3>
      <p className="meta">{when(event)} · Eastern Time</p>
      <p className="meta">{event.location}</p>
      <p>Complete this RSVP to add the event to your calendar.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          const problem = await onSubmit({
            display_name: displayName.trim(),
            attending,
          });
          if (problem) setError(problem);
        }}
      >
        <label className="rsvp-name">
          Demo attendee name
          <input
            autoFocus
            required
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="rsvp-check">
          <input
            type="checkbox"
            required
            checked={attending}
            onChange={(e) => setAttending(e.target.checked)}
            disabled={busy}
          />
          <span>I confirm I’d like to attend this demo event.</span>
        </label>
        <p className="fineprint">
          This is a simulated RSVP. No organizer is contacted and no real place
          is reserved. Use a demo name; no email or payment is needed.
        </p>
        {error ? (
          <p className="event-problem" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Adding to your calendar…" : "Complete RSVP & add"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
