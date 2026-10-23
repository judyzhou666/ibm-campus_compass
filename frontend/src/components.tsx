import { RecommendationInfo } from "./RecommendationPresentation.tsx";
import { DEMO, dayLabel } from "./config.ts";
import { COMMUNITIES, communityHash } from "./communities.ts";
import { useEffect, useRef, type ReactNode } from "react";
import { DAYS, EVENTS, time, when } from "./data.ts";
import { issue, reasons } from "./planner.ts";
import { paths } from "./icons.ts";
import type { CampusEvent, DemoState } from "./types.ts";

export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d={paths[name] || paths.compass} />
    </svg>
  );
}
export function Button({
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`btn ${className}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="compass" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="sub">{description}</p>
      </div>
      {children || (
        <span className="date">
          {dayLabel(0)}, {DEMO.week_start.slice(0, 4)} · Demo
        </span>
      )}
    </div>
  );
}
export function Filters({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="filters">
      {["All", "Academic", "Career", "Social", "Workshops", "Free Food"].map(
        (c) => (
          <button
            key={c}
            className={`chip ${value === c ? "active" : ""}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
          >
            {c}
          </button>
        ),
      )}
    </div>
  );
}
export function EventCard({
  event: e,
  state,
  onAdd,
  onSave,
  onDetail,
  onCalendar,
  onDecline,
  onAnother,
  matchReasons,
  alternativeIds,
}: {
  event: CampusEvent;
  alternativeIds?: string[];
  matchReasons?: import("./planner.ts").RecommendationMatch[];
  state: DemoState;
  onAdd: (id: string) => void;
  onSave: (id: string) => void;
  onDetail: (id: string) => void;
  onCalendar: () => void;
  onDecline?: (id: string) => void;
  onAnother?: (id: string) => void;
}) {
  const inPlan = state.plan.includes(e.id),
    problem = issue(e, state),
    saved = state.saved.includes(e.id);
  const category =
    e.topic === "Arts & culture" ? "arts" : e.category.toLowerCase();
  return (
    <article className="event-card">
      <div className={`poster ${category}`}>
        <small>
          {DEMO.campus_name} / {dayLabel(e.day)}
        </small>
        <b>
          {e.poster.split(" / ").map((part, i) => (
            <span key={part}>
              {i > 0 ? <br /> : null}
              {part}
            </span>
          ))}
        </b>
        <button
          className={`icon-btn ${saved ? "selected" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${e.title}`}
          aria-pressed={saved}
          onClick={() => onSave(e.id)}
        >
          <Icon name="bookmark" />
        </button>
      </div>
      <div className="event-body">
        <span className={`tag ${category}`}>{e.category}</span>
        <button className="event-title" onClick={() => onDetail(e.id)}>
          <h3>{e.title}</h3>
        </button>
        <div className="meta">
          <Icon name="calendar" />
          {when(e)}
        </div>
        <div className="meta">
          <Icon name="pin" />
          {e.location}
        </div>
        <div className="meta">
          <Icon name="food" />
          {foodLabel(e.food)} · {e.cost ? `$${e.cost}` : "Free entry"}
        </div>
        <RecommendationInfo
          event={e}
          state={state}
          matches={matchReasons}
          alternativeIds={alternativeIds}
        />
        {onDecline && !inPlan && (
          <>
            <Button onClick={() => onDecline(e.id)}>Not for me</Button>
            {onAnother && (
              <Button onClick={() => onAnother(e.id)}>Show another</Button>
            )}
          </>
        )}
        <Button
          disabled={!inPlan && !!problem}
          onClick={() => (inPlan ? onCalendar() : onAdd(e.id))}
        >
          <Icon name={inPlan ? "check" : "plus"} />
          {inPlan ? "In your calendar" : "Add to calendar"}
        </Button>
      </div>
    </article>
  );
}
export function foodLabel(food: string) {
  return food === "None"
    ? "No food provided"
    : food === "Unknown"
      ? "Food unconfirmed"
      : food;
}
export function Week({
  state,
  full = false,
  onDetail,
  onDay,
}: {
  state: DemoState;
  full?: boolean;
  onDetail: (id: string) => void;
  onDay: (day: number) => void;
}) {
  return (
    <div className="week-scroll">
      <div className="week">
        {DAYS.map((day, i) => {
          const items = [
            ...state.blocks
              .filter((b) => b.day === i)
              .map((b) => ({ ...b, kind: "class" })),
            ...EVENTS.filter(
              (e) => e.day === i && state.plan.includes(e.id),
            ).map((e) => ({ ...e, kind: "event" })),
          ].sort((a, b) => a.start - b.start);
          return (
            <div className="week-day" key={day}>
              <div className={`day-head ${i === 0 ? "today" : ""}`}>
                {day}
                <strong>{dayLabel(i)}</strong>
              </div>
              {items.map((e) => {
                const cancelled = state.cancelled.includes(e.id),
                  content = (
                    <>
                      <strong>{e.title}</strong>
                      <span>
                        {cancelled
                          ? "Cancelled"
                          : `${time(e.start)}${full ? " – " + time(e.end) : ""}`}
                      </span>
                    </>
                  );
                return e.kind === "event" ? (
                  <button
                    key={e.id}
                    className={`calendar-item event ${cancelled ? "cancelled" : ""}`}
                    onClick={() => onDetail(e.id)}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={e.id} className="calendar-item class">
                    {content}
                  </div>
                );
              })}
              <button
                className="add-day"
                aria-label={`Find events on ${day}`}
                onClick={() => onDay(i)}
              >
                <Icon name="plus" />
                {full ? "Find an event" : ""}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function EventDetails({
  event: e,
  state,
  onClose,
  onAdd,
  onRemove,
  onSave,
}: {
  event: CampusEvent;
  state: DemoState;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSave: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    problem = issue(e, state),
    planned = state.plan.includes(e.id);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="detail-title">
      <button
        className="icon-btn close"
        aria-label="Close details"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <span className="tag">{e.category} · Fictional event</span>
      <h2 id="detail-title">{e.title}</h2>
      <p>{e.description}</p>
      <div className="meta">
        <Icon name="calendar" />
        {when(e)} · {DEMO.time_zone}
      </div>
      <div className="meta">
        <Icon name="pin" />
        {e.location}
      </div>
      <div className="meta">
        <Icon name="food" />
        {foodLabel(e.food)} · {e.cost ? `$${e.cost}` : "Free admission"}
      </div>
      <div className="meta">
        <Icon name="users" />
        {e.access === "open"
          ? "Open to all demo students"
          : e.access === "members"
            ? "Membership required"
            : e.access === "full"
              ? "At capacity"
              : "Eligibility not confirmed"}{" "}
        · {e.rsvp}
      </div>
      {problem ? (
        <div className="notice">{problem}</div>
      ) : (
        <div className="reason">
          {reasons(e, state).map((reason) => (
            <div key={reason}>{reason}</div>
          ))}
        </div>
      )}
      <section>
        <h3>Related communities</h3>
        <p className="fineprint">
          Fictional local groups matching this record’s topic.
        </p>
        {COMMUNITIES.filter((c) => c.topics.includes(e.topic)).map((c) => (
          <p key={c.id}>
            <a href={communityHash(c.id)} onClick={onClose}>
              {c.name}
            </a>
          </p>
        ))}
      </section>
      <div className="source">
        <strong>Record & evidence</strong>
        <br />
        <dl className="evidence">
          {Object.entries({
            Campus: e.campus_id || "Unknown",
            Source: e.source || "Unknown",
            "Original source URL": e.source_url || "Unknown",
            "Last checked timestamp": e.last_checked_at || "Not verified",
            "Intended audience": e.intended_audience || "Unknown",
            Eligibility: e.eligibility || "Unknown",
            RSVP: e.rsvp || "Unknown",
            Availability: e.availability || "Unknown",
            "Participation format": e.participation || "unknown",
            "Food status": e.food_status || "Unknown",
            Verification: e.verification_status || "Not verified",
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <br />
        Authored for this prototype · Internal authoring review (not external
        verification) {e.checked}
        <br />
        RSVP-required events use a mandatory demo registration step. No
        organizer is contacted and no real place is reserved.
      </div>
      <div className="row">
        <Button
          className="primary"
          onClick={() => (planned ? onRemove(e.id) : onAdd(e.id))}
        >
          {planned ? "Remove from calendar" : "Add to calendar"}
        </Button>
        <Button onClick={() => onSave(e.id)}>
          {state.saved.includes(e.id) ? "Unsave event" : "Save event"}
        </Button>
      </div>
    </dialog>
  );
}
