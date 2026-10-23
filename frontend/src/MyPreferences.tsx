import {
  DirectionSection,
  LearningSection,
  ParticipationSection,
  PracticalSection,
  ControlsSection,
} from "./PreferenceSections.tsx";
import type { ReactNode } from "react";
import type { Preferences } from "./preferences.ts";
import { useEffect, useState } from "react";
import { DAYS, TOPICS } from "./data.ts";
import { Button, Heading } from "./components.tsx";
import {
  GUIDANCE,
  PARTICIPATION,
  migratePreferences,
  activeTopics,
} from "./preferences.ts";
import type { DemoState } from "./types.ts";
function editable(s: DemoState) {
  return {
    name: s.name,
    interests: [...s.interests],
    major: s.major,
    goals: s.goals,
    preferred_time: s.preferred_time || "any",
    blocks: structuredClone(s.blocks),
    buffer: s.buffer,
    preferences: migratePreferences(s.preferences),
  };
}
export interface PreferenceEditor {
  draft: ReturnType<typeof editable>;
  change: (value: Partial<ReturnType<typeof editable>>) => void;
  pref: (value: Partial<Preferences>) => void;
  topic: string;
  setTopic: (value: string) => void;
  confirmTopic: (topic: string) => void;
  timeFields: (kind: "block" | "window") => ReactNode;
  confirm: boolean;
  setConfirm: (value: boolean) => void;
  update: (change: (s: DemoState) => DemoState) => void;
  notify: (message: string) => void;
  onClearChat: () => void;
}
export function MyPreferences({
  state,
  update,
  notify,
  onClearChat,
  onDirtyChange,
}: {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => void;
  notify: (s: string) => void;
  onClearChat: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => editable(state));
  const savedKey = JSON.stringify(editable(state));
  useEffect(() => {
    setDraft(editable(state));
  }, [savedKey]);
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const [block, setBlock] = useState({
    title: "",
    day: 0,
    start: "14:00",
    end: "15:00",
  });
  const [window, setWindow] = useState({
    day: 0,
    start: "13:00",
    end: "17:00",
  });
  const [topic, setTopic] = useState(TOPICS[0]);
  const p = draft.preferences,
    dirty = JSON.stringify(draft) !== savedKey;
  useEffect(() => {
    onDirtyChange?.(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty) globalThis.addEventListener("beforeunload", beforeUnload);
    return () => {
      onDirtyChange?.(false);
      globalThis.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, onDirtyChange]);
  const change = (value: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...value }));
  const pref = (value: Partial<typeof p>) =>
    setDraft((d) => ({ ...d, preferences: { ...d.preferences, ...value } }));
  function confirmTopic(t: string) {
    pref({
      learning_topics: [
        ...p.learning_topics.filter((x) => x.topic !== t),
        { topic: t, source: "Added by you" },
      ],
      use_learning: true,
    });
  }
  const minutes = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };
  function addTime(kind: "block" | "window") {
    const value = kind === "block" ? block : window;
    const entry = {
      day: value.day,
      start: minutes(value.start),
      end: minutes(value.end),
    };
    if (
      !Number.isFinite(entry.start) ||
      !Number.isFinite(entry.end) ||
      entry.start >= entry.end
    ) {
      setError("Choose an end time later than the start time.");
      return;
    }
    if (kind === "block") {
      if (!block.title.trim()) {
        setError("Enter a commitment title.");
        return;
      }
      if (draft.blocks.length >= 100) {
        setError("Remove a commitment before adding another.");
        return;
      }
      change({
        blocks: [
          ...draft.blocks,
          { ...entry, id: crypto.randomUUID(), title: block.title.trim() },
        ],
      });
      setBlock({ ...block, title: "" });
    } else {
      if (p.windows.length >= 20) {
        setError("Remove a window before adding another.");
        return;
      }
      pref({ windows: [...p.windows, entry] });
    }
    setError("");
  }
  function timeFields(kind: "block" | "window") {
    const value = kind === "block" ? block : window;
    const set = (v: Partial<typeof value>) =>
      kind === "block"
        ? setBlock((b) => ({ ...b, ...v }))
        : setWindow((w) => ({ ...w, ...v }));
    return (
      <div className="form-grid">
        {kind === "block" && (
          <label className="field full">
            Commitment title
            <input
              maxLength={60}
              value={block.title}
              onChange={(e) => setBlock({ ...block, title: e.target.value })}
            />
          </label>
        )}
        <label className="field">
          {kind === "block" ? "Busy" : "Available-only"} day
          <select
            value={value.day}
            onChange={(e) => set({ day: +e.target.value })}
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {kind === "block" ? "Busy" : "Available-only"} from
          <input
            type="time"
            value={value.start}
            onChange={(e) => set({ start: e.target.value })}
          />
        </label>
        <label className="field">
          {kind === "block" ? "Busy" : "Available-only"} until
          <input
            type="time"
            value={value.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </label>
        <Button onClick={() => addTime(kind)}>
          Add {kind === "block" ? "busy commitment" : "available-only window"}
        </Button>
      </div>
    );
  }
  const editor: PreferenceEditor = {
    draft,
    change,
    pref,
    topic,
    setTopic,
    confirmTopic,
    timeFields,
    confirm,
    setConfirm,
    update,
    notify,
    onClearChat,
  };
  return (
    <>
      <Heading
        title="My Preferences"
        description="Shape your campus experience around what matters to you."
      />
      <p>Skip any question and change your preferences anytime.</p>
      <div className="preferences-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => ({
              ...s,
              ...draft,
              preferences: migratePreferences(p),
              onboarded: true,
              draft: [],
              constraints: {},
            }));
            setError("");
            notify(
              "Preferences saved. Suggestions will use these choices; your planned events are preserved.",
            );
          }}
        >
          <DirectionSection editor={editor} />
          <LearningSection editor={editor} />
          <ParticipationSection editor={editor} />
          <PracticalSection editor={editor} />
          <ControlsSection editor={editor} />
          <div role="alert">{error}</div>
          <div className="preference-actions">
            <button className="btn primary" type="submit" disabled={!dirty}>
              Save changes
            </button>
            <Button
              onClick={() => {
                if (
                  dirty &&
                  !globalThis.confirm(
                    "Discard unsaved preference changes? Recommendations still use your saved choices.",
                  )
                )
                  return;
                setDraft(editable(state));
                setError("");
                notify("Unsaved changes discarded.");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
        <aside
          className="panel preference-summary"
          aria-label="Preference summary"
        >
          <h2>Your choices</h2>
          <p role="status">
            {dirty ? "Unsaved changes — preview only" : "Saved preferences"}
          </p>
          <p>
            Recommendations keep using your saved preferences until you select
            Save changes.
          </p>
          <h3>Topics</h3>
          <p>
            {activeTopics({ ...state, ...draft }).join(" · ") ||
              "General browsing"}
          </p>
          <p>
            {p.learning_topics.length} confirmed learning topics;{" "}
            {p.use_learning ? "enabled" : "disabled"}.
          </p>
          <p>
            {GUIDANCE[p.guidance]} · Up to {p.count} suggestions
          </p>
          <p>
            {p.participation
              .map((t) => PARTICIPATION[t as keyof typeof PARTICIPATION])
              .join(" · ") || "No participation preference"}
          </p>
          <p>
            {p.free_only
              ? "Free admission only"
              : "No saved admission-cost filter"}{" "}
            · {p.windows.length} available-only windows
          </p>
          <p>
            {draft.blocks.length} entered commitments · {draft.buffer}-minute
            travel buffer
          </p>
          <p>
            Saving may change future suggestions. Existing chosen events stay in
            your calendar; review any new conflicts there.
          </p>
        </aside>
      </div>
    </>
  );
}
