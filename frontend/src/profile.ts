export const STUDENT_STATUSES = [
  "Undergraduate student",
  "Graduate student",
  "Master's student",
  "PhD student",
  "Exchange student",
] as const;

/** Match exactly so legacy/custom values are never replaced on opening. */
export function studentStatusChoice(status: string): string {
  if (status === "") return "";
  return (STUDENT_STATUSES as readonly string[]).includes(status)
    ? status
    : "other";
}

export interface BasicInformation {
  name: string;
  studentStatus: string;
  university: string;
  major: string;
}

export function normalizeBasicInformation(
  input: BasicInformation,
): BasicInformation {
  return {
    name: input.name.trim(),
    studentStatus: input.studentStatus.trim(),
    university: input.university.trim(),
    major: input.major.trim(),
  };
}

export function hasBasicInformationChanges(
  draft: BasicInformation,
  saved: BasicInformation,
): boolean {
  const normalizedDraft = normalizeBasicInformation(draft);
  const normalizedSaved = normalizeBasicInformation(saved);
  return (
    normalizedDraft.name !== normalizedSaved.name ||
    normalizedDraft.studentStatus !== normalizedSaved.studentStatus ||
    normalizedDraft.university !== normalizedSaved.university ||
    normalizedDraft.major !== normalizedSaved.major
  );
}

export function profileAvatarInitial(name: string, fallback = "?"): string {
  return [...name.trim()][0]?.toUpperCase() || fallback;
}

export interface BasicInformationPreview {
  avatar: string;
  name: string;
  studentStatus: string;
  university: string;
  major: string;
}

export function basicInformationPreview(
  input: BasicInformation,
): BasicInformationPreview {
  const name = input.name.trim();
  const optionalValue = (value: string) => value.trim() || "Not added yet";
  return {
    avatar: profileAvatarInitial(name),
    name: name || "Not added yet",
    studentStatus: optionalValue(input.studentStatus),
    university: optionalValue(input.university),
    major: optionalValue(input.major),
  };
}

export type BasicInformationValidation =
  { valid: true; value: BasicInformation } | { valid: false; error: string };

export function validateBasicInformation(
  input: BasicInformation,
): BasicInformationValidation {
  const value = normalizeBasicInformation(input);
  if (!value.name) {
    return { valid: false, error: "Enter a display name to continue." };
  }
  if (
    value.name.length > 30 ||
    value.studentStatus.length > 80 ||
    value.university.length > 120 ||
    value.major.length > 120
  ) {
    return {
      valid: false,
      error: "One or more fields exceed the maximum length.",
    };
  }
  return { valid: true, value };
}
