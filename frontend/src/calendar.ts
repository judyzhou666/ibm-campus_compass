import { DEMO, utcStamp } from "./config.ts";
import { EVENTS } from "./data.ts";
import type { DemoState, CampusEvent } from "./types.ts";

export function calendarText(state: DemoState): string | null {
  const chosen = EVENTS.filter(
    (e) => state.plan.includes(e.id) && !state.cancelled.includes(e.id),
  );
  if (!chosen.length) return null;
  const stamp = (e: CampusEvent, minute: number) => utcStamp(e.day, minute);
  const clean = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Compass//Fictional Demo//EN",
    "CALSCALE:GREGORIAN",
    ...chosen.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}-${DEMO.campus_id}-${DEMO.week_start}@campus-compass-demo`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
      `DTSTART:${stamp(e, e.start)}`,
      `DTEND:${stamp(e, e.end)}`,
      `SUMMARY:${clean("[DEMO] " + e.title)}`,
      `LOCATION:${clean(e.location)}`,
      "DESCRIPTION:Fictional Campus Compass demonstration event. No real reservation.",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
