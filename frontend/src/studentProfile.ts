import { DEMO } from "./config.ts";
import type { DemoState } from "./types.ts";

export interface StudentProfile {
  status: string;
  university: string;
  bio: string;
}

// Optional additive state: older browser sessions keep their existing name,
// interests and activity. Missing biographical details are never fabricated.
export function readStudentProfile(value: unknown): StudentProfile {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const text = (key: string, limit: number, fallback: string) =>
    typeof input[key] === "string"
      ? input[key].trim().slice(0, limit)
      : fallback;
  return {
    status: text("status", 60, "Graduate student"),
    university: text("university", 120, DEMO.campus_name),
    bio: text("bio", 280, ""),
  };
}

export function saveStudentProfile(
  state: DemoState,
  name: string,
  profile: StudentProfile,
): DemoState {
  const displayName = name.trim().slice(0, 30);
  if (!displayName) throw Error("Enter a display name.");
  return {
    ...state,
    name: displayName,
    studentProfile: readStudentProfile(profile),
  };
}

export function profileInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase() || "S"
  );
}
