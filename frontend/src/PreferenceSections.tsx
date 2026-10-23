import type { PreferenceEditor } from "./MyPreferences.tsx";
import { DAYS, TOPICS, time, when } from "./data.ts";
import { DEMO } from "./config.ts";
import { Button } from "./components.tsx";
import {
  GOALS,
  GUIDANCE,
  PARTICIPATION,
  clearPersonalization,
  suggestedTopics,
} from "./preferences.ts";
import type { Block, TimeSlot } from "./types.ts";

export function DirectionSection({ editor }: { editor: PreferenceEditor }) {
  const { draft, change, pref } = editor;
  const p = draft.preferences;
  return (
    <section className="panel preference-section">
      <h2>A. My Direction</h2>
      <h3>What would you like to explore right now?</h3>
      <p>
        Select more than one goal, or choose Not sure yet on its own. A primary
        goal is optional.
      </p>
      <p>
        Structured goals affect recommendations only when enabled in
        Personalization Controls. Raw notes stay local.
      </p>
      <div className="topic-options">
        {Object.entries(GOALS).map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={p.goals.includes(id)}
              onChange={() => {
                const goals =
                  id === "unsure"
                    ? p.goals.includes(id)
                      ? []
                      : ["unsure"]
                    : p.goals.includes(id)
                      ? p.goals.filter((g) => g !== id)
                      : [...p.goals.filter((g) => g !== "unsure"), id];
                pref({
                  goals,
                  primary_goal: goals.includes(p.primary_goal)
                    ? p.primary_goal
                    : "",
                });
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <label className="field">
        Primary goal (optional)
        <select
          value={p.primary_goal}
          onChange={(e) => pref({ primary_goal: e.target.value })}
        >
          <option value="">No preference</option>
          {p.goals
            .filter((g) => g !== "unsure")
            .map((g) => (
              <option key={g} value={g}>
                {GOALS[g as keyof typeof GOALS]}
              </option>
            ))}
        </select>
      </label>
      <fieldset>
        <legend>Interests / topics</legend>
        <div className="topic-options">
          {TOPICS.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={draft.interests.includes(t)}
                onChange={() =>
                  change({
                    interests: draft.interests.includes(t)
                      ? draft.interests.filter((x) => x !== t)
                      : [...draft.interests, t],
                  })
                }
              />
              {t}
            </label>
          ))}
        </div>
        <p>
          No topics selected means general browsing. Social, cultural and
          wellbeing interests are equally welcome.
        </p>
      </fieldset>
      <label className="field">
        Something else / custom interest (optional)
        <input
          maxLength={240}
          value={p.custom_interest}
          onChange={(e) => pref({ custom_interest: e.target.value })}
        />
      </label>
      <label className="field">
        Why does this matter to you right now?
        <textarea
          aria-describedby="reflection-help"
          maxLength={240}
          value={p.why}
          onChange={(e) => pref({ why: e.target.value })}
        />
      </label>
      <p className="fineprint" id="reflection-help">
        Optional. Reflection and custom text remain local notes. They are not
        interpreted or sent for recommendations.
      </p>
      <label className="field">
        Demo display name
        <input
          maxLength={30}
          value={draft.name}
          onChange={(e) => change({ name: e.target.value })}
        />
      </label>
      <label className="field">
        Major or interdisciplinary interests (optional)
        <input
          maxLength={120}
          value={draft.major}
          onChange={(e) => change({ major: e.target.value })}
        />
      </label>
      <label className="field">
        Research / career exploration goals (optional)
        <input
          maxLength={240}
          value={draft.goals}
          onChange={(e) => change({ goals: e.target.value })}
        />
      </label>
      <p className="fineprint">
        Existing major/goals notes are retained locally; no career goal is
        required and raw notes do not affect matching.
      </p>
    </section>
  );
}

export function LearningSection({ editor }: { editor: PreferenceEditor }) {
  const { draft, pref, topic, setTopic, confirmTopic } = editor;
  const p = draft.preferences;
  return (
    <section className="panel preference-section">
      <h2>B. My Learning Connections</h2>
      <h3>Connect what you’re learning with what you explore.</h3>
      <label className="field">
        What have you been learning or trying recently?
        <textarea
          maxLength={500}
          aria-describedby="learning-notes-help"
          placeholder="A concept, tool or topic — course names are optional"
          value={p.learning_note}
          onChange={(e) => pref({ learning_note: e.target.value })}
        />
      </label>
      <label className="field">
        What would you like to explore next?
        <textarea
          maxLength={500}
          aria-describedby="learning-notes-help"
          value={p.next_note}
          onChange={(e) => pref({ next_note: e.target.value })}
        />
      </label>
      <p id="learning-notes-help">
        These optional notes stay in this browser and do not become
        recommendation topics. Choose a supported topic below to use this in
        recommendations.
      </p>
      <p className="fineprint">
        Please do not share grades, assignments or confidential course
        materials. Arbitrary text is not semantically understood.
      </p>
      {suggestedTopics(p.learning_note + " " + p.next_note).length > 0 && (
        <div className="notice">
          Limited keyword suggestions, not an understanding of arbitrary notes:{" "}
          {suggestedTopics(p.learning_note + " " + p.next_note).map((t) => (
            <Button key={t} onClick={() => confirmTopic(t)}>
              Confirm {t}
            </Button>
          ))}
        </div>
      )}
      <label className="field">
        Learning topic to confirm
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <Button onClick={() => confirmTopic(topic)}>
        Confirm topic for recommendations
      </Button>
      <p>
        Confirming adds a topic to this draft and enables learning connections.
        Select Save changes to apply it to recommendations; Cancel discards the
        change.
      </p>
      {!p.learning_topics.length && <p>No confirmed learning topics.</p>}
      <ul aria-label="Confirmed learning topics">
        {p.learning_topics.map((t) => (
          <li key={t.topic}>
            {t.topic} — {t.source}{" "}
            <Button
              onClick={() => {
                if (
                  !globalThis.confirm(
                    `Remove the confirmed ${t.topic} topic from this draft? Notes will remain. Save changes to apply removal.`,
                  )
                )
                  return;
                pref({
                  learning_topics: p.learning_topics.filter(
                    (x) => x.topic !== t.topic,
                  ),
                });
              }}
            >
              Remove {t.topic}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => {
          if (
            !globalThis.confirm(
              "Remove learning notes and confirmed topics from this draft? Save changes to apply removal, or Cancel to keep saved data.",
            )
          )
            return;
          pref({
            learning_note: "",
            next_note: "",
            learning_topics: [],
            use_learning: false,
          });
        }}
      >
        Remove learning notes and topics
      </Button>
    </section>
  );
}

export function ParticipationSection({ editor }: { editor: PreferenceEditor }) {
  const { draft, pref } = editor;
  const p = draft.preferences;
  return (
    <section className="panel preference-section">
      <h2>C. My Participation &amp; Support</h2>
      <p>
        Optional. Choose any formats that suit you, or select No preference on
        its own. You can change these choices anytime.
      </p>
      <fieldset aria-describedby="participation-help">
        <legend>How would you like to participate?</legend>
        <p id="participation-help">
          You can select more than one. Choosing a format clears No preference;
          choosing No preference clears the other formats.
        </p>
        <div className="topic-options">
          {Object.entries(PARTICIPATION).map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={p.participation.includes(id)}
                onChange={() =>
                  pref({
                    participation: p.participation.includes(id)
                      ? p.participation.filter((x) => x !== id)
                      : [...p.participation, id],
                  })
                }
              />
              {label}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={!p.participation.length}
              onChange={() => pref({ participation: [] })}
            />
            No preference
          </label>
        </div>
      </fieldset>
      <label className="field">
        What kind of guidance would help?
        <select
          value={p.guidance}
          onChange={(e) =>
            pref({ guidance: e.target.value as typeof p.guidance })
          }
        >
          {Object.entries(GUIDANCE).map(([id, label]) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        How many suggestions would you like to consider at a time?
        <select
          value={p.count}
          aria-describedby="result-count-help"
          onChange={(e) => pref({ count: +e.target.value as 1 | 3 | 5 })}
        >
          {[1, 3, 5].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <p id="result-count-help">
        This limits suggestions shown, not attendance. You can decline every
        suggestion; there is no weekly quota or workload estimate.
      </p>
    </section>
  );
}

export function PracticalSection({ editor }: { editor: PreferenceEditor }) {
  const { draft, change, pref, timeFields } = editor;
  const p = draft.preferences;
  return (
    <section className="panel preference-section">
      <h2>D. My Time &amp; Practical Needs</h2>
      <p>
        {DEMO.time_zone}. Busy commitments are hard exclusions. Your timetable
        helps avoid conflicts. It does not tell us what you learned.
      </p>
      <label className="field">
        Preferred event time
        <select
          value={draft.preferred_time}
          onChange={(e) => change({ preferred_time: e.target.value })}
        >
          {["any", "morning", "afternoon", "evening"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <p>Preferred times affect ranking, not eligibility.</p>
      <label className="rsvp-check">
        <input
          type="checkbox"
          checked={draft.buffer === 15}
          onChange={(e) => change({ buffer: e.target.checked ? 15 : 0 })}
        />
        Keep a 15-minute travel buffer (hard conflict check)
      </label>
      <label className="rsvp-check">
        <input
          type="checkbox"
          checked={p.free_only}
          onChange={(e) => pref({ free_only: e.target.checked })}
        />
        Only free admission (hard requirement)
      </label>
      <p>
        Numeric budgets are not supported. Current chat requests cannot override
        saved hard requirements.
      </p>
      <h3>Busy commitments</h3>
      {draft.blocks.map((b: Block) => (
        <div className="block-row" key={b.id}>
          <span>
            {b.title} · {when(b)}
          </span>
          <Button
            onClick={() =>
              change({
                blocks: draft.blocks.filter((x) => x.id !== b.id),
              })
            }
          >
            Remove {b.title}
          </Button>
        </div>
      ))}
      {timeFields("block")}
      <h3>Available-only windows (optional hard requirement)</h3>
      <p>
        If any windows are saved, an event must fit entirely within at least
        one. An empty calendar alone does not verify availability.
      </p>
      {p.windows.map((w: TimeSlot, i) => (
        <div className="block-row" key={i}>
          <span>
            {DAYS[w.day]} {time(w.start)}–{time(w.end)}
          </span>
          <Button
            onClick={() =>
              pref({ windows: p.windows.filter((_, j) => j !== i) })
            }
          >
            Remove window {i + 1}
          </Button>
        </div>
      ))}
      {timeFields("window")}
      <label className="field">
        Location preference (local note only)
        <input
          maxLength={500}
          value={p.location_note}
          onChange={(e) => pref({ location_note: e.target.value })}
        />
      </label>
      <label className="field">
        Participation format note (local only)
        <input
          maxLength={500}
          value={p.format_note}
          onChange={(e) => pref({ format_note: e.target.value })}
        />
      </label>
      <p>
        These notes are not filters. Only explicit fictional participation
        metadata can affect ranking; unknown formats are never inferred.
      </p>
    </section>
  );
}

export function ControlsSection({ editor }: { editor: PreferenceEditor }) {
  const { draft, pref, confirm, setConfirm, update, notify, onClearChat } =
    editor;
  const p = draft.preferences;
  return (
    <section className="panel preference-section">
      <h2>E. My Personalization Controls</h2>
      <p>
        Not for me hides an event from future suggestions in this browser.
        Restore hidden events below. Show another skips only for the current
        search session.
      </p>
      <p>
        Saved interests, enabled structured goals, enabled confirmed learning
        topics, participation choices, preferred time and practical settings
        influence selection. Guidance and result count control presentation.
        Busy commitments and travel buffer support conflict checking, not
        knowledge of what you learned. Chat guides the current search; it never
        saves topics without your review.
      </p>
      <p className="fineprint">
        Clearing affects active settings. The guided demo can retain an earlier
        local snapshot; restoring that snapshot explicitly restores its
        preferences too.
      </p>
      <label className="rsvp-check">
        <input
          type="checkbox"
          checked={p.use_goals}
          onChange={(e) => pref({ use_goals: e.target.checked })}
        />
        Use saved structured goals in recommendations
      </label>
      <label className="rsvp-check">
        <input
          type="checkbox"
          checked={p.use_learning}
          onChange={(e) => pref({ use_learning: e.target.checked })}
        />
        Use confirmed learning topics in recommendations
      </label>
      <p>
        Disabling goals or learning topics stops their use after Save changes
        without deleting them.
      </p>
      <p>
        Preferences are saved in this browser. Recommendation requests are
        processed by the app’s Rust service when it is available. Raw
        reflection, learning notes, major and free-text goals are not included
        in those requests. The current planner message, structured search
        filters, plan/cancellation IDs, interests, practical settings and busy
        commitment times (without titles) may be sent to that service.
        Conversation history is not included automatically. If you copy a note
        into a planner message, that message can be sent. When the service is
        unavailable, the labelled browser fallback processes recommendations
        locally.
      </p>
      <Button
        onClick={() => {
          setConfirm(true);
        }}
      >
        Clear personalization…
      </Button>
      <Button onClick={onClearChat}>Clear local planner conversation</Button>
      <Button onClick={() => pref({ dismissed: [] })}>
        Restore events marked Not for me ({p.dismissed.length})
      </Button>
      {confirm && (
        <div className="notice" role="alert">
          <p>
            Clear interests, goals, learning notes/topics and personalization
            choices now? Existing plans, saved events, RSVP records,
            conversations, community memberships, busy commitments and saved
            hard practical requirements will remain. Unsaved edits and current
            search/draft suggestions will be discarded. This action applies
            immediately; it does not wait for Save.
          </p>
          <Button onClick={() => setConfirm(false)}>Keep preferences</Button>
          <Button
            onClick={() => {
              update(clearPersonalization);
              setConfirm(false);
              notify(
                "Personalization cleared. Planned events and hard scheduling requirements were preserved.",
              );
            }}
          >
            Confirm clear personalization
          </Button>
        </div>
      )}
    </section>
  );
}
