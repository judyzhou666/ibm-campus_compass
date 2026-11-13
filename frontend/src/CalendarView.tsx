/**
 * CalendarView — Google-Calendar-style Day/Week/Month/Year views.
 * Used only on the My Calendar page; the Dashboard strip and
 * AI Planner panel continue to use the existing Week component.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { DEMO, DEMO_NOW_MINUTE, isTimeZone, weekDates } from "./config.ts";
import { EVENTS, time } from "./data.ts";
import { issue } from "./planner.ts";
import { effectiveEvents } from "./updates.ts";
import { busyBlocks } from "./personalEvents.ts";
import { daysBetween, occursOn, shiftSeries } from "./recurrence.ts";
import type { Block, CampusEvent, DemoState, PersonalEvent } from "./types.ts";
import { Icon } from "./components.tsx";
import {
  type CalView,
  type CalendarItem,
  HOUR_PX,
  attentionTag,
  blockDropAllowed,
  clampEnd,
  clampStart,
  colHeight,
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
  /** Show a toast notification (with optional action buttons, matching App.tsx ToastAction) */
  notify: (text: string, actions?: Array<{ label: string; run: () => void }>) => void;
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
  origStart: number;
  origEnd: number;
  origIso: string;
  /** Pointer clientY at drag start */
  startY: number;
  /** Pointer clientX at drag start */
  startX: number;
  /** clientY of the block's top edge at drag start (for grab offset) */
  blockTopClientY: number;
  /**
   * Column DOMRect array captured at drag start.
   * Used to find the target column from clientX without relying on
   * which column's handler fires (pointer capture locks events to the
   * originating element).
   */
  colRects: DOMRect[];
  /** The ISO dates corresponding to each colRect (same indices). */
  colDates: string[];
  mode: "move" | "resize";
  preview: { iso: string; start: number; end: number } | null;
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
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: (e: React.PointerEvent) => void;
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
      style={{ "--gcal-col-h": `${colHeight(grid.start, grid.end)}px` } as React.CSSProperties}
      aria-label={`${DAY_NAMES_FULL[isoWeekdayIndex(iso)]}, ${shortDate(iso)}`}
      onPointerDown={handleColPointerDown}
      onPointerMove={onDragMove}
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
                e.preventDefault(); // Fix 5: prevent text selection
                e.stopPropagation();
                onDragStart(e, item.id, "class", "move", iso, item.start, item.end);
              }}
              onClick={(e) => {
                e.stopPropagation();
                // onEditBlock is only called when endDrag detects no real drag
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditBlock(item.id); } }}
            >
              <strong>{item.title}</strong>
              <span>{timeText}</span>
              <div
                className="gcal-resize-handle"
                title="Drag to resize"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDragStart(e, item.id, "class", "resize", iso, item.start, item.end);
                }}
              />
            </div>
          );
        }

        if (item.kind === "personal") {
          const isDragging = dragState?.active && dragState.id === item.id;
          const lbl = `${item.title}, ${timeText}${item.location ? ", " + item.location : ""}${item.repeating ? " (repeats)" : ""}`;
          return (
            <div
              key={item.id}
              className={`gcal-event-block gcal-personal${item.asClass ? " gcal-personal-class" : ""}${isDragging ? " gcal-dragging" : ""}`}
              style={style}
              role="button"
              aria-label={lbl + " (editable)"}
              title={lbl}
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault(); // Fix 5: prevent text selection
                e.stopPropagation();
                onDragStart(e, item.id, "personal", "move", iso, item.start, item.end);
              }}
              onClick={(e) => {
                e.stopPropagation();
                // onEditPersonal is only called when endDrag detects no real drag
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditPersonal(item.id); } }}
            >
              <strong>{item.title}</strong>
              <span>{timeText}</span>
              <div
                className="gcal-resize-handle"
                title="Drag to resize"
                onPointerDown={(e) => {
                  e.preventDefault();
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
  onDragMove: (e: React.PointerEvent) => void;
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

        <div className={`gcal-time-grid${dragState?.active ? " gcal-is-dragging" : ""}`}>
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
              onEditPersonal={onEditPersonal}
              onEditBlock={onEditBlock}
              onCreateAt={onCreateAt}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MonthView ────────────────────────────────────────────────────────────────

interface MonthDragState {
  id: string;
  kind: "personal" | "block";
  origIso: string;
  startX: number;
  startY: number;
  targetIso: string | null;
  active: boolean;
}

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
  onMonthDrop,
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
  onMonthDrop: (id: string, kind: "personal" | "block", targetIso: string, fromIso: string) => void;
}) {
  const dates = monthGridDates(anchor);
  const demoWeek = weekDates();
  const gridRef = useRef<HTMLDivElement>(null);

  const [mDrag, setMDrag] = useState<MonthDragState | null>(null);
  const mDragRef = useRef<MonthDragState | null>(null);
  mDragRef.current = mDrag;

  function findCellIso(clientX: number, clientY: number): string | null {
    if (!gridRef.current) return null;
    const cells = Array.from(gridRef.current.querySelectorAll<HTMLDivElement>("[data-iso]"));
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return cell.dataset.iso ?? null;
      }
    }
    return null;
  }

  function startMonthDrag(e: React.PointerEvent, id: string, kind: "personal" | "block", iso: string) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ds: MonthDragState = { id, kind, origIso: iso, startX: e.clientX, startY: e.clientY, targetIso: null, active: false };
    setMDrag(ds);
    mDragRef.current = ds;
  }

  function moveMonthDrag(e: React.PointerEvent) {
    const ds = mDragRef.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.active && Math.sqrt(dx*dx + dy*dy) < DRAG_THRESHOLD) return;
    const iso = findCellIso(e.clientX, e.clientY);
    const updated = { ...ds, active: true, targetIso: iso };
    setMDrag(updated);
    mDragRef.current = updated;
  }

  function endMonthDrag(e: React.PointerEvent) {
    const ds = mDragRef.current;
    if (!ds) return;
    setMDrag(null);
    mDragRef.current = null;
    if (!ds.active || !ds.targetIso || ds.targetIso === ds.origIso) {
      if (!ds.active) onEditPersonal(ds.id);
      return;
    }
    onMonthDrop(ds.id, ds.kind, ds.targetIso, ds.origIso);
  }

  return (
    <div className="gcal-month">
      <div className="gcal-month-header">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="gcal-month-dow">
            {d}
          </div>
        ))}
      </div>

      <div
        className="gcal-month-grid"
        ref={gridRef}
        onPointerMove={moveMonthDrag}
        onPointerUp={endMonthDrag}
        onPointerCancel={endMonthDrag}
      >
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
          const isDragTarget = mDrag?.active && mDrag.targetIso === iso;

          return (
            <div
              key={iso}
              data-iso={iso}
              className={[
                "gcal-month-cell",
                !sameMonth(iso, anchor) ? "gcal-other-month" : "",
                isToday ? "gcal-today-cell" : "",
                inDemoWeek ? "gcal-demo-week-cell" : "",
                isDragTarget ? "gcal-month-drag-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onCreateAt(iso, 9 * 60)}
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

              {/* Personal event chips — draggable */}
              {personal.slice(0, Math.max(0, MAX_CHIPS - chosen.length)).map((item) => {
                const isDraggingThis = mDrag?.active && mDrag.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`gcal-month-chip gcal-chip-personal${item.asClass ? " gcal-personal-class" : ""}${isDraggingThis ? " gcal-dragging" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.title}, ${time(item.start)}–${time(item.end)}${item.repeating ? " (repeats)" : ""} (editable)`}
                    title={`${item.title}${item.repeating ? " (repeats)" : ""}`}
                    onPointerDown={(e) => startMonthDrag(e, item.id, "personal", iso)}
                    onClick={(e) => { e.stopPropagation(); /* handled in endMonthDrag */ }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditPersonal(item.id); } }}
                  >
                    <span className="gcal-chip-text">
                      {time(item.start)} {item.title}
                    </span>
                  </div>
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
            (state.personalEvents ?? []).some((pe) => occursOn(pe, iso));
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
    // Editing removes the old entry from both lists first, so changing the
    // Calendar or Frequency can turn a class into a personal item and back.
    const strip = (s: DemoState): DemoState =>
      payload.replaces
        ? {
            ...s,
            blocks: s.blocks.filter((x) => x.id !== payload.replaces),
            personalEvents: (s.personalEvents ?? []).filter((x) => x.id !== payload.replaces),
          }
        : s;
    if (payload.block) {
      const b = payload.block;
      onUpdate((s0) => {
        const s = strip(s0);
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
      onUpdate((s0) => {
        const s = strip(s0);
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
      const peDays = weekDates()
        .slice(0, 5)
        .map((iso, day) => (occursOn(pe, iso) ? day : -1))
        .filter((day) => day >= 0);
      if (peDays.length) {
        const overlap = planEvents.find(
          (e) =>
            state.plan.includes(e.id) &&
            !state.cancelled.includes(e.id) &&
            peDays.includes(e.day) &&
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

  // ── Month drop handler ────────────────────────────────────────────────────
  function handleMonthDrop(id: string, kind: "personal" | "block", targetIso: string, fromIso: string) {
    const prevBlocks = [...state.blocks];
    const prevPersonal = [...(state.personalEvents ?? [])];

    if (kind === "block") {
      if (!blockDropAllowed(targetIso)) { notify("Classes can only be placed on Mon–Fri."); return; }
      // Classes repeat every week, so any Mon–Fri date sets the weekday.
      const newDay = isoWeekdayIndex(targetIso);
      const b = state.blocks.find((x) => x.id === id);
      if (!b) return;
      onUpdate((s) => ({ ...s, blocks: s.blocks.map((x) => x.id === id ? { ...x, day: newDay } : x) }));
      notify(
        `Moved "${b.title}" to ${DAY_NAMES_FULL[isoWeekdayIndex(targetIso)]}`,
        [{ label: "Undo", run: () => onUpdate((s) => ({ ...s, blocks: prevBlocks, personalEvents: prevPersonal })) }],
      );
    } else {
      const pe = (state.personalEvents ?? []).find((x) => x.id === id);
      if (!pe) return;
      // A repeating item moves as a whole series by the same number of days.
      const shift = daysBetween(fromIso, targetIso);
      onUpdate((s) => ({
        ...s,
        personalEvents: (s.personalEvents ?? []).map((x) =>
          x.id !== id ? x : x.repeat === "none" ? { ...x, date: targetIso } : shiftSeries(x, shift),
        ),
      }));
      notify(
        `Moved "${pe.title}" to ${DAY_NAMES_FULL[isoWeekdayIndex(targetIso)]}`,
        [{ label: "Undo", run: () => onUpdate((s) => ({ ...s, blocks: prevBlocks, personalEvents: prevPersonal })) }],
      );
    }
  }

  // ── Drag implementation ────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = dragState;

  /**
   * Start a drag. Capture column rects here so moveDrag can find the target
   * column from clientX even though pointer capture locks events to the
   * original element.
   */
  function startDrag(
    e: React.PointerEvent,
    id: string,
    kind: "personal" | "class",
    mode: "move" | "resize",
    iso: string,
    start: number,
    end: number,
  ) {
    // Capture pointer to receive future move/up on this element regardless of
    // where the pointer goes; but we'll compute the target col from stored rects.
    e.currentTarget.setPointerCapture(e.pointerId);

    // Collect the bounding rects of all day columns.
    const gridEl = (e.currentTarget as HTMLElement).closest(".gcal-time-grid");
    const colEls = gridEl
      ? Array.from(gridEl.querySelectorAll<HTMLDivElement>(".gcal-day-col"))
      : [];
    const dayColHeaders = gridEl
      ? Array.from((gridEl.closest(".gcal-time-grid-wrap") as HTMLElement | null)
          ?.querySelectorAll<HTMLDivElement>(".gcal-col-head") ?? [])
      : [];

    // Map col header data-iso (via aria-label) back to dates — simpler: just
    // query all day cols in DOM order and pair with viewDates.
    const colRects = colEls.map((el) => el.getBoundingClientRect());

    // The block's own rect top for grab offset.
    const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    const ds: DragState = {
      id,
      kind,
      origStart: start,
      origEnd: end,
      origIso: iso,
      startY: e.clientY,
      startX: e.clientX,
      blockTopClientY: blockRect.top,
      colRects,
      colDates: viewDates.length > 0 ? [...viewDates] : [iso],
      mode,
      preview: null,
      active: false,
    };
    setDragState(ds);
    dragRef.current = ds;
  }

  /**
   * Move handler — compute target column from stored rects (Fix 2),
   * use grab offset for time (Fix 3).
   */
  function moveDrag(e: React.PointerEvent) {
    const ds = dragRef.current;
    if (!ds) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!ds.active && dist < DRAG_THRESHOLD) return;

    // Determine target column from clientX vs stored rects (Fix 2)
    let targetIso = ds.origIso;
    if (ds.mode === "move" && ds.colRects.length > 1) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < ds.colRects.length; i++) {
        const r = ds.colRects[i];
        const mid = r.left + r.width / 2;
        const d = Math.abs(e.clientX - mid);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      targetIso = ds.colDates[bestIdx] ?? ds.origIso;
    }

    // Blocks can only drop on weekdays (Fix 8) — snap back during drag too
    if (ds.kind === "class" && !blockDropAllowed(targetIso)) {
      targetIso = ds.origIso;
    }

    // Compute new time using grab offset (Fix 3)
    // The pointer's Y offset from the block top at drag start = (clientY - blockTopClientY)
    // Use first col rect top as grid top anchor
    const colTop = ds.colRects[0]?.top ?? 0;
    const relY = e.clientY - colTop - (ds.blockTopClientY - colTop);
    // relY is the pixel distance from block top to pointer = grab point within block
    // New block top in grid coords = (clientY - grabOffsetInBlock) - colTop
    const grabOffsetPx = ds.startY - ds.blockTopClientY;
    const newBlockTopPx = e.clientY - colTop - grabOffsetPx;

    const dur = ds.origEnd - ds.origStart;
    let newStart: number;
    let newEnd: number;

    if (ds.mode === "move") {
      // Use actual column top, not the first col's top, for the active column
      const activColIdx = ds.colDates.indexOf(targetIso);
      const activeColRect = ds.colRects[activColIdx] ?? ds.colRects[0];
      const activeRelY = e.clientY - activeColRect.top - grabOffsetPx;
      newStart = pixelToMins(activeRelY, grid.start, grid.end);
      newStart = clampStart(newStart, dur, grid.start, grid.end);
      newEnd = newStart + dur;
    } else {
      // Resize: keep start, drag end from bottom edge
      const activeColRect = ds.colRects[0] ?? { top: 0 };
      const endRelY = e.clientY - activeColRect.top;
      newStart = ds.origStart;
      newEnd = pixelToMins(endRelY, grid.start, grid.end);
      newEnd = clampEnd(newEnd, ds.origStart, grid.end);
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

  /**
   * End drag. If it was a real drag, apply the move. If it was a tiny
   * movement (< 4 px), open the edit dialog. Never both (Fix 4).
   */
  function endDrag(e: React.PointerEvent) {
    const ds = dragRef.current;
    if (!ds) return;

    if (!ds.active || !ds.preview) {
      // Below threshold: treat as click → open edit dialog (Fix 4)
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

    // Validate blocks-only-weekdays (Fix 8)
    if (ds.kind === "class" && !blockDropAllowed(targetIso)) {
      notify("Classes can only be placed on Mon–Fri.");
      setDragState(null);
      dragRef.current = null;
      return;
    }

    const prevBlocks = [...state.blocks];
    const prevPersonal = [...(state.personalEvents ?? [])];

    if (ds.kind === "class") {
      // Classes repeat every week, so any Mon–Fri date sets the weekday.
      const newDay = isoWeekdayIndex(targetIso);
      onUpdate((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === ds.id ? { ...b, day: newDay, start: newStart, end: newEnd } : b,
        ),
      }));
    } else {
      onUpdate((s) => ({
        ...s,
        personalEvents: (s.personalEvents ?? []).map((pe) => {
          if (pe.id !== ds.id) return pe;
          // A repeating item moves as a whole series by the same offset.
          if (pe.repeat !== "none")
            return {
              ...shiftSeries(pe, daysBetween(ds.origIso, targetIso)),
              start: newStart,
              end: newEnd,
            };
          return { ...pe, date: targetIso, start: newStart, end: newEnd };
        }),
      }));
    }

    const moved =
      state.blocks.find((b) => b.id === ds.id) ??
      (state.personalEvents ?? []).find((pe) => pe.id === ds.id);
    const label = moved?.title ?? "item";
    const dLabel = DAY_NAMES_FULL[isoWeekdayIndex(targetIso)];
    const restoreBlocks = prevBlocks;
    const restorePersonal = prevPersonal;
    // Fix 6: show Undo only in the toast (no separate banner)
    notify(
      `Moved "${label}" to ${dLabel}, ${formatTimeRange(newStart, newEnd)}`,
      [{ label: "Undo", run: () => onUpdate((s) => ({ ...s, blocks: restoreBlocks, personalEvents: restorePersonal })) }],
    );

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
            onMonthDrop={handleMonthDrop}
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
