/**
 * CalendarView — Google-Calendar-style Day/Week/Month/Year views.
 * Used only on the My Calendar page; the Dashboard strip and
 * AI Planner panel continue to use the existing Week component.
 */
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { DEMO, DEMO_NOW_MINUTE, isTimeZone, weekDates } from "./config.ts";
import { EVENTS, time } from "./data.ts";
import { issue } from "./planner.ts";
import { effectiveEvents } from "./updates.ts";
import type { CampusEvent, DemoState } from "./types.ts";
import { Icon } from "./components.tsx";
import {
  type CalView,
  type CalendarItem,
  attentionTag,
  gridHours,
  itemPosition,
  itemsForDate,
  isoWeekdayIndex,
  isWeekday,
  layoutColumns,
  monthGridDates,
  monthStart,
  navigate,
  parseSavedPosition,
  demoDayIndex,
  todayIso,
  viewTitle,
  weekDatesFor,
  yearMonthStarts,
} from "./calendarGrid.ts";

const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const POSITION_KEY = "campus-compass-calendar-position";
const MAX_CHIPS = 3;

/** "Nov 2" for any ISO date (config's dayLabel only covers the demo week). */
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

function dayOfMonth(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDate();
}

function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

function readSavedPosition(): string | null {
  try {
    return window.sessionStorage.getItem(POSITION_KEY);
  } catch {
    return null;
  }
}

function writeSavedPosition(value: { view: CalView; anchor: string }) {
  try {
    window.sessionStorage.setItem(POSITION_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, blocked): the calendar still works.
  }
}

interface CalendarViewProps {
  state: DemoState;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void; // 0-4 = Mon-Fri of the demo week
  onEditAvailability: () => void;
  onExportCalendar: () => void;
}

/** Chosen-event status shown on blocks and chips. */
interface ItemStatus {
  /** Short tag ("Conflict", "Full", "Check") or null. */
  tag: string | null;
  /** Full reason from the planner's issue() check. */
  reason: string | null;
}

function useStatuses(state: DemoState, events: CampusEvent[]) {
  return useMemo(() => {
    const map = new Map<string, ItemStatus>();
    for (const id of state.plan) {
      const e = events.find((x) => x.id === id);
      if (!e) continue;
      const reason = issue(e, state, events);
      map.set(id, { tag: attentionTag(reason), reason });
    }
    return map;
  }, [state, events]);
}

function itemLabel(item: CalendarItem, status?: ItemStatus): string {
  const parts = [`${item.title}, ${time(item.start)}–${time(item.end)}`];
  if (item.kind === "event") {
    if (item.cancelled) parts.push("Cancelled");
    if (item.moved) parts.push("Time changed");
    if (status?.tag && status.reason) parts.push(`${status.tag}: ${status.reason}`);
  }
  return parts.join(", ");
}

/** Demo-week range banner shown when outside the demo week. */
function DemoWeekBanner({ onGoToDemo }: { onGoToDemo: () => void }) {
  return (
    <div className="gcal-demo-banner" role="note">
      <span>Campus events in this demo cover Nov 2–6, 2026.</span>
      <button className="btn small" onClick={onGoToDemo}>
        Go to demo week
      </button>
    </div>
  );
}

/** Time-grid column for a single day. */
function DayColumn({
  iso,
  items,
  grid,
  showNow,
  statuses,
  onDetail,
}: {
  iso: string;
  items: CalendarItem[];
  grid: { start: number; end: number };
  showNow: boolean;
  statuses: Map<string, ItemStatus>;
  onDetail: (id: string) => void;
}) {
  const totalMin = (grid.end - grid.start) * 60;
  const nowPct = ((DEMO_NOW_MINUTE - grid.start * 60) / totalMin) * 100;
  const layout = layoutColumns(items);

  return (
    <div className="gcal-day-col" aria-label={`${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`}>
      {layout.map(({ item, col, totalCols }) => {
        const { top, height } = itemPosition(item.start, item.end, grid.start, grid.end);
        const widthPct = 92 / totalCols; // leave 4% gap on each side
        const leftPct = 4 + col * widthPct;
        const style = { top, height, left: `${leftPct}%`, width: `${widthPct}%` };
        const timeText = `${time(item.start)}–${time(item.end)}`;

        if (item.kind === "class") {
          const label = itemLabel(item);
          return (
            <div key={item.id} className="gcal-event-block gcal-class" style={style} role="note" aria-label={label} title={label}>
              <strong>{item.title}</strong>
              <span>{timeText}</span>
            </div>
          );
        }

        const status = statuses.get(item.id);
        const attention = !item.cancelled && status?.tag;
        const label = itemLabel(item, status);
        const cls = [
          "gcal-event-block",
          "gcal-chosen",
          item.cancelled ? "gcal-cancelled" : "",
          attention ? "gcal-attention" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button key={item.id} className={cls} style={style} onClick={() => onDetail(item.id)} aria-label={label} title={label}>
            <strong>{item.title}</strong>
            <span>{item.cancelled ? "Cancelled" : timeText}</span>
            {(attention || item.moved) && !item.cancelled ? (
              <span className="gcal-tags">
                {attention ? (
                  <em className="gcal-tag gcal-tag-attention">
                    <span className="gcal-tag-icon" aria-hidden="true">⚠</span>
                    <span className="gcal-tag-label">{status!.tag}</span>
                  </em>
                ) : null}
                {item.moved ? (
                  <em className="gcal-tag">
                    <span className="gcal-tag-icon" aria-hidden="true">↻</span>
                    <span className="gcal-tag-label">Time changed</span>
                  </em>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}

      {showNow && DEMO_NOW_MINUTE >= grid.start * 60 && DEMO_NOW_MINUTE <= grid.end * 60 ? (
        <div className="gcal-now-line" style={{ top: `${nowPct}%` }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

/**
 * Shared time-grid scaffold (Day and Week views).
 *  .gcal-scroll-host       horizontal scroll for phones
 *    .gcal-time-grid-wrap  vertical scroll; the sticky header lives inside it
 *      .gcal-col-headers   so header and columns share one width
 *      .gcal-time-grid     day columns
 */
function TimeGrid({
  dates,
  state,
  events,
  grid,
  today,
  statuses,
  onDetail,
  onDay,
}: {
  dates: string[];
  state: DemoState;
  events: CampusEvent[];
  grid: { start: number; end: number };
  today: string | null;
  statuses: Map<string, ItemStatus>;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void;
}) {
  const hours = Array.from({ length: grid.end - grid.start }, (_, i) => grid.start + i);
  // The grid is in campus time, so the demo clock (Mon 9:00 AM campus time)
  // sits on the campus demo date; draw it only when that is also "today".
  const nowDate = DEMO.week_start;

  return (
    <div className="gcal-scroll-host">
      <div className="gcal-time-grid-wrap">
        <div className="gcal-col-headers">
          <div className="gcal-gutter" aria-hidden="true" />
          {dates.map((iso) => {
            const wdi = isoWeekdayIndex(iso);
            const isToday = iso === today;
            const demoIdx = demoDayIndex(iso);
            const showAdd = demoIdx >= 0 && isWeekday(iso);
            return (
              <div key={iso} className={`gcal-col-head ${isToday ? "gcal-today-head" : ""}`}>
                <span className="gcal-dow">{dates.length === 1 ? DAY_NAMES_FULL[wdi] : DAY_NAMES_SHORT[wdi]}</span>
                <span className={`gcal-dom ${isToday ? "gcal-today-dot" : ""}`}>{dayOfMonth(iso)}</span>
                {showAdd ? (
                  <button className="gcal-add-header-btn" aria-label={`Find an event on ${DAY_NAMES_FULL[wdi]}`} onClick={() => onDay(demoIdx)}>
                    <Icon name="plus" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="gcal-time-grid">
          <div className="gcal-gutter">
            {hours.map((h) => (
              <div key={h} className="gcal-hour-label">
                {time(h * 60)}
              </div>
            ))}
          </div>
          <div className="gcal-grid-lines" aria-hidden="true">
            {hours.map((h) => (
              <div key={h} className="gcal-grid-line" />
            ))}
          </div>
          {dates.map((iso) => (
            <DayColumn
              key={iso}
              iso={iso}
              items={itemsForDate(iso, state, events, EVENTS, true)}
              grid={grid}
              showNow={iso === nowDate && iso === today}
              statuses={statuses}
              onDetail={onDetail}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────

function MonthView({
  anchor,
  state,
  events,
  today,
  statuses,
  onDayClick,
  onDetail,
}: {
  anchor: string;
  state: DemoState;
  events: CampusEvent[];
  today: string | null;
  statuses: Map<string, ItemStatus>;
  onDayClick: (iso: string) => void;
  onDetail: (id: string) => void;
}) {
  const dates = monthGridDates(anchor);
  const demoWeek = weekDates();

  return (
    <div className="gcal-month">
      <div className="gcal-month-header">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="gcal-month-dow">
            {d}
          </div>
        ))}
      </div>

      <div className="gcal-month-grid">
        {dates.map((iso) => {
          const isToday = iso === today;
          const inDemoWeek = demoWeek.includes(iso);
          const chosen = itemsForDate(iso, state, events, EVENTS, false).filter(
            (i): i is Extract<CalendarItem, { kind: "event" }> => i.kind === "event",
          );
          const overflow = chosen.length - MAX_CHIPS;
          const dayName = `${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`;

          return (
            // The whole cell opens Day view for mouse users; the date button is
            // the keyboard/screen-reader route. Chips are separate buttons.
            <div
              key={iso}
              className={[
                "gcal-month-cell",
                !sameMonth(iso, anchor) ? "gcal-other-month" : "",
                isToday ? "gcal-today-cell" : "",
                inDemoWeek ? "gcal-demo-week-cell" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onDayClick(iso)}
            >
              <button
                className={`gcal-month-day-num ${isToday ? "gcal-today-dot" : ""}`}
                aria-label={`${dayName}${isToday ? ", Today" : ""}${chosen.length ? `, ${chosen.length} event${chosen.length === 1 ? "" : "s"}` : ""}. Open day`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(iso);
                }}
              >
                {dayOfMonth(iso)}
              </button>
              {inDemoWeek && isoWeekdayIndex(iso) === 0 ? <span className="gcal-demo-week-label">Demo week</span> : null}
              {chosen.slice(0, MAX_CHIPS).map((item) => {
                const status = statuses.get(item.id);
                const attention = !item.cancelled && status?.tag;
                return (
                  <button
                    key={item.id}
                    className={[
                      "gcal-month-chip",
                      item.cancelled ? "gcal-chip-cancelled" : "",
                      attention ? "gcal-chip-attention" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={itemLabel(item, status)}
                    title={itemLabel(item, status)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetail(item.id);
                    }}
                  >
                    <span className="gcal-chip-text">
                      {time(item.start)} {item.title}
                    </span>
                  </button>
                );
              })}
              {overflow > 0 ? <span className="gcal-month-more">+{overflow}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Year view ──────────────────────────────────────────────────────────────

function MiniMonth({
  monthIso,
  state,
  today,
  onDayClick,
  monthRef,
}: {
  monthIso: string;
  state: DemoState;
  today: string | null;
  onDayClick: (iso: string) => void;
  monthRef?: Ref<HTMLDivElement>;
}) {
  const dates = monthGridDates(monthIso);
  const demoWeek = weekDates();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(`${monthIso}T12:00:00Z`),
  );

  return (
    <div className="gcal-mini-month" ref={monthRef}>
      <div className="gcal-mini-month-title">{monthName}</div>
      <div className="gcal-mini-header">
        {DAY_NAMES_SHORT.map((n) => (
          <div key={n} className="gcal-mini-dow">
            {n.slice(0, 1)}
          </div>
        ))}
      </div>
      <div className="gcal-mini-grid">
        {dates.map((iso) => {
          const isThisMonth = sameMonth(iso, monthIso);
          const isToday = iso === today;
          const dayIdx = demoDayIndex(iso);
          const hasEvent = dayIdx >= 0 && state.plan.some((id) => EVENTS.find((e) => e.id === id)?.day === dayIdx);
          return (
            <button
              key={iso}
              className={[
                "gcal-mini-cell",
                !isThisMonth ? "gcal-mini-other" : "",
                demoWeek.includes(iso) && isThisMonth ? "gcal-mini-demo" : "",
                isToday ? "gcal-mini-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onDayClick(iso)}
              aria-label={`${shortDate(iso)}${isToday ? ", Today" : ""}${hasEvent ? ", has events" : ""}`}
            >
              {dayOfMonth(iso)}
              {hasEvent ? <span className="gcal-event-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({
  anchor,
  state,
  today,
  onDayClick,
}: {
  anchor: string;
  state: DemoState;
  today: string | null;
  onDayClick: (iso: string) => void;
}) {
  const months = yearMonthStarts(anchor);
  const focusMonth = monthStart(anchor);
  const focusRef = useRef<HTMLDivElement>(null);
  // Bring the current month into view (on phones the year is one long column).
  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [focusMonth]);
  return (
    <div className="gcal-year">
      {months.map((m) => (
        <MiniMonth
          key={m}
          monthIso={m}
          state={state}
          today={today}
          onDayClick={onDayClick}
          monthRef={m === focusMonth ? focusRef : undefined}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CalendarView({ state, onDetail, onDay, onEditAvailability, onExportCalendar }: CalendarViewProps) {
  const zone = isTimeZone(state.timezone) ? state.timezone : DEMO.time_zone;
  const today = todayIso(zone);
  const home = today ?? DEMO.week_start;

  const [position, setPosition] = useState(() => parseSavedPosition(readSavedPosition(), home));
  const { view, anchor } = position;
  useEffect(() => writeSavedPosition(position), [position]);
  const setView = (v: CalView) => setPosition((p) => ({ ...p, view: v }));
  const setAnchor = (a: string) => setPosition((p) => ({ ...p, anchor: a }));

  const events = useMemo(() => effectiveEvents(state.appliedUpdateIds ?? []), [state.appliedUpdateIds]);
  // Size the grid from the whole catalog plus busy times, so it never clips
  // an item and keeps the same height in every week.
  const grid = useMemo(() => gridHours([...events, ...state.blocks]), [events, state.blocks]);
  const statuses = useStatuses(state, events);

  const demoWeek = weekDates();
  const showingDemoWeek =
    view === "day"
      ? demoWeek.includes(anchor)
      : view === "week"
        ? demoWeek.some((d) => weekDatesFor(anchor).includes(d))
        : view === "month"
          ? demoWeek.some((d) => sameMonth(d, anchor))
          : demoWeek.some((d) => d.startsWith(anchor.slice(0, 4)));

  const goToDemoWeek = () => setPosition({ view: "week", anchor: home });
  const openDay = (iso: string) => setPosition({ view: "day", anchor: iso });

  const viewDates = view === "day" ? [anchor] : view === "week" ? weekDatesFor(anchor) : [];
  const unit = view === "day" ? "day" : view === "week" ? "week" : view === "month" ? "month" : "year";
  const timeGridView = view === "day" || view === "week";

  return (
    <div className="gcal-root">
      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button className="btn small gcal-today-btn" onClick={() => setAnchor(home)} aria-label="Go to today">
            Today
          </button>
          <button className="gcal-nav-btn" onClick={() => setAnchor(navigate(anchor, view, -1))} aria-label={`Previous ${unit}`}>
            ‹
          </button>
          <button className="gcal-nav-btn" onClick={() => setAnchor(navigate(anchor, view, 1))} aria-label={`Next ${unit}`}>
            ›
          </button>
          <span className="gcal-title">{viewTitle(anchor, view)}</span>
        </div>

        <div className="gcal-toolbar-right">
          <div className="gcal-toolbar-right-top">
            <div className="gcal-view-switcher" role="group" aria-label="Calendar view">
              {(["Day", "Week", "Month", "Year"] as const).map((v) => {
                const val = v.toLowerCase() as CalView;
                return (
                  <button key={v} className={`gcal-switch-btn ${view === val ? "active" : ""}`} aria-pressed={view === val} onClick={() => setView(val)}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="gcal-toolbar-right-bottom">
            <button className="text-btn" onClick={onEditAvailability} aria-label="Edit availability">
              Edit availability <Icon name="arrow" />
            </button>
            <button className="btn small" onClick={onExportCalendar}>
              <Icon name="download" />
              Export calendar
            </button>
          </div>
        </div>
      </div>

      <div className="legend gcal-legend">
        {timeGridView ? (
          <span>
            <i className="dot" />
            Busy commitments
          </span>
        ) : null}
        <span>
          <i className="dot green" />
          Chosen events
        </span>
        <span>
          <i className="dot amber" />
          Needs attention
        </span>
        {!timeGridView ? <span>Classes appear in Day and Week view.</span> : null}
        <span>
          Times in campus time ({DEMO.time_zone}) · {state.buffer}-minute travel buffer
        </span>
      </div>

      {!showingDemoWeek && timeGridView ? <DemoWeekBanner onGoToDemo={goToDemoWeek} /> : null}

      {timeGridView ? (
        <div className="gcal-body panel">
          <TimeGrid
            dates={viewDates}
            state={state}
            events={events}
            grid={grid}
            today={today}
            statuses={statuses}
            onDetail={onDetail}
            onDay={onDay}
          />
        </div>
      ) : null}

      {view === "month" ? (
        <div className="gcal-body panel">
          {!showingDemoWeek ? <DemoWeekBanner onGoToDemo={goToDemoWeek} /> : null}
          <MonthView
            anchor={monthStart(anchor)}
            state={state}
            events={events}
            today={today}
            statuses={statuses}
            onDayClick={openDay}
            onDetail={onDetail}
          />
        </div>
      ) : null}

      {view === "year" ? (
        <div className="gcal-body panel">
          {!showingDemoWeek ? <DemoWeekBanner onGoToDemo={goToDemoWeek} /> : null}
          <YearView anchor={anchor} state={state} today={today} onDayClick={openDay} />
        </div>
      ) : null}
    </div>
  );
}
