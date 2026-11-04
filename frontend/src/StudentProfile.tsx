import { useEffect, useRef, useState } from "react";
import { Button, Heading } from "./components.tsx";
import { COMMUNITIES } from "./communities.ts";
import { EVENTS } from "./data.ts";
import {
  profileInitials,
  readStudentProfile,
  saveStudentProfile,
} from "./studentProfile.ts";
import type { DemoState } from "./types.ts";

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="avatar student-avatar"
      role="img"
      aria-label={`Initials avatar for ${name}`}
    >
      {profileInitials(name)}
    </span>
  );
}
function Interests({ state }: { state: DemoState }) {
  return state.interests.length ? (
    <div className="student-interest-tags">
      {state.interests.map((topic) => (
        <span className="tag" key={topic}>
          {topic}
        </span>
      ))}
    </div>
  ) : (
    <p className="sub">No interests selected yet.</p>
  );
}
export function StudentProfileCard({
  state,
  onView,
}: {
  state: DemoState;
  onView: () => void;
}) {
  const profile = readStudentProfile(state.studentProfile);
  return (
    <section className="student-profile-card" aria-label="Student profile">
      <div className="student-identity">
        <Avatar name={state.name} />
        <div>
          <strong>{state.name}</strong>
          <small>{profile.status || "Status not added"}</small>
        </div>
      </div>
      <p className="student-university">
        {profile.university || "University not added"}
      </p>
      <p className="student-card-bio">
        {profile.bio || "Add a short bio to introduce yourself."}
      </p>
      <Interests state={state} />
      <span className="fineprint">Demo profile</span>
      <Button onClick={onView}>View Profile</Button>
    </section>
  );
}

export function StudentProfilePage({
  state,
  update,
  notify,
  onPreferences,
  onActivity,
  onDirtyChange,
}: {
  state: DemoState;
  update: (fn: (state: DemoState) => DemoState) => void;
  notify: (text: string) => void;
  onPreferences: () => void;
  onActivity: (page: "saved" | "calendar") => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: state.name,
    ...readStudentProfile(state.studentProfile),
  }));
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const profile = readStudentProfile(state.studentProfile);
  const dirty =
    editing &&
    JSON.stringify(draft) !== JSON.stringify({ name: state.name, ...profile });
  useEffect(() => {
    onDirtyChange(dirty);
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    if (dirty) globalThis.addEventListener("beforeunload", warn);
    return () => {
      onDirtyChange(false);
      globalThis.removeEventListener("beforeunload", warn);
    };
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);
  function finish() {
    setEditing(false);
    setError("");
    onDirtyChange(false);
    requestAnimationFrame(() => editRef.current?.focus());
  }
  const communities = COMMUNITIES.filter((c) =>
    state.joinedCommunities.includes(c.id),
  );
  const planned = EVENTS.filter((e) => state.plan.includes(e.id));
  const saved = EVENTS.filter((e) => state.saved.includes(e.id));
  return (
    <>
      <Heading
        title="My Profile"
        description="Your introduction and a snapshot of your campus experience."
      >
        {!editing && (
          <button
            ref={editRef}
            className="btn primary"
            onClick={() => {
              setDraft({ name: state.name, ...profile });
              setEditing(true);
            }}
          >
            Edit Profile
          </button>
        )}
      </Heading>
      <section
        className="panel student-profile-hero"
        aria-label="Profile overview"
      >
        <Avatar name={state.name} />
        <div>
          <h2>{state.name}</h2>
          <p>
            {profile.status || "Status not added"} ·{" "}
            {profile.university || "University not added"}
          </p>
          <span className="tag">Demo profile</span>
        </div>
      </section>
      <p className="fineprint">
        This is a fictional classroom profile, not a verified student record.
        Profile edits are saved in this browser. Use fictional details.
      </p>
      <form
        className="student-profile-grid"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            update((latest) => saveStudentProfile(latest, draft.name, draft));
            finish();
            notify(
              "Profile saved. Preferences and campus plans are unchanged.",
            );
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not save profile.",
            );
            nameRef.current?.focus();
          }
        }}
      >
        <section className="panel">
          <h2>Basic Information</h2>
          {editing ? (
            <>
              <label className="field">
                Display name
                <input
                  ref={nameRef}
                  value={draft.name}
                  required
                  maxLength={30}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field">
                Student status
                <input
                  value={draft.status}
                  maxLength={60}
                  placeholder="Optional"
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                />
              </label>
              <label className="field">
                University
                <input
                  value={draft.university}
                  maxLength={120}
                  placeholder="Optional"
                  onChange={(e) =>
                    setDraft({ ...draft, university: e.target.value })
                  }
                />
              </label>
            </>
          ) : (
            <dl className="student-details">
              <dt>Display name</dt>
              <dd>{state.name}</dd>
              <dt>Student status</dt>
              <dd>{profile.status || "Not added"}</dd>
              <dt>University</dt>
              <dd>{profile.university || "Not added"}</dd>
              <dt>Major / interdisciplinary interests</dt>
              <dd>{state.major || "Not added"}</dd>
            </dl>
          )}
        </section>
        <section className="panel">
          <h2>About Me</h2>
          {editing ? (
            <div className="field">
              <label htmlFor="student-bio">Short bio (optional)</label>
              <textarea
                id="student-bio"
                aria-describedby="student-bio-count"
                value={draft.bio}
                maxLength={280}
                rows={5}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
              <small id="student-bio-count">
                {draft.bio.length}/280 characters
              </small>
            </div>
          ) : (
            <p className="student-bio">
              {profile.bio ||
                "No bio added yet. Use Edit Profile to share a little about yourself."}
            </p>
          )}
        </section>
        <section className="panel student-profile-wide">
          <h2>My Interests</h2>
          <Interests state={state} />
          <p className="sub">
            These tags reflect your saved interests. Manage interests and
            recommendation settings in My Preferences.
          </p>
          <Button onClick={onPreferences}>
            Edit interests in My Preferences
          </Button>
        </section>
        <section className="panel">
          <h2>Campus Involvement</h2>
          <p className="sub">Your joined fictional demo communities.</p>
          {communities.length ? (
            <ul>
              {communities.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          ) : (
            <p>You haven’t joined any demo communities yet.</p>
          )}
        </section>
        <section className="panel">
          <h2>My Activity</h2>
          <p className="sub">
            Saved and planned activity, not a record of attendance.
          </p>
          <dl className="student-details">
            <dt>Saved events</dt>
            <dd>{saved.length}</dd>
            <dt>Planned events</dt>
            <dd>{planned.length}</dd>
            <dt>Demo RSVP records</dt>
            <dd>
              {
                state.rsvps.filter((id) => planned.some((e) => e.id === id))
                  .length
              }
            </dd>
          </dl>
          {planned.length > 0 && (
            <ul>
              {planned.map((e) => (
                <li key={e.id}>
                  {e.title}
                  {state.cancelled.includes(e.id) ? " · Cancelled" : ""}
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <Button onClick={() => onActivity("saved")}>
              View saved events
            </Button>
            <Button onClick={() => onActivity("calendar")}>
              View my calendar
            </Button>
          </div>
        </section>
        {editing && (
          <div className="panel student-profile-wide student-edit-actions">
            <p role="status">
              {dirty ? "Unsaved profile changes" : "No profile changes yet"}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="row">
              <button className="btn primary" type="submit">
                Save Profile
              </button>
              <Button
                onClick={() => {
                  if (
                    dirty &&
                    !globalThis.confirm("Discard unsaved profile changes?")
                  )
                    return;
                  finish();
                  notify("Profile edits cancelled.");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
