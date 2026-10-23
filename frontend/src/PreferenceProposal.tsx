import type { proposalChanges } from "./preferenceProposals.ts";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components.tsx";
export function PreferenceProposal({
  topics,
  changes,
  onOnce,
  onSave,
  onDismiss,
  onManual,
}: {
  topics: string[];
  changes: ReturnType<typeof proposalChanges>;
  onOnce: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onManual: () => void;
}) {
  const [review, setReview] = useState(false);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  return (
    <section className="notice" aria-label="Proposed preference change">
      <h3>Use this for your search or save it?</h3>
      <p>
        Deterministic keyword mapping only:{" "}
        {topics.join(" · ") || "No reliable supported topic found"}. Nothing has
        been saved.
      </p>
      <p>
        This demo recognizes limited interest phrases and keywords; it does not
        understand arbitrary language.
      </p>
      {topics.length ? (
        <>
          <Button onClick={onOnce}>This search only</Button>
          <button
            className="btn"
            ref={reviewTrigger}
            onClick={() => setReview(true)}
          >
            Review and save
          </button>
        </>
      ) : (
        <Button onClick={onManual}>Choose a topic in My Preferences</Button>
      )}
      <Button onClick={onDismiss}>Dismiss</Button>
      {review && (
        <Review
          changes={changes}
          onClose={() => setReview(false)}
          onConfirm={onSave}
          onReturnFocus={() => reviewTrigger.current?.focus()}
        />
      )}
    </section>
  );
}
function Review({
  changes,
  onClose,
  onConfirm,
  onReturnFocus,
}: {
  changes: ReturnType<typeof proposalChanges>;
  onClose: () => void;
  onConfirm: () => void;
  onReturnFocus: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => {
      d.close();
      queueMicrotask(onReturnFocus);
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="proposal-title" onCancel={onClose}>
      <h2 id="proposal-title">Review preference change</h2>
      <p>
        Add confirmed learning topics:{" "}
        {changes.additions.join(", ") || "None — already confirmed"}.
      </p>
      {changes.existing.length > 0 && (
        <p>
          Already confirmed: {changes.existing.join(", ")}. Their existing
          provenance will be preserved.
        </p>
      )}
      <p>
        {changes.alreadyEnabled ? "Keep enabled" : "Enable"} all confirmed
        learning topics for recommendations: {changes.enabledTopics.join(", ")}.
      </p>
      <p>
        Source for newly added topics: Confirmed from a conversation. Use the
        listed topics for future recommendations. Existing notes, plans and
        RSVPs are unchanged. Current draft suggestions reset; search filters and
        saved hard requirements stay in place. You can remove or disable topics
        in My Preferences. Only the listed topic settings change; this does not
        save or infer a budget, location, time requirement or arbitrary note.
      </p>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm}>Confirm and save topics</Button>
    </dialog>
  );
}
