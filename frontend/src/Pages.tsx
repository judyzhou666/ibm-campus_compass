import { dayLabel, DEMO, TIME_ZONES } from "./config.ts";
import { COMMUNITIES, toggleCommunityMembership } from "./communities.ts";
import { useEffect, useState, type FormEvent } from "react";
import { useSubPage } from "./navigation.ts";
import { DAYS, EVENTS, TOPICS, time } from "./data.ts";
import { issue, overlap } from "./planner.ts";
import { effectiveEvents } from "./updates.ts";
import { Button, Heading, Icon } from "./components.tsx";
import type { DemoState, Post, PostDraft } from "./types.ts";
import { GOAL_TYPES } from "./types.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Props = {
  state: DemoState;
  update: (change: (s: DemoState) => DemoState) => void;
  notify: (text: string) => void;
  watsonxMode?: boolean;
};
export function Profile({ state, update, notify, watsonxMode = false }: Props) {
  const [error, setError] = useState("");
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    update((s) => ({
      ...s,
      name: String(f.get("name")).trim() || "Judy",
      interests: f.getAll("topics").map(String),
      goal_types: f.getAll("goal_types").map(String),
      onboarded: true,
      major: String(f.get("major") || "").trim(),
      goals: String(f.get("goals") || "").trim(),
      preferred_time: String(f.get("preferred_time") || "any"),
    }));
    notify("Preferences saved. Ask the planner for updated suggestions.");
  }
  function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const minutes = (v: FormDataEntryValue | null) =>
      String(v)
        .split(":")
        .reduce((sum, n, i) => sum + Number(n) * (i ? 1 : 60), 0);
    const block = {
      id: crypto.randomUUID(),
      title: String(f.get("title")).trim(),
      day: Number(f.get("day")),
      start: minutes(f.get("start")),
      end: minutes(f.get("end")),
    };
    if (!block.title || block.end <= block.start) {
      setError("Enter a title and an end time later than the start time.");
      return;
    }
    if (state.blocks.length >= 100) {
      setError("Remove a busy time before adding another.");
      return;
    }
    // Check against the current (update-applied) times, not the catalog's.
    const conflict = effectiveEvents(state.appliedUpdateIds ?? []).find(
      (e) =>
        state.plan.includes(e.id) &&
        !state.cancelled.includes(e.id) &&
        overlap(e, block, state.buffer),
    );
    if (conflict) {
      setError(
        `This overlaps ${conflict.title}. Remove that event from your calendar first.`,
      );
      return;
    }
    update((s) => ({ ...s, blocks: [...s.blocks, block] }));
    setError("");
    notify("Busy time added. Future recommendations will respect it.");
  }
  return (
    <>
      <Heading
        title="A little about you."
        description="Your interests and availability help make better recommendations."
      >
        {state.signedIn ? (
          <Button
            onClick={() => {
              update((s) => ({ ...s, signedIn: false }));
              notify("Signed out. Your demo plans stay in this browser.");
            }}
          >
            Sign out
          </Button>
        ) : undefined}
      </Heading>
      <div className="wide-grid">
        <section className="panel">
          <h2>What are you curious about?</h2>
          <p className="sub">
            Explore beyond your major. These can change anytime.
          </p>
          <form onSubmit={save}>
            <div className="topic-options">
              {TOPICS.map((t) => (
                <label key={t}>
                  <input
                    type="checkbox"
                    name="topics"
                    value={t}
                    defaultChecked={state.interests.includes(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
            <label className="field">
              Demo display name
              <input
                name="name"
                defaultValue={state.name}
                maxLength={30}
                required
              />
            </label>
            <p className="sub">
              Use a fictional profile for classroom demonstrations. Changes stay
              in this browser.
            </p>
            <label className="field">
              Major or interdisciplinary interests (optional)
              <input name="major" maxLength={120} defaultValue={state.major} />
            </label>
            <label className="field">
              Research / career exploration goals (optional)
              <input name="goals" maxLength={240} defaultValue={state.goals} />
            </label>
            {!watsonxMode && (
              <p className="fineprint" data-simulated-only>
                These notes stay local. Select topics above to influence matching;
                free-text goals are not interpreted in the simulated planner.
              </p>
            )}
            <div>
              <p className="sub" style={{ marginBottom: 4 }}>
                What are you hoping to get out of events? (optional)
              </p>
              <div className="topic-options">
                {GOAL_TYPES.map((g) => (
                  <label key={g}>
                    <input
                      type="checkbox"
                      name="goal_types"
                      value={g}
                      defaultChecked={state.goal_types?.includes(g)}
                    />
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </label>
                ))}
              </div>
              <p className="fineprint">
                Goal types help the AI planner explain cross-school matches.
                Not used in simulated mode.
              </p>
            </div>
            <label className="field">
              Preferred event time
              <select
                name="preferred_time"
                defaultValue={state.preferred_time || "any"}
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <p className="fineprint">
              Time preferences affect ranking. Use chat for strict time limits,
              busy times below and travel buffer in Settings.
            </p>
            <button className="btn primary">Save preferences</button>
          </form>
        </section>
        <section className="panel">
          <h2>Your busy times</h2>
          <p className="sub">Sample classes and personal commitments.</p>
          {state.blocks.map((b) => (
            <div className="block-row" key={b.id}>
              <div>
                <strong>{b.title}</strong>
                <small>
                  {DAYS[b.day]} · {time(b.start)}–{time(b.end)}
                </small>
              </div>
              <button
                className="icon-btn"
                aria-label={`Remove ${b.title}`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    blocks: s.blocks.filter((x) => x.id !== b.id),
                  }))
                }
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Block off some time</h2>
          <form className="form-grid" onSubmit={addBlock}>
            <label className="field full">
              Commitment
              <input
                name="title"
                required
                maxLength={60}
                placeholder="Study group"
              />
            </label>
            <label className="field full">
              Day
              <select name="day">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}, {dayLabel(i)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              From
              <input name="start" type="time" required defaultValue="14:00" />
            </label>
            <label className="field">
              Until
              <input name="end" type="time" required defaultValue="15:00" />
            </label>
            <div className="field full">
              <button className="btn primary">Add busy time</button>
              <span role="alert">{error}</span>
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>Calendar connections</h2>
          {["Google Calendar", "Canvas"].map((n) => (
            <div className="settings-row" key={n}>
              <div>
                <h3>{n}</h3>
                <p>Sample availability is loaded for this demo.</p>
              </div>
              <span className="tag">Not connected</span>
            </div>
          ))}
          <p className="sub">
            You can export chosen events as an .ics file without connecting an
            account.
          </p>
        </section>
      </div>
    </>
  );
}

interface DiscussionPost {
  id: string;
  name: string;
  title: string;
  body: string;
  communityId: string;
  upvotes: number;
  timeAgo: string;
  comments: { name: string; text: string; timeAgo: string }[];
}

const seedPosts: DiscussionPost[] = [
  {
    id: "s1",
    name: "Alex",
    title: "Anyone exploring AI and education this week?",
    body: "I'm planning to try the Learning with AI lab on Tuesday afternoon. It's hands-on with classroom AI tools — would love to meet students from other programs. Feel free to reply if you're going!",
    communityId: "ai",
    upvotes: 34,
    timeAgo: "3 hr. ago",
    comments: [
      { name: "Jordan", text: "I'll be there! Coming from the CS program.", timeAgo: "2 hr. ago" },
      { name: "Morgan", text: "Same — I heard the facilitator is really engaging.", timeAgo: "1 hr. ago" },
    ],
  },
  {
    id: "s2",
    name: "Sam",
    title: "A shared table for new connections",
    body: "The community dinner on Tuesday evening looks like a wonderful way to meet people outside our own classes. International students especially welcome — all backgrounds, all majors.",
    communityId: "global",
    upvotes: 51,
    timeAgo: "5 hr. ago",
    comments: [
      { name: "Priya", text: "Looking forward to it! Will there be vegetarian options?", timeAgo: "4 hr. ago" },
      { name: "Sam", text: "Yes — the organizer confirmed it yesterday.", timeAgo: "3 hr. ago" },
    ],
  },
  {
    id: "s3",
    name: "Taylor",
    title: "Making a little room for creativity",
    body: "Who else is going to the sketchbook walk on Friday afternoon? No drawing experience needed — it's more about slowing down and noticing things.",
    communityId: "arts",
    upvotes: 27,
    timeAgo: "6 hr. ago",
    comments: [
      { name: "Casey", text: "This sounds so lovely. Signing up now.", timeAgo: "5 hr. ago" },
    ],
  },
  {
    id: "s4",
    name: "Riley",
    title: "Resume review sessions — how useful were they?",
    body: "Went to a career center drop-in last week and got some great feedback on my resume layout. Has anyone else tried the Wednesday lunchtime peer reviews? Worth it for internship season.",
    communityId: "career",
    upvotes: 18,
    timeAgo: "1 day ago",
    comments: [
      { name: "Dana", text: "Super helpful! The advisor gave line-by-line notes.", timeAgo: "20 hr. ago" },
      { name: "Chris", text: "I went twice — second visit was even better.", timeAgo: "18 hr. ago" },
    ],
  },
  {
    id: "s5",
    name: "Jamie",
    title: "Reading group forming — philosophy of mind",
    body: "Looking for 4–6 people interested in reading Derek Parfit's Reasons and Persons together. Bi-weekly, totally informal, no prior philosophy background required.",
    communityId: "research",
    upvotes: 22,
    timeAgo: "2 days ago",
    comments: [
      { name: "Alex", text: "I'm very interested. Is this open to undergrads?", timeAgo: "1 day ago" },
      { name: "Jamie", text: "Absolutely — everyone welcome!", timeAgo: "23 hr. ago" },
    ],
  },
];

export function Forum({
  state,
  update,
  notify,
  selected,
  onSelect,
}: Props & { selected: string | null; onSelect: (id: string | null) => void }) {
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityCategory, setCommunityCategory] = useState("All");
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(selected);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [postQuery, setPostQuery] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [composer, setComposer] = useState<PostDraft>({
    title: "",
    body: "",
    communityId: "",
  });
  function openComposer() {
    setComposer(
      state.postDraft ?? {
        title: "",
        body: "",
        communityId: activeCommunityId ?? "",
      },
    );
    setCreatingPost(true);
  }
  // Likes are saved with the rest of the browser-local demo state, so they
  // survive leaving the forum and reloading. Keys: "post:id" or "comment:postId:index".
  const likes = new Set(state.likes);
  function toggleLike(key: string) {
    update((s) => ({
      ...s,
      likes: s.likes.includes(key) ? s.likes.filter((k) => k !== key) : [...s.likes, key],
    }));
  }

  // Sync activeCommunityId when selected prop changes (e.g. from URL hash)
  useEffect(() => {
    setActiveCommunityId(selected);
  }, [selected]);

  // A post or the post editor is a sub-page: Back / swipe-back returns to the
  // post list (see navigation.ts).
  const closeSubPage = useSubPage(Boolean(selectedPostId || creatingPost), () => {
    setSelectedPostId(null);
    setCreatingPost(false);
  });

  const userPosts: DiscussionPost[] = state.posts.map((p) => ({
    id: `u:${p.id}`,
    name: p.name,
    title: p.title,
    body: p.body,
    communityId:
      p.communityId ?? COMMUNITIES.find((c) => c.name === p.tag)?.id ?? "",
    upvotes: 1,
    timeAgo: "just now",
    comments: [],
  }));
  const localComments = (postId: string) =>
    state.comments.filter((c) => c.postId === postId);

  const allPosts = [...userPosts, ...seedPosts];

  const filteredPosts = allPosts.filter((p) => {
    if (activeCommunityId && p.communityId !== activeCommunityId) return false;
    if (postQuery && !`${p.title} ${p.body}`.toLowerCase().includes(postQuery.toLowerCase())) return false;
    return true;
  });

  const shownCommunities = COMMUNITIES.filter(
    (c) =>
      (communityCategory === "All" || c.category === communityCategory) &&
      `${c.name} ${c.description}`.toLowerCase().includes(communityQuery.toLowerCase()),
  );

  const selectedPost = selectedPostId ? allPosts.find((p) => p.id === selectedPostId) ?? null : null;
  const activeCommunity = activeCommunityId ? COMMUNITIES.find((c) => c.id === activeCommunityId) : null;

  // ── Create post sub-page ─────────────────────────────────────────────────
  if (creatingPost) {
    return (
      <div className="forum-detail-page">
        <button
          className="forum-back-btn text-btn"
          onClick={closeSubPage}
        >
          ← Back to posts
        </button>
        <div className="forum-create-page panel">
          <div className="forum-create-top">
            <select
              className="forum-community-select"
              aria-label="Community"
              value={composer.communityId}
              onChange={(e) =>
                setComposer((d) => ({ ...d, communityId: e.target.value }))
              }
            >
              <option value="">No community (local demo post)</option>
              {COMMUNITIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <form
            className="forum-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              const title = composer.title.trim(),
                body = composer.body.trim(),
                community = COMMUNITIES.find(
                  (c) => c.id === composer.communityId,
                );
              if (!title) return;
              update((s) => ({
                ...s,
                posts: [
                  {
                    id: `p${Date.now().toString(36)}`,
                    name: s.name,
                    title,
                    body,
                    tag: community?.name ?? "Local demo post",
                    ...(community ? { communityId: community.id } : {}),
                  },
                  ...s.posts,
                ].slice(0, 100),
                postDraft: null,
              }));
              notify("Posted to your local demo only.");
              closeSubPage();
            }}
          >
            <input
              name="title"
              required
              maxLength={100}
              className="forum-create-title"
              placeholder="Title*"
              value={composer.title}
              onChange={(e) =>
                setComposer((d) => ({ ...d, title: e.target.value }))
              }
              autoFocus
            />
            <div className="forum-create-tags-row">
              <button type="button" className="forum-tag-btn">🏷 Add tags</button>
            </div>
            <textarea
              name="body"
              maxLength={2000}
              rows={8}
              className="forum-create-body"
              placeholder="Body text (optional)"
              value={composer.body}
              onChange={(e) =>
                setComposer((d) => ({ ...d, body: e.target.value }))
              }
            />
            <div className="forum-create-toolbar">
              <span className="forum-toolbar-group">
                <button type="button" title="Bold"><strong>B</strong></button>
                <button type="button" title="Italic"><em>i</em></button>
                <button type="button" title="Strikethrough"><s>S</s></button>
                <button type="button" title="Superscript">x²</button>
              </span>
              <span className="forum-toolbar-sep" />
              <span className="forum-toolbar-group">
                <button type="button" title="Heading">T↑</button>
                <button type="button" title="Link">🔗</button>
                <button type="button" title="Bullet list">• —</button>
                <button type="button" title="Numbered list">1.</button>
              </span>
              <span className="forum-toolbar-sep" />
              <span className="forum-toolbar-group">
                <button type="button" title="Quote">"  "</button>
                <button type="button" title="Code">&lt;/&gt;</button>
              </span>
            </div>
            <div className="forum-create-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  update((s) => ({ ...s, postDraft: composer }));
                  notify("Draft saved in this browser only.");
                  closeSubPage();
                }}
              >
                Save Draft
              </button>
              <button type="submit" className="btn primary">Post</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Post detail sub-page ──────────────────────────────────────────────────
  if (selectedPost) {
    const community = COMMUNITIES.find((c) => c.id === selectedPost.communityId);
    const mine = localComments(selectedPost.id);
    const conversationJoined = state.joined.includes(selectedPost.title);
    return (
      <div className="forum-detail-page">
        <button
          className="forum-back-btn text-btn"
          onClick={closeSubPage}
        >
          ← Back to posts
        </button>
        <div className="forum-detail-layout">
          <article className="forum-detail-article panel">
            <div className="forum-detail-meta">
              <div className="avatar">{selectedPost.name[0]}</div>
              <span className="forum-post-community">{community?.name ?? "Local demo post"}</span>
              <span className="forum-post-author">u/{selectedPost.name}</span>
              <span className="forum-post-time">· {selectedPost.timeAgo}</span>
            </div>
            <h2 className="forum-detail-title">{selectedPost.title}</h2>
            <p className="forum-detail-body">{selectedPost.body}</p>
            <div className="forum-post-stats">
              <button
                className={`forum-like-btn ${likes.has(`post:${selectedPost.id}`) ? "liked" : ""}`}
                onClick={() => toggleLike(`post:${selectedPost.id}`)}
                aria-pressed={likes.has(`post:${selectedPost.id}`)}
                aria-label="Like post"
              >
                ▲ {selectedPost.upvotes + (likes.has(`post:${selectedPost.id}`) ? 1 : 0)}
              </button>
              <span className="forum-stat">💬 {plural(selectedPost.comments.length + mine.length, "comment")}</span>
              <button
                className="text-btn forum-stat"
                aria-pressed={conversationJoined}
                onClick={() => {
                  update((s) => ({
                    ...s,
                    joined: s.joined.includes(selectedPost.title)
                      ? s.joined.filter((x) => x !== selectedPost.title)
                      : [...s.joined, selectedPost.title],
                  }));
                  notify("Updated locally. No message was sent.");
                }}
              >
                <Icon name={conversationJoined ? "check" : "plus"} />
                {conversationJoined ? "Joined locally" : "Join conversation"}
              </button>
              <span className="forum-stat fineprint">Fictional demo post — not shared</span>
            </div>
            <section className="forum-comments">
              <h3 className="forum-comments-heading">Comments</h3>
              {selectedPost.comments.length + mine.length === 0 && (
                <p className="forum-empty-comments">No comments yet. Be the first!</p>
              )}
              {selectedPost.comments.map((c, i) => {
                const commentKey = `comment:${selectedPost.id}:${i}`;
                return (
                <div className="forum-comment" key={i}>
                  <div className="avatar avatar-sm">{c.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <span className="forum-comment-author">u/{c.name}</span>
                    <span className="forum-post-time"> · {c.timeAgo}</span>
                    <p className="forum-comment-text">{c.text}</p>
                    <button
                      className={`forum-comment-like ${likes.has(commentKey) ? "liked" : ""}`}
                      onClick={() => toggleLike(commentKey)}
                      aria-pressed={likes.has(commentKey)}
                      aria-label="Like comment"
                    >
                      ▲ {likes.has(commentKey) ? 1 : 0}
                    </button>
                  </div>
                </div>
                );
              })}
              {mine.map((c, i) => (
                <div className="forum-comment" key={`mine-${i}`}>
                  <div className="avatar avatar-sm">{c.name[0] ?? "?"}</div>
                  <div style={{ flex: 1 }}>
                    <span className="forum-comment-author">u/{c.name}</span>
                    <span className="forum-post-time"> · Saved in this browser</span>
                    <p className="forum-comment-text">{c.text}</p>
                  </div>
                </div>
              ))}
              <form
                className="forum-comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    text = String(new FormData(form).get("comment")).trim();
                  if (!text) return;
                  update((s) => ({
                    ...s,
                    comments: [
                      ...s.comments,
                      { postId: selectedPost.id, name: s.name, text },
                    ].slice(-200),
                  }));
                  notify("Comment saved in this browser only. No message was sent.");
                  form.reset();
                }}
              >
                <label className="field full">
                  Add a comment
                  <textarea
                    name="comment"
                    required
                    maxLength={400}
                    placeholder="Share your thoughts…"
                  />
                </label>
                <button className="btn primary">Comment (local only)</button>
              </form>
            </section>
          </article>
          <aside className="forum-detail-sidebar panel" style={{ alignSelf: "start" }}>
            {community && (
              <>
                <h3 className="forum-sidebar-heading">{community.name}</h3>
                <p className="forum-sidebar-desc">{community.description}</p>
                <p className="fineprint">{community.category} · Fictional community</p>
                <Button
                  onClick={() => update((s) => toggleCommunityMembership(s, community.id))}
                >
                  {state.joinedCommunities.includes(community.id) ? "Leave community" : "Join locally"}
                </Button>
              </>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // ── Main forum layout ─────────────────────────────────────────────────────
  return (
    <>
      <Heading
        title="Good things start with a hello."
        description="A sample community board for the Campus Compass demonstration."
      />
      <div className="forum-layout">
      {/* Left sidebar: community search + filters */}
      <aside className="forum-sidebar">
        <h2 className="forum-sidebar-heading">Communities</h2>
        <label className="field">
          Search
          <input
            value={communityQuery}
            onChange={(e) => setCommunityQuery(e.target.value)}
            placeholder="Search communities…"
          />
        </label>
        <div className="filters" style={{ marginBottom: 16 }}>
          {["All", "Academic", "Career", "Social", "Arts"].map((c) => (
            <button
              key={c}
              className={`chip ${communityCategory === c ? "active" : ""}`}
              aria-pressed={communityCategory === c}
              onClick={() => setCommunityCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="forum-community-list">
          {shownCommunities.map((c) => (
            <li key={c.id}>
              <button
                className={`forum-community-item ${activeCommunityId === c.id ? "active" : ""}`}
                onClick={() => {
                  const next = activeCommunityId === c.id ? null : c.id;
                  setActiveCommunityId(next);
                  onSelect(next);
                }}
              >
                <span className="forum-community-avatar">{c.name[0]}</span>
                <span className="forum-community-info">
                  <span className="forum-community-name">{c.name}</span>
                  <span className="forum-community-cat">{c.category}</span>
                </span>
                {state.joinedCommunities.includes(c.id) && (
                  <span className="forum-joined-badge">Joined</span>
                )}
              </button>
            </li>
          ))}
          {!shownCommunities.length && (
            <li className="fineprint" style={{ padding: "8px 0" }}>No communities match.</li>
          )}
        </ul>
        <p className="fineprint" style={{ marginTop: 16 }}>
          Joining only changes this browser. No messages are delivered.
        </p>
      </aside>

      {/* Center: post feed */}
      <main className="forum-feed panel">
        <div className="forum-feed-header">
          <h2 className="forum-feed-title">
            {activeCommunity ? activeCommunity.name : "All Posts"}
          </h2>
          <label className="field forum-search-field">
            <input
              value={postQuery}
              onChange={(e) => setPostQuery(e.target.value)}
              placeholder="Search posts…"
            />
          </label>
        </div>

        {activeCommunity && (
          <section
            className="notice forum-community-details"
            aria-label="Community details"
          >
            <h3>{activeCommunity.name}</h3>
            <p>{activeCommunity.description}</p>
            <p>
              Topics: {activeCommunity.topics.join(", ")}. Membership is local
              only.
            </p>
            <h4>Related fictional events</h4>
            {EVENTS.filter((e) => activeCommunity.topics.includes(e.topic))
              .slice(0, 3)
              .map((e) => (
                <p key={e.id}>{e.title}</p>
              ))}
            <div className="row">
              <Button
                onClick={() =>
                  update((s) => toggleCommunityMembership(s, activeCommunity.id))
                }
              >
                {state.joinedCommunities.includes(activeCommunity.id)
                  ? "Leave community"
                  : "Join locally"}
              </Button>
              <Button
                onClick={() => {
                  setActiveCommunityId(null);
                  onSelect(null);
                }}
              >
                Close community details
              </Button>
            </div>
          </section>
        )}

        {/* Create post trigger */}
        <div className="forum-new-post">
          <div className="forum-new-post-row">
            <div className="avatar">{state.name ? state.name[0] : "?"}</div>
            <button
              type="button"
              className="forum-create-trigger"
              onClick={openComposer}
            >
              + Create post
            </button>
          </div>
        </div>

        {/* Post list */}
        {filteredPosts.length === 0 && (
          <p role="status" className="forum-empty">No posts yet. Start the conversation!</p>
        )}
        {filteredPosts.map((p) => {
          const community = COMMUNITIES.find((c) => c.id === p.communityId);
          return (
            <article key={p.id} className="forum-post-card">
              <div className="forum-post-card-meta">
                <span className="forum-post-community">
                  {community?.name ?? "Local demo post"}
                </span>
                <span className="forum-post-author">u/{p.name}</span>
                <span className="forum-post-time">· {p.timeAgo}</span>
              </div>
              <button
                className="forum-post-title text-btn"
                onClick={() => setSelectedPostId(p.id)}
              >
                {p.title}
              </button>
              <p className="forum-post-preview">{p.body.slice(0, 160)}{p.body.length > 160 ? "…" : ""}</p>
              <div className="forum-post-footer">
                <button
                  className={`forum-like-btn ${likes.has(`post:${p.id}`) ? "liked" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleLike(`post:${p.id}`); }}
                  aria-pressed={likes.has(`post:${p.id}`)}
                  aria-label="Like post"
                >
                  ▲ {p.upvotes + (likes.has(`post:${p.id}`) ? 1 : 0)}
                </button>
                <button
                  className="forum-stat text-btn"
                  onClick={() => setSelectedPostId(p.id)}
                >
                  💬 {plural(p.comments.length + localComments(p.id).length, "comment")}
                </button>
              </div>
            </article>
          );
        })}
      </main>
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
            <h3>Time zone</h3>
            <p>
              Shows the demo date and time, the day marked today and, in
              event details, each event&rsquo;s start in this zone. Schedules, the planner and calendar export
              stay in campus time ({DEMO.time_zone}). Resets on demo reset.
            </p>
          </div>
          <select
            value={state.timezone || DEMO.time_zone}
            aria-label="Time zone"
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--line)" }}
            onChange={(e) => {
              update((s) => ({ ...s, timezone: e.target.value }));
              notify("Time zone updated.");
            }}
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
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
              Simulated planner by default. The server can run a live IBM
              watsonx interpreter when configured; each chat reply is labelled
              with the mode that answered.
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
          development work must be documented separately, and the optional
          watsonx interpreter has not yet been verified with a live IBM account.
        </p>
      </section>
    </>
  );
}
