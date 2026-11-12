/**
 * PersonalEventDialog — Canvas-style Create/Edit dialog for student-owned
 * calendar items.
 *
 * Fields: Title, Date, From/To (15-min steps), Frequency, Location, Calendar
 * (Personal or Class / busy time → becomes a state.blocks entry when saved).
 *
 * Used by CalendarView for create (empty form) and edit (pre-filled form).
 * Calls onSave / onDelete / onClose; the parent owns state mutations.
 */
import { useEffect, useRef, useState } from "react";
import type { PersonalEvent, Block } from "./types.ts";
import { isoToNoonUTC } from "./calendarGrid.ts";
import { weekDates } from "./config.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format minutes → "HH:MM" (24-hour) for <input type="time"> */
export function minsToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Parse "HH:MM" → minutes */
export function HHMMToMins(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Snap minutes to nearest 15 */
export function snap15(m: number): number {
  return Math.round(m / 15) * 15;
}

/** 0-based weekday index (0=Mon…6=Sun) for an ISO date string */
function isoWeekday(iso: string): number {
  const dow = isoToNoonUTC(iso).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ── Sub-types ─────────────────────────────────────────────────────────────────

/** What the parent receives when the user saves. */
export interface PersonalEventSavePayload {
  /** personal event to upsert — undefined when saving as a block */
  personalEvent?: PersonalEvent;
  /** block to upsert — only when Calendar = "Class / busy time" + weekly + weekday */
  block?: Block;
}

export interface PersonalEventDialogProps {
  /** null → create mode; PersonalEvent → edit mode */
  item: PersonalEvent | null;
  /** Block currently being edited (when clicking a block from the calendar), or null */
  block: Block | null;
  /** ISO date to pre-fill when creating */
  defaultDate?: string;
  /** Start time in minutes to pre-fill when creating */
  defaultStart?: number;
  onSave: (payload: PersonalEventSavePayload) => void;
  /** Called only in edit mode. id is PersonalEvent.id or Block.id */
  onDelete: (id: string, kind: "personal" | "block") => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonalEventDialog({
  item,
  block,
  defaultDate,
  defaultStart,
  onSave,
  onDelete,
  onClose,
}: PersonalEventDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Initial values ────────────────────────────────────────────────────────
  const demoWeek = weekDates();
  const blockDate = block ? (demoWeek[block.day] ?? "") : null;
  const initDate =
    item?.date ?? blockDate ?? defaultDate ?? new Date().toISOString().slice(0, 10);
  const initStart = snap15(item?.start ?? block?.start ?? defaultStart ?? 540);
  const initEnd = snap15(item?.end ?? block?.end ?? Math.min(initStart + 60, 1440));
  const initRepeat: "none" | "weekly" =
    block != null ? "weekly" : (item?.repeat ?? "none");
  const initCalendar: "personal" | "class" = block != null ? "class" : "personal";

  const [title, setTitle] = useState(item?.title ?? block?.title ?? "");
  const [date, setDate] = useState(initDate);
  const [startStr, setStartStr] = useState(minsToHHMM(initStart));
  const [endStr, setEndStr] = useState(minsToHHMM(initEnd));
  const [repeat, setRepeat] = useState<"none" | "weekly">(initRepeat);
  const [location, setLocation] = useState(item?.location ?? "");
  const [calendar, setCalendar] = useState<"personal" | "class">(initCalendar);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startMins = HHMMToMins(startStr);
  const endMins = HHMMToMins(endStr);
  const weekdayIdx = isoWeekday(date);
  const isWeekend = weekdayIdx >= 5;
  const valid =
    title.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    endMins > startMins;
  // Class/busy time only works for Mon–Fri + weekly
  const calendarClass = calendar === "class";
  const submitDisabled =
    !valid || (calendarClass && (isWeekend || repeat !== "weekly"));

  const isEdit = item !== null || block !== null;
  const editId = item?.id ?? block?.id ?? null;

  // ── Trap focus into dialog ────────────────────────────────────────────────
  useEffect(() => {
    openerRef.current = document.activeElement;
    const el = dialogRef.current;
    if (!el) return;
    const firstFocusable = el.querySelector<HTMLElement>(
      'input, select, textarea, button:not([disabled])',
    );
    firstFocusable?.focus();
    return () => {
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    const snappedStart = snap15(startMins);
    const snappedEnd = snap15(endMins);
    if (snappedEnd <= snappedStart) return;

    if (calendarClass && repeat === "weekly" && !isWeekend) {
      // Save as a Block (class / busy time)
      const week = weekDates();
      const day = week.indexOf(date);
      if (day >= 0) {
        const b: Block = {
          id: editId ?? crypto.randomUUID(),
          title: title.trim(),
          day,
          start: snappedStart,
          end: snappedEnd,
        };
        onSave({ block: b });
      }
    } else {
      const pe: PersonalEvent = {
        id: editId ?? crypto.randomUUID(),
        title: title.trim(),
        date,
        start: snappedStart,
        end: snappedEnd,
        repeat,
        ...(location.trim() ? { location: location.trim() } : {}),
      };
      onSave({ personalEvent: pe });
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!editId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editId, block != null ? "block" : "personal");
  }

  const weekdayLabel =
    repeat === "weekly" && !isWeekend
      ? `Weekly on ${WEEKDAY_NAMES[weekdayIdx]}`
      : "Weekly";

  return (
    <>
      {/* Backdrop */}
      <div
        className="pe-dialog-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <dialog
        ref={dialogRef}
        className="pe-dialog"
        aria-label={isEdit ? "Edit event" : "New event"}
        aria-modal="true"
        open
      >
        <div className="pe-dialog-header">
          <h2 className="pe-dialog-title">
            {isEdit ? "Edit event" : "New event"}
          </h2>
          <button
            className="pe-dialog-close"
            aria-label="Close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pe-dialog-form">
          {/* Title */}
          <div className="field pe-field-full">
            <label htmlFor="pe-title">Title *</label>
            <input
              id="pe-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              maxLength={80}
              required
              autoComplete="off"
            />
          </div>

          {/* Date */}
          <div className="field">
            <label htmlFor="pe-date">Date</label>
            <input
              id="pe-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={block !== null}
            />
          </div>

          {/* From / To */}
          <div className="pe-time-row">
            <div className="field">
              <label htmlFor="pe-start">From</label>
              <input
                id="pe-start"
                type="time"
                step={900}
                value={startStr}
                onChange={(e) => {
                  setStartStr(e.target.value);
                  const s = HHMMToMins(e.target.value);
                  if (HHMMToMins(endStr) <= s) {
                    setEndStr(minsToHHMM(Math.min(s + 60, 1440)));
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="pe-end">To</label>
              <input
                id="pe-end"
                type="time"
                step={900}
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
              />
            </div>
          </div>
          {endMins <= startMins && (
            <p className="pe-field-error">End time must be after start time.</p>
          )}

          {/* Frequency */}
          <div className="field">
            <label htmlFor="pe-repeat">Frequency</label>
            <select
              id="pe-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as "none" | "weekly")}
              disabled={block !== null}
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">{weekdayLabel}</option>
            </select>
          </div>

          {/* Location */}
          <div className="field pe-field-full">
            <label htmlFor="pe-location">Location (optional)</label>
            <input
              id="pe-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={80}
              placeholder="Room, building, or link"
            />
          </div>

          {/* Calendar */}
          <div className="field">
            <label htmlFor="pe-calendar">Calendar</label>
            <select
              id="pe-calendar"
              value={calendar}
              onChange={(e) => setCalendar(e.target.value as "personal" | "class")}
              disabled={block !== null}
            >
              <option value="personal">Personal</option>
              <option value="class">Class / busy time</option>
            </select>
          </div>

          {calendarClass && isWeekend && (
            <p className="pe-field-error">
              Class / busy time only works on Mon–Fri.
            </p>
          )}
          {calendarClass && !isWeekend && repeat !== "weekly" && (
            <p className="pe-field-error">
              Class / busy time must be set to weekly.
            </p>
          )}

          {/* Actions */}
          <div className="pe-dialog-actions">
            {isEdit ? (
              confirmDelete ? (
                <div className="pe-confirm-delete">
                  <span>Delete &ldquo;{title}&rdquo;?</span>
                  <button
                    type="button"
                    className="btn danger small"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn danger small pe-delete-btn"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              )
            ) : null}
            <div className="pe-dialog-actions-right">
              <button type="button" className="btn small" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary small"
                disabled={submitDisabled}
              >
                {isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
