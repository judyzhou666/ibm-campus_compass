import { useEffect, useRef } from "react";
import { Button, Icon } from "./components.tsx";

/** First-visit dialog: personalize the demo or keep the default preferences. */
export function Welcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="welcome-dialog"
      aria-labelledby="welcome-title"
      onCancel={onSkip}
    >
      <button
        type="button"
        className="welcome-close icon-btn"
        aria-label="Close and use default preferences"
        onClick={onSkip}
      >
        <Icon name="close" />
      </button>
      <h2 id="welcome-title">Make campus feel more familiar.</h2>
      <p>
        Personalize academic, research, career, social and cultural interests
        and preferred times. No career goal is required. Your fictional profile
        stays in this browser unless you opt in to profile-based IBM watsonx
        ranking in My Preferences.
      </p>
      <div className="row">
        <Button onClick={onStart}>Personalize my demo</Button>
        <Button onClick={onSkip}>Default Preference</Button>
      </div>
    </dialog>
  );
}
