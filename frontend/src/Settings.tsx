import { useState, type ReactNode } from "react";
import { DEMO, TIME_ZONES } from "./config.ts";
import { EVENTS } from "./data.ts";
import { issue } from "./planner.ts";
import { relativeTime } from "./updates.ts";
import { Button, Icon } from "./components.tsx";
import {
  SETTINGS_SECTIONS,
  searchSettings,
  type SettingItem,
} from "./settings.ts";
import type { DemoState } from "./types.ts";

interface Props {
  state: DemoState;
  update: (change: (s: DemoState) => DemoState) => void;
  notify: (text: string) => void;
  watsonxMode: boolean;
  sidebarCollapsed: boolean;
  onSidebarCollapsed: (collapsed: boolean) => void;
  unreadCount: number;
  updatesWaiting: boolean;
  onProfile: () => void;
  onSignIn: () => void;
  onReview: () => void;
  onNotifications: () => void;
  onMarkAllRead: () => void;
  onCheckUpdates: () => void;
  onExport: () => void;
  onPlanner: () => void;
  onReset: () => void;
}

/** An on/off switch built on a checkbox, so it keeps native semantics. */
function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      className="switch"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function Settings(p: Props) {
  const { state, update, notify } = p;
  const [section, setSection] = useState(SETTINGS_SECTIONS[0].id);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(false);
  const results = searchSettings(query);
  const searching = query.trim() !== "";
  const shown = searching
    ? results
    : SETTINGS_SECTIONS.filter((s) => s.id === section);

  function setBuffer(on: boolean) {
    const next = { ...state, buffer: on ? 15 : 0 };
    const conflict = EVENTS.find(
      (x) =>
        next.plan.includes(x.id) &&
        !next.cancelled.includes(x.id) &&
        issue(x, next),
    );
    if (conflict) {
      notify(
        `Remove ${conflict.title} before enabling a longer travel buffer.`,
      );
      return;
    }
    update(() => next);
    notify("Travel buffer updated.");
  }

  /** The control on the right of a setting row. */
  function control(item: SettingItem): ReactNode {
    switch (item.id) {
      case "profile":
        return (
          <div className="row">
            <span className="settings-value">
              {state.signedIn
                ? `${state.name} · Signed in`
                : "Guest · Not signed in"}
            </span>
            {state.signedIn ? null : (
              <Button onClick={p.onSignIn}>Sign in</Button>
            )}
            <Button onClick={p.onProfile}>Edit profile</Button>
          </div>
        );
      case "sidebar":
        return (
          <Switch
            label="Compact sidebar"
            checked={p.sidebarCollapsed}
            onChange={p.onSidebarCollapsed}
          />
        );
      case "review":
        return <Button onClick={p.onReview}>Open synthetic-data review</Button>;
      case "unread":
        return (
          <div className="row">
            <span className="settings-value">{p.unreadCount} unread</span>
            <Button onClick={p.onMarkAllRead} disabled={!p.unreadCount}>
              Mark all read
            </Button>
            <Button onClick={p.onNotifications}>Open</Button>
          </div>
        );
      case "updates":
        return (
          <div className="settings-stack">
            <Button onClick={p.onCheckUpdates} disabled={!p.updatesWaiting}>
              <Icon name="bell" />
              {p.updatesWaiting ? "Check for updates" : "All updates applied"}
            </Button>
            <small>
              {state.lastUpdateCheck
                ? `Last checked ${relativeTime(state.lastUpdateCheck)}`
                : "Not checked yet"}
            </small>
          </div>
        );
      case "export":
        return (
          <Button onClick={p.onExport}>
            <Icon name="download" /> Export calendar
          </Button>
        );
      case "external":
        return <span className="tag">Not connected</span>;
      case "storage":
        return <span className="tag">This browser</span>;
      case "ai-mode":
        return (
          <span className="tag">
            {p.watsonxMode ? "IBM watsonx (Granite)" : "Simulated · Demo mode"}
          </span>
        );
      case "planner":
        return (
          <Button onClick={p.onPlanner}>
            <Icon name="spark" /> Open AI Planner
          </Button>
        );
      case "timezone":
        return (
          <select
            className="settings-select"
            value={state.timezone || DEMO.time_zone}
            aria-label="Time zone"
            onChange={(e) => {
              update((s) => ({ ...s, timezone: e.target.value }));
              notify("Time zone updated.");
            }}
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        );
      case "buffer":
        return (
          <Switch
            label="15-minute travel buffer"
            checked={state.buffer > 0}
            onChange={setBuffer}
          />
        );
      case "reset":
        return (
          <Button className="danger" onClick={() => setConfirm(true)}>
            Reset demo
          </Button>
        );
      default:
        return null;
    }
  }

  function row(item: SettingItem) {
    if (item.id === "about")
      return (
        <div className="settings-row settings-about" key={item.id}>
          <div>
            <h3>{item.title}</h3>
            <p>
              A higher-education opportunity discovery project for the IBM AI
              Experiential Learning Lab. Built to help students turn scattered
              possibilities into a feasible weekly plan.
            </p>
            <p>Team: Judy, Shuozishan Wang, Chenxi Liu, and Tingting Lai.</p>
            <p>
              All events, student stories, and schedules are fictional. This is
              a student project, not an official university or IBM product. IBM
              Bob development work must be documented separately, and the
              optional watsonx interpreter has not yet been verified with a live
              IBM account.
            </p>
          </div>
        </div>
      );
    return (
      <div key={item.id}>
        <div className="settings-row">
          <div>
            <h3>{item.title}</h3>
            <p>
              {item.id === "timezone"
                ? item.text.replace(
                    "campus time",
                    `campus time (${DEMO.time_zone})`,
                  )
                : item.text}
            </p>
          </div>
          <div className="settings-control">{control(item)}</div>
        </div>
        {item.id === "reset" && confirm ? (
          <div className="notice" role="alert">
            <strong>Reset your demo?</strong>
            <p>
              This clears plans, saved events, chats, and local posts, then
              restores the sample profile.
            </p>
            <div className="row">
              <Button onClick={() => setConfirm(false)}>Keep my changes</Button>
              <Button className="primary" onClick={p.onReset}>
                Confirm reset
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="settings-page">
      <aside className="settings-side">
        <h1>Settings</h1>
        <p className="sub">Customize your Campus Compass demo.</p>
        <label className="settings-search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search settings…"
            aria-label="Search settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((s) => {
            const active = !searching && s.id === section;
            const dim = searching && !results.some((r) => r.id === s.id);
            return (
              <button
                key={s.id}
                className={`${active ? "active" : ""} ${dim ? "dim" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setQuery("");
                  setSection(s.id);
                  setConfirm(false);
                }}
              >
                <Icon name={s.icon} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="settings-main">
        {searching ? (
          <h2 className="settings-title" aria-live="polite">
            {results.length
              ? `Results for “${query.trim()}”`
              : `No settings match “${query.trim()}”`}
          </h2>
        ) : null}
        {shown.map((s) => (
          <section key={s.id} className="settings-section" aria-label={s.label}>
            {searching ? (
              <h3 className="settings-group">
                <Icon name={s.icon} /> {s.label}
              </h3>
            ) : (
              <>
                <h2 className="settings-title">{s.label}</h2>
                <p className="sub settings-blurb">{s.blurb}</p>
              </>
            )}
            <div className="settings-card">{s.items.map(row)}</div>
          </section>
        ))}
        {searching && !results.length ? (
          <p className="sub">
            Try “time zone”, “buffer”, “export” or “reset”.{" "}
            <button className="text-btn inline" onClick={() => setQuery("")}>
              Clear search
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
