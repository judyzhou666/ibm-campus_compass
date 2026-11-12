/**
 * CalendarView — Google-Calendar-style Day/Week/Month/Year views.
 * Used only on the My Calendar page; the Dashboard strip and
 * AI Planner panel continue to use the existing Week component.
 */
import { useState } from "react";
import { DEMO, DEMO_NOW_MINUTE } from "./config.ts";
import { EVENTS, time } from "./data.ts";
import type { DemoState } from "./types.ts";
import { Icon } from "./components.tsx";
import {
  type CalView,
  addDays,
  weekDatesFor,
  monthGridDates,
  yearMonthStarts,
  navigate,
  viewTitle,
  itemPosition,
  layoutColumns,
  isWeekday,
  isoWeekdayIndex,
  demoDayIndex,
  demoWeekDates,
  demoToday,
  demoNowMinute,
  monthStart,
  sortByStart,
} from "./calendarGrid.ts";

const GRID_START = 8;  // 8 AM
const GRID_END = 21;   // 9 PM
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a minute-of-day as "8 AM" or "1:30 PM". */
function fmtHour(h: number): string {
  return time(h * 60);
}

/** Short date label e.g. "Nov 2". */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${MONTH_NAMES_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Day-of-month number. */
function dayOfMonth(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDate();
}

/** True if two ISO dates share the same month. */
function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

interface CalendarViewProps {
  state: DemoState;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void; // existing handler (0-4 = Mon-Fri demo-week days)
  onEditAvailability: () => void;
  onExportCalendar: () => void;
}

type CalendarItem =
  | { kind: "class"; id: string; title: string; day: number; start: number; end: number }
  | { kind: "event"; id: string; title: string; day: number; start: number; end: number; cancelled: boolean };

/**
 * Get items for a given ISO date string.
 * - Events: shown only on their demo-week date (chosen events only).
 * - Classes: repeat on their weekday index for all weeks (day/week view only).
 * `includeClasses` should be false for month/year views per requirements.
 */
function itemsForDate(
  iso: string,
  state: DemoState,
  includeClasses: boolean,
): CalendarItem[] {
  const items: CalendarItem[] = [];

  if (includeClasses) {
    // Classes repeat every week on their weekday (0=Mon…4=Fri).
    const wdIdx = isoWeekdayIndex(iso); // 0=Mon…6=Sun
    if (wdIdx < 5) { // only weekdays
      for (const b of state.blocks) {
        if (b.day === wdIdx) {
          items.push({ kind: "class", ...b });
        }
      }
    }
  }

  // Events appear only on their specific demo-week date.
  const dayIdx = demoDayIndex(iso);
  if (dayIdx >= 0) {
    for (const e of EVENTS) {
      if (e.day === dayIdx && state.plan.includes(e.id)) {
        items.push({
          kind: "event",
          id: e.id,
          title: e.title,
          day: e.day,
          start: e.start,
          end: e.end,
          cancelled: state.cancelled.includes(e.id),
        });
      }
    }
  }

  return sortByStart(items);
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
  isToday,
  onDetail,
}: {
  iso: string;
  items: CalendarItem[];
  isToday: boolean;
  onDetail: (id: string) => void;
}) {
  const nowMinute = demoNowMinute();
  const totalMin = (GRID_END - GRID_START) * 60;
  const nowPct = ((nowMinute - GRID_START * 60) / totalMin) * 100;
  const layout = layoutColumns(items);

  return (
    <div className="gcal-day-col" aria-label={`${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`}>
      {/* Items */}
      {layout.map(({ item, col, totalCols }) => {
        const { top, height } = itemPosition(item.start, item.end, GRID_START, GRID_END);
        const widthPct = 92 / totalCols; // leave 4% gap on each side
        const leftPct = 4 + col * widthPct;
        const isCancelled = item.kind === "event" && item.cancelled;
        const cls = [
          "gcal-event-block",
          item.kind === "class" ? "gcal-class" : "gcal-chosen",
          isCancelled ? "gcal-cancelled" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const label = `${item.title}, ${time(item.start)}–${time(item.end)}${isCancelled ? ", Cancelled" : ""}`;
        const titleAttr = `${item.title} · ${time(item.start)}–${time(item.end)}${isCancelled ? " (Cancelled)" : ""}`;

        if (item.kind === "event") {
          return (
            <button
              key={item.id}
              className={cls}
              style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
              onClick={() => onDetail(item.id)}
              aria-label={label}
              title={titleAttr}
            >
              <strong>{item.title}</strong>
              <span>{isCancelled ? "Cancelled" : `${time(item.start)}–${time(item.end)}`}</span>
            </button>
          );
        } else {
          return (
            <div
              key={item.id}
              className={cls}
              style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
              role="note"
              aria-label={label}
              title={titleAttr}
            >
              <strong>{item.title}</strong>
              <span>{time(item.start)}–{time(item.end)}</span>
            </div>
          );
        }
      })}

      {/* "Now" line */}
      {isToday && nowMinute >= GRID_START * 60 && nowMinute <= GRID_END * 60 && (
        <div
          className="gcal-now-line"
          style={{ top: `${nowPct}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Shared time-grid scaffold (used by both Day and Week views).
 * Fix #2: one shared horizontal-scroll container holds BOTH the sticky header
 * row and the scrollable time grid, so they always scroll together and share
 * the same column widths.
 */
function TimeGrid({
  dates,
  state,
  today,
  onDetail,
  onDay,
}: {
  dates: string[];
  state: DemoState;
  today: string;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void;
}) {
  const demoWeek = demoWeekDates();

  return (
    /* Single horizontal-scroll container for header + body */
    <div className="gcal-scroll-host">
      {/* Sticky column-header row — scrolls horizontally with the grid */}
      <div className="gcal-col-headers">
        <div className="gcal-gutter" aria-hidden="true" />
        {dates.map((iso) => {
          const wdi = isoWeekdayIndex(iso);
          const isToday = iso === today;
          const demoIdx = demoDayIndex(iso);
          const showAdd = demoWeek.includes(iso) && isWeekday(iso);
          return (
            <div key={iso} className={`gcal-col-head ${isToday ? "gcal-today-head" : ""}`}>
              <span className="gcal-dow">
                {dates.length === 1 ? DAY_NAMES_FULL[wdi] : DAY_NAMES_SHORT[wdi]}
              </span>
              <span className={`gcal-dom ${isToday ? "gcal-today-dot" : ""}`}>
                {dayOfMonth(iso)}
              </span>
              {/* Fix #4: "+" find-an-event button in the header, always visible */}
              {showAdd && (
                <button
                  className="gcal-add-header-btn"
                  aria-label={`Find an event on ${DAY_NAMES_FULL[wdi]}`}
                  onClick={() => onDay(demoIdx)}
                >
                  <Icon name="plus" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time-grid body */}
      <div className="gcal-time-grid-wrap">
        <div className="gcal-time-grid">
          {/* Gutter with hour labels */}
          <div className="gcal-gutter">
            {HOURS.map((h) => (
              <div key={h} className="gcal-hour-label">
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {/* Hour grid lines (behind columns) */}
          <div className="gcal-grid-lines" aria-hidden="true">
            {HOURS.map((h) => (
              <div key={h} className="gcal-grid-line" />
            ))}
          </div>

          {/* Day columns */}
          {dates.map((iso) => {
            const items = itemsForDate(iso, state, true);
            return (
              <DayColumn
                key={iso}
                iso={iso}
                items={items}
                isToday={iso === today}
                onDetail={onDetail}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────

function MonthView({
  anchor,
  state,
  today,
  onDayClick,
}: {
  anchor: string;
  state: DemoState;
  today: string;
  onDayClick: (iso: string) => void;
}) {
  const dates = monthGridDates(anchor);
  const demoWeek = demoWeekDates();
  const demoMon = demoWeek[0];
  const demoFri = demoWeek[4];

  return (
    <div className="gcal-month">
      {/* Weekday header — Fix #1: same grid-template-columns as the grid */}
      <div className="gcal-month-header">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="gcal-month-dow">{d}</div>
        ))}
      </div>

      {/* Grid cells — Fix #1: every column equal width */}
      <div className="gcal-month-grid">
        {dates.map((iso) => {
          const isThisMonth = sameMonth(iso, anchor);
          const isToday = iso === today;
          // Fix #10: isInDemoWeek is equivalent to isInDemo (demo week is Mon–Fri),
          // so just check demoWeek.includes(iso) instead of the double check.
          const isInDemo = demoWeek.includes(iso);
          const isDemoWeekRange = iso >= demoMon && iso <= demoFri;
          const dayIdx = demoDayIndex(iso);
          // Fix #5: sort chips by start time using sortByStart
          const chosenEvents = sortByStart(
            dayIdx >= 0
              ? EVENTS.filter((e) => e.day === dayIdx && state.plan.includes(e.id))
              : []
          );
          const MAX_CHIPS = 3;
          const overflow = chosenEvents.length - MAX_CHIPS;
          // Fix #9: show "Demo week" label only on the Monday cell
          const isMonday = isoWeekdayIndex(iso) === 0;
          const showDemoLabel = isDemoWeekRange && isInDemo && isMonday;

          return (
            <button
              key={iso}
              className={[
                "gcal-month-cell",
                !isThisMonth ? "gcal-other-month" : "",
                isToday ? "gcal-today-cell" : "",
                isDemoWeekRange ? "gcal-demo-week-cell" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onDayClick(iso)}
              aria-label={`${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}${isToday ? ", Today" : ""}`}
            >
              <span className={`gcal-month-day-num ${isToday ? "gcal-today-dot" : ""}`}>
                {dayOfMonth(iso)}
              </span>
              {/* Fix #9: only the Monday cell gets the label */}
              {showDemoLabel && (
                <span className="gcal-demo-week-label">Demo week</span>
              )}
              {chosenEvents.slice(0, MAX_CHIPS).map((e) => (
                <span key={e.id} className={`gcal-month-chip ${state.cancelled.includes(e.id) ? "gcal-chip-cancelled" : ""}`}>
                  {time(e.start)} {e.title}
                </span>
              ))}
              {overflow > 0 && (
                <span className="gcal-month-more">+{overflow} more</span>
              )}
            </button>
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
}: {
  monthIso: string;
  state: DemoState;
  today: string;
  onDayClick: (iso: string) => void;
}) {
  const dates = monthGridDates(monthIso);
  const demoWeek = demoWeekDates();
  const demoMon = demoWeek[0];
  const demoFri = demoWeek[4];
  const d = new Date(`${monthIso}T12:00:00Z`);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);

  return (
    <div className="gcal-mini-month">
      <div className="gcal-mini-month-title">{monthName}</div>
      <div className="gcal-mini-header">
        {DAY_NAMES_SHORT.map((n) => (
          <div key={n} className="gcal-mini-dow">{n.slice(0, 1)}</div>
        ))}
      </div>
      <div className="gcal-mini-grid">
        {dates.map((iso) => {
          const isThisMonth = sameMonth(iso, monthIso);
          const isToday = iso === today;
          const isDemoRange = iso >= demoMon && iso <= demoFri;
          const dayIdx = demoDayIndex(iso);
          const hasEvent = dayIdx >= 0 && EVENTS.some(
            (e) => e.day === dayIdx && state.plan.includes(e.id),
          );

          // Fix #3: today wins over demo-range: put gcal-mini-today LAST so
          // it overrides gcal-mini-demo in CSS specificity (and we also add a
          // more-specific CSS rule to be sure).
          return (
            <button
              key={iso}
              className={[
                "gcal-mini-cell",
                !isThisMonth ? "gcal-mini-other" : "",
                isDemoRange && isThisMonth ? "gcal-mini-demo" : "",
                isToday ? "gcal-mini-today" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onDayClick(iso)}
              aria-label={`${shortDate(iso)}${isToday ? ", Today" : ""}`}
            >
              {dayOfMonth(iso)}
              {hasEvent && <span className="gcal-event-dot" aria-hidden="true" />}
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
  today: string;
  onDayClick: (iso: string) => void;
}) {
  const months = yearMonthStarts(anchor);
  return (
    <div className="gcal-year">
      {months.map((m) => (
        <MiniMonth
          key={m}
          monthIso={m}
          state={state}
          today={today}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CalendarView({
  state,
  onDetail,
  onDay,
  onEditAvailability,
  onExportCalendar,
}: CalendarViewProps) {
  const today = demoToday(); // "2026-11-02"
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState<string>(today);

  // Check if the current view window contains the demo week
  function isShowingDemoWeek(): boolean {
    const demoWeek = demoWeekDates();
    switch (view) {
      case "day":
        return demoWeek.includes(anchor);
      case "week": {
        const wDates = weekDatesFor(anchor);
        return demoWeek.some((d) => wDates.includes(d));
      }
      case "month":
        return demoWeek.some((d) => sameMonth(d, anchor));
      case "year":
        return demoWeek.some((d) => d.startsWith(anchor.slice(0, 4)));
    }
  }

  // Fix #10: remove the duplicate setAnchor call
  function goToToday() {
    setAnchor(today);
  }

  function goToDemoWeek() {
    setView("week");
    setAnchor(today);
  }

  function handleDayClick(iso: string) {
    setView("day");
    setAnchor(iso);
  }

  const viewDates: string[] = view === "day"
    ? [anchor]
    : view === "week"
    ? weekDatesFor(anchor)
    : [];

  const prevLabel = view === "day" ? "Previous day"
    : view === "week" ? "Previous week"
    : view === "month" ? "Previous month"
    : "Previous year";

  const nextLabel = view === "day" ? "Next day"
    : view === "week" ? "Next week"
    : view === "month" ? "Next month"
    : "Next year";

  return (
    <div className="gcal-root">
      {/*
        Fix #8: two-row toolbar layout at ≥ 1024 px:
        Row 1: Today ‹ › title | switcher
        Row 2:                 | Edit availability  Export calendar
        This keeps the switcher anchored to the top-right and prevents
        the Day/Week/Month/Year buttons from moving when the title changes.
      */}
      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button
            className="btn small gcal-today-btn"
            onClick={goToToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            className="gcal-nav-btn"
            onClick={() => setAnchor(navigate(anchor, view, -1))}
            aria-label={prevLabel}
          >
            ‹
          </button>
          <button
            className="gcal-nav-btn"
            onClick={() => setAnchor(navigate(anchor, view, 1))}
            aria-label={nextLabel}
          >
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
                  <button
                    key={v}
                    className={`gcal-switch-btn ${view === val ? "active" : ""}`}
                    aria-pressed={view === val}
                    onClick={() => setView(val)}
                  >
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

      {/* Legend */}
      <div className="legend gcal-legend">
        <span><i className="dot" />Busy commitments</span>
        <span><i className="dot green" />Chosen events</span>
        <span>{DEMO.time_zone} · {state.buffer}-minute travel buffer</span>
      </div>

      {/* Demo-week note (when outside demo week) */}
      {!isShowingDemoWeek() && (view === "day" || view === "week") && (
        <DemoWeekBanner onGoToDemo={goToDemoWeek} />
      )}

      {/* Calendar body */}
      {(view === "day" || view === "week") && (
        <div className="gcal-body panel">
          <TimeGrid
            dates={viewDates}
            state={state}
            today={today}
            onDetail={onDetail}
            onDay={onDay}
          />
        </div>
      )}

      {view === "month" && (
        <div className="gcal-body panel">
          {!isShowingDemoWeek() && (
            <DemoWeekBanner onGoToDemo={goToDemoWeek} />
          )}
          <MonthView
            anchor={monthStart(anchor)}
            state={state}
            today={today}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {view === "year" && (
        <div className="gcal-body panel">
          {!isShowingDemoWeek() && (
            <DemoWeekBanner onGoToDemo={goToDemoWeek} />
          )}
          <YearView
            anchor={anchor}
            state={state}
            today={today}
            onDayClick={handleDayClick}
          />
        </div>
      )}
    </div>
  );
}
