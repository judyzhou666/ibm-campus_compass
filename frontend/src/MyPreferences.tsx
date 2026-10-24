import { newBusyConflicts, busyConflictWarning } from "./busyCommitments.ts";
import {
  DirectionSection,
  LearningSection,
  ParticipationSection,
  PracticalSection,
  ControlsSection,
} from "./PreferenceSections.tsx";
import type { ReactNode } from "react";
import type { Preferences } from "./preferences.ts";
import { useEffect, useRef, useState } from "react";
import { DAYS, TOPICS } from "./data.ts";
import { Button, Heading } from "./components.tsx";
import {
  GUIDANCE,
  PARTICIPATION,
  migratePreferences,
  activeTopics,
} from "./preferences.ts";
import type { DemoState } from "./types.ts";
const EMPTY_BLOCK = { title: "", day: 0, start: "14:00", end: "15:00" };
const EMPTY_WINDOW = { day: 0, start: "13:00", end: "17:00" };
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
  brief = false,
  onSkip,
  onFull,
}: {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => void;
  notify: (s: string) => void;
  onClearChat: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  brief?: boolean;
  onSkip?: () => void;
  onFull?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!brief) return;
    const d = dialogRef.current!;
    d.showModal();
    const heading = d.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    return () => {
      d.close();
      queueMicrotask(() => document.getElementById("main")?.focus());
    };
  }, [brief]);
  const [draft, setDraft] = useState(() => editable(state));
  const savedKey = JSON.stringify(editable(state));
  useEffect(() => {
    setDraft(editable(state));
  }, [savedKey]);
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const [block, setBlock] = useState(() => ({ ...EMPTY_BLOCK }));
  const [window, setWindow] = useState(() => ({ ...EMPTY_WINDOW }));
  const [blockBaseline, setBlockBaseline] = useState(() => ({
    ...EMPTY_BLOCK,
  }));
  const [windowBaseline, setWindowBaseline] = useState(() => ({
    ...EMPTY_WINDOW,
  }));
  const pendingBlock = JSON.stringify(block) !== JSON.stringify(blockBaseline);
  const pendingWindow =
    JSON.stringify(window) !== JSON.stringify(windowBaseline);
  function clearEntry(kind: "block" | "window") {
    if (kind === "block") {
      setBlock({ ...EMPTY_BLOCK });
      setBlockBaseline({ ...EMPTY_BLOCK });
    } else {
      setWindow({ ...EMPTY_WINDOW });
      setWindowBaseline({ ...EMPTY_WINDOW });
    }
  }
  const [topic, setTopic] = useState(TOPICS[0]);
  const p = draft.preferences,
    dirty = JSON.stringify(draft) !== savedKey || pendingBlock || pendingWindow;
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
    if (!TOPICS.includes(t)) return;
    pref({
      learning_topics: [
        ...p.learning_topics.filter((x) => x.topic !== t),
        p.learning_topics.find((x) => x.topic === t) ?? {
          topic: t,
          source: "Added by you",
        },
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
      const nextBlock = { ...block, title: "" };
      setBlock(nextBlock);
      setBlockBaseline(nextBlock);
    } else {
      if (p.windows.length >= 20) {
        setError("Remove a window before adding another.");
        return;
      }
      pref({ windows: [...p.windows, entry] });
      setWindowBaseline({ ...window });
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
              id="busy-commitment-title"
              maxLength={60}
              value={block.title}
              onChange={(e) => setBlock({ ...block, title: e.target.value })}
            />
          </label>
        )}
        <label className="field">
          {kind === "block" ? "Busy" : "Available-only"} day
          <select
            id={kind === "window" ? "available-window-day" : undefined}
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
        <Button
          onClick={() => {
            clearEntry(kind);
            setError("");
          }}
        >
          Clear {kind === "block" ? "busy" : "available-only"} entry
        </Button>
      </div>
    );
  }
  const conflicts = newBusyConflicts(state, draft.blocks, draft.buffer);
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
  function skipSetup() {
    if (
      dirty &&
      !globalThis.confirm(
        "Skip setup and discard unsaved changes? Your saved preferences will stay unchanged.",
      )
    )
      return;
    onSkip?.();
    notify(
      "Setup skipped. Your existing preferences are unchanged; open My Preferences anytime.",
    );
  }
  const content = (
    <>
      <Heading
        title={brief ? "Quick preference setup" : "My Preferences"}
        description={
          brief
            ? "Choose what helps, or skip for now."
            : "Shape your campus experience around what matters to you."
        }
      />
      <p>Skip any question and change your preferences anytime.</p>
      {brief && (
        <p id="quick-setup-help">
          These are your current saved or sample choices. Save applies edits;
          Skip for now keeps existing preferences. Full preferences are
          available later.
        </p>
      )}
      {brief && <Button onClick={skipSetup}>Skip for now</Button>}
      {brief && (
        <p role="status">
          {dirty
            ? "Unsaved choices — recommendations still use saved preferences."
            : "Current choices — nothing changed."}
        </p>
      )}
      <div
        className={`preferences-layout ${brief ? "preference-setup-layout" : ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingBlock || pendingWindow) {
              setError(
                "Add or clear the unfinished busy commitment or available-only window before saving.",
              );
              document
                .getElementById(
                  pendingBlock
                    ? "busy-commitment-title"
                    : "available-window-day",
                )
                ?.focus();
              return;
            }
            let saved = false;
            update((s) => {
              const latestConflicts = newBusyConflicts(
                s,
                draft.blocks,
                draft.buffer,
              );
              if (
                latestConflicts.length &&
                !globalThis.confirm(busyConflictWarning(latestConflicts))
              )
                return s;
              saved = true;
              return {
                ...s,
                ...draft,
                preferences: migratePreferences(p),
                onboarded: true,
                draft: [],
                constraints: {},
              };
            });
            if (!saved) {
              notify(
                "Busy commitment not saved. Your draft is still available; planned events and RSVP records are unchanged.",
              );
              return;
            }
            setError("");
            notify(
              brief
                ? "Quick setup saved. You can edit My Preferences anytime."
                : "Preferences saved. Suggestions will use these choices; your planned events are preserved.",
            );
          }}
        >
          <DirectionSection editor={editor} brief={brief} />
          {!brief && <LearningSection editor={editor} />}
          <ParticipationSection editor={editor} brief={brief} />
          {!brief && <PracticalSection editor={editor} />}
          {!brief && <ControlsSection editor={editor} />}
          {conflicts.length > 0 && (
            <div
              className="notice"
              role="status"
              aria-label="Unsaved busy-time conflicts"
            >
              <strong>
                Your busy commitment conflicts with planned events.
              </strong>
              <ul>
                {conflicts.map(({ event, blocks }) => (
                  <li key={event.id}>
                    {event.title} — {blocks.map((b) => b.title).join(", ")}
                  </li>
                ))}
              </ul>
              <p>
                Save changes will ask for confirmation. Planned events and RSVP
                records will remain; you can review or explicitly remove an
                event in your calendar.
              </p>
            </div>
          )}
          <div role="alert">{error}</div>
          <div className="preference-actions">
            <button
              className="btn primary"
              type="submit"
              disabled={!dirty && !brief}
            >
              {brief ? "Save quick setup" : "Save changes"}
            </button>
            {!brief && (
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
                  clearEntry("block");
                  clearEntry("window");
                  setError("");
                  notify("Unsaved changes discarded.");
                }}
              >
                Cancel
              </Button>
            )}
            {brief && (
              <>
                <Button
                  onClick={() => {
                    if (
                      dirty &&
                      !globalThis.confirm(
                        "Discard unsaved setup choices and open full preferences?",
                      )
                    )
                      return;
                    onFull?.();
                    notify(
                      dirty
                        ? "Full preferences opened. Unsaved setup choices were not saved."
                        : "Full preferences opened. Nothing was changed.",
                    );
                  }}
                >
                  Open full preferences
                </Button>
                <Button onClick={skipSetup}>Use sample preferences</Button>
              </>
            )}
          </div>
        </form>
        {!brief && (
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
            <p className="fineprint">
              Suggestion count is a display limit, not an attendance target.
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
              Saving may change future suggestions. Existing chosen events stay
              in your calendar; review any new conflicts there.
            </p>
          </aside>
        )}
      </div>
    </>
  );
  return brief ? (
    <dialog
      ref={dialogRef}
      aria-label="Quick preference setup"
      aria-describedby="quick-setup-help"
      onCancel={(event) => {
        event.preventDefault();
        skipSetup();
      }}
    >
      {content}
    </dialog>
  ) : (
    content
  );
}
