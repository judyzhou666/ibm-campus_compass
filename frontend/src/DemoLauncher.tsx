import { useEffect, useRef, useState } from "react";
import { Button } from "./components.tsx";
import { EVENTS, when } from "./data.ts";
import { GUIDED_PROMPT } from "./demoScenario.ts";
import type { DemoState } from "./types.ts";
function PrepareDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onCancel} aria-labelledby="scenario-title">
      <h2 id="scenario-title">Prepare a fictional student journey?</h2>
      <p>
        This replaces the current browser-local demo with a first-semester
        graduate profile, AI/career/social interests and limited availability.
        It never adds events or confirms RSVP. Your current state will be
        archived in this browser; use Restore previous demo to return.
      </p>
      <div className="row">
        <Button onClick={onCancel}>Keep current demo</Button>
        <Button onClick={onConfirm}>Prepare guided demo</Button>
      </div>
    </dialog>
  );
}
export function DemoLauncher({
  state,
  onPrepare,
  onRestore,
  onPlan,
  onCancel,
  onReplace,
  onExport,
  busy,
}: {
  state: DemoState;
  onPrepare: () => boolean;
  onRestore: () => void;
  onPlan: (text: string) => void;
  onCancel: () => void;
  onReplace: () => void;
  onExport: () => void;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const active = state.plan.filter((id) => !state.cancelled.includes(id));
  const affected = state.plan.filter((id) => state.cancelled.includes(id));
  return (
    <section className="panel demo-launcher">
      <h2>Demo Scenario Launcher</h2>
      <p className="fineprint">
        Three-minute journey · Fictional first-semester graduate student · No
        live AI
      </p>
      <details>
        <summary>Student context and limited availability</summary>
        <p>
          {state.name} · {state.major || "Major optional"}
        </p>
        <p>
          Selected interests:{" "}
          {state.interests.join(" · ") || "Explore any topic"}. Preferred time:{" "}
          {state.preferred_time || "any"}. Free-text goals are not interpreted.
        </p>
        <ul>
          {state.blocks.map((b) => (
            <li key={b.id}>
              {b.title}: {when(b)}
            </li>
          ))}
        </ul>
      </details>
      <ol>
        <li>
          Prepare the sample profile and inspect interests / busy classes in
          Profile.
        </li>
        <li>
          Request a balanced plan; read evidence and details below. Add choices
          individually; approve any required demo RSVP.
        </li>
        <li>
          Simulate a cancellation, inspect affected choices and request a
          replacement. Review its trade-offs before approving.
        </li>
        <li>
          Export the final calendar. Restore your previous demo or prepare again
          to reset.
        </li>
      </ol>
      <p>
        Chosen: {active.length}. Affected:{" "}
        {affected
          .map((id) => EVENTS.find((e) => e.id === id)?.title)
          .join(", ") || "none"}
        .
      </p>
      <div className="row">
        <Button disabled={busy} onClick={() => setConfirm(true)}>
          Prepare scenario
        </Button>
        <Button disabled={busy} onClick={() => onPlan(GUIDED_PROMPT)}>
          Recommend across interests
        </Button>
        <Button disabled={busy || !active.length} onClick={onCancel}>
          Simulate cancellation
        </Button>
        <Button disabled={busy || !affected.length} onClick={onReplace}>
          Suggest replacement
        </Button>
        <Button disabled={!active.length} onClick={onExport}>
          Export final calendar
        </Button>
        <Button disabled={busy} onClick={onRestore}>
          Restore previous demo
        </Button>
      </div>
      {confirm && (
        <PrepareDialog
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            if (onPrepare()) setConfirm(false);
          }}
        />
      )}
    </section>
  );
}
