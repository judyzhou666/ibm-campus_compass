import { DEMO, dayLabel, weekDates } from "./config.ts";
import events from "../../data/events.json";
import type { CampusEvent, Block } from "./types.ts";
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const DATES = weekDates();
export const TOPICS = [
  "AI & education",
  "Career",
  "Social",
  "Arts & culture",
  "Wellbeing",
];
export const DEFAULT_BLOCKS: Block[] = [
  { id: "c1", title: "Learning Sciences", day: 0, start: 600, end: 720 },
  { id: "c2", title: "Research Methods", day: 1, start: 600, end: 720 },
  { id: "c3", title: "Project studio", day: 2, start: 780, end: 960 },
  { id: "c4", title: "Learning Sciences", day: 3, start: 600, end: 720 },
  { id: "c5", title: "Independent study", day: 4, start: 540, end: 660 },
];
export const EVENTS: CampusEvent[] = events.map((e) => ({
  ...e,
  campus_id: DEMO.campus_id,
}));
export const time = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""} ${m >= 720 ? "PM" : "AM"}`;
export const when = (e: { day: number; start: number; end: number }) =>
  `${DAYS[e.day] || "Unknown day"}, ${dayLabel(e.day)} · ${time(e.start)}–${time(e.end)}`;
