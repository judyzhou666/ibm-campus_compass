import { DEMO, dayLabel } from "./config.ts";
import { COMMUNITIES, communityHash } from "./communities.ts";
import { useEffect, type ReactNode } from "react";
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
  timezone,
  children,
}: {
  title: string;
  description: string;
  timezone?: string;
  children?: ReactNode;
}) {
  const tz = timezone || DEMO.time_zone;
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(new Date());
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="sub">{description}</p>
      </div>
      {children || (
        <span className="date">
          {todayLabel} · Demo
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
}: {
  event: CampusEvent;
  state: DemoState;
  onAdd: (id: string) => void;
  onSave: (id: string) => void;
  onDetail: (id: string) => void;
  onCalendar: () => void;
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
        <div className="reason">
          {problem ||
            `${state.interests.includes(e.topic) ? "Matches your interests" : "Discover something new"} · Fits your schedule`}
        </div>
        <Button onClick={() => (inPlan ? onCalendar() : onAdd(e.id))}>
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
  const problem = issue(e, state),
    planned = state.plan.includes(e.id),
    saved = state.saved.includes(e.id);
  const category =
    e.topic === "Arts & culture" ? "arts" : e.category.toLowerCase();

  // Lock body scroll while detail is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Keyboard close
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="event-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      {/* Sticky close bar */}
      <div className="event-detail-bar">
        <button className="event-detail-close icon-btn" aria-label="Close details" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      {/* Scrollable page content */}
      <div className="event-detail-scroll">

        {/* Hero banner */}
        <div className={`event-detail-hero poster ${category}`}>
          <div className="event-detail-hero-inner">
            <span className="tag">{e.category} · Fictional event</span>
            <h1 id="detail-title" className="event-detail-hero-title">{e.title}</h1>
          </div>
        </div>

        {/* Body */}
        <div className="event-detail-body">

          {/* Left: details */}
          <div className="event-detail-main">
            <p className="event-detail-desc">{e.description}</p>

            <div className="event-detail-info-grid">
              <div className="event-detail-info-row">
                <Icon name="calendar" />
                <span>{when(e)} · {DEMO.time_zone}</span>
              </div>
              <div className="event-detail-info-row">
                <Icon name="pin" />
                <span>{e.location}</span>
              </div>
              <div className="event-detail-info-row">
                <Icon name="food" />
                <span>{foodLabel(e.food)} · {e.cost ? `$${e.cost}` : "Free admission"}</span>
              </div>
              <div className="event-detail-info-row">
                <Icon name="users" />
                <span>
                  {e.access === "open"
                    ? "Open to all demo students"
                    : e.access === "members"
                      ? "Membership required"
                      : e.access === "full"
                        ? "At capacity"
                        : "Eligibility not confirmed"
                  } · {e.rsvp}
                </span>
              </div>
            </div>

            {problem ? (
              <div className="notice">{problem}</div>
            ) : (
              <div className="event-detail-reasons">
                {reasons(e, state).map((reason) => (
                  <div key={reason} className="event-detail-reason-item">✓ {reason}</div>
                ))}
              </div>
            )}

            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Related communities</h2>
              <p className="fineprint">Fictional local groups matching this record's topic.</p>
              <div className="event-detail-communities">
                {COMMUNITIES.filter((c) => c.topics.includes(e.topic)).map((c) => (
                  <a key={c.id} href={communityHash(c.id)} onClick={onClose} className="event-detail-community-link">
                    {c.name}
                  </a>
                ))}
              </div>
            </section>

            <details className="event-detail-evidence">
              <summary>Record &amp; evidence</summary>
              <dl className="evidence">
                {Object.entries({
                  Campus: e.campus_id || "Unknown",
                  Source: e.source || "Unknown",
                  "Original source URL": e.source_url || "Unknown",
                  "Last checked": e.last_checked_at || "Not verified",
                  "Intended audience": e.intended_audience || "Unknown",
                  Eligibility: e.eligibility || "Unknown",
                  RSVP: e.rsvp || "Unknown",
                  Availability: e.availability || "Unknown",
                  "Food status": e.food_status || "Unknown",
                  Verification: e.verification_status || "Not verified",
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="fineprint">
                Authored for this prototype · Internal authoring review (not external verification) {e.checked}.
                RSVP-required events use a mandatory demo registration step. No organiser is contacted and no real place is reserved.
              </p>
            </details>
          </div>

          {/* Right: sticky action panel */}
          <aside className="event-detail-aside">
            <div className="event-detail-aside-inner">
              <div className={`event-detail-aside-banner poster ${category}`}>
                <b>{e.poster.split(" / ").map((part, i) => (
                  <span key={part}>{i > 0 ? " / " : ""}{part}</span>
                ))}</b>
              </div>
              <div className="event-detail-aside-body">
                <p className="event-detail-aside-date">{when(e)}</p>
                <p className="event-detail-aside-loc"><Icon name="pin" /> {e.location}</p>
                <Button
                  className="primary"
                  onClick={() => (planned ? onRemove(e.id) : onAdd(e.id))}
                >
                  {planned ? "Remove from calendar" : "Add to calendar"}
                </Button>
                <Button onClick={() => onSave(e.id)}>
                  <Icon name={saved ? "bookmark" : "bookmark"} />
                  {saved ? "Saved" : "Save event"}
                </Button>
                <p className="fineprint" style={{ marginTop: 12 }}>
                  Fictional demo event. No real registration.
                </p>
              </div>
            </div>
          </aside>

        </div>
      </div>

      {/* Backdrop click to close */}
      <div className="event-detail-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}
