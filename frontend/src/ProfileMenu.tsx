import { useEffect, useRef } from "react";
import { Icon } from "./components.tsx";
import {
  ROLE_INFO,
  profileMenuItems,
  type ProfileAction,
  type Role,
} from "./identity.ts";

const ICONS: Record<ProfileAction, string> = {
  create: "plus",
  review: "search",
  profile: "user",
  switch: "refresh",
  signout: "arrow",
};

/** Dropdown under the top-bar profile photo: who is signed in, and as which identity. */
export function ProfileMenu({
  name,
  role,
  onAction,
  onClose,
}: {
  name: string;
  role: Role;
  onAction: (action: ProfileAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.(".profile-btn")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);
  const info = ROLE_INFO[role];
  return (
    <div
      className="profile-menu"
      id="profile-menu"
      role="dialog"
      aria-label="Account"
      ref={ref}
    >
      <div className="profile-menu-head">
        <span className={`avatar ${role}`} aria-hidden="true">
          {name[0] || "J"}
        </span>
        <div>
          <strong>{name}</strong>
          <span className="profile-menu-as">
            Signed in as <span className={`role-pill ${role}`}>{info.label}</span>
          </span>
        </div>
      </div>
      <p className="profile-menu-summary">{info.summary}</p>
      <div className="profile-menu-list">
        {profileMenuItems(role).map((item) => (
          <button
            key={item.action}
            className={item.action === "signout" ? "signout" : undefined}
            onClick={() => onAction(item.action)}
          >
            <Icon name={ICONS[item.action]} />
            {item.label}
          </button>
        ))}
      </div>
      <p className="profile-menu-note">
        Demo identity only: no password, and nothing leaves this browser.
      </p>
    </div>
  );
}
