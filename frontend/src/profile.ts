export interface BasicInformation {
  name: string;
  studentStatus: string;
  university: string;
  major: string;
}

export type BasicInformationValidation =
  { valid: true; value: BasicInformation } | { valid: false; error: string };

export function validateBasicInformation(
  input: BasicInformation,
): BasicInformationValidation {
  const value = {
    name: input.name.trim(),
    studentStatus: input.studentStatus.trim(),
    university: input.university.trim(),
    major: input.major.trim(),
  };
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
