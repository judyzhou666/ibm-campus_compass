import { DataReview } from "./DataReview.tsx";
import { DemoLauncher } from "./DemoLauncher.tsx";
import { guidedScenario } from "./demoScenario.ts";
import { DEMO, WEEK_LABEL, isTimeZone, weekDayLabel } from "./config.ts";
import { CalendarView } from "./CalendarView.tsx";
import { communityFromHash, communityHash } from "./communities.ts";
import { handlePopState, initHistory, useSubPage } from "./navigation.ts";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  SignInDialog,
  Filters,
  Heading,
  Icon,
  Week,
} from "./components.tsx";
import { ChatEvents, PlannerCalendar, RsvpDialog } from "./PlannerPanels.tsx";
import { Briefing, Welcome } from "./Briefing.tsx";
import { Forum, Profile, Settings } from "./Pages.tsx";
import {
  NotificationDetail,
  NotificationMenu,
  NotificationsPage,
} from "./Notifications.tsx";
import {
  allNotifications,
  NO_FILTER,
  unreadOf,
  type NotificationFilter,
} from "./notifications.ts";
import type { Constraints, Message, Rsvp } from "./types.ts";
import { applyNextBatch, nextBatch, relativeTime, effectiveEvents } from "./updates.ts";

const labels = {
  review: "Team data review",
  dashboard: "My Dashboard",
  calendar: "My Calendar",
  explore: "Explore Events",
  forum: "Discussion Forum",
  planner: "AI Planner",
  saved: "Saved Events",
  profile: "Profile",
  settings: "Settings",
  notifications: "Notifications",
};
type Page = keyof typeof labels;
interface ToastAction {
  label: string;
  run: () => void;
}
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
  notifications: "bell",
};
/** Pages reached from elsewhere in the app, not from the sidebar. */
const hiddenFromSidebar: Page[] = ["review", "notifications", "calendar"];
/** Hidden pages whose sidebar parent stays highlighted while they are open. */
const sidebarParent: Partial<Record<Page, Page>> = { calendar: "dashboard" };
const prompts = [
  "AI and education on Tuesday or Thursday afternoons",
  "A social event with free food",
  "Career events after 1 PM",
];
const SIDEBAR_KEY = "campus-compass:sidebar-collapsed";
const validPage = (s: string): Page => {
  const page = s.split("?")[0];
  return page in labels ? (page as Page) : "dashboard";
};
export default function App() {
  const [demo] = useState(() => createStore(restore()));
  const state = useSyncExternalStore(demo.subscribe, demo.read);
  // Remember whether this page load began before onboarding, so the first
  // visit greets with "Welcome" rather than "Welcome back".
  const [firstVisit] = useState(() => !state.onboarded);
  const update = demo.update;
  // Check whether the backend is in watsonx mode to hide simulated-only UI and
  // forward unrecognised messages to the server for model interpretation.
  const watsonxModeRef = useRef(false);
  const [watsonxMode, setWatsonxMode] = useState(false);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: { mode?: string }) => {
        const isWatsonx = h.mode === "watsonx";
        watsonxModeRef.current = isWatsonx;
        setWatsonxMode(isWatsonx);
      })
      .catch(() => {});
  }, []);
  const [enrollment] = useState(() => createEnrollment(demo));
  const [conversation] = useState(() =>
    createConversation(demo, enrollment.remove, globalThis.fetch, () => watsonxModeRef.current),
  );
  const { busy, mode } = useSyncExternalStore(
    conversation.subscribe,
    conversation.read,
  );
  /** Label shown in the chat header status area. Before the first reply it
   *  reflects the health endpoint mode; after a reply it reflects the plan mode. */
  const chatStatusLabel =
    state.messages.length === 0
      ? watsonxMode
        ? "IBM watsonx (Granite) · Ranking and explaining picks · Fictional events"
        : "Simulated planner · No live AI"
      : mode;
  const chatFineprint = watsonxMode
    ? "IBM watsonx (Granite) is ranking and explaining picks. All events are fictional demo data."
    : "Simulated responses using fictional events. No live AI or external calendar is connected.";
  const { busy: enrolling, rsvpEvent } = useSyncExternalStore(
    enrollment.subscribe,
    enrollment.read,
  );
  // Before any sub-page pushes an entry (see navigation.ts).
  useState(initHistory);
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
  // Desktop-only: the student can shrink the sidebar to an icon rail. The
  // choice is a per-browser convenience, so storage failures are ignored.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);
  // Notifications: the bell dropdown, the open message, and the page the
  // student was on before opening the Notifications sub-page.
  const [bellOpen, setBellOpen] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [notesFrom, setNotesFrom] = useState<Page>("dashboard");
  const [noteFilter, setNoteFilter] = useState<NotificationFilter>(NO_FILTER);
  // My Calendar is a sub-page of the page it was opened from (usually My
  // Dashboard); the dashboard's Weekly Calendar can step through weeks.
  const [calendarFrom, setCalendarFrom] = useState<Page>("dashboard");
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState("");
  const [toastActions, setToastActions] = useState<ToastAction[]>([]);
  const [toastHeld, setToastHeld] = useState(false);
  // Bumped after a toast action: its button unmounts with the toast, so move
  // focus to the page heading once the page has rendered.
  const [focusHeading, setFocusHeading] = useState(0);
  useEffect(() => {
    if (!focusHeading) return;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [focusHeading]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      enrollment.reset();
      conversation.reset();
    },
    [enrollment, conversation],
  );
  function notify(text: string, actions: ToastAction[] = []) {
    setToast(text);
    setToastActions(actions);
    setToastHeld(false);
  }
  function nav(next: Page, communityId?: string) {
    setSelectedCommunity(next === "forum" && communityId ? communityId : null);
    setPage(next);
    setMenu(false);
    setDetail(null);
    setOpenNote(null);
    setBellOpen(false);
    setFilter("All");
    setQuery("");
    setSearch("");
    // The URL follows page state (see the URL effect below); switching tabs
    // replaces the history entry, so Back never steps between sibling tabs.
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      notify(
        "Changes are available for this session only. Browser storage is unavailable.",
      );
    }
  }, [state]);
  useEffect(() => {
    // Hold the toast while the pointer or keyboard focus is on it; give
    // toasts with actions longer to be read and used.
    if (!toast || toastHeld) return;
    const timer = setTimeout(
      () => setToast(""),
      toastActions.length ? 9000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [toast, toastActions, toastHeld]);
  // Sub-pages: Back closes an open community or the event details overlay
  // before anything else (see navigation.ts).
  const closeCommunity = useSubPage(
    page === "forum" && selectedCommunity !== null,
    () => setSelectedCommunity(null),
  );
  // Notifications is a sub-page of whatever page it was opened from, and an
  // open message is a sub-page of Notifications: Back from a message shows
  // the full list, and Back again returns to the earlier page. Declared in
  // this order so both register in this order when opened together.
  const closeCalendar = useSubPage(page === "calendar", () =>
    setPage(calendarFrom),
  );
  useSubPage(page === "notifications", () => {
    setOpenNote(null);
    setPage(notesFrom);
  });
  const closeNote = useSubPage(
    page === "notifications" && openNote !== null,
    () => setOpenNote(null),
  );
  const closeDetail = useSubPage(detail !== null, () => setDetail(null));
  // The synthetic-data review is opened from Settings, not the sidebar, so
  // Back returns to Settings.
  useSubPage(page === "review", () => setPage("settings"));
  // Keep the URL in step with the current tab without adding history.
  const appUrl =
    page === "forum" && selectedCommunity
      ? communityHash(selectedCommunity)
      : `#${page}`;
  const appUrlRef = useRef(appUrl);
  appUrlRef.current = appUrl;
  useEffect(() => {
    if (location.hash !== appUrl) history.replaceState(history.state, "", appUrl);
  }, [appUrl]);
  // Back / swipe-back: close the innermost sub-page; on a top-level tab,
  // nothing happens.
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      handlePopState(
        e,
        () => {
          // A link or typed URL changed the hash: go there as a tab switch.
          setPage(validPage(location.hash.slice(1)));
          setSelectedCommunity(communityFromHash(location.hash));
          setDetail(null);
          setOpenNote(null);
          setMenu(false);
        },
        () => appUrlRef.current,
      );
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
  function checkForUpdates() {
    const current = demo.read();
    const { nextState, applied, batch, movedConflicts } = applyNextBatch(current);
    if (!applied.length) {
      notify(
        "No more update batches. All synthetic updates have been applied. · Synthetic update",
      );
      return;
    }
    update(() => nextState);
    nav("dashboard");
    const planned = applied.filter((u) =>
      current.plan.includes(u.event_id),
    );
    const planNotice =
      planned.length > 0
        ? ` ${planned.length} of your planned event${planned.length > 1 ? "s" : ""} ${planned.length > 1 ? "are" : "is"} affected.`
        : "";
    const conflictNotice =
      movedConflicts.length > 0
        ? ` A time change now conflicts with your schedule — use "Find a replacement" to update your plan.`
        : "";
    notify(
      `${batch!.label}: ${applied.length} update${applied.length > 1 ? "s" : ""} applied.${planNotice}${conflictNotice} See Briefing for details. · Synthetic update`,
      planned.length > 0
        ? [{ label: "View briefing", run: () => nav("dashboard") }]
        : [],
    );
  }

  function markRead(ids: string[]) {
    update((s) => ({
      ...s,
      readNotificationIds: [
        ...s.readNotificationIds,
        ...ids.filter((id) => !s.readNotificationIds.includes(id)),
      ],
    }));
  }
  function markUnread(id: string) {
    update((s) => ({
      ...s,
      readNotificationIds: s.readNotificationIds.filter((x) => x !== id),
    }));
  }
  /** Opens the My Calendar sub-page; Back returns to the current page. */
  function openCalendar() {
    if (page !== "calendar") setCalendarFrom(page);
    nav("calendar");
  }
  /** Opens the Notifications sub-page, optionally at one message. */
  function openNotifications(id?: string) {
    if (page !== "notifications") {
      setNotesFrom(page);
      setNoteFilter(NO_FILTER);
    }
    nav("notifications");
    if (id) {
      setOpenNote(id);
      markRead([id]);
    }
  }
  function openNotification(id: string) {
    setOpenNote(id);
    markRead([id]);
    window.scrollTo(0, 0);
  }

  function clearChat() {
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
  function presentEnrollment(
    id: string,
    result: EnrollmentOutcome,
    draftBefore: string[],
  ): string | null {
    if (result.kind === "added") {
      setDetail(null);
      setCalendarOpen(true);
      notify(result.notice, [
        { label: "View calendar", run: () => openCalendar() },
        {
          label: "Undo",
          run: () => {
            enrollment.remove(id);
            // Adding takes the event out of the planner's draft ideas; put it
            // back where it was so Undo returns to the earlier state.
            const at = draftBefore.indexOf(id);
            if (at >= 0)
              update((s) =>
                s.draft.includes(id)
                  ? s
                  : {
                      ...s,
                      draft: [
                        ...s.draft.slice(0, at),
                        id,
                        ...s.draft.slice(at),
                      ],
                    },
              );
            notify("Removed from your calendar.");
          },
        },
      ]);
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
    const draftBefore = demo.read().draft;
    const result = await enrollment.choose(id);
    if (result.kind === "rejected") setDetail(id);
    presentEnrollment(id, result, draftBefore);
  }
  async function completeEnrollment(id: string, rsvp: Rsvp) {
    const draftBefore = demo.read().draft;
    return presentEnrollment(id, await enrollment.confirm(rsvp), draftBefore);
  }
  async function chat(text: string, previous?: Constraints) {
    if (conversation.read().busy || !text.trim()) return;
    setMessage("");
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
  const FOOD_FILTERS: Record<string, string> = {
    "Free Food": "Free meal",
    "Coffee & snacks": "Coffee & snacks",
    "Paid food": "Paid food",
    "No food": "None",
    "Food unknown": "Unknown",
  };
  const filterEvents = (list: typeof EVENTS) =>
    list.filter(
      (e) =>
        (filter === "All" ||
          (filter in FOOD_FILTERS
            ? e.food === FOOD_FILTERS[filter]
            : e.category === filter)) &&
        (!query ||
          `${e.title} ${e.description} ${e.topic} ${e.food} ${e.host_school ?? ""} ${(e.goal_type ?? []).join(" ")}`
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
          onCalendar={openCalendar}
        />
      ))}
    </div>
  );
  // Shared by the Dashboard strip and the My Calendar "+" buttons.
  const findOnDay = (day: number) => {
    nav("planner");
    void chat(
      `Find events on ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day]}`,
      { days: [day] },
    );
  };
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
  // A plan event is "unavailable" when explicitly cancelled OR when a time_moved
  // update has shifted it into a conflict with a busy block or another plan event.
  const effEvents = effectiveEvents(state.appliedUpdateIds);
  const cancelled =
    state.cancelled.some((id) => state.plan.includes(id)) ||
    state.plan.some(
      (id) =>
        !state.cancelled.includes(id) &&
        (() => {
          const eff = effEvents.find((e) => e.id === id);
          return eff ? !!issue(eff, state, effEvents) : false;
        })(),
    );
  const detailEvent = EVENTS.find((e) => e.id === detail);
  const campusZone = isTimeZone(state.timezone) ? state.timezone : DEMO.time_zone;
  const notifications = allNotifications(state.appliedUpdateIds);
  const unreadNotes = unreadOf(notifications, state.readNotificationIds);
  const updatesWaiting = nextBatch(state.appliedUpdateIds) !== null;
  const openNotification_ = notifications.find((n) => n.id === openNote);
  const list = filterEvents(
    page === "saved"
      ? EVENTS.filter((e) => state.saved.includes(e.id))
      : EVENTS,
  );

  return (
    <>
      {!state.onboarded ? (
        <Welcome
          onStart={() => {
            update((s) => ({ ...s, onboarded: true }));
            nav("profile");
          }}
          onSkip={() => update((s) => ({ ...s, onboarded: true }))}
        />
      ) : null}
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
        <a
          className="brand"
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            nav("dashboard");
          }}
        >
          <span className="logo">
            <Icon name="compass" />
          </span>
          <span className="brand-text">
            Campus<small>COMPASS</small>
          </span>
        </a>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setFilter("All");
            setPage("explore");
          }}
        >
          <Icon name="search" />
          <input
            aria-label="Search events"
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="search-go" aria-label="Search">
            <Icon name="search" />
          </button>
        </form>
        <nav className="top-links" aria-label="Quick links">
          {(
            [
              ["explore", "Find events"],
              ["calendar", "My calendar"],
              ["forum", "Forum"],
            ] as [Page, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              aria-current={page === p ? "page" : undefined}
              onClick={() => (p === "calendar" ? openCalendar() : nav(p))}
            >
              {label}
            </button>
          ))}
          <button
            className={`top-cta ${page === "planner" ? "active" : ""}`}
            aria-current={page === "planner" ? "page" : undefined}
            onClick={() => nav("planner")}
          >
            Plan with AI
          </button>
        </nav>
        <div className="top-actions">
          <div className="bell-wrap">
            <button
              className="icon-btn bell-btn"
              aria-label={
                unreadNotes.length
                  ? `Notifications, ${unreadNotes.length} unread`
                  : updatesWaiting
                    ? "Notifications, new synthetic updates available"
                    : "Notifications"
              }
              aria-expanded={bellOpen}
              aria-controls="notification-menu"
              onClick={() => setBellOpen((open) => !open)}
            >
              <Icon name="bell" />
              {unreadNotes.length || updatesWaiting ? (
                <span className="bell-dot" aria-hidden="true" />
              ) : null}
            </button>
            {bellOpen ? (
              <NotificationMenu
                unread={unreadNotes}
                timeZone={campusZone}
                updatesWaiting={updatesWaiting}
                onOpen={(id) => openNotifications(id)}
                onViewAll={() => openNotifications()}
                onCheckUpdates={() => {
                  checkForUpdates();
                  // Keep the menu open so the new updates show in it.
                  setBellOpen(true);
                }}
                onMarkAllRead={() => markRead(unreadNotes.map((n) => n.id))}
                onClose={() => setBellOpen(false)}
              />
            ) : null}
          </div>
          {state.signedIn ? (
            <button
              className="avatar"
              aria-label={`Open profile for ${state.name}`}
              style={{ border: 0 }}
              onClick={() => nav("profile")}
            >
              {state.name[0] || "J"}
            </button>
          ) : (
            <button className="sign-in" onClick={() => setSigningIn(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>
      <aside
        className={`sidebar ${menu ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
        id="sidebar"
      >
        <button
          className="collapse-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
        </button>
        <nav className="nav" aria-label="Main navigation">
          {(
            Object.keys(labels).filter(
              (key) => !hiddenFromSidebar.includes(key as Page),
            ) as Page[]
          ).map((p) => (
            <div key={p}>
              {p === "profile" ? <div className="break" /> : null}
              <button
                className={
                  page === p || sidebarParent[page] === p ? "active" : ""
                }
                aria-current={page === p ? "page" : undefined}
                title={collapsed ? labels[p] : undefined}
                aria-label={collapsed ? labels[p] : undefined}
                onClick={() => nav(p)}
              >
                <Icon name={navIcons[p]} />
                <span className="nav-label">{labels[p]}</span>
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
          {state.signedIn ? (
            <div className="user">
              <span className="avatar">{state.name[0] || "J"}</span>
              <div>
                <strong>{state.name}’s campus</strong>
                <small>Graduate student · Demo profile</small>
              </div>
            </div>
          ) : (
            <div className="user">
              <span className="avatar guest">
                <Icon name="user" />
              </span>
              <div>
                <strong>Guest</strong>
                <small>Not signed in · Demo</small>
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className="shell">
        <main id="main">
          {page === "dashboard" ? (
            <>
              <Heading
                title={
                  state.signedIn
                    ? `${firstVisit ? "Welcome" : "Welcome back"}, ${state.name}.`
                    : "Welcome to Campus Compass."
                }
                description="A little direction. A world of campus possibilities."
                timezone={state.timezone}
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
                    <div className="section-bar weekly-bar">
                      <h2>Weekly Calendar</h2>
                      <div className="week-nav">
                        <button
                          className="icon-btn"
                          aria-label="Previous week"
                          onClick={() => setWeekOffset((w) => w - 1)}
                        >
                          <Icon name="chevronLeft" />
                        </button>
                        <span className="week-nav-label" aria-live="polite">
                          {weekDayLabel(0, weekOffset)} – {weekDayLabel(4, weekOffset)}
                        </span>
                        <button
                          className="icon-btn"
                          aria-label="Next week"
                          onClick={() => setWeekOffset((w) => w + 1)}
                        >
                          <Icon name="chevronRight" />
                        </button>
                      </div>
                      <button className="text-btn" onClick={openCalendar}>
                        Full Calendar <Icon name="arrow" />
                      </button>
                    </div>
                    {weekOffset !== 0 ? (
                      <p className="week-nav-note">
                        Campus events in this demo are only in the week of{" "}
                        {weekDayLabel(0)}–{weekDayLabel(4)}, so this week shows
                        classes only.{" "}
                        <button
                          className="text-btn"
                          onClick={() => setWeekOffset(0)}
                        >
                          Back to demo week
                        </button>
                      </p>
                    ) : null}
                    <Week
                      state={state}
                      weekOffset={weekOffset}
                      onDetail={setDetail}
                      onDay={findOnDay}
                    />
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
                    <Briefing
                      state={state}
                      onDetail={setDetail}
                      onPlanner={() => nav("planner")}
                      onCalendar={openCalendar}
                      onCheckUpdates={checkForUpdates}
                    />
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
                timezone={state.timezone}
                description={
                  page === "saved"
                    ? "Keep the things that catch your eye in one place."
                    : "Follow your curiosity. There’s more happening than you think."
                }
              />
              <div className="section-bar">
                <Filters value={filter} onChange={setFilter} />
                <span className="date">
                  {list.length} fictional {list.length === 1 ? "event" : "events"}
                </span>
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
          {page === "notifications" ? (
            openNotification_ ? (
              <NotificationDetail
                notification={openNotification_}
                timeZone={campusZone}
                onBack={closeNote}
                onViewEvent={setDetail}
                onOpenCommunity={(id) => nav("forum", id)}
                onExplore={() => nav("explore")}
                onMarkUnread={() => {
                  markUnread(openNotification_.id);
                  closeNote();
                }}
              />
            ) : (
              <NotificationsPage
                list={notifications}
                readIds={state.readNotificationIds}
                timeZone={campusZone}
                filter={noteFilter}
                setFilter={setNoteFilter}
                onOpen={openNotification}
                onMarkAllRead={() => markRead(unreadNotes.map((n) => n.id))}
              />
            )
          ) : null}
          {page === "review" ? (
            <DataReview onDetail={setDetail} onExit={() => nav("dashboard")} />
          ) : null}
          {page === "planner" ? (
            <>
              <Heading
                title="Your week, with a little guidance."
                description="Discover opportunities that fit your interests and your actual free time."
                timezone={state.timezone}
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
              <DemoLauncher
                state={state}
                busy={busy || enrolling}
                watsonxMode={watsonxMode}
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
                    An event in your plan is now unavailable — cancelled, full, or moved into a conflict. Your other choices will stay in place.
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
                        {chatStatusLabel}
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
                  <p className="fineprint">{chatFineprint}</p>
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
                    <section className="panel">
                      <div className="section-bar">
                        <h2>Event updates</h2>
                        <Icon name="bell" />
                      </div>
                      <p className="sub">
                        Apply the next batch of synthetic demo updates — cancellations, capacity, time or room changes.
                      </p>
                      <Button
                        className="small"
                        onClick={checkForUpdates}
                      >
                        <Icon name="bell" />
                        Check for updates
                      </Button>
                      {state.lastUpdateCheck ? (
                        <p className="fineprint">
                          Last checked {relativeTime(state.lastUpdateCheck)} · Synthetic update
                        </p>
                      ) : null}
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
              <button className="text-btn sub-page-back" onClick={closeCalendar}>
                <span className="flip">
                  <Icon name="arrow" />
                </span>
                Back to {labels[calendarFrom]}
              </button>
              <Heading
                title="Make room for what matters."
                description="Your classes, your plans, and a little breathing room."
                timezone={state.timezone}
              />

              {cancelled ? (
                <div className="notice">
                  A planned event is now unavailable — cancelled, full, or moved into a conflict.{" "}
                  <Button className="small" onClick={replan} disabled={busy}>
                    Find a replacement
                  </Button>
                </div>
              ) : null}

              <CalendarView
                state={state}
                onDetail={setDetail}
                onDay={findOnDay}
                onEditAvailability={() => nav("profile")}
                onExportCalendar={exportCalendar}
              />

              <section style={{ marginTop: 28 }}>
                <div className="section-bar">
                  <h2>Your campus plans</h2>
                  <button className="text-btn" onClick={() => nav("planner")}>
                    Find my next event <Icon name="arrow" />
                  </button>
                </div>
                {state.plan.length ? (
                  effEvents.filter((e) => state.plan.includes(e.id)).map((e) => (
                    <div className="block-row" key={e.id}>
                      <div>
                        <strong>
                          {e.title}
                          {state.cancelled.includes(e.id) ? " · Cancelled" : ""}
                        </strong>
                        <small>
                          {when(e)} · {e.location}
                          {(() => {
                            const o = EVENTS.find((x) => x.id === e.id);
                            return o && (o.start !== e.start || o.end !== e.end) ? " · Time changed" : "";
                          })()}
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
            <Profile state={state} update={update} notify={notify} watsonxMode={watsonxMode} />
          ) : null}
          {page === "forum" ? (
            <Forum
              state={state}
              update={update}
              notify={notify}
              selected={selectedCommunity}
              onSelect={(id) => (id ? nav("forum", id) : closeCommunity())}
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
        className={toast ? "show" : ""}
        onMouseEnter={() => setToastHeld(true)}
        onMouseLeave={() => setToastHeld(false)}
        onFocus={() => setToastHeld(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setToastHeld(false);
        }}
      >
        {/* Only the message is announced; the actions are ordinary buttons. */}
        <span role="status" aria-live="polite">
          {toast}
        </span>
        {toast && toastActions.length ? (
          <span className="toast-actions">
            {toastActions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  setToast("");
                  setToastHeld(false);
                  a.run();
                  setFocusHeading((n) => n + 1);
                }}
              >
                {a.label}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {signingIn ? (
        <SignInDialog
          name={state.name}
          onClose={() => setSigningIn(false)}
          onSignIn={(name) => {
            update((s) => ({ ...s, name, signedIn: true }));
            setSigningIn(false);
            notify(`Signed in as ${name}. Demo only; nothing leaves this browser.`);
          }}
        />
      ) : null}
      {rsvpEvent ? (
        <RsvpDialog
          key={rsvpEvent}
          event={EVENTS.find((e) => e.id === rsvpEvent)!}
          name={state.name}
          busy={enrolling}
          onClose={enrollment.cancel}
          onSubmit={(rsvp) => completeEnrollment(rsvpEvent, rsvp)}
        />
      ) : null}
      {detailEvent ? (
        <EventDetails
          event={detailEvent}
          state={state}
          onClose={closeDetail}
          onCommunity={(id) => nav("forum", id)}
          onAdd={add}
          onRemove={remove}
          onSave={save}
        />
      ) : null}
    </>
  );
}
