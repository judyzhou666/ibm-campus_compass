import { RecommendationInfo } from "./RecommendationPresentation.tsx";
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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DAYS, EVENTS, time as formatTime, when } from "./data.ts";
import { issue, reasons } from "./planner.ts";
import { paths } from "./icons.ts";
import type { CampusEvent, DemoState } from "./types.ts";
import {
  updateBadge,
  hasConflict,
  effectiveUpdate,
  effectiveEvents,
  relativeTime,
  kindLabel,
} from "./updates.ts";

/** Colour class for an event's poster and tag: arts topics read as arts. */
export const posterTone = (e: Pick<CampusEvent, "topic" | "category">) =>
  e.topic === "Arts & culture" ? "arts" : e.category.toLowerCase();

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
      {children || <span className="date">{todayLabel} · Demo week</span>}
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
        "Wellbeing",
        "Arts",
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
  const category = posterTone(e);
  const appliedIds = (state as DemoState).appliedUpdateIds ?? [];
  const badge = updateBadge(e.id, appliedIds);
  const conflict = hasConflict(e.id, appliedIds);
  const upd = !conflict ? effectiveUpdate(e.id, appliedIds) : null;
  return (
    <article
      className={`event-card${badge === "needs-confirmation" ? " event-card--conflict" : badge === "updated" ? " event-card--updated" : ""}`}
    >
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
          {upd?.kind === "time_moved" &&
          upd.new_start != null &&
          upd.new_end != null ? (
            <>
              {formatTime(upd.new_start)}–{formatTime(upd.new_end)}{" "}
              <span className="badge badge--updated">Time changed</span>
            </>
          ) : (
            when(e)
          )}
        </div>
        <div className="meta">
          <Icon name="pin" />
          {upd?.new_location ?? e.location}
          {upd?.new_location ? (
            <span className="badge badge--updated">Room changed</span>
          ) : null}
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
    ? demoTodayIndex(
        isTimeZone(state.timezone) ? state.timezone : DEMO.time_zone,
      )
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
                const plannedEvent =
                  e.kind === "event"
                    ? EVENTS.find((event) => event.id === e.id)
                    : undefined;
                const conflict =
                  plannedEvent && !state.cancelled.includes(e.id)
                    ? issue(plannedEvent, state)
                    : null;
                const cancelled = state.cancelled.includes(e.id),
                  content = (
                    <>
                      <strong>{e.title}</strong>
                      <span>
                        {cancelled
                          ? "Cancelled"
                          : `${formatTime(e.start)}${full ? " – " + formatTime(e.end) : ""}`}
                      </span>
                      {conflict && (
                        <span className="event-problem">
                          Conflict: {conflict}
                        </span>
                      )}
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
function ConditionRow({ label, value }: { label: string; value: string }) {
  const confirmed = value !== "Not confirmed";
  return (
    <div className="ed-condition-row">
      <span className="ed-condition-label">{label}</span>
      <span
        className={`ed-condition-value ${confirmed ? "confirmed" : "unconfirmed"}`}
      >
        <Icon name={confirmed ? "check" : "info"} />
        {value}
      </span>
    </div>
  );
}

// Followed hosts live in this browser only (fictional demo hosts).
const FOLLOW_KEY = "campus-compass-followed-hosts";
function readFollowed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeFollowed(list: string[]) {
  try {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: following lasts for this page only */
  }
}

const TRAVEL_MODES = [
  { id: "walk", label: "Walking" },
  { id: "bike", label: "Biking" },
  { id: "bus", label: "Public transit" },
] as const;

export function EventDetails({
  event: e,
  state,
  onClose,
  onCommunity,
  onAdd,
  onRemove,
  onSave,
  onDetail,
}: {
  event: CampusEvent;
  state: DemoState;
  onClose: () => void;
  onCommunity: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSave: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const problem = issue(e, state),
    planned = state.plan.includes(e.id),
    saved = state.saved.includes(e.id);
  const category = posterTone(e);
  const appliedIds = (state as DemoState).appliedUpdateIds ?? [];
  const badge = updateBadge(e.id, appliedIds);
  const conflict = hasConflict(e.id, appliedIds);
  const upd = !conflict ? effectiveUpdate(e.id, appliedIds) : null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [followed, setFollowed] = useState<string[]>(readFollowed);
  const following = !!e.host_school && followed.includes(e.host_school);
  function toggleFollow() {
    if (!e.host_school) return;
    const next = following
      ? followed.filter((h) => h !== e.host_school)
      : [...followed, e.host_school];
    setFollowed(next);
    writeFollowed(next);
  }
  // Short status lines for the demo-only controls; cleared per event.
  const [shareNote, setShareNote] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [travel, setTravel] = useState<string | null>(null);
  useEffect(() => {
    setShareNote("");
    setContactNote("");
    setMapOpen(false);
    setTravel(null);
  }, [e.id]);
  const viewerZone =
    isTimeZone(state.timezone) && state.timezone !== DEMO.time_zone
      ? state.timezone
      : "";
  const moved =
    upd?.kind === "time_moved" && upd.new_start != null && upd.new_end != null;
  const shown = moved
    ? { ...e, start: upd!.new_start!, end: upd!.new_end! }
    : e;
  const shownLocation = upd?.new_location ?? e.location;
  const shownStart = shown.start;
  let viewerTime = "";
  if (viewerZone) {
    try {
      viewerTime = timeIn(e.day, shownStart, viewerZone);
    } catch {
      viewerTime = "";
    }
  }

  // Scroll back to the top when the event changes (You might also like nav)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [e.id]);

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
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Keyboard close
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") return onClose();
      if (ev.key !== "Tab" || !overlayRef.current) return;
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

  // Poster banner: day abbreviation + date from dayLabel, e.g. "TUE · NOV 3"
  const WEEKDAY_ABBR = ["MON", "TUE", "WED", "THU", "FRI"];
  const dayAbbr = WEEKDAY_ABBR[e.day] ?? "???";
  // dayLabel returns e.g. "Nov 3"; convert to "NOV 3"
  const dateStr = dayLabel(e.day).toUpperCase();
  const posterDateLine = `${dayAbbr} · ${dateStr}`;

  // Initials avatar from host_school: first letters of the first two
  // significant words ("School of Education" → "SE").
  function hostInitials(name: string): string {
    const words = name
      .trim()
      .split(/\s+/)
      .filter(
        (w) => !["of", "and", "the", "for", "&"].includes(w.toLowerCase()),
      );
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }

  // Duration label from shown times
  function durationLabel(start: number, end: number): string {
    const mins = end - start;
    if (mins <= 0) return "";
    if (mins % 60 === 0)
      return `${mins / 60} hour${mins / 60 === 1 ? "" : "s"}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} minutes`;
    return `${h}.${Math.round((m / 60) * 10)} hours`;
  }

  // Access label. Read access after applied updates, so an event a notice
  // marked full says "At capacity" here, matching the RSVP card.
  const currentAccess = (
    effectiveEvents(appliedIds).find((x) => x.id === e.id) ?? e
  ).access;
  function accessLabel(): string {
    if (currentAccess === "open") return "Open to all";
    if (currentAccess === "members") return "Members only";
    if (currentAccess === "full") return "At capacity";
    return "Eligibility not confirmed";
  }

  // RSVP card primary button. Enrollment rejects any event with an issue
  // (conflicts included), so a blocked event gets a disabled "Can't add"
  // button and the issue strip explains why, matching the event cards.
  const blocked = !planned && !!problem;
  // Reason shown beside the button. Conflicting notices get a short pointer to
  // the full notice above, so a disabled button is never left unexplained.
  const rsvpReason = conflict
    ? "Needs confirmation: conflicting notices for this event. See the notice above."
    : problem;
  function rsvpButtonLabel(): string {
    if (planned) return "Remove from calendar";
    if (blocked) return "Can't add";
    return e.rsvp === "RSVP required"
      ? "RSVP & add to calendar"
      : "Add to calendar";
  }

  // "You might also like" — same topic, excluding this event and cancelled, sorted by day then start
  const relatedEvents = effectiveEvents(appliedIds)
    .filter(
      (ev) =>
        ev.topic === e.topic &&
        ev.id !== e.id &&
        !state.cancelled.includes(ev.id),
    )
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .slice(0, 4);

  // Short date+time for RSVP card: "Tue, Nov 3 · 10:30 AM"
  const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const shortWhen = `${WEEKDAY_SHORT[e.day] ?? ""}, ${dayLabel(e.day)} · ${formatTime(shown.start)}`;

  // Merge membership + ticket when both "Not required"
  const ac = e.access_conditions;
  const membershipLabel = ac ? conditionLabel(ac.membership) : null;
  const ticketLabel = ac ? conditionLabel(ac.ticket) : null;
  const bothNotRequired =
    membershipLabel === "Not required" && ticketLabel === "Not required";

  return (
    <div
      ref={overlayRef}
      className="event-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >
      {/* Sticky close bar */}
      <div className="event-detail-bar">
        <button
          className="event-detail-close icon-btn"
          aria-label="Close details"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>

      {/* Scrollable page content */}
      <div className="event-detail-scroll" ref={scrollRef}>
        <div className="event-detail-page">

          <button type="button" className="ed-back" onClick={onClose}>
            <Icon name="arrow" />
            Back to events
          </button>

          {/* Poster banner */}
          <div className="ed-banner-wrap">
            <div className={`ed-poster poster ${category}`}>
              <div className="ed-poster-left">
                <span className="ed-poster-topic">
                  {e.topic.toUpperCase()} · {e.category.toUpperCase()}
                </span>
                <b className="ed-poster-title">
                  {e.poster.split(" / ").map((part, i) => (
                    <span key={part}>
                      {i > 0 ? <br /> : null}
                      {part}
                    </span>
                  ))}
                </b>
              </div>
              <div className="ed-poster-right">
                <div className="ed-poster-rule" />
                <span className="ed-poster-date">{posterDateLine}</span>
                <span className="ed-poster-time">
                  {formatTime(shown.start)}–{formatTime(shown.end)}
                </span>
                <span className="ed-poster-loc">{shownLocation}</span>
                {e.host_school && (
                  <span className="ed-poster-host">{e.host_school}</span>
                )}
              </div>
            </div>
          </div>

          {/* Share / Save row. The detail view has no URL of its own, so
              Share copies the event's details as text instead of a link. */}
          <div className="ed-icon-row">
            {shareNote && (
              <span className="ed-demo-note" role="status">
                {shareNote}
              </span>
            )}
            <button
              className="icon-btn ed-icon-btn"
              aria-label="Share event details"
              onClick={() => {
                const text = `${e.title} · ${shortWhen}–${formatTime(shown.end)} · ${shownLocation} (fictional demo event)`;
                // Fallback for browsers that block the async clipboard API.
                const legacyCopy = () => {
                  const ta = document.createElement("textarea");
                  ta.value = text;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  document.body.appendChild(ta);
                  ta.select();
                  const ok = document.execCommand("copy");
                  ta.remove();
                  if (!ok) throw new Error("copy blocked");
                };
                Promise.resolve()
                  .then(() => navigator.clipboard.writeText(text))
                  .catch(legacyCopy)
                  .then(
                    () => setShareNote("Event details copied"),
                    () => setShareNote("Couldn't copy in this browser"),
                  );
              }}
            >
              <Icon name="share" />
            </button>
            <button
              className={`icon-btn ed-icon-btn ${saved ? "selected" : ""}`}
              aria-label={saved ? "Saved" : "Save event"}
              aria-pressed={saved}
              onClick={() => onSave(e.id)}
            >
              <Icon name="bookmark" />
            </button>
          </div>

          {/* Two-column layout */}
          <div className="event-detail-body">
            {/* Main column */}
            <div className="event-detail-main">
              {/* 1. Title block */}
              <div className="ed-section ed-title-block">
                {/* Tags row */}
                <div className="ed-tags-row">
                  <span className={`ed-cat-pill tag ${category}`}>
                    {e.category.toUpperCase()}
                  </span>
                  <span className="ed-demo-pill">Fictional demo event</span>
                  {badge === "needs-confirmation" ? (
                    <span className="badge badge--conflict">
                      Needs confirmation
                    </span>
                  ) : null}
                </div>

                <h1 id="detail-title" className="ed-title">
                  {e.title}
                </h1>

                {/* Host row */}
                {e.host_school && (
                  <div className="ed-host-row">
                    <span className="ed-avatar" aria-hidden="true">
                      {hostInitials(e.host_school)}
                    </span>
                    <div className="ed-host-info">
                      <span>
                        by <strong>{e.host_school}</strong>
                      </span>
                      <span className="ed-host-sub">
                        Fictional host · {e.topic}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ed-outline-btn ed-host-follow"
                      aria-pressed={following}
                      onClick={toggleFollow}
                    >
                      {following ? "Following" : "Follow"}
                    </button>
                  </div>
                )}

                {/* When */}
                <div className="ed-meta-row">
                  <Icon name="calendar" />
                  <span>
                    {WEEKDAY_SHORT[e.day] || ""}, {dayLabel(e.day)} ·{" "}
                    <strong>
                      {formatTime(shown.start)}–{formatTime(shown.end)}
                    </strong>{" "}
                    ET
                    {moved && (
                      <span className="badge badge--updated ed-badge-inline">
                        Time updated
                      </span>
                    )}
                  </span>
                </div>
                {viewerTime && (
                  <div className="ed-meta-row ed-meta-sub">
                    <Icon name="clock" />
                    <span>
                      Starts {viewerTime} in your time zone ({viewerZone})
                    </span>
                  </div>
                )}

                {/* Where */}
                <div className="ed-meta-row">
                  <Icon name="pin" />
                  <span>
                    {shownLocation} · Fictional campus
                    {upd?.new_location && (
                      <span className="badge badge--updated ed-badge-inline">
                        Room changed
                      </span>
                    )}
                  </span>
                </div>

                {/* Update notice */}
                {conflict ? (
                  <div
                    className="ed-update-notice notice--conflict"
                    role="status"
                  >
                    <strong>
                      <Icon name="warning" /> Needs confirmation
                    </strong>
                    <p>
                      Conflicting notices were received for this event — one
                      says it was cancelled, another says the room changed. The
                      organizer has not clarified. Do not make plans based on
                      either notice alone.
                    </p>
                  </div>
                ) : moved ? (
                  <div
                    className="ed-update-notice ed-update-notice--info"
                    role="status"
                  >
                    <strong>
                      Moved {upd!.new_start! < e.start ? "earlier" : "later"}.
                    </strong>{" "}
                    Now {formatTime(upd!.new_start!)}–
                    {formatTime(upd!.new_end!)},{" "}
                    <s className="ed-struck">
                      was {formatTime(e.start)}–{formatTime(e.end)}
                    </s>
                    . Your schedule was re-checked.
                  </div>
                ) : upd?.kind === "room_changed" ? (
                  <div
                    className="ed-update-notice ed-update-notice--info"
                    role="status"
                  >
                    <strong>Room changed.</strong> Now in {upd.new_location},{" "}
                    <s className="ed-struck">was {e.location}</s>.
                  </div>
                ) : badge === "updated" && upd ? (
                  <div
                    className="ed-update-notice ed-update-notice--info"
                    role="status"
                  >
                    <strong>{kindLabel(upd.kind)}.</strong> {upd.details}
                  </div>
                ) : null}
              </div>

              {/* 2. Overview */}
              <div className="ed-section">
                <h2 className="ed-section-heading">Overview</h2>
                <p className="event-detail-desc">{e.description}</p>
                {e.goal_type && e.goal_type.length > 0 && (
                  <div className="ed-goals-row">
                    <span className="ed-goals-label">Good for</span>
                    {e.goal_type.map((g) => (
                      <span key={g} className="ed-goal-pill">
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Good to know */}
              <div className="ed-section">
                <h2 className="ed-section-heading">Good to know</h2>
                <div className="ed-cards-row">
                  {/* Highlights card */}
                  <div className="ed-card">
                    <h3 className="ed-card-title">Highlights</h3>
                    <ul className="ed-card-list">
                      <li>
                        <Icon name="clock" />
                        {durationLabel(shown.start, shown.end)}
                      </li>
                      <li>
                        <Icon name="pin" />
                        In person
                      </li>
                      <li>
                        <Icon name="food" />
                        {foodLabel(e.food)}
                      </li>
                      <li>
                        <Icon name="users" />
                        {accessLabel()}
                      </li>
                    </ul>
                  </div>
                  {/* Entry requirements card */}
                  <div className="ed-card">
                    <h3 className="ed-card-title">Entry requirements</h3>
                    <div className="ed-conditions">
                      <ConditionRow label="RSVP" value={e.rsvp} />
                      {ac ? (
                        <>
                          {bothNotRequired ? (
                            <ConditionRow
                              label="Membership / Ticket"
                              value="Not required"
                            />
                          ) : (
                            <>
                              <ConditionRow
                                label="Membership"
                                value={membershipLabel!}
                              />
                              <ConditionRow
                                label="Ticket"
                                value={ticketLabel!}
                              />
                            </>
                          )}
                          {conditionLabel(ac.min_age) !== "Not required" && (
                            <ConditionRow
                              label="Minimum age"
                              value={conditionLabel(ac.min_age)}
                            />
                          )}
                          {conditionLabel(ac.capacity) !== "Not required" && (
                            <ConditionRow
                              label="Capacity"
                              value={conditionLabel(ac.capacity)}
                            />
                          )}
                        </>
                      ) : null}
                      {e.cost > 0 && (
                        <ConditionRow label="Cost" value={`$${e.cost}`} />
                      )}
                    </div>
                    {/* Why it fits */}
                    {!problem && (
                      <div className="ed-why-fits">
                        <span className="ed-why-label">Why it fits you</span>
                        {reasons(e, state).map((r) => (
                          <div key={r} className="ed-why-item">
                            <Icon name="check" />
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Location */}
              <div className="ed-section">
                <h2 className="ed-section-heading">Location</h2>
                <div className="ed-location-row">
                  <div className="ed-location-text">
                    <strong>{shownLocation}</strong>
                    <span className="ed-location-sub">Fictional campus</span>
                    <div className="ed-travel">
                      <h3>Getting there</h3>
                      {TRAVEL_MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="ed-travel-btn"
                          aria-pressed={travel === m.id}
                          onClick={() => setTravel(m.id)}
                        >
                          <Icon name={m.id} />
                          {m.label}
                        </button>
                      ))}
                      {travel && (
                        <p className="ed-demo-note" role="status">
                          Demo only: there are no {TRAVEL_MODES.find((m) => m.id === travel)!.label.toLowerCase()} directions for this fictional campus.
                        </p>
                      )}
                      {state.buffer > 0 && (
                        <span className="ed-location-note">
                          Travel time between rooms counts toward conflict checks.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ed-map-placeholder">
                    <button
                      type="button"
                      className="ed-outline-btn"
                      aria-expanded={mapOpen}
                      onClick={() => setMapOpen((v) => !v)}
                    >
                      {mapOpen ? "Hide campus map" : "Show campus map"}
                    </button>
                    <span>
                      {mapOpen
                        ? `Demo only: no real map. ${shownLocation} is on the fictional campus.`
                        : "Fictional campus map"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Hosted by + related communities */}
              <div className="ed-section">
                <h2 className="ed-section-heading">Hosted by</h2>
                {e.host_school ? (
                  <div className="ed-host-card">
                    <span
                      className="ed-avatar ed-avatar--lg"
                      aria-hidden="true"
                    >
                      {hostInitials(e.host_school)}
                    </span>
                    <div>
                      <strong>{e.host_school}</strong>
                      <span className="ed-host-sub">
                        Fictional host department · Topics: {e.topic}
                      </span>
                      {contactNote && (
                        <p className="ed-demo-note" role="status">
                          {contactNote}
                        </p>
                      )}
                    </div>
                    <div className="ed-host-actions">
                      <button
                        type="button"
                        className="ed-outline-btn"
                        onClick={() =>
                          setContactNote(
                            "Demo only: this fictional host can't be contacted and no message is sent.",
                          )
                        }
                      >
                        Contact
                      </button>
                      <button
                        type="button"
                        className="ed-fill-btn"
                        aria-pressed={following}
                        onClick={toggleFollow}
                      >
                        {following ? "Following" : "Follow"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="ed-location-sub">Host not confirmed.</p>
                )}
                <div className="ed-communities">
                  <span className="ed-communities-label">
                    Related communities
                  </span>
                  <div className="event-detail-communities">
                    {COMMUNITIES.filter((c) => c.topics.includes(e.topic)).map(
                      (c) => (
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
                      ),
                    )}
                  </div>
                  <p className="fineprint">
                    Fictional local groups matching this record's topic.
                  </p>
                </div>
              </div>

              {/* 6. Record & evidence */}
              <div className="ed-section">
                <details className="event-detail-evidence">
                  <summary>
                    Record &amp; evidence
                    {e.last_checked_at && (
                      <span className="ed-evidence-checked">
                        Last checked {relativeTime(e.last_checked_at)}
                      </span>
                    )}
                  </summary>
                  <dl className="evidence">
                    {Object.entries({
                      "Host school": e.host_school || "Not confirmed",
                      "Goal type": e.goal_type?.length
                        ? e.goal_type.join(", ")
                        : "Not confirmed",
                      Campus: e.campus_id || "Unknown",
                      Source: e.source || "Unknown",
                      "Last checked": e.last_checked_at
                        ? `${new Date(e.last_checked_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} (${relativeTime(e.last_checked_at)})`
                        : "Not confirmed",
                      "Intended audience":
                        e.intended_audience || "Not confirmed",
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
                          <a
                            href={e.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                    Authored for this prototype · Internal authoring review (not
                    external verification) {e.checked}. RSVP-required events use
                    a mandatory demo registration step. No organiser is
                    contacted and no real place is reserved.
                  </p>
                </details>
              </div>

              {/* 7. You might also like */}
              {relatedEvents.length > 0 && (
                <div className="ed-section">
                  <h2 className="ed-section-heading">You might also like</h2>
                  <p className="ed-section-sub">
                    More {e.topic} events this week.
                  </p>
                  <div className="ed-related-list">
                    {relatedEvents.map((ev) => {
                      const evUpd = !hasConflict(ev.id, appliedIds)
                        ? effectiveUpdate(ev.id, appliedIds)
                        : null;
                      const evShownLoc = evUpd?.new_location ?? ev.location;
                      const sameRoom = evShownLoc === shownLocation;
                      return (
                        <button
                          key={ev.id}
                          className="ed-related-item"
                          onClick={() => {
                            onDetail(ev.id);
                            // The clicked row unmounts; keep keyboard focus
                            // inside the dialog.
                            overlayRef.current
                              ?.querySelector<HTMLElement>(
                                ".event-detail-close",
                              )
                              ?.focus();
                          }}
                        >
                          <span
                            className={`ed-related-poster poster ${posterTone(ev)}`}
                          >
                            <b>
                              {ev.poster.split(" / ").map((part, i) => (
                                <span key={part}>
                                  {i > 0 ? <br /> : null}
                                  {part}
                                </span>
                              ))}
                            </b>
                          </span>
                          <span className="ed-related-info">
                            <strong className="ed-related-title">
                              {ev.title}
                            </strong>
                            <span className="ed-related-when">{when(ev)}</span>
                            <span className="ed-related-meta">
                              {evShownLoc} · {ev.cost ? `$${ev.cost}` : "Free"}
                            </span>
                            <span className="ed-related-badges">
                              {sameRoom && (
                                <span className="badge badge--updated">
                                  Same room
                                </span>
                              )}
                              {ev.access === "members" && (
                                <span className="badge badge--conflict">
                                  Members
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Aside: RSVP card (sticky on desktop, fixed bottom bar on mobile) */}
            <aside className="event-detail-aside">
              <div className="ed-rsvp-card">
                <p className="ed-rsvp-price">
                  {e.cost ? `$${e.cost}` : "Free"}
                  {e.rsvp === "RSVP required" ? " · RSVP required" : ""}
                </p>
                <p className="ed-rsvp-when">{shortWhen}</p>

                {/* Issue strip */}
                {rsvpReason ? (
                  <div className="ed-issue-strip" role="status">
                    <Icon name="warning" />
                    <span>{rsvpReason}</span>
                  </div>
                ) : null}

                {/* Primary button */}
                <Button
                  className="primary ed-rsvp-btn"
                  disabled={blocked}
                  onClick={() => (planned ? onRemove(e.id) : onAdd(e.id))}
                >
                  {rsvpButtonLabel()}
                </Button>

                <p className="fineprint ed-rsvp-fine">
                  Nothing is added until you confirm. Fictional demo event, no
                  real registration.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Backdrop click to close */}
      <div
        className="event-detail-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile fixed bottom bar */}
      <div className="ed-mobile-bar" aria-hidden="false">
        <div className="ed-mobile-bar-left">
          <span className="ed-rsvp-price">
            {e.cost ? `$${e.cost}` : "Free"}
            {e.rsvp === "RSVP required" ? " · RSVP required" : ""}
          </span>
          {rsvpReason ? (
            <span className="ed-mobile-issue">
              {conflict ? "Needs confirmation" : rsvpReason}
            </span>
          ) : null}
        </div>
        <Button
          className="primary ed-rsvp-btn"
          disabled={blocked}
          onClick={() => (planned ? onRemove(e.id) : onAdd(e.id))}
        >
          {rsvpButtonLabel()}
        </Button>
        <p className="ed-mobile-fine">
          Nothing is added until you confirm · Fictional demo event
        </p>
      </div>
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
          <input
            name="name"
            autoFocus
            required
            maxLength={30}
            defaultValue={name}
          />
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
