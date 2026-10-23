import {
  activeTopics,
  migratePreferences,
  proposalTopic,
} from "./preferences.ts";
import { PreferenceProposal } from "./PreferenceProposal.tsx";
import { useRecommendations } from "./useRecommendations.ts";
import { DataReview } from "./DataReview.tsx";
import { DemoLauncher } from "./DemoLauncher.tsx";
import { guidedScenario } from "./demoScenario.ts";
import { DEMO, WEEK_LABEL } from "./config.ts";
import { communityFromHash, communityHash } from "./communities.ts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EVENTS, when } from "./data.ts";
import { issue, reasons } from "./planner.ts";
import { createEnrollment, type EnrollmentOutcome } from "./enrollment.ts";
import { createConversation } from "./conversation.ts";
import { createStore, fresh, restore, STORAGE_KEY } from "./state.ts";
import { calendarText } from "./calendar.ts";
import {
  Button,
  Empty,
  EventCard,
  EventDetails,
  Filters,
  Heading,
  Icon,
  Week,
} from "./components.tsx";
import { ChatEvents, PlannerCalendar, RsvpDialog } from "./PlannerPanels.tsx";
import { Briefing, Welcome } from "./Briefing.tsx";
import { Forum, Profile, Settings } from "./Pages.tsx";
import type { Constraints, Message, Rsvp } from "./types.ts";

const labels = {
  review: "Team data review",
  dashboard: "Dashboard",
  calendar: "My Calendar",
  explore: "Explore Events",
  forum: "Discussion Forum",
  planner: "AI Planner",
  saved: "Saved Events",
  profile: "My Preferences",
  settings: "Settings",
};
type Page = keyof typeof labels;
const navIcons: Record<Page, string> = {
  review: "settings",
  dashboard: "home",
  calendar: "calendar",
  explore: "search",
  forum: "chat",
  planner: "spark",
  saved: "bookmark",
  profile: "user",
  settings: "settings",
};
const prompts = [
  "AI and education on Tuesday or Thursday afternoons",
  "A social event with free food",
  "Career events after 1 PM",
];
const validPage = (s: string): Page => {
  const page = s.split("?")[0];
  return page in labels ? (page as Page) : "dashboard";
};
export default function App() {
  const [demo] = useState(() => createStore(restore()));
  const state = useSyncExternalStore(demo.subscribe, demo.read);
  const update = demo.update;
  const [enrollment] = useState(() => createEnrollment(demo));
  const [conversation] = useState(() =>
    createConversation(demo, enrollment.remove),
  );
  const { busy, mode } = useSyncExternalStore(
    conversation.subscribe,
    conversation.read,
  );
  const { busy: enrolling, rsvpEvent } = useSyncExternalStore(
    enrollment.subscribe,
    enrollment.read,
  );
  const [page, setPage] = useState<Page>(() =>
    validPage(location.hash.slice(1)),
  );
  const [selectedCommunity, setSelectedCommunity] = useState(() =>
    communityFromHash(location.hash),
  );
  const [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [message, setMessage] = useState(""),
    [detail, setDetail] = useState<string | null>(null),
    [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [proposal, setProposal] = useState<{
    topics: string[];
    text: string;
    key: string;
  } | null>(null);
  const [sessionSkipped, setSessionSkipped] = useState<string[]>([]);
  const recommendationResult = useRecommendations({
    ...state,
    preferences: {
      ...migratePreferences(state.preferences),
      dismissed: [
        ...new Set([
          ...migratePreferences(state.preferences).dismissed,
          ...sessionSkipped,
        ]),
      ],
    },
  });
  const preferenceRevision = JSON.stringify([
    state.interests,
    state.preferences,
    state.preferred_time,
    state.buffer,
    state.blocks,
  ]);
  useEffect(() => {
    setProposal(null);
    setSessionSkipped([]);
  }, [page, preferenceRevision]);
  useEffect(() => {
    conversation.reset();
  }, [preferenceRevision, conversation]);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      enrollment.reset();
      conversation.reset();
    },
    [enrollment, conversation],
  );
  function notify(text: string) {
    setToast(text);
  }
  const preferenceDirty = useRef(false);
  const setPreferenceDirty = useCallback((dirty: boolean) => {
    preferenceDirty.current = dirty;
  }, []);
  function allowPreferenceDeparture() {
    if (!preferenceDirty.current) return true;
    if (
      !window.confirm(
        "Discard unsaved preference changes and leave My Preferences? Recommendations still use your saved choices.",
      )
    )
      return false;
    preferenceDirty.current = false;
    return true;
  }
  function nav(next: Page, communityId?: string) {
    if (next !== "profile" && !allowPreferenceDeparture()) return false;
    setSelectedCommunity(next === "forum" && communityId ? communityId : null);
    setPage(next);
    setMenu(false);
    setDetail(null);
    setFilter("All");
    setQuery("");
    setSearch("");
    location.hash =
      next === "forum" && communityId ? communityHash(communityId) : next;
    window.scrollTo(0, 0);
    return true;
  }
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setToast(
        "Changes are available for this session only. Browser storage is unavailable.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const handle = () => {
      const next = validPage(location.hash.slice(1));
      if (next !== "profile" && !allowPreferenceDeparture()) {
        history.replaceState(null, "", "#profile");
        return;
      }
      setPage(next);
      setSelectedCommunity(communityFromHash(location.hash));
      setMenu(false);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  useEffect(() => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [state.messages, busy, page]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  function clearChat() {
    setProposal(null);
    conversation.clear();
    setMessage("");
  }
  function remove(id: string) {
    enrollment.remove(id);
    setDetail(null);
    notify("Removed from your calendar.");
  }
  function save(id: string) {
    update((s) => ({
      ...s,
      saved: s.saved.includes(id)
        ? s.saved.filter((x) => x !== id)
        : [...s.saved, id],
    }));
  }
  function presentEnrollment(result: EnrollmentOutcome): string | null {
    if (result.kind === "added") {
      setDetail(null);
      setCalendarOpen(true);
      notify(result.notice);
    } else if (result.kind === "already-added") {
      setCalendarOpen(true);
      notify("This event is already in your calendar.");
    } else if (result.kind === "rsvp") {
      setDetail(null);
    } else if (result.kind === "rejected") {
      notify(result.message);
      return result.message;
    }
    return null;
  }
  async function add(id: string) {
    const result = await enrollment.choose(id);
    if (result.kind === "rejected") setDetail(id);
    presentEnrollment(result);
  }
  async function completeEnrollment(rsvp: Rsvp) {
    return presentEnrollment(await enrollment.confirm(rsvp));
  }
  async function chat(text: string, previous?: Constraints) {
    if (conversation.read().busy || !text.trim()) return;
    setMessage("");
    if (
      previous === undefined &&
      /\b(interested in|learning about|explore next)\b/i.test(text)
    ) {
      setProposal({
        topics: proposalTopic(text),
        text,
        key: preferenceRevision,
      });
      return;
    }
    await conversation.chat(text, previous);
  }
  async function replan() {
    if (conversation.read().busy) return;
    nav("planner");
    await conversation.replace();
  }
  function exportCalendar() {
    const text = calendarText(demo.read());
    if (!text) {
      notify("Add an event to your calendar before exporting.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([text], { type: "text/calendar;charset=utf-8" }),
    );
    a.download = "campus-compass-demo-week.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify("Exported chosen events. Cancelled events were excluded.");
  }
  const filterEvents = (list: typeof EVENTS) =>
    list.filter(
      (e) =>
        (filter === "All" ||
          (filter === "Free Food"
            ? e.food === "Free meal"
            : e.category === filter)) &&
        (!query ||
          `${e.title} ${e.description} ${e.topic} ${e.food}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
  const cards = (list: typeof EVENTS) => (
    <div className="event-grid">
      {list.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          state={state}
          onAdd={add}
          onSave={save}
          onDetail={setDetail}
          onCalendar={() => nav("calendar")}
          onAnother={(id) =>
            setSessionSkipped((ids) => [...new Set([...ids, id])])
          }
          onDecline={(id) => {
            update((s) => ({
              ...s,
              preferences: {
                ...migratePreferences(s.preferences),
                dismissed: [
                  ...new Set([
                    ...migratePreferences(s.preferences).dismissed,
                    id,
                  ]),
                ],
              },
              draft: s.draft.filter((x) => x !== id),
            }));
          }}
        />
      ))}
    </div>
  );
  const week = (full = false) => (
    <Week
      state={state}
      full={full}
      onDetail={setDetail}
      onDay={(day) => {
        nav("planner");
        void chat(
          `Find events on ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day]}`,
          { days: [day] },
        );
      }}
    />
  );
  const draft = state.draft
    .map((id) => EVENTS.find((e) => e.id === id))
    .filter((e) => e && !state.plan.includes(e.id) && !issue(e, state));
  const displayedMessages: Message[] = state.messages.length
    ? state.messages
    : [
        {
          role: "assistant",
          text: `Hi ${state.name}! Let’s find a little more of what you love on campus.\n\nTell me your interests, when you’re free, and anything that matters — like free food or a little time between events. I’ll check your demo schedule and suggest a few options.`,
        },
      ];
  const cancelled = state.cancelled.some((id) => state.plan.includes(id));
  const detailEvent = EVENTS.find((e) => e.id === detail);
  const list = filterEvents(
    page === "saved"
      ? EVENTS.filter((e) => state.saved.includes(e.id))
      : EVENTS,
  );
  const recommended = filterEvents(
    recommendationResult.ids
      .map((id) => EVENTS.find((e) => e.id === id)!)
      .filter(Boolean),
  );

  return (
    <>
      {!state.onboarded ? (
        <Welcome
          onStart={() => {
            update((s) => ({ ...s, onboarded: true }));
            nav("profile");
          }}
          onFinish={(interests, participation, guidance) => {
            update((s) => ({
              ...s,
              interests,
              onboarded: true,
              preferences: {
                ...migratePreferences(s.preferences),
                participation,
                guidance,
              },
            }));
          }}
          onBrowse={() =>
            update((s) => ({ ...s, interests: [], onboarded: true }))
          }
          onSkip={() => update((s) => ({ ...s, onboarded: true }))}
        />
      ) : null}
      <aside className={`sidebar ${menu ? "open" : ""}`} id="sidebar">
        <a className="brand" href="#dashboard" onClick={() => nav("dashboard")}>
          <span className="logo">
            <Icon name="compass" />
          </span>
          <span>
            Campus<small>COMPASS</small>
          </span>
        </a>
        <nav className="nav" aria-label="Main navigation">
          {(
            Object.keys(labels).filter((key) => key !== "review") as Page[]
          ).map((p, i) => (
            <div key={p}>
              {i === 6 ? <div className="break" /> : null}
              <button
                className={page === p ? "active" : ""}
                aria-current={page === p ? "page" : undefined}
                onClick={() => nav(p)}
              >
                <Icon name={navIcons[p]} />
                {labels[p]}
                {p === "saved" && state.saved.length > 0 ? (
                  <span className="badge">{state.saved.length}</span>
                ) : null}
              </button>
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="demo-note">
            <strong>A campus of possibilities.</strong>Your interests. Your
            time. Your next great discovery.
          </div>
          <div className="user">
            <span className="avatar">{state.name[0] || "J"}</span>
            <div>
              <strong>{state.name}’s campus</strong>
              <small>Graduate student · Demo profile</small>
              <button className="text-btn" onClick={() => nav("profile")}>
                My Preferences
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="sidebar"
            onClick={() => setMenu(!menu)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            My campus <span>/ &nbsp; {labels[page]}</span>
          </div>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              const term = search.trim();
              if (nav("explore")) setQuery(term);
            }}
          >
            <Icon name="search" />
            <input
              aria-label="Search events"
              placeholder="Find something that sparks your interest"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="top-actions">
            <span className="term">{DEMO.campus_name}</span>
            <button
              className="icon-btn"
              aria-label="View notifications"
              onClick={() => {
                nav("dashboard");
                notify(
                  cancelled
                    ? "An event was cancelled in the demo. Open AI Planner to review."
                    : "Your weekly event suggestions are ready. All updates are fictional.",
                );
              }}
            >
              <Icon name="bell" />
            </button>
            <button
              className="avatar"
              aria-label="Open profile"
              style={{ border: 0 }}
              onClick={() => nav("profile")}
            >
              {state.name[0] || "J"}
            </button>
          </div>
        </header>
        <main id="main">
          {page === "dashboard" ? (
            <>
              <Heading
                title={`Welcome back, ${state.name}.`}
                description="A little direction. A world of campus possibilities."
              />
              <div className="layout">
                <div className="stack">
                  <section className="hero">
                    <div>
                      <h2>
                        Find your people.
                        <br />
                        Make room for possibility.
                      </h2>
                      <p>
                        Your next idea, conversation, or favorite campus moment
                        could be just around the corner.
                      </p>
                      <Button onClick={() => nav("planner")}>
                        Let’s plan your week <Icon name="arrow" />
                      </Button>
                    </div>
                    <div className="hero-compass">
                      <Icon name="compass" />
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-bar">
                      <h2>Your week, at a glance</h2>
                      <button
                        className="text-btn"
                        onClick={() => nav("calendar")}
                      >
                        View calendar <Icon name="arrow" />
                      </button>
                    </div>
                    {week()}
                    <div className="legend">
                      <span>
                        <i className="dot" />
                        Classes & personal time
                      </span>
                      <span>
                        <i className="dot green" />
                        Your campus plans
                      </span>
                    </div>
                  </section>
                  <section>
                    <div className="section-bar">
                      <h2>A few things you might love</h2>
                      <button
                        className="text-btn"
                        onClick={() => nav("explore")}
                      >
                        Explore all <Icon name="arrow" />
                      </button>
                    </div>
                    <Briefing
                      state={state}
                      onDetail={setDetail}
                      onPlanner={() => nav("planner")}
                      onCalendar={() => nav("calendar")}
                    />
                    <Filters value={filter} onChange={setFilter} />
                    <p role="status">{recommendationResult.notice}</p>
                    {cards(recommended)}
                    {!recommended.length ? (
                      <Empty title="Try another category">
                        There are no available matches in this category.
                      </Empty>
                    ) : null}
                  </section>
                </div>
                <aside className="stack rail">
                  <section className="panel planner-teaser">
                    <img
                      className="mascot"
                      src="/assets/mascot.png"
                      alt="Campus Compass cat mascot wearing a green compass bandana"
                    />
                    <h2>A week that feels like you.</h2>
                    <p>
                      Tell me what you’re curious about.
                      <br />
                      I’ll help you find a place to start.
                    </p>
                    <Button className="primary" onClick={() => nav("planner")}>
                      <Icon name="spark" />
                      Meet your AI planner
                    </Button>
                    <span className="label">
                      SIMULATED CHAT · REAL DEMO INTERACTIONS
                    </span>
                  </section>
                  <section className="panel">
                    <div className="section-bar">
                      <h2>Around campus</h2>
                      <Icon name="bell" />
                    </div>
                    <div className="feed">
                      <strong>Your weekly possibilities are ready</strong>
                      <p>
                        Discover opportunities across learning, career, and
                        community.
                      </p>
                      <button
                        className="text-btn"
                        onClick={() => nav("explore")}
                      >
                        Take a look <Icon name="arrow" />
                      </button>
                    </div>
                    <div className="feed">
                      <strong>
                        {cancelled
                          ? "An event update needs your attention"
                          : "Leave a little breathing room"}
                      </strong>
                      <p>
                        {cancelled
                          ? "A fictional cancellation is ready to re-plan."
                          : `Your planner leaves ${state.buffer} minutes between commitments.`}
                      </p>
                    </div>
                    <div className="feed">
                      <strong>All campus stories here are fictional</strong>
                      <p>
                        Explore freely. This is a student-built demonstration.
                      </p>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Find your community</h2>
                    {[
                      "AI & learning circle",
                      "Global table",
                      "Career connections",
                    ].map((n) => (
                      <div className="group" key={n}>
                        <span className="group-icon">
                          <Icon name="users" />
                        </span>
                        <strong>{n}</strong>
                      </div>
                    ))}
                    <button className="text-btn" onClick={() => nav("forum")}>
                      Join the conversation <Icon name="arrow" />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          ) : null}
          {page === "explore" || page === "saved" ? (
            <>
              <Heading
                title={
                  page === "saved"
                    ? "Your saved possibilities"
                    : "Explore campus events"
                }
                description={
                  page === "saved"
                    ? "Keep the things that catch your eye in one place."
                    : "Follow your curiosity. There’s more happening than you think."
                }
              />
              <div className="section-bar">
                <Filters value={filter} onChange={setFilter} />
                <span className="date">{list.length} fictional events</span>
              </div>
              {query ? (
                <p>
                  Results for “{query}”{" "}
                  <button
                    className="text-btn"
                    onClick={() => {
                      setQuery("");
                      setSearch("");
                    }}
                  >
                    Clear search
                  </button>
                </p>
              ) : null}
              {cards(list)}
              {!list.length ? (
                <Empty
                  title={
                    page === "saved"
                      ? "Your next possibility is out there"
                      : "No events found"
                  }
                >
                  Try another keyword or category, or bookmark an event.
                  <p>
                    <Button onClick={() => nav("explore")}>
                      Explore events
                    </Button>
                  </p>
                </Empty>
              ) : null}
            </>
          ) : null}
          {page === "review" ? (
            <DataReview onDetail={setDetail} onExit={() => nav("dashboard")} />
          ) : null}
          {page === "planner" ? (
            <>
              <Heading
                title="Your week, with a little guidance."
                description="Discover opportunities that fit your interests and your actual free time."
              >
                <button
                  className="btn"
                  aria-expanded={calendarOpen}
                  aria-controls="planner-calendar"
                  onClick={() => setCalendarOpen((open) => !open)}
                >
                  <Icon name="calendar" />
                  {calendarOpen ? "Hide calendar" : "My calendar"}
                </button>
              </Heading>
              {proposal && (
                <PreferenceProposal
                  topics={proposal.topics}
                  onOnce={() => {
                    const { topics, text } = proposal;
                    setProposal(null);
                    const constraints = { ...demo.read().constraints, topics };
                    delete constraints.explore;
                    void conversation.chat("Find events. " + text, constraints);
                  }}
                  onDismiss={() => setProposal(null)}
                  onManual={() => {
                    setProposal(null);
                    nav("profile");
                  }}
                  onSave={() => {
                    if (proposal.key !== preferenceRevision) {
                      setProposal(null);
                      notify(
                        "Preferences changed. Please review a fresh proposal.",
                      );
                      return;
                    }
                    const topics = proposal.topics;
                    conversation.reset();
                    update((s) => {
                      const p = migratePreferences(s.preferences);
                      return {
                        ...s,
                        preferences: {
                          ...p,
                          use_learning: true,
                          learning_topics: [
                            ...p.learning_topics.filter(
                              (x) => !topics.includes(x.topic),
                            ),
                            ...topics.map((topic) => ({
                              topic,
                              source: "Confirmed from a conversation" as const,
                            })),
                          ],
                        },
                        draft: [],
                        constraints: {},
                      };
                    });
                    setProposal(null);
                    notify(
                      "Confirmed topics saved. You can edit them in My Preferences.",
                    );
                  }}
                />
              )}
              <div className="row">
                <Button
                  onClick={() => {
                    setProposal(null);
                    void conversation.chat("Find events", { explore: true });
                  }}
                >
                  Explore beyond my interests
                </Button>
                <Button onClick={() => nav("profile")}>
                  Edit My Preferences
                </Button>
              </div>
              <DemoLauncher
                state={state}
                busy={busy || enrolling}
                onPrepare={() => {
                  try {
                    if (
                      !localStorage.getItem(STORAGE_KEY + ":before-guided-demo")
                    )
                      localStorage.setItem(
                        STORAGE_KEY + ":before-guided-demo",
                        JSON.stringify(demo.read()),
                      );
                  } catch {
                    notify("Could not archive current demo. Nothing changed.");
                    return false;
                  }
                  enrollment.reset();
                  conversation.reset();
                  update(() => guidedScenario());
                  setCalendarOpen(false);
                  return true;
                }}
                onRestore={() => {
                  try {
                    const saved = localStorage.getItem(
                      STORAGE_KEY + ":before-guided-demo",
                    );
                    if (!saved) {
                      notify("No previous demo has been archived.");
                      return;
                    }
                    localStorage.setItem(STORAGE_KEY, saved);
                    localStorage.removeItem(
                      STORAGE_KEY + ":before-guided-demo",
                    );
                    location.reload();
                  } catch {
                    notify("Could not restore browser storage.");
                  }
                }}
                onPlan={(text) => void chat(text, {})}
                onCancel={() => {
                  const id = demo
                    .read()
                    .plan.find((id) => !demo.read().cancelled.includes(id));
                  if (id)
                    update((s) => ({ ...s, cancelled: [...s.cancelled, id] }));
                }}
                onReplace={replan}
                onExport={exportCalendar}
              />
              {cancelled ? (
                <div className="notice">
                  <strong>One of your plans has changed.</strong>
                  <p>
                    An event was cancelled in this demonstration. Your other
                    choices will stay in place.
                  </p>
                  <Button className="small" onClick={replan} disabled={busy}>
                    Find a replacement
                  </Button>
                </div>
              ) : null}
              <div className="planner-layout">
                <section className="panel chat-panel">
                  <div className="chat-header">
                    <img src="/assets/mascot.png" alt="AI planner mascot" />
                    <div>
                      <h2>Chat with your campus guide</h2>
                      <span className="status-label">
                        <i className="dot green" />
                        {mode} · Name coming soon
                      </span>
                    </div>
                    <button
                      className="text-btn"
                      style={{ marginLeft: "auto" }}
                      onClick={clearChat}
                    >
                      New chat
                    </button>
                  </div>
                  <div
                    className="messages"
                    ref={messagesRef}
                    aria-live="polite"
                  >
                    {displayedMessages.map((m, i) => (
                      <div
                        className={`message ${m.role === "user" ? "user-msg" : ""}`}
                        key={i}
                      >
                        {m.role === "assistant" ? (
                          <img src="/assets/mascot.png" alt="" />
                        ) : null}
                        <div className="bubble">
                          {m.text}
                          {m.role === "assistant" && m.eventIds?.length ? (
                            <ChatEvents
                              ids={m.eventIds}
                              evidence={m.evidence}
                              state={state}
                              onDecline={(id) => {
                                update((s) => ({
                                  ...s,
                                  preferences: {
                                    ...migratePreferences(s.preferences),
                                    dismissed: [
                                      ...new Set([
                                        ...migratePreferences(s.preferences)
                                          .dismissed,
                                        id,
                                      ]),
                                    ],
                                  },
                                  draft: s.draft.filter((x) => x !== id),
                                }));
                              }}
                              onAnother={(id) => {
                                setProposal(null);
                                void conversation.another(id);
                              }}
                              onDetails={setDetail}
                              onAdd={add}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {busy ? (
                      <div className="message">
                        <div className="bubble">
                          Checking interests, timing, and access…
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="prompts">
                    {prompts.map((p) => (
                      <button
                        key={p}
                        disabled={busy}
                        onClick={() => chat(p, {})}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void chat(message);
                    }}
                  >
                    <textarea
                      aria-label="Message your AI planner"
                      placeholder="I’m interested in AI, but I’m only free Tuesday afternoon…"
                      maxLength={1000}
                      disabled={busy}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void chat(message);
                        }
                      }}
                    />
                    <button
                      aria-label="Send message"
                      disabled={busy || !message.trim()}
                    >
                      <Icon name="send" />
                    </button>
                  </form>
                  <p className="fineprint">
                    Simulated responses using fictional events. No live AI or
                    external calendar is connected.
                  </p>
                </section>
                {calendarOpen ? (
                  <PlannerCalendar
                    state={state}
                    onClose={() => setCalendarOpen(false)}
                    onDetails={setDetail}
                  />
                ) : (
                  <aside className="stack">
                    <section className="panel">
                      <div className="section-bar">
                        <h2>Your draft plan</h2>
                        <span className="tag">
                          {draft.length} {draft.length === 1 ? "idea" : "ideas"}
                        </span>
                      </div>
                      {draft.length ? (
                        draft.map((e) => (
                          <div className="draft-item" key={e!.id}>
                            <span className="tag">{e!.category}</span>
                            <button
                              className="event-title"
                              onClick={() => setDetail(e!.id)}
                            >
                              <h3>{e!.title}</h3>
                            </button>
                            <div className="meta">
                              <Icon name="clock" />
                              {when(e!)}
                            </div>
                            <div className="reason">
                              {reasons(e!, state, state.constraints).map(
                                (r) => (
                                  <div key={r}>• {r}</div>
                                ),
                              )}
                            </div>
                            <Button
                              className="small"
                              onClick={() => add(e!.id)}
                            >
                              <Icon name="plus" />
                              Add to my calendar
                            </Button>
                          </div>
                        ))
                      ) : (
                        <Empty title="A little space for possibility">
                          Start a conversation to see a few events selected for
                          you.
                        </Empty>
                      )}
                      <p className="fineprint">
                        You choose what makes it into your week.
                      </p>
                    </section>
                    <section className="panel">
                      <div className="section-bar">
                        <h2>What I’m working with</h2>
                        <Icon name="settings" />
                      </div>
                      {[
                        ["Demo week", WEEK_LABEL],
                        ["Busy commitments", state.blocks.length],
                        ["Travel time", `${state.buffer} minutes`],
                        [
                          "Events in your plan",
                          state.plan.filter(
                            (id) => !state.cancelled.includes(id),
                          ).length,
                        ],
                      ].map(([key, value]) => (
                        <div className="summary-line" key={key}>
                          <span>{key}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                      <p className="sub">{state.interests.join(" · ")}</p>
                      <button
                        className="text-btn"
                        onClick={() => nav("profile")}
                      >
                        Edit interests & availability <Icon name="arrow" />
                      </button>
                    </section>
                    {state.plan.some((id) => !state.cancelled.includes(id)) ? (
                      <section className="panel">
                        <h2>Try a change of plans</h2>
                        <p className="sub">
                          Simulate a cancellation, then find an alternative that
                          fits.
                        </p>
                        <Button
                          className="small"
                          onClick={() => {
                            const id = demo
                              .read()
                              .plan.find(
                                (id) => !demo.read().cancelled.includes(id),
                              );
                            if (id)
                              update((s) => ({
                                ...s,
                                cancelled: [...s.cancelled, id],
                              }));
                            notify(
                              "Demo cancellation created. Your other events are unchanged.",
                            );
                          }}
                        >
                          Simulate event cancellation
                        </Button>
                      </section>
                    ) : null}
                  </aside>
                )}
              </div>
            </>
          ) : null}
          {page === "calendar" ? (
            <>
              <Heading
                title="Make room for what matters."
                description="Your classes, your plans, and a little breathing room."
              >
                <Button onClick={exportCalendar}>
                  <Icon name="download" />
                  Export calendar
                </Button>
              </Heading>

              {cancelled ? (
                <div className="notice">
                  A planned event was cancelled.{" "}
                  <Button className="small" onClick={replan} disabled={busy}>
                    Find a replacement
                  </Button>
                </div>
              ) : null}
              {state.plan.some((id) => {
                const e = EVENTS.find((e) => e.id === id);
                return e && issue(e, state);
              }) && (
                <div className="notice" role="status">
                  Some existing choices no longer fit your saved requirements or
                  commitments. They have been preserved. Review details, edit My
                  Preferences, or remove an event yourself.
                </div>
              )}
              <section className="panel calendar-full">
                <div className="section-bar">
                  <h2>{WEEK_LABEL}</h2>
                  <button className="text-btn" onClick={() => nav("profile")}>
                    Edit availability <Icon name="arrow" />
                  </button>
                </div>
                {week(true)}
                <div className="legend">
                  <span>
                    <i className="dot" />
                    Busy commitments
                  </span>
                  <span>
                    <i className="dot green" />
                    Chosen events
                  </span>
                  <span>
                    {DEMO.time_zone} · {state.buffer}-minute travel buffer
                  </span>
                </div>
              </section>
              <section style={{ marginTop: 28 }}>
                <div className="section-bar">
                  <h2>Your campus plans</h2>
                  <button className="text-btn" onClick={() => nav("planner")}>
                    Find my next event <Icon name="arrow" />
                  </button>
                </div>
                {state.plan.length ? (
                  EVENTS.filter((e) => state.plan.includes(e.id)).map((e) => (
                    <div className="block-row" key={e.id}>
                      <div>
                        <strong>
                          {e.title}
                          {state.cancelled.includes(e.id) ? " · Cancelled" : ""}
                        </strong>
                        <small>
                          {when(e)} · {e.location}
                        </small>
                      </div>
                      <Button className="small" onClick={() => remove(e.id)}>
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <Empty title="Your week is waiting">
                    Choose an event or ask the planner to help you get started.
                    <p>
                      <Button
                        className="primary"
                        onClick={() => nav("planner")}
                      >
                        Plan with me
                      </Button>
                    </p>
                  </Empty>
                )}
              </section>
            </>
          ) : null}
          {page === "profile" ? (
            <Profile
              state={state}
              update={update}
              notify={notify}
              onClearChat={clearChat}
              onDirtyChange={setPreferenceDirty}
            />
          ) : null}
          {page === "forum" ? (
            <Forum
              state={state}
              update={update}
              notify={notify}
              selected={selectedCommunity}
              onSelect={(id) => nav("forum", id ?? undefined)}
            />
          ) : null}
          {page === "settings" ? (
            <section className="panel briefing">
              <h2>Team tools</h2>
              <p>
                Read-only review of fictional event quality, separate from
                student planning.
              </p>
              <Button onClick={() => nav("review")}>
                Open synthetic-data review
              </Button>
            </section>
          ) : null}
          {page === "settings" ? (
            <Settings
              state={state}
              update={update}
              notify={notify}
              onReset={() => {
                conversation.reset();
                enrollment.reset();
                setCalendarOpen(false);
                update(fresh);
                nav("dashboard");
                notify("Demo restored. You’re ready to present.");
              }}
            />
          ) : null}
          <footer className="section-footer">
            <span>
              Campus Compass · IBM AI Experiential Learning Lab project
            </span>
            <span>
              Fictional data · Demo week, {WEEK_LABEL} · {DEMO.time_zone}
            </span>
          </footer>
        </main>
      </div>
      <div
        id="toast"
        role="status"
        aria-live="polite"
        className={toast ? "show" : ""}
      >
        {toast}
      </div>
      {rsvpEvent ? (
        <RsvpDialog
          key={rsvpEvent}
          event={EVENTS.find((e) => e.id === rsvpEvent)!}
          name={state.name}
          busy={enrolling}
          onClose={enrollment.cancel}
          onSubmit={completeEnrollment}
        />
      ) : null}
      {detailEvent ? (
        <EventDetails
          event={detailEvent}
          state={state}
          onClose={() => setDetail(null)}
          onAdd={add}
          onRemove={remove}
          onSave={save}
        />
      ) : null}
    </>
  );
}
