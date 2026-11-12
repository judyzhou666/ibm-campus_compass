/**
 * CalendarView — Google-Calendar-style Day/Week/Month/Year views.
 * Used only on the My Calendar page; the Dashboard strip and
 * AI Planner panel continue to use the existing Week component.
 *
 * New in this version:
 *  - PersonalEvent items shown in blue (kind="personal")
 *  - Click own items to edit; click campus events for details (unchanged)
 *  - "+ New event" toolbar button; click empty grid to create
 *  - Drag own items (pointer events, no library): move time/day in Week/Day,
 *    resize bottom edge, move date in Month view
 *  - Campus events: no drag; title="Campus event — time set by the organizer"
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { DEMO, DEMO_NOW_MINUTE, isTimeZone, weekDates } from "./config.ts";
import { EVENTS, time } from "./data.ts";
import { issue } from "./planner.ts";
import { effectiveEvents } from "./updates.ts";
import { busyBlocks } from "./personalEvents.ts";
import type { Block, CampusEvent, DemoState, PersonalEvent } from "./types.ts";
import { Icon } from "./components.tsx";
import {
  type CalView,
  type CalendarItem,
  addDays,
  attentionTag,
  blockDropAllowed,
  clampEnd,
  clampStart,
  gridHours,
  isoWeekdayIndex,
  isWeekday,
  itemPosition,
  itemsForDate,
  layoutColumns,
  monthGridDates,
  monthStart,
  navigate,
  parseSavedPosition,
  pixelToMins,
  demoDayIndex,
  todayIso,
  viewTitle,
  weekDatesFor,
  yearMonthStarts,
} from "./calendarGrid.ts";
import {
  PersonalEventDialog,
  type PersonalEventSavePayload,
} from "./PersonalEventDialog.tsx";
import { effectiveEvents as eff } from "./updates.ts";

const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const POSITION_KEY = "campus-compass-calendar-position";
const MAX_CHIPS = 3;
/** Matches the one-column Year layout in styles.css. */
const PHONE_QUERY = "(max-width: 480px)";
/** Minimum pointer movement (px) before treating as a drag vs. a click. */
const DRAG_THRESHOLD = 4;

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

/** Short human description of a time for toast messages */
function formatTimeRange(start: number, end: number): string {
  return `${time(start)}–${time(end)}`;
}

interface CalendarViewProps {
  state: DemoState;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void; // 0-4 = Mon-Fri of the demo week
  onEditAvailability: () => void;
  onExportCalendar: () => void;
  /** Called when the user creates/edits/deletes a personal event or block */
  onUpdate: (change: (s: DemoState) => DemoState) => void;
  /** Show a toast notification */
  notify: (text: string) => void;
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

// ── Drag state ─────────────────────────────────────────────────────────────

interface DragState {
  id: string;
  kind: "personal" | "class";
  /** Original start/end in minutes */
  origStart: number;
  origEnd: number;
  /** ISO date before drag started */
  origIso: string;
  /** Pointer Y at drag start, relative to the grid element */
  startY: number;
  /** Pointer X at grid start */
  startX: number;
  /** "move" = dragging whole block; "resize" = dragging bottom edge */
  mode: "move" | "resize";
  /** Current preview while dragging */
  preview: { iso: string; start: number; end: number } | null;
  /** Whether this is actually dragging (vs. still within click threshold) */
  active: boolean;
}

// ── DayColumn ──────────────────────────────────────────────────────────────

function DayColumn({
  iso,
  items,
  grid,
  showNow,
  statuses,
  onDetail,
  onEditPersonal,
  onEditBlock,
  onCreateAt,
  dragState,
  onDragStart,
  onDragMove,
  onDragEnd,
  colIndex,
  dates,
}: {
  iso: string;
  items: CalendarItem[];
  grid: { start: number; end: number };
  showNow: boolean;
  statuses: Map<string, ItemStatus>;
  onDetail: (id: string) => void;
  onEditPersonal: (id: string) => void;
  onEditBlock: (id: string) => void;
  onCreateAt: (iso: string, startMins: number) => void;
  dragState: DragState | null;
  onDragStart: (e: React.PointerEvent, id: string, kind: "personal" | "class", mode: "move" | "resize", iso: string, start: number, end: number) => void;
  onDragMove: (e: React.PointerEvent, colRef: HTMLDivElement | null, iso: string, colIndex: number, dates: string[]) => void;
  onDragEnd: (e: React.PointerEvent) => void;
  colIndex: number;
  dates: string[];
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const totalMin = (grid.end - grid.start) * 60;
  const nowPct = ((DEMO_NOW_MINUTE - grid.start * 60) / totalMin) * 100;

  // Determine which items to show: replace dragged item with preview
  const visibleItems = items.map((item) => {
    if (
      dragState?.active &&
      dragState.id === item.id &&
      dragState.preview?.iso === iso
    ) {
      return { ...item, start: dragState.preview.start, end: dragState.preview.end };
    }
    return item;
  });
  // If dragged item's preview is on a different column, hide it here
  const filteredItems = visibleItems.filter((item) => {
    if (dragState?.active && dragState.id === item.id && dragState.preview?.iso !== iso) {
      return false;
    }
    return true;
  });

  const layout = layoutColumns(filteredItems);

  function handleColPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only fire when clicking on empty space (not on an item button)
    if ((e.target as HTMLElement).closest(".gcal-event-block")) return;
    const rect = colRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = (e.clientY - rect.top) / rect.height;
    const rawMins = grid.start * 60 + pct * totalMin;
    const snapped = Math.round(rawMins / 30) * 30; // snap to 30min for create
    onCreateAt(iso, Math.max(grid.start * 60, Math.min(grid.end * 60 - 60, snapped)));
  }

  return (
    <div
      className="gcal-day-col"
      ref={colRef}
      aria-label={`${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`}
      onPointerDown={handleColPointerDown}
      onPointerMove={(e) => onDragMove(e, colRef.current, iso, colIndex, dates)}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      {layout.map(({ item, col, totalCols }) => {
        const { top, height } = itemPosition(item.start, item.end, grid.start, grid.end);
        const widthPct = 92 / totalCols;
        const leftPct = 4 + col * widthPct;
        const style = { top, height, left: `${leftPct}%`, width: `${widthPct}%` } as React.CSSProperties;
        const timeText = `${time(item.start)}–${time(item.end)}`;

        if (item.kind === "class") {
          const label = itemLabel(item);
          const isDragging = dragState?.active && dragState.id === item.id;
          return (
            <div
              key={item.id}
              className={`gcal-event-block gcal-class${isDragging ? " gcal-dragging" : ""}`}
              style={style}
              role="button"
              aria-label={label + " (editable)"}
              title={label}
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                onDragStart(e, item.id, "class", "move", iso, item.start, item.end);
              }}
              onClick={(e) => {
                if (dragState?.active) return;
                e.stopPropagation();
                onEditBlock(item.id);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditBlock(item.id); } }}
            >
              <strong>{item.title}</strong>
              <span>{timeText}</span>
              {/* Resize handle */}
              <div
                className="gcal-resize-handle"
                title="Drag to resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDragStart(e, item.id, "class", "resize", iso, item.start, item.end);
                }}
              />
            </div>
          );
        }

        if (item.kind === "personal") {
          const isDragging = dragState?.active && dragState.id === item.id;
          const lbl = `${item.title}, ${timeText}${item.location ? ", " + item.location : ""}${item.weekly ? " (weekly)" : ""}`;
          return (
            <div
              key={item.id}
              className={`gcal-event-block gcal-personal${isDragging ? " gcal-dragging" : ""}`}
              style={style}
              role="button"
              aria-label={lbl + " (editable)"}
              title={lbl}
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                onDragStart(e, item.id, "personal", "move", iso, item.start, item.end);
              }}
              onClick={(e) => {
                if (dragState?.active) return;
                e.stopPropagation();
                onEditPersonal(item.id);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditPersonal(item.id); } }}
            >
              <strong>{item.title}</strong>
              <span>{timeText}</span>
              {/* Resize handle */}
              <div
                className="gcal-resize-handle"
                title="Drag to resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDragStart(e, item.id, "personal", "resize", iso, item.start, item.end);
                }}
              />
            </div>
          );
        }

        // Campus event
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
          <button
            key={item.id}
            className={cls}
            style={style}
            onClick={(e) => { e.stopPropagation(); onDetail(item.id); }}
            aria-label={label}
            title="Campus event — time set by the organizer"
            onPointerDown={(e) => e.stopPropagation()} // no drag for campus events
          >
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

// ── TimeGrid ────────────────────────────────────────────────────────────────

function TimeGrid({
  dates,
  state,
  events,
  grid,
  today,
  statuses,
  onDetail,
  onDay,
  onEditPersonal,
  onEditBlock,
  onCreateAt,
  dragState,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  dates: string[];
  state: DemoState;
  events: CampusEvent[];
  grid: { start: number; end: number };
  today: string | null;
  statuses: Map<string, ItemStatus>;
  onDetail: (id: string) => void;
  onDay: (dayIndex: number) => void;
  onEditPersonal: (id: string) => void;
  onEditBlock: (id: string) => void;
  onCreateAt: (iso: string, startMins: number) => void;
  dragState: DragState | null;
  onDragStart: (e: React.PointerEvent, id: string, kind: "personal" | "class", mode: "move" | "resize", iso: string, start: number, end: number) => void;
  onDragMove: (e: React.PointerEvent, colRef: HTMLDivElement | null, iso: string, colIndex: number, dates: string[]) => void;
  onDragEnd: (e: React.PointerEvent) => void;
}) {
  const hours = Array.from({ length: grid.end - grid.start }, (_, i) => grid.start + i);
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
                  <button
                    className="gcal-add-header-btn"
                    aria-label={`Find an event on ${DAY_NAMES_FULL[wdi]}`}
                    onClick={() => onDay(demoIdx)}
                  >
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
          {dates.map((iso, colIndex) => (
            <DayColumn
              key={iso}
              iso={iso}
              items={itemsForDate(iso, state, events, EVENTS, true)}
              grid={grid}
              showNow={iso === nowDate && iso === today}
              statuses={statuses}
              onDetail={onDetail}
              onEditPersonal={onEditPersonal}
              onEditBlock={onEditBlock}
              onCreateAt={onCreateAt}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              colIndex={colIndex}
              dates={dates}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MonthView ────────────────────────────────────────────────────────────────

function MonthView({
  anchor,
  state,
  events,
  today,
  statuses,
  onDayClick,
  onDetail,
  onEditPersonal,
  onCreateAt,
}: {
  anchor: string;
  state: DemoState;
  events: CampusEvent[];
  today: string | null;
  statuses: Map<string, ItemStatus>;
  onDayClick: (iso: string) => void;
  onDetail: (id: string) => void;
  onEditPersonal: (id: string) => void;
  onCreateAt: (iso: string, startMins: number) => void;
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
          const allItems = itemsForDate(iso, state, events, EVENTS, false);
          const chosen = allItems.filter(
            (i): i is Extract<CalendarItem, { kind: "event" }> => i.kind === "event",
          );
          const personal = allItems.filter(
            (i): i is Extract<CalendarItem, { kind: "personal" }> => i.kind === "personal",
          );
          const totalChips = chosen.length + personal.length;
          const overflow = totalChips - MAX_CHIPS;
          const dayName = `${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`;

          return (
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
              onClick={() => onCreateAt(iso, 9 * 60)} // click empty area → create
            >
              <button
                className={`gcal-month-day-num ${isToday ? "gcal-today-dot" : ""}`}
                aria-label={`${dayName}${isToday ? ", Today" : ""}${totalChips ? `, ${totalChips} item${totalChips === 1 ? "" : "s"}` : ""}. Open day`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(iso);
                }}
              >
                {dayOfMonth(iso)}
              </button>
              {inDemoWeek && isoWeekdayIndex(iso) === 0 ? (
                <span className="gcal-demo-week-label">Demo week</span>
              ) : null}

              {/* Campus event chips */}
              {chosen.slice(0, Math.min(MAX_CHIPS, chosen.length)).map((item) => {
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
                    title="Campus event — time set by the organizer"
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

              {/* Personal event chips */}
              {personal.slice(0, Math.max(0, MAX_CHIPS - chosen.length)).map((item) => (
                <button
                  key={item.id}
                  className="gcal-month-chip gcal-chip-personal"
                  aria-label={`${item.title}, ${time(item.start)}–${time(item.end)}${item.weekly ? " (weekly)" : ""} (editable)`}
                  title={`${item.title}${item.weekly ? " (weekly)" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPersonal(item.id);
                  }}
                >
                  <span className="gcal-chip-text">
                    {time(item.start)} {item.title}
                  </span>
                </button>
              ))}

              {overflow > 0 ? <span className="gcal-month-more">+{overflow}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Year view ────────────────────────────────────────────────────────────────

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
          const hasEvent =
            (dayIdx >= 0 && state.plan.some((id) => EVENTS.find((e) => e.id === id)?.day === dayIdx)) ||
            (state.personalEvents ?? []).some((pe) => {
              if (pe.repeat === "none") return pe.date === iso;
              const peWd = (() => {
                const d = new Date(`${pe.date}T12:00:00Z`).getUTCDay();
                return d === 0 ? 6 : d - 1;
              })();
              return pe.repeat === "weekly" && peWd === isoWeekdayIndex(iso) && peWd < 5;
            });
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
  useEffect(() => {
    if (!window.matchMedia?.(PHONE_QUERY).matches) return;
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

// ── Main component ────────────────────────────────────────────────────────────

type DialogMode =
  | { kind: "create"; iso: string; startMins: number }
  | { kind: "editPersonal"; id: string }
  | { kind: "editBlock"; id: string };

export function CalendarView({
  state,
  onDetail,
  onDay,
  onEditAvailability,
  onExportCalendar,
  onUpdate,
  notify,
}: CalendarViewProps) {
  const zone = isTimeZone(state.timezone) ? state.timezone : DEMO.time_zone;
  const today = todayIso(zone);
  const home = today ?? DEMO.week_start;

  const [position, setPosition] = useState(() => parseSavedPosition(readSavedPosition(), home));
  const { view, anchor } = position;
  useEffect(() => writeSavedPosition(position), [position]);
  const setView = (v: CalView) => setPosition((p) => ({ ...p, view: v }));
  const setAnchor = (a: string) => setPosition((p) => ({ ...p, anchor: a }));

  const events = useMemo(() => effectiveEvents(state.appliedUpdateIds ?? []), [state.appliedUpdateIds]);
  const allBlocks = useMemo(() => busyBlocks(state), [state]);
  const grid = useMemo(() => gridHours([...events, ...allBlocks]), [events, allBlocks]);
  const statuses = useStatuses(state, events);
  const anyAttention = [...statuses].some(([id, s]) => s.tag && !state.cancelled.includes(id));

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

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);

  // Undo state for drag
  const [undoState, setUndoState] = useState<{
    label: string;
    restore: (s: DemoState) => DemoState;
  } | null>(null);

  const openCreateDialog = useCallback(
    (iso: string, startMins: number) => {
      setDialogMode({ kind: "create", iso, startMins });
    },
    [],
  );

  const openEditPersonal = useCallback((id: string) => {
    setDialogMode({ kind: "editPersonal", id });
  }, []);

  const openEditBlock = useCallback((id: string) => {
    setDialogMode({ kind: "editBlock", id });
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────
  function handleSave(payload: PersonalEventSavePayload) {
    if (payload.block) {
      const b = payload.block;
      onUpdate((s) => {
        const existing = s.blocks.find((x) => x.id === b.id);
        if (existing) {
          return { ...s, blocks: s.blocks.map((x) => (x.id === b.id ? b : x)) };
        }
        if (s.blocks.length >= 100) {
          notify("Remove a busy time before adding another.");
          return s;
        }
        return { ...s, blocks: [...s.blocks, b] };
      });
      // Check for campus event overlap
      const planEvents = eff(state.appliedUpdateIds ?? []);
      const overlap = planEvents.find(
        (e) =>
          state.plan.includes(e.id) &&
          !state.cancelled.includes(e.id) &&
          e.day === b.day &&
          e.start < b.end + state.buffer &&
          b.start < e.end + state.buffer,
      );
      if (overlap) {
        notify(`Saved. This overlaps ${overlap.title}.`);
      } else {
        notify("Busy time saved.");
      }
    } else if (payload.personalEvent) {
      const pe = payload.personalEvent;
      onUpdate((s) => {
        const existing = (s.personalEvents ?? []).find((x) => x.id === pe.id);
        if (existing) {
          return { ...s, personalEvents: (s.personalEvents ?? []).map((x) => (x.id === pe.id ? pe : x)) };
        }
        if ((s.personalEvents ?? []).length >= 200) {
          notify("Remove an item before adding another.");
          return s;
        }
        return { ...s, personalEvents: [...(s.personalEvents ?? []), pe] };
      });
      // Check overlap with campus events
      const planEvents = eff(state.appliedUpdateIds ?? []);
      const demoWeekDates = weekDates();
      let peDay = -1;
      if (pe.repeat === "none") {
        peDay = demoWeekDates.indexOf(pe.date);
      } else if (pe.repeat === "weekly") {
        const peWd = (() => {
          const d = new Date(`${pe.date}T12:00:00Z`).getUTCDay();
          return d === 0 ? 6 : d - 1;
        })();
        peDay = peWd < 5 ? peWd : -1;
      }
      if (peDay >= 0) {
        const overlap = planEvents.find(
          (e) =>
            state.plan.includes(e.id) &&
            !state.cancelled.includes(e.id) &&
            e.day === peDay &&
            e.start < pe.end + state.buffer &&
            pe.start < e.end + state.buffer,
        );
        if (overlap) {
          notify(`Saved. This overlaps ${overlap.title}.`);
        } else {
          notify("Event saved.");
        }
      } else {
        notify("Event saved.");
      }
    }
    setDialogMode(null);
  }

  function handleDelete(id: string, kind: "personal" | "block") {
    if (kind === "block") {
      onUpdate((s) => ({ ...s, blocks: s.blocks.filter((x) => x.id !== id) }));
      notify("Busy time deleted.");
    } else {
      onUpdate((s) => ({
        ...s,
        personalEvents: (s.personalEvents ?? []).filter((x) => x.id !== id),
      }));
      notify("Event deleted.");
    }
    setDialogMode(null);
  }

  // ── Drag implementation ────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null);
  // We use a ref alongside state for pointer-event handlers that capture stale state
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = dragState;

  function startDrag(
    e: React.PointerEvent,
    id: string,
    kind: "personal" | "class",
    mode: "move" | "resize",
    iso: string,
    start: number,
    end: number,
  ) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ds: DragState = {
      id,
      kind,
      origStart: start,
      origEnd: end,
      origIso: iso,
      startY: e.clientY,
      startX: e.clientX,
      mode,
      preview: null,
      active: false,
    };
    setDragState(ds);
    dragRef.current = ds;
  }

  function moveDrag(
    e: React.PointerEvent,
    colRef: HTMLDivElement | null,
    iso: string,
    colIndex: number,
    dates: string[],
  ) {
    const ds = dragRef.current;
    if (!ds) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!ds.active && dist < DRAG_THRESHOLD) return;

    const gridEl = colRef?.closest(".gcal-time-grid") as HTMLDivElement | null;
    const gridH = gridEl?.getBoundingClientRect().height ?? 1;
    const gridTop = gridEl?.getBoundingClientRect().top ?? 0;
    const relY = e.clientY - gridTop;

    const newMins = pixelToMins(relY, gridH, grid.start, grid.end);
    const dur = ds.origEnd - ds.origStart;

    let newStart: number;
    let newEnd: number;
    let targetIso = iso;

    if (ds.mode === "move") {
      newStart = clampStart(newMins - Math.floor(dur / 2), dur, grid.start, grid.end);
      newEnd = newStart + dur;

      // Horizontal column change
      if (dates.length > 1) {
        const newColIndex = Math.max(0, Math.min(dates.length - 1, colIndex));
        targetIso = dates[newColIndex];
      }

      // Blocks can only drop on weekdays
      if (ds.kind === "class" && !blockDropAllowed(targetIso)) {
        targetIso = ds.origIso;
      }
    } else {
      // resize: keep start, change end
      newStart = ds.origStart;
      newEnd = clampEnd(newMins, ds.origStart, grid.end);
      targetIso = ds.origIso;
    }

    const updated: DragState = {
      ...ds,
      active: true,
      preview: { iso: targetIso, start: newStart, end: newEnd },
    };
    setDragState(updated);
    dragRef.current = updated;
  }

  function endDrag(e: React.PointerEvent) {
    const ds = dragRef.current;
    if (!ds) return;

    if (!ds.active || !ds.preview) {
      // Was a click (no drag threshold reached) — open edit dialog
      setDragState(null);
      dragRef.current = null;
      if (ds.kind === "personal") {
        openEditPersonal(ds.id);
      } else {
        openEditBlock(ds.id);
      }
      return;
    }

    const { iso: targetIso, start: newStart, end: newEnd } = ds.preview;

    // Validate: blocks only on weekdays
    if (ds.kind === "class" && !blockDropAllowed(targetIso)) {
      notify("Classes can only be placed on Mon–Fri.");
      setDragState(null);
      dragRef.current = null;
      return;
    }

    // Save previous state for undo
    const prevBlocks = [...state.blocks];
    const prevPersonal = [...(state.personalEvents ?? [])];

    if (ds.kind === "class") {
      const demoWeekDates = weekDates();
      const newDay = demoWeekDates.indexOf(targetIso);
      if (newDay < 0) {
        notify("Classes can only be placed on Mon–Fri.");
        setDragState(null);
        dragRef.current = null;
        return;
      }
      onUpdate((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === ds.id ? { ...b, day: newDay, start: newStart, end: newEnd } : b,
        ),
      }));
    } else {
      // personal event
      onUpdate((s) => ({
        ...s,
        personalEvents: (s.personalEvents ?? []).map((pe) => {
          if (pe.id !== ds.id) return pe;
          if (pe.repeat === "weekly") {
            // Weekly: preserve weekday by adjusting the date
            const demoWeekDates = weekDates();
            const targetWd = isoWeekdayIndex(targetIso);
            // Find a date with this weekday starting from pe.date
            const peDate = new Date(`${pe.date}T12:00:00Z`);
            const peWd = peDate.getUTCDay() === 0 ? 6 : peDate.getUTCDay() - 1;
            const diff = targetWd - peWd;
            const newDate = addDays(pe.date, diff);
            return { ...pe, date: newDate, start: newStart, end: newEnd };
          }
          return { ...pe, date: targetIso, start: newStart, end: newEnd };
        }),
      }));
    }

    const moved = state.blocks.find((b) => b.id === ds.id) ?? (state.personalEvents ?? []).find((pe) => pe.id === ds.id);
    const label = moved?.title ?? "item";
    const dayLabel = DAY_NAMES_FULL[isoWeekdayIndex(targetIso)];
    notify(
      `Moved ${label} to ${dayLabel}, ${formatTimeRange(newStart, newEnd)}. Undo`,
    );

    // Store undo
    setUndoState({
      label,
      restore: (s) => ({
        ...s,
        blocks: prevBlocks,
        personalEvents: prevPersonal,
      }),
    });

    setDragState(null);
    dragRef.current = null;
  }

  // ── Dialog helpers ────────────────────────────────────────────────────────
  const dialogItem: PersonalEvent | null = useMemo(() => {
    if (!dialogMode || dialogMode.kind !== "editPersonal") return null;
    return (state.personalEvents ?? []).find((pe) => pe.id === dialogMode.id) ?? null;
  }, [dialogMode, state.personalEvents]);

  const dialogBlock: Block | null = useMemo(() => {
    if (!dialogMode || dialogMode.kind !== "editBlock") return null;
    return state.blocks.find((b) => b.id === dialogMode.id) ?? null;
  }, [dialogMode, state.blocks]);

  const dialogDefaultDate =
    dialogMode?.kind === "create" ? dialogMode.iso : undefined;
  const dialogDefaultStart =
    dialogMode?.kind === "create" ? dialogMode.startMins : undefined;

  // ── Render ────────────────────────────────────────────────────────────────
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
            <button
              className="btn primary small gcal-new-event-btn"
              onClick={() => openCreateDialog(anchor, 9 * 60)}
              aria-label="New event"
            >
              + New event
            </button>
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

      <div className="legend gcal-legend">
        {timeGridView ? (
          <span>
            <i className="dot" />
            Busy commitments
          </span>
        ) : null}
        <span>
          <i className="dot dot-personal" />
          Your events
        </span>
        <span>
          <i className="dot green" />
          Chosen campus events
        </span>
        {anyAttention ? (
          <span>
            <i className="dot amber" />
            Needs attention
          </span>
        ) : null}
        {!timeGridView ? <span>Classes appear in Day and Week view.</span> : null}
        <span>
          Times in campus time ({DEMO.time_zone}) · {state.buffer}-minute travel buffer
        </span>
      </div>

      {!showingDemoWeek && timeGridView ? <DemoWeekBanner onGoToDemo={goToDemoWeek} /> : null}

      {undoState ? (
        <div className="gcal-undo-bar" role="status">
          <span>Moved {undoState.label}</span>
          <button
            className="btn small"
            onClick={() => {
              onUpdate(undoState.restore);
              setUndoState(null);
              notify("Move undone.");
            }}
          >
            Undo
          </button>
          <button
            className="gcal-undo-dismiss"
            aria-label="Dismiss"
            onClick={() => setUndoState(null)}
          >
            ×
          </button>
        </div>
      ) : null}

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
            onEditPersonal={openEditPersonal}
            onEditBlock={openEditBlock}
            onCreateAt={openCreateDialog}
            dragState={dragState}
            onDragStart={startDrag}
            onDragMove={moveDrag}
            onDragEnd={endDrag}
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
            onEditPersonal={openEditPersonal}
            onCreateAt={openCreateDialog}
          />
        </div>
      ) : null}

      {view === "year" ? (
        <div className="gcal-body panel">
          {!showingDemoWeek ? <DemoWeekBanner onGoToDemo={goToDemoWeek} /> : null}
          <YearView anchor={anchor} state={state} today={today} onDayClick={openDay} />
        </div>
      ) : null}

      {/* Dialog */}
      {dialogMode ? (
        <PersonalEventDialog
          item={dialogItem}
          block={dialogBlock}
          defaultDate={dialogDefaultDate}
          defaultStart={dialogDefaultStart}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setDialogMode(null)}
        />
      ) : null}
    </div>
  );
}
