import {
  DEMO,
  DEMO_NOW_MINUTE,
  dayLabel,
  weekDayLabel,
  demoTodayIndex,
  isTimeZone,
  timeIn,
} from "./config.ts";
import { COMMUNITIES, communityHash } from "./communities.ts";
import { useEffect, useRef, type ReactNode } from "react";
import { DAYS, EVENTS, time as formatTime, when } from "./data.ts";
import { issue, reasons } from "./planner.ts";
import { paths } from "./icons.ts";
import type { CampusEvent, DemoState } from "./types.ts";
import { updateBadge, hasConflict, effectiveUpdate, effectiveEvents, relativeTime, kindLabel } from "./updates.ts";

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
  const tz = isTimeZone(timezone) ? timezone : DEMO.time_zone;
  // The demo is frozen at Monday 9:00 AM campus time of the demo week, so the
  // heading date always agrees with the "today" marker on the week strip.
  const todayLabel = timeIn(0, DEMO_NOW_MINUTE, tz);
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="sub">{description}</p>
      </div>
      {children || (
        <span className="date">
          {todayLabel} · Demo week
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
      {[
        "All",
        "Academic",
        "Career",
        "Social",
        "Workshops",
        "Free Food",
        "Coffee & snacks",
        "Paid food",
        "No food",
        "Food unknown",
      ].map((c) => (
        <button
          key={c}
          className={`chip ${value === c ? "active" : ""}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
        >
          {c}
        </button>
      ))}
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
  const appliedIds = (state as DemoState).appliedUpdateIds ?? [];
  const badge = updateBadge(e.id, appliedIds);
  const conflict = hasConflict(e.id, appliedIds);
  const upd = !conflict ? effectiveUpdate(e.id, appliedIds) : null;
  return (
    <article className={`event-card${badge === "needs-confirmation" ? " event-card--conflict" : badge === "updated" ? " event-card--updated" : ""}`}>
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
        <div className="event-tag-row">
          <span className={`tag ${category}`}>{e.category}</span>
          {badge === "needs-confirmation" ? (
            <span className="badge badge--conflict">Needs confirmation</span>
          ) : badge === "updated" && upd ? (
            <span className="badge badge--updated">{kindLabel(upd.kind)}</span>
          ) : null}
        </div>
        <button className="event-title" onClick={() => onDetail(e.id)}>
          <h3>{e.title}</h3>
        </button>
        <div className="meta">
          <Icon name="calendar" />
          {upd?.kind === "time_moved" && upd.new_start != null && upd.new_end != null
            ? <>{formatTime(upd.new_start)}–{formatTime(upd.new_end)} <span className="badge badge--updated">Time changed</span></>
            : when(e)}
        </div>
        <div className="meta">
          <Icon name="pin" />
          {upd?.new_location ?? e.location}
          {upd?.new_location ? <span className="badge badge--updated">Room changed</span> : null}
        </div>
        <div className="meta">
          <Icon name="food" />
          {foodLabel(e.food)} · {e.cost ? `$${e.cost}` : "Free entry"}
        </div>
        {e.host_school && (
          <div className="meta">
            <Icon name="users" />
            {e.host_school}
            {e.goal_type?.length ? ` · ${e.goal_type.join(", ")}` : ""}
          </div>
        )}
        {e.last_checked_at ? (
          <div className="meta meta--fineprint">
            <Icon name="clock" />
            Last checked {relativeTime(e.last_checked_at)}
          </div>
        ) : null}
        <div className={`reason ${problem && !inPlan ? "blocked" : ""}`}>
          {conflict
            ? "Needs confirmation — conflicting notices received for this event."
            : problem ||
              `${state.interests.includes(e.topic) ? "Matches your interests" : "Discover something new"} · Fits your schedule`}
        </div>
        {problem && !inPlan ? (
          // A blocked event explains itself instead of offering an add that fails.
          <Button className="blocked" onClick={() => onDetail(e.id)}>
            Can't add · See why
          </Button>
        ) : (
          <Button onClick={() => (inPlan ? onCalendar() : onAdd(e.id))}>
            <Icon name={inPlan ? "check" : "plus"} />
            {inPlan ? "In your calendar" : "Add to calendar"}
          </Button>
        )}
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
/** Renders an access_conditions field value; "unknown" → "Not confirmed". */
export function conditionLabel(value: boolean | number | string | undefined) {
  if (value === "unknown" || value === undefined) return "Not confirmed";
  if (value === true) return "Required";
  if (value === false) return "Not required";
  if (value === "full") return "Full";
  return String(value);
}
export function Week({
  state,
  full = false,
  weekOffset = 0,
  onDetail,
  onDay,
}: {
  state: DemoState;
  full?: boolean;
  /**
   * Weeks before (negative) or after the demo week. Classes repeat weekly;
   * campus events exist only in the demo week, so other weeks show classes
   * only and no "Find events" buttons.
   */
  weekOffset?: number;
  onDetail: (id: string) => void;
  onDay: (day: number) => void;
}) {
  const demoWeek = weekOffset === 0;
  // Mark the same day the heading shows for the chosen time zone.
  const today = demoWeek
    ? demoTodayIndex(isTimeZone(state.timezone) ? state.timezone : DEMO.time_zone)
    : -1;
  return (
    <div className="week-scroll">
      <div className="week">
        {DAYS.map((day, i) => {
          const items = [
            ...state.blocks
              .filter((b) => b.day === i)
              .map((b) => ({ ...b, kind: "class" })),
            // Effective times: a time_moved update moves the block.
            ...(demoWeek ? effectiveEvents(state.appliedUpdateIds ?? []) : [])
              .filter((e) => e.day === i && state.plan.includes(e.id))
              .map((e) => ({ ...e, kind: "event" })),
          ].sort((a, b) => a.start - b.start);
          return (
            <div className="week-day" key={day}>
              <div className={`day-head ${i === today ? "today" : ""}`}>
                {day}
                <strong>{weekDayLabel(i, weekOffset)}</strong>
              </div>
              {items.map((e) => {
                const cancelled = state.cancelled.includes(e.id),
                  content = (
                    <>
                      <strong>{e.title}</strong>
                      <span>
                        {cancelled
                          ? "Cancelled"
                          : `${formatTime(e.start)}${full ? " – " + formatTime(e.end) : ""}`}
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
              {demoWeek ? (
                <button
                  className="add-day"
                  aria-label={`Find events on ${day}`}
                  onClick={() => onDay(i)}
                >
                  <Icon name="plus" />
                  {full ? "Find an event" : ""}
                </button>
              ) : null}
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
  onCommunity,
  onAdd,
  onRemove,
  onSave,
}: {
  event: CampusEvent;
  state: DemoState;
  onClose: () => void;
  onCommunity: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSave: (id: string) => void;
}) {
  const problem = issue(e, state),
    planned = state.plan.includes(e.id),
    saved = state.saved.includes(e.id);
  const category =
    e.topic === "Arts & culture" ? "arts" : e.category.toLowerCase();
  const appliedIds = (state as DemoState).appliedUpdateIds ?? [];
  const badge = updateBadge(e.id, appliedIds);
  const conflict = hasConflict(e.id, appliedIds);
  const upd = !conflict ? effectiveUpdate(e.id, appliedIds) : null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerZone =
    isTimeZone(state.timezone) && state.timezone !== DEMO.time_zone
      ? state.timezone
      : "";
  // Convert the same start time the panel shows (the moved time after a
  // time_moved update), not the original catalog time.
  const moved = upd?.kind === "time_moved" && upd.new_start != null && upd.new_end != null;
  const shown = moved ? { ...e, start: upd!.new_start!, end: upd!.new_end! } : e;
  const shownStart = shown.start;
  let viewerTime = "";
  if (viewerZone) {
    try {
      viewerTime = timeIn(e.day, shownStart, viewerZone);
    } catch {
      viewerTime = "";
    }
  }

  // Move focus into the overlay and give it back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    overlayRef.current
      ?.querySelector<HTMLElement>(".event-detail-close")
      ?.focus();
    return () => opener?.focus?.();
  }, []);

  // Lock body scroll while detail is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Keyboard close
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") return onClose();
      if (ev.key !== "Tab" || !overlayRef.current) return;
      // Keep Tab inside the overlay, as the former modal dialog did.
      const focusable = [
        ...overlayRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      const inside = overlayRef.current.contains(document.activeElement);
      if (ev.shiftKey && (document.activeElement === first || !inside)) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && (document.activeElement === last || !inside)) {
        ev.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={overlayRef} className="event-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
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
            {badge === "needs-confirmation" ? (
              <span className="badge badge--conflict">Needs confirmation</span>
            ) : badge === "updated" && upd ? (
              <span className="badge badge--updated">{kindLabel(upd.kind)}</span>
            ) : null}
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
                <span>
                  {upd?.kind === "time_moved" && upd.new_start != null && upd.new_end != null ? (
                    <>{formatTime(upd.new_start)}–{formatTime(upd.new_end)} · {DEMO.time_zone} <span className="badge badge--updated" style={{ marginLeft: "0.25rem" }}>Time changed</span></>
                  ) : (
                    <>{when(e)} · {DEMO.time_zone}</>
                  )}
                </span>
              </div>
              {viewerTime && (
                <div className="event-detail-info-row">
                  <Icon name="calendar" />
                  <span>
                    Starts {viewerTime} in your time zone ({viewerZone})
                  </span>
                </div>
              )}
              <div className="event-detail-info-row">
                <Icon name="pin" />
                <span>
                  {upd?.new_location ?? e.location}
                  {upd?.new_location ? <span className="badge badge--updated" style={{ marginLeft: "0.5rem" }}>Room changed</span> : null}
                </span>
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
              {e.host_school && (
                <div className="event-detail-info-row">
                  <Icon name="users" />
                  <span>Hosted by {e.host_school}</span>
                </div>
              )}
              {e.goal_type && e.goal_type.length > 0 && (
                <div className="event-detail-info-row">
                  <Icon name="spark" />
                  <span>Goal: {e.goal_type.join(" · ")}</span>
                </div>
              )}
              {e.access_conditions && (
                <div className="event-detail-info-row">
                  <Icon name="settings" />
                  <span>
                    Membership: {conditionLabel(e.access_conditions.membership)} ·{" "}
                    Min age: {conditionLabel(e.access_conditions.min_age)} ·{" "}
                    Ticket: {conditionLabel(e.access_conditions.ticket)} ·{" "}
                    Capacity: {conditionLabel(e.access_conditions.capacity)}
                  </span>
                </div>
              )}
            </div>

            {conflict ? (
              <div className="notice notice--conflict">
                <strong>Needs confirmation</strong>
                <p>Conflicting notices were received for this event — one says it was cancelled, another says the room changed. The organizer has not clarified. Do not make plans based on either notice alone.</p>
              </div>
            ) : badge === "updated" && upd ? (
              <div className="notice notice--updated">
                <strong>{kindLabel(upd.kind)}</strong>
                <p>{upd.details}</p>
              </div>
            ) : null}
            {e.last_checked_at ? (
              <p className="fineprint" style={{ marginTop: "0.5rem" }}>
                <Icon name="clock" /> Last checked {relativeTime(e.last_checked_at)}
              </p>
            ) : null}
            {problem && !conflict ? (
              <div className="notice">{problem}</div>
            ) : !problem ? (
              <div className="event-detail-reasons">
                {reasons(e, state).map((reason) => (
                  <div key={reason} className="event-detail-reason-item">✓ {reason}</div>
                ))}
              </div>
            ) : null}

            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Related communities</h2>
              <p className="fineprint">Fictional local groups matching this record's topic.</p>
              <div className="event-detail-communities">
                {COMMUNITIES.filter((c) => c.topics.includes(e.topic)).map((c) => (
                  <a
                    key={c.id}
                    href={communityHash(c.id)}
                    onClick={(ev) => {
                      ev.preventDefault();
                      onCommunity(c.id);
                    }}
                    className="event-detail-community-link"
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            </section>

            <details className="event-detail-evidence">
              <summary>Record &amp; evidence</summary>
              <dl className="evidence">
                {Object.entries({
                  "Host school": e.host_school || "Not confirmed",
                  "Goal type": e.goal_type?.length ? e.goal_type.join(", ") : "Not confirmed",
                  Campus: e.campus_id || "Unknown",
                  Source: e.source || "Unknown",
                  "Last checked": e.last_checked_at
                    ? `${new Date(e.last_checked_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} (${relativeTime(e.last_checked_at)})`
                    : "Not confirmed",
                  "Intended audience": e.intended_audience || "Not confirmed",
                  Eligibility: e.eligibility || "Not confirmed",
                  RSVP: e.rsvp || "Unknown",
                  Availability: e.availability || "Not confirmed",
                  "Food status": e.food_status || "Not confirmed",
                  Verification: e.verification_status || "Not verified",
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                {e.source_url ? (
                  <div>
                    <dt>Original source URL</dt>
                    <dd>
                      <a href={e.source_url} target="_blank" rel="noopener noreferrer">
                        {e.source_url}
                      </a>
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt>Original source URL</dt>
                    <dd>Not confirmed</dd>
                  </div>
                )}
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
                <p className="event-detail-aside-date">{when(shown)}</p>
                <p className="event-detail-aside-loc"><Icon name="pin" /> {upd?.new_location ?? e.location}</p>
                <Button
                  className="primary"
                  onClick={() => (planned ? onRemove(e.id) : onAdd(e.id))}
                >
                  {planned ? "Remove from calendar" : "Add to calendar"}
                </Button>
                <Button onClick={() => onSave(e.id)}>
                  <Icon name="bookmark" />
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

/** Demo sign-in: a display name only. No account, password or email. */
export function SignInDialog({
  name,
  onSignIn,
  onClose,
}: {
  name: string;
  onSignIn: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rsvp-dialog signin-dialog"
      aria-labelledby="signin-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="signin-title">Sign in to Campus Compass</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(
            new FormData(e.currentTarget).get("name") || "",
          ).trim();
          if (value) onSignIn(value.slice(0, 30));
        }}
      >
        <label className="rsvp-name">
          Display name
          <input name="name" autoFocus required maxLength={30} defaultValue={name} />
        </label>
        <p className="fineprint">
          Demo sign-in only: there is no account or password, and no email is
          needed. Your fictional profile stays in this browser.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Sign in
          </button>
        </div>
      </form>
    </dialog>
  );
}
