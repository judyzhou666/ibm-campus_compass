/**
 * Demo identities. Signing in only stores a display name and a role in this
 * browser: there is no password, account or server-side permission check.
 */
export const ROLES = ["student", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  (ROLES as readonly unknown[]).includes(value);

export const ROLE_INFO: Record<
  Role,
  { label: string; summary: string; sidebar: string }
> = {
  student: {
    label: "Student",
    summary: "Find events, plan your week and RSVP.",
    sidebar: "Student · Demo profile",
  },
  admin: {
    label: "Admin",
    summary: "Draft fictional events and review the catalog. Drafts stay in this browser.",
    sidebar: "Admin · Demo profile",
  },
};

export type ProfileAction =
  | "create"
  | "profile"
  | "review"
  | "switch"
  | "signout";

/** Rows in the profile dropdown, in order, for the signed-in role. */
export function profileMenuItems(
  role: Role,
): { action: ProfileAction; label: string }[] {
  const other = role === "student" ? "admin" : "student";
  return [
    ...(role === "admin"
      ? [
          { action: "create" as const, label: "Create event" },
          { action: "review" as const, label: "Team data review" },
        ]
      : []),
    { action: "profile", label: "Edit profile" },
    { action: "switch", label: `Sign in as ${ROLE_INFO[other].label}` },
    { action: "signout", label: "Sign out" },
  ];
}
