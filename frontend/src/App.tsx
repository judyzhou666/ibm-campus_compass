import { useEffect, useRef, useState } from "react";
import { EVENTS, when } from "./data.ts";
import { issue, reasons } from "./planner.ts";
import { planningKey, requestPlan, enrollEvent } from "./api.ts";
import { fresh, restore, STORAGE_KEY } from "./state.ts";
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
import { Forum, Profile, Settings } from "./Pages.tsx";
import type { Constraints, DemoState, Message, Rsvp } from "./types.ts";

const labels = {
  dashboard: "Dashboard",
  calendar: "My Calendar",
  explore: "Explore Events",
  forum: "Discussion Forum",
  planner: "AI Planner",
  saved: "Saved Events",
  profile: "Profile",
  settings: "Settings",
};
type Page = keyof typeof labels;
const navIcons: Record<Page, string> = {
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
const validPage = (s: string): Page =>
  s in labels ? (s as Page) : "dashboard";
const recognizable =
  /\b(ai|education|research|learning|tech|coding|data|career|job|industry|alumni|networking|resume|social|friend|friends|meet|people|dinner|lunch|community|art|arts|culture|cultural|film|museum|creative|sketch|wellbeing|wellness|relax|mindful|movement|quiet|plan|event|events|week|free|after|before|afternoon|morning|evening|tuesday|thursday|monday|wednesday|friday|weekend|coffee|tea|options|choices|reset|start over)\b/i;

export default function App() {
  const [state, setState] = useState(restore),
    current = useRef(state);
  const [page, setPage] = useState<Page>(() =>
    validPage(location.hash.slice(1)),
  );
  const [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    locked = useRef(false),
    epoch = useRef(0);
  const [message, setMessage] = useState(""),
    [detail, setDetail] = useState<string | null>(null),
    [menu, setMenu] = useState(false);
  const [toast, setToast] = useState(""),
    [mode, setMode] = useState("Simulated planner");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rsvpEvent, setRsvpEvent] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const enrollmentLock = useRef(false),
    enrollmentVersion = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  function update(change: (s: DemoState) => DemoState) {
    const next = change(current.current);
    current.current = next;
    setState(next);
  }
  function notify(text: string) {
    setToast(text);
  }
  function nav(next: Page) {
    setPage(next);
    setMenu(false);
    setDetail(null);
    setFilter("All");
    setQuery("");
    setSearch("");
    location.hash = next;
    window.scrollTo(0, 0);
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
      setPage(validPage(location.hash.slice(1)));
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
    epoch.current++;
    locked.current = false;
    setBusy(false);
    update((s) => ({ ...s, messages: [], constraints: {}, draft: [] }));
    setMessage("");
  }
  function remove(id: string) {
    update((s) => ({
      ...s,
      plan: s.plan.filter((x) => x !== id),
      rsvps: s.rsvps.filter((x) => x !== id),
    }));
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
  function add(id: string) {
    if (enrollmentLock.current) return;
    const event = EVENTS.find((e) => e.id === id);
    if (!event) return;
    if (current.current.plan.includes(id)) {
      setCalendarOpen(true);
      notify("This event is already in your calendar.");
      return;
    }
    const problem = issue(event, current.current);
    if (problem) {
      notify(problem);
      setDetail(id);
      return;
    }
    if (event.rsvp === "RSVP required") {
      setDetail(null);
      setRsvpEvent(id);
      return;
    }
    void completeEnrollment(id);
  }
  async function completeEnrollment(
    id: string,
    rsvp?: Rsvp,
  ): Promise<string | null> {
    if (enrollmentLock.current) return "An addition is already in progress.";
    enrollmentLock.current = true;
    setEnrolling(true);
    const version = enrollmentVersion.current;
    try {
      const result = await enrollEvent(id, current.current, rsvp);
      if (version !== enrollmentVersion.current)
        return "The demo was reset. Please try again.";
      const event = EVENTS.find((e) => e.id === id)!;
      const problem = issue(event, current.current);
      if (problem) throw new Error(problem);
      if (!current.current.plan.includes(id))
        update((s) => ({
          ...s,
          plan: [...s.plan, id],
          rsvps: result.rsvpConfirmed
            ? [...s.rsvps.filter((x) => x !== id), id]
            : s.rsvps,
          draft: s.draft.filter((x) => x !== id),
        }));
      setRsvpEvent(null);
      setDetail(null);
      setCalendarOpen(true);
      notify(
        (result.rsvpConfirmed ? "Demo RSVP confirmed. " : "") +
          "Added to your calendar." +
          (result.notice ? " " + result.notice : ""),
      );
      return null;
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Could not add this event. Please try again.";
      notify(text);
      return text;
    } finally {
      if (version === enrollmentVersion.current) {
        enrollmentLock.current = false;
        setEnrolling(false);
      }
    }
  }
  async function chat(text: string, previous?: Constraints) {
    if (locked.current || !text.trim()) return;
    text = text.trim();
    if (
      /\b(cancelled|canceled|replacement|replan|re-plan)\b/i.test(text) &&
      current.current.cancelled.some((id) => current.current.plan.includes(id))
    ) {
      await replan();
      return;
    }
    locked.current = true;
    setBusy(true);
    const token = ++epoch.current;
    setMessage("");
    update((s) => ({
      ...s,
      constraints: previous ?? s.constraints,
      messages: [...s.messages, { role: "user", text }],
    }));
    const snapshot = current.current,
      key = planningKey(snapshot);
    try {
      if (!recognizable.test(text)) {
        update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text: "I’m a limited demo planner. Try an interest such as AI, career, social, arts, or wellbeing, plus a day or time. For example: “AI events on Tuesday after 1 PM.”",
            },
          ],
        }));
        return;
      }
      const result = await requestPlan(text, snapshot.constraints, snapshot);
      if (token !== epoch.current) return;
      if (key !== planningKey(current.current)) {
        update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text: "Your schedule or preferences changed while I was planning. Please send your request again so I can use the latest details.",
            },
          ],
        }));
        return;
      }
      setMode(
        result.source === "rust"
          ? "Rust planner · Simulated"
          : "Browser fallback · Simulated",
      );
      const matches = result.ids
        .map((id) => EVENTS.find((e) => e.id === id))
        .filter((e) => e && !issue(e, current.current));
      let response = matches.length
        ? `I found ${matches.length} ${matches.length === 1 ? "option" : "options"} for your week. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
        : "I couldn’t find a verified, conflict-free match for those constraints in this demo week. I haven’t changed your calendar.\n\nTry a different day or interest, or say “start over” to clear time and food filters. Only Monday–Friday events are available. Restricted, full, cancelled, and conflicting events are excluded.";
      if (result.notice) response = result.notice + "\n\n" + response;
      update((s) => ({
        ...s,
        constraints: result.constraints,
        draft: matches.map((e) => e!.id),
        messages: [
          ...s.messages,
          {
            role: "assistant",
            text: response,
            eventIds: matches.map((e) => e!.id),
          },
        ],
      }));
    } catch (error) {
      if (token === epoch.current)
        update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text:
                error instanceof Error
                  ? error.message
                  : "The planner could not finish. Try again.",
            },
          ],
        }));
    } finally {
      if (token === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function replan() {
    if (locked.current) return;
    const old = EVENTS.find(
      (e) =>
        current.current.plan.includes(e.id) &&
        current.current.cancelled.includes(e.id),
    );
    if (!old) {
      notify("There are no cancelled events in your plan.");
      return;
    }
    locked.current = true;
    setBusy(true);
    const token = ++epoch.current;
    nav("planner");
    update((s) => ({
      ...s,
      plan: s.plan.filter((id) => id !== old.id),
      rsvps: s.rsvps.filter((id) => id !== old.id),
    }));
    const snapshot = current.current,
      key = planningKey(snapshot);
    try {
      const constraints = {
        ...snapshot.constraints,
        topics: [old.topic],
        limit: 1,
      };
      let result = await requestPlan("Find events", constraints, snapshot),
        trade = "";
      if (!result.ids.length) {
        const relaxed = { ...constraints };
        delete relaxed.days;
        delete relaxed.after;
        delete relaxed.before;
        result = await requestPlan("Find events", relaxed, snapshot);
        trade =
          "I relaxed your chat day/time filters to show a possible alternative; review the new time before adding it.";
      }
      if (token !== epoch.current) return;
      if (key !== planningKey(current.current)) {
        update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text: "Your schedule changed. The cancelled entry was removed; ask for another suggestion using your latest availability.",
            },
          ],
        }));
        return;
      }
      const alternative = EVENTS.find((e) => e.id === result.ids[0]);
      setMode(
        result.source === "rust"
          ? "Rust planner · Simulated"
          : "Browser fallback · Simulated",
      );
      const response = `“${old.title}” was cancelled in this simulation. I removed the cancelled entry and kept all your other calendar choices.\n\n${alternative ? `An alternative is “${alternative.title}” on ${when(alternative)}. It shares the ${old.topic.toLowerCase()} topic and fits your schedule. ${trade}\n\nIt’s a suggestion only. Add it if it works for you.` : "No eligible alternative in the same topic fits your current schedule. Try changing your availability or choosing another interest."}${result.notice ? "\n\n" + result.notice : ""}`;
      update((s) => ({
        ...s,
        draft: result.ids,
        messages: [
          ...s.messages,
          { role: "assistant", text: response, eventIds: result.ids },
        ],
      }));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not find a replacement. Try the planner again.",
      );
    } finally {
      if (token === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  function exportCalendar() {
    const text = calendarText(current.current);
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
    EVENTS.filter((e) => !state.plan.includes(e.id) && !issue(e, state)),
  ).sort(
    (a, b) =>
      Number(state.interests.includes(b.topic)) -
        Number(state.interests.includes(a.topic)) ||
      a.day - b.day ||
      a.start - b.start,
  );

  return (
    <>
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
          {(Object.keys(labels) as Page[]).map((p, i) => (
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
              setQuery(search.trim());
              setFilter("All");
              setPage("explore");
              location.hash = "explore";
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
            <span className="term">Fall semester 2026</span>
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
                    <Filters value={filter} onChange={setFilter} />
                    {cards(recommended.slice(0, 3))}
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
                              state={state}
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
                        ["Demo week", "Oct 19–23"],
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
                            const id = current.current.plan.find(
                              (id) => !current.current.cancelled.includes(id),
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
              <section className="panel calendar-full">
                <div className="section-bar">
                  <h2>October 19–23, 2026</h2>
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
                    Eastern Time · {state.buffer}-minute travel buffer
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
            <Profile state={state} update={update} notify={notify} />
          ) : null}
          {page === "forum" ? (
            <Forum state={state} update={update} notify={notify} />
          ) : null}
          {page === "settings" ? (
            <Settings
              state={state}
              update={update}
              notify={notify}
              onReset={() => {
                epoch.current++;
                locked.current = false;
                setBusy(false);
                enrollmentVersion.current++;
                enrollmentLock.current = false;
                setEnrolling(false);
                setRsvpEvent(null);
                setCalendarOpen(false);
                update(fresh);
                nav("dashboard");
                setMode("Simulated planner");
                notify("Demo restored. You’re ready to present.");
              }}
            />
          ) : null}
          <footer className="section-footer">
            <span>
              Campus Compass · IBM AI Experiential Learning Lab project
            </span>
            <span>
              Fictional data · Demo week, Oct 19–23, 2026 · Eastern Time
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
          onClose={() => setRsvpEvent(null)}
          onSubmit={(rsvp) => completeEnrollment(rsvpEvent, rsvp)}
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
