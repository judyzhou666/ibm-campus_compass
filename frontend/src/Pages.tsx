import { COMMUNITIES, toggleCommunityMembership } from "./communities.ts";
import { useEffect, useRef, useState } from "react";
import { EVENTS } from "./data.ts";
import { issue } from "./planner.ts";
import { Button, Heading, Icon } from "./components.tsx";
import type { DemoState, Post } from "./types.ts";

type Props = {
  state: DemoState;
  update: (change: (s: DemoState) => DemoState) => void;
  notify: (text: string) => void;
};
export { MyPreferences as Profile } from "./MyPreferences.tsx";

const seedPosts: Post[] = [
  {
    name: "Alex",
    title: "Anyone exploring AI and education this week?",
    body: "I’m planning to try the learning lab. Would love to meet students from other programs.",
    tag: "AI & learning circle",
  },
  {
    name: "Sam",
    title: "A shared table for new connections",
    body: "The community dinner looks like a nice way to meet people beyond our own classes.",
    tag: "Global table",
  },
  {
    name: "Taylor",
    title: "Making a little room for creativity",
    body: "Who else is interested in the sketchbook walk? No drawing experience needed.",
    tag: "Arts & culture",
  },
];
export function Forum({
  state,
  update,
  notify,
  selected,
  onSelect,
}: Props & { selected: string | null; onSelect: (id: string | null) => void }) {
  const detailsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) {
      detailsRef.current?.focus({ preventScroll: true });
      detailsRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const community = COMMUNITIES.find((c) => c.id === selected);
  const shown = COMMUNITIES.filter(
    (c) =>
      (category === "All" || c.category === category) &&
      `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Good things start with a hello."
        description="A sample community board for the Campus Compass demonstration."
      />
      <section className="panel communities">
        <h2>All Communities</h2>
        <p>
          Fictional groups. Joining and posting only change this browser; no
          messages are delivered.
        </p>
        <label className="field">
          Search communities
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="filters">
          {["All", "Academic", "Career", "Social", "Arts"].map((c) => (
            <button
              className={`chip ${category === c ? "active" : ""}`}
              aria-pressed={category === c}
              key={c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="briefing-grid">
          {shown.map((c) => (
            <article key={c.id}>
              <h3>
                <button className="text-btn" onClick={() => onSelect(c.id)}>
                  {c.name}
                </button>
              </h3>
              <p>{c.description}</p>
              <p className="fineprint">{c.category} · Fictional community</p>
              <Button
                onClick={() =>
                  update((s) => toggleCommunityMembership(s, c.id))
                }
              >
                {state.joinedCommunities.includes(c.id)
                  ? "Leave community"
                  : "Join locally"}
              </Button>
            </article>
          ))}
        </div>
        {!shown.length && (
          <p role="status">
            No communities match. Try another search or category.
          </p>
        )}
        {community && (
          <section
            className="notice"
            aria-label="Community details"
            ref={detailsRef}
            tabIndex={-1}
          >
            <h3>{community.name}</h3>
            <p>{community.description}</p>
            <p>
              Topics: {community.topics.join(", ")}. Membership is local only.
            </p>
            <h4>Related fictional events</h4>
            {EVENTS.filter((e) => community.topics.includes(e.topic))
              .slice(0, 3)
              .map((e) => (
                <p key={e.id}>{e.title}</p>
              ))}
            <Button onClick={() => onSelect(null)}>
              Close community details
            </Button>
          </section>
        )}
      </section>
      <div className="wide-grid">
        <section className="panel">
          <h2>Campus conversations</h2>
          {[...state.posts, ...seedPosts].map((p, i) => (
            <article className="discussion" key={`${i}-${p.title}`}>
              <div className="avatar">{p.name[0]}</div>
              <div>
                <h3>{p.title}</h3>
                <small>
                  {p.name} · Fictional demo participant · {p.tag}
                </small>
                <p>{p.body}</p>
                <button
                  className="text-btn"
                  onClick={() => {
                    update((s) => ({
                      ...s,
                      joined: s.joined.includes(p.title)
                        ? s.joined.filter((x) => x !== p.title)
                        : [...s.joined, p.title],
                    }));
                    notify("Updated locally. No message was sent.");
                  }}
                >
                  <Icon
                    name={state.joined.includes(p.title) ? "check" : "plus"}
                  />
                  {state.joined.includes(p.title)
                    ? "Joined locally"
                    : "Join conversation"}
                </button>
              </div>
            </article>
          ))}
        </section>
        <section className="panel" style={{ alignSelf: "start" }}>
          <h2>Start a conversation</h2>
          <p className="sub">
            Demo posts stay on this device and are not shared with anyone.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form),
                title = String(f.get("title")).trim(),
                body = String(f.get("body")).trim();
              if (!title || !body) return;
              update((s) => ({
                ...s,
                posts: [
                  { name: s.name, title, body, tag: "Local demo post" },
                  ...s.posts,
                ].slice(0, 100),
              }));
              form.reset();
              notify("Posted to your local demo only.");
            }}
          >
            <label className="field full">
              Topic
              <input
                name="title"
                required
                maxLength={100}
                placeholder="What are you curious about?"
              />
            </label>
            <label className="field full">
              Message
              <textarea
                name="body"
                required
                maxLength={600}
                placeholder="Say hello to the demo community…"
              />
            </label>
            <div className="field full">
              <button className="btn primary">Post to local demo</button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function Settings({
  state,
  update,
  notify,
  onReset,
}: Props & { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Heading
        title="Keep things your way."
        description="A few useful settings for your demonstration."
      />
      <section className="panel">
        <div className="settings-row">
          <div>
            <h3>Leave time to get there</h3>
            <p>Keep a 15-minute buffer between events and busy commitments.</p>
          </div>
          <input
            type="checkbox"
            aria-label="15-minute travel buffer"
            checked={state.buffer > 0}
            onChange={(e) => {
              const next = { ...state, buffer: e.target.checked ? 15 : 0 };
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
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <h3>AI connection</h3>
            <p>
              Rust simulated planner. IBM watsonx integration is planned for a
              later step.
            </p>
          </div>
          <span className="tag">Demo mode</span>
        </div>
        <div className="settings-row">
          <div>
            <h3>Start the demonstration again</h3>
            <p>Clear locally saved plans, messages, posts, and preferences.</p>
          </div>
          <Button className="danger" onClick={() => setConfirm(true)}>
            Reset demo
          </Button>
        </div>
        {confirm ? (
          <div className="notice" role="alert">
            <strong>Reset your demo?</strong>
            <p>
              This clears plans, saved events, chats, and local posts, then
              restores the sample profile.
            </p>
            <div className="row">
              <Button onClick={() => setConfirm(false)}>Keep my changes</Button>
              <Button className="primary" onClick={onReset}>
                Confirm reset
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>About Campus Compass</h2>
        <p className="sub">
          A higher-education opportunity discovery project for the IBM AI
          Experiential Learning Lab. Built to help students turn scattered
          possibilities into a feasible weekly plan.
        </p>
        <p>Team: Judy, Shuozishan Wang, Chenxi Liu, and Tingting Lai.</p>
        <p className="sub">
          All events, student stories, and schedules are fictional. This is a
          student project, not an official university or IBM product. IBM Bob
          development work and live watsonx integration must be completed and
          documented separately.
        </p>
      </section>
    </>
  );
}
