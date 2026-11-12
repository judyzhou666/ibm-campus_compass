import { useState, type FormEvent } from "react";
import { Button, Heading, Icon } from "./components.tsx";
import { dayLabel } from "./config.ts";
import { DAYS, TOPICS, time } from "./data.ts";
import {
  DRAFT_ACCESS,
  DRAFT_CATEGORIES,
  DRAFT_FOOD,
  DRAFT_RSVP,
  MAX_DRAFTS,
  draftFromForm,
} from "./eventDrafts.ts";
import type { DemoState } from "./types.ts";

/** Admin-only page: draft a fictional event for team review. */
export function CreateEvent({
  state,
  update,
  notify,
  onSignInAsAdmin,
}: {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => void;
  notify: (message: string) => void;
  onSignInAsAdmin: () => void;
}) {
  const [error, setError] = useState("");
  const isAdmin = state.signedIn && state.role === "admin";

  if (!isAdmin)
    return (
      <>
        <Heading
          title="Create an event"
          description="Event drafting is for Admin identities."
        />
        <section className="panel create-locked">
          <p>Sign in as Admin to draft a fictional event for team review.</p>
          <Button className="primary" onClick={onSignInAsAdmin}>
            Sign in as Admin
          </Button>
        </section>
      </>
    );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.eventDrafts.length >= MAX_DRAFTS) {
      setError(`You can keep up to ${MAX_DRAFTS} drafts. Delete one first.`);
      return;
    }
    const form = e.currentTarget;
    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([k, v]) => [k, String(v)]),
    );
    const result = draftFromForm(
      values,
      `draft-${Date.now().toString(36)}`,
      new Date().toISOString(),
    );
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    update((s) => ({ ...s, eventDrafts: [result.draft, ...s.eventDrafts] }));
    form.reset();
    notify(
      `Draft saved: ${result.draft.title}. It is not published; it stays in this browser for team review.`,
    );
  }

  return (
    <>
      <Heading
        title="Create an event"
        description="Draft a fictional event for team review."
      >
        <span className="role-pill admin">Admin</span>
      </Heading>
      <p className="notice create-note">
        <Icon name="info" />
        <span>
          Drafts stay in this browser. They are not added to Explore Events,
          My Calendar or the AI Planner, which use the shared fictional catalog.
          Catalog changes go through team review.
        </span>
      </p>
      <div className="wide-grid">
        <section className="panel">
          <h2>Event details</h2>
          <form className="form-grid" onSubmit={submit} noValidate>
            <label className="field full">
              Event title
              <input name="title" required maxLength={80} placeholder="AI study circle" />
            </label>
            <label className="field">
              Topic
              <select name="topic" defaultValue={TOPICS[0]}>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Category
              <select name="category" defaultValue="Academic">
                {DRAFT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field full">
              Day
              <select name="day" defaultValue="0">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}, {dayLabel(i)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Starts
              <input name="start" type="time" required defaultValue="15:00" />
            </label>
            <label className="field">
              Ends
              <input name="end" type="time" required defaultValue="16:00" />
            </label>
            <label className="field">
              Location
              <input name="location" required maxLength={60} placeholder="Learning Studio" />
            </label>
            <label className="field">
              Host (optional)
              <input name="host" maxLength={60} placeholder="School of Education" />
            </label>
            <label className="field full">
              Description (optional)
              <textarea name="description" maxLength={400} />
            </label>
            <label className="field">
              Food
              <select name="food" defaultValue="None">
                {DRAFT_FOOD.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Admission ($)
              <input name="cost" type="number" min={0} max={100} step={1} defaultValue={0} />
            </label>
            <label className="field">
              Sign-up
              <select name="rsvp" defaultValue={DRAFT_RSVP[0]}>
                {DRAFT_RSVP.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Who can attend
              <select name="access" defaultValue="open">
                {Object.entries(DRAFT_ACCESS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field full">
              <button className="btn primary">
                <Icon name="plus" /> Save draft
              </button>
              <span role="alert" className="create-error">
                {error}
              </span>
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>Your drafts</h2>
          <p className="sub">
            {state.eventDrafts.length
              ? `${state.eventDrafts.length} of ${MAX_DRAFTS} drafts · not published`
              : "No drafts yet. Saved drafts appear here."}
          </p>
          {state.eventDrafts.map((d) => (
            <div className="block-row draft-row" key={d.id}>
              <div>
                <strong>{d.title}</strong>
                <small>
                  {DAYS[d.day]}, {dayLabel(d.day)} · {time(d.start)}–{time(d.end)} ·{" "}
                  {d.location}
                </small>
                <small>
                  {d.topic} · {d.cost ? `$${d.cost}` : "Free"} · {d.rsvp} ·{" "}
                  {DRAFT_ACCESS[d.access]}
                </small>
                <span className="tag">Draft · Not published</span>
              </div>
              <button
                className="icon-btn"
                aria-label={`Delete draft ${d.title}`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    eventDrafts: s.eventDrafts.filter((x) => x.id !== d.id),
                  }))
                }
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
