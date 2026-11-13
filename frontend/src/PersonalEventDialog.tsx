/**
 * PersonalEventDialog — Canvas-style Create/Edit dialog for student-owned
 * calendar items.
 *
 * Fields: Title, Date, From/To (15-min steps), Frequency (Google/Canvas-style
 * presets plus Custom: every N days/weeks/months/years, weekdays, ends),
 * Location, Calendar (Personal or Class / busy time).
 *
 * Every field can be changed, also for classes. A class that repeats weekly
 * on one weekday (Mon–Fri) with no end or location stays a `state.blocks`
 * entry (the backend's busy-time format); anything else is saved as a
 * PersonalEvent, which the planner also treats as busy time.
 *
 * Used by CalendarView for create (empty form) and edit (pre-filled form).
 * Calls onSave / onDelete / onClose; the parent owns state mutations.
 */
import { useEffect, useRef, useState } from "react";
import type { PersonalEvent, Block } from "./types.ts";
import { isoToNoonUTC } from "./calendarGrid.ts";
import {
  REPEAT_PRESETS,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  describeRule,
  presetLabel,
  ruleFor,
  type RepeatPreset,
  type RepeatRule,
  type RepeatUnit,
} from "./recurrence.ts";
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


// ── Sub-types ─────────────────────────────────────────────────────────────────

/** What the parent receives when the user saves. */
export interface PersonalEventSavePayload {
  /** personal event to upsert — undefined when saving as a block */
  personalEvent?: PersonalEvent;
  /** block to upsert — a class repeating weekly on one weekday (Mon–Fri) */
  block?: Block;
  /**
   * The id being edited. The parent removes it from both lists before
   * upserting, so a class can become a personal item and back.
   */
  replaces?: string;
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

const UNITS: { value: RepeatUnit; one: string; many: string }[] = [
  { value: "day", one: "day", many: "days" },
  { value: "week", one: "week", many: "weeks" },
  { value: "month", one: "month", many: "months" },
  { value: "year", one: "year", many: "years" },
];

/** Pure save rule, exported for tests. */
export function savePayload(
  form: {
    id: string;
    title: string;
    date: string;
    start: number;
    end: number;
    preset: RepeatPreset;
    rule: RepeatRule | null;
    location: string;
    calendar: "personal" | "class";
  },
  replaces?: string,
): PersonalEventSavePayload {
  const wd = isoWeekday(form.date);
  const simpleWeekly =
    form.preset === "weekly" ||
    (form.preset === "custom" &&
      form.rule?.unit === "week" &&
      form.rule.interval === 1 &&
      form.rule.weekdays?.length === 1 &&
      form.rule.weekdays[0] === wd &&
      !form.rule.until &&
      !form.rule.count);
  if (form.calendar === "class" && simpleWeekly && wd < 5 && !form.location) {
    return {
      block: { id: form.id, title: form.title, day: wd, start: form.start, end: form.end },
      replaces,
    };
  }
  const pe: PersonalEvent = {
    id: form.id,
    title: form.title,
    date: form.date,
    start: form.start,
    end: form.end,
    repeat: form.preset,
    ...(form.preset === "custom" && form.rule ? { rule: form.rule } : {}),
    ...(form.calendar === "class" ? { calendar: "class" as const } : {}),
    ...(form.location ? { location: form.location } : {}),
  };
  return { personalEvent: pe, replaces };
}

/** Problem with a custom rule, in plain words, or "" when it is fine. */
export function ruleProblem(rule: RepeatRule | null, date: string) {
  if (!rule) return "";
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 99)
    return "Repeat every 1 to 99.";
  if (rule.unit === "week" && !rule.weekdays?.length) return "Pick at least one day.";
  if (rule.until !== undefined && !(rule.until >= date))
    return "The end date must be on or after the start date.";
  if (rule.count !== undefined && !(rule.count >= 1 && rule.count <= 400))
    return "Choose 1 to 400 occurrences.";
  return "";
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
  const initPreset: RepeatPreset = block != null ? "weekly" : (item?.repeat ?? "none");
  const initCalendar: "personal" | "class" =
    block != null || item?.calendar === "class" ? "class" : "personal";

  const [title, setTitle] = useState(item?.title ?? block?.title ?? "");
  const [date, setDate] = useState(initDate);
  const [startStr, setStartStr] = useState(minsToHHMM(initStart));
  const [endStr, setEndStr] = useState(minsToHHMM(initEnd));
  const [preset, setPreset] = useState<RepeatPreset>(initPreset);
  const [custom, setCustom] = useState<RepeatRule>(
    item?.rule ?? ruleFor("weekly", initDate)!,
  );
  const [ends, setEnds] = useState<"never" | "on" | "after">(
    item?.rule?.until ? "on" : item?.rule?.count ? "after" : "never",
  );
  const [location, setLocation] = useState(item?.location ?? "");
  const [calendar, setCalendar] = useState<"personal" | "class">(initCalendar);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startMins = HHMMToMins(startStr);
  const endMins = HHMMToMins(endStr);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const rule: RepeatRule | null =
    preset === "custom"
      ? {
          unit: custom.unit,
          interval: custom.interval,
          ...(custom.unit === "week" ? { weekdays: custom.weekdays ?? [] } : {}),
          ...(custom.unit === "month" ? { monthly: custom.monthly ?? "weekday" } : {}),
          ...(ends === "on" ? { until: custom.until ?? date } : {}),
          ...(ends === "after" ? { count: custom.count ?? 5 } : {}),
        }
      : null;
  const problem = dateOk ? ruleProblem(rule, date) : "";
  const valid =
    title.trim().length > 0 && dateOk && endMins > startMins && !problem;

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
    onSave(
      savePayload(
        {
          id: editId ?? crypto.randomUUID(),
          title: title.trim(),
          date,
          start: snappedStart,
          end: snappedEnd,
          preset,
          rule,
          location: location.trim(),
          calendar,
        },
        editId ?? undefined,
      ),
    );
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

  const patch = (p: Partial<RepeatRule>) => setCustom((c) => ({ ...c, ...p }));
  const toggleDay = (d: number) => {
    const now = custom.weekdays ?? [];
    patch({
      weekdays: now.includes(d) ? now.filter((x) => x !== d) : [...now, d].sort(),
    });
  };
  const weekdayName = dateOk ? WEEKDAYS_LONG[isoWeekday(date)] : "";
  const unitWord = (u: (typeof UNITS)[number]) =>
    custom.interval === 1 ? u.one : u.many;

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
          <div className="field pe-field-full">
            <label htmlFor="pe-date">Date</label>
            <input
              id="pe-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
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
                    setEndStr(minsToHHMM(Math.min(s + 60, 1439)));
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
          <div className="field pe-field-full">
            <label htmlFor="pe-repeat">Frequency</label>
            <select
              id="pe-repeat"
              value={preset}
              onChange={(e) => {
                const next = e.target.value as RepeatPreset;
                // Opening Custom starts from what was chosen before.
                if (next === "custom" && preset !== "custom" && dateOk)
                  setCustom(ruleFor(preset === "none" ? "weekly" : preset, date)!);
                setPreset(next);
              }}
            >
              {REPEAT_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {dateOk ? presetLabel(p, date) : p}
                </option>
              ))}
            </select>
          </div>

          {preset === "custom" ? (
            <fieldset className="pe-custom pe-field-full">
              <legend>Custom repeat</legend>
              <div className="pe-custom-row">
                <label htmlFor="pe-interval">Repeat every</label>
                <input
                  id="pe-interval"
                  type="number"
                  min={1}
                  max={99}
                  value={Number.isNaN(custom.interval) ? "" : custom.interval}
                  onChange={(e) => patch({ interval: e.target.valueAsNumber })}
                />
                <select
                  aria-label="Repeat unit"
                  value={custom.unit}
                  onChange={(e) => {
                    const unit = e.target.value as RepeatUnit;
                    patch({
                      unit,
                      weekdays:
                        unit === "week" && !custom.weekdays?.length && dateOk
                          ? [isoWeekday(date)]
                          : custom.weekdays,
                    });
                  }}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {unitWord(u)}
                    </option>
                  ))}
                </select>
              </div>
              {custom.unit === "week" ? (
                <div className="pe-weekdays" role="group" aria-label="Repeat on">
                  {WEEKDAYS_SHORT.map((d, i) => {
                    const on = (custom.weekdays ?? []).includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`pe-day${on ? " active" : ""}`}
                        aria-pressed={on}
                        aria-label={WEEKDAYS_LONG[i]}
                        onClick={() => toggleDay(i)}
                      >
                        {d.slice(0, 1)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {custom.unit === "month" && dateOk ? (
                <select
                  aria-label="Monthly on"
                  value={custom.monthly ?? "weekday"}
                  onChange={(e) =>
                    patch({ monthly: e.target.value as "date" | "weekday" })
                  }
                >
                  <option value="date">Monthly on day {Number(date.slice(8))}</option>
                  <option value="weekday">
                    {presetLabel("monthly", date)}
                  </option>
                </select>
              ) : null}
              <div className="pe-ends" role="radiogroup" aria-label="Ends">
                <span className="pe-ends-title">Ends</span>
                <label>
                  <input
                    type="radio"
                    name="pe-ends"
                    checked={ends === "never"}
                    onChange={() => setEnds("never")}
                  />
                  Never
                </label>
                <label>
                  <input
                    type="radio"
                    name="pe-ends"
                    checked={ends === "on"}
                    onChange={() => setEnds("on")}
                  />
                  On
                  <input
                    type="date"
                    aria-label="End date"
                    value={custom.until ?? date}
                    min={date}
                    disabled={ends !== "on"}
                    onChange={(e) => patch({ until: e.target.value })}
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="pe-ends"
                    checked={ends === "after"}
                    onChange={() => setEnds("after")}
                  />
                  After
                  <input
                    type="number"
                    aria-label="Number of occurrences"
                    min={1}
                    max={400}
                    value={custom.count ?? 5}
                    disabled={ends !== "after"}
                    onChange={(e) => patch({ count: e.target.valueAsNumber })}
                  />
                  occurrences
                </label>
              </div>
              {rule && dateOk && !problem ? (
                <p className="pe-rule-summary">{describeRule(rule, date)}</p>
              ) : null}
            </fieldset>
          ) : null}
          {problem ? <p className="pe-field-error">{problem}</p> : null}

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
          <div className="field pe-field-full">
            <label htmlFor="pe-calendar">Calendar</label>
            <select
              id="pe-calendar"
              value={calendar}
              onChange={(e) => setCalendar(e.target.value as "personal" | "class")}
            >
              <option value="personal">Personal</option>
              <option value="class">Class / busy time</option>
            </select>
          </div>
          {calendar === "class" && preset !== "none" && weekdayName ? (
            <p className="pe-field-hint pe-field-full">
              The AI Planner treats every occurrence in the demo week as busy time.
            </p>
          ) : null}

          {/* Actions */}
          <div className="pe-dialog-actions">
            {isEdit ? (
              confirmDelete ? (
                <div className="pe-confirm-delete">
                  <span>
                    Delete &ldquo;{title}&rdquo;
                    {preset !== "none" ? " and all its repeats" : ""}?
                  </span>
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
                disabled={!valid}
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
