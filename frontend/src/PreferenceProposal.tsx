import { useEffect, useRef, useState } from "react";
import { Button } from "./components.tsx";
export function PreferenceProposal({
  topics,
  onOnce,
  onSave,
  onDismiss,
  onManual,
}: {
  topics: string[];
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
        Simulated topic mapping:{" "}
        {topics.join(" · ") || "No reliable supported topic found"}. Nothing has
        been saved.
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
          topics={topics}
          onClose={() => setReview(false)}
          onConfirm={onSave}
          onReturnFocus={() => reviewTrigger.current?.focus()}
        />
      )}
    </section>
  );
}
function Review({
  topics,
  onClose,
  onConfirm,
  onReturnFocus,
}: {
  topics: string[];
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
      <p>Add these confirmed learning topics: {topics.join(", ")}.</p>
      <p>
        Source: Confirmed from a conversation. Enable these topics for future
        recommendations. Existing notes, plans and RSVPs are unchanged. Current
        draft/search filters reset so future suggestions use your new choices.
        You can remove or disable them in My Preferences.
      </p>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm}>Confirm and save topics</Button>
    </dialog>
  );
}
