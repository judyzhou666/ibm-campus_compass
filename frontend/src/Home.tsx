import { useEffect, useRef, useState } from "react";
import { DEMO, dayLabel } from "./config.ts";
import { DAYS, EVENTS, time } from "./data.ts";
import { Button, EventCard, Icon } from "./components.tsx";
import {
  HOME_CATEGORIES,
  announcements,
  categoryCount,
  createWheelSwipe,
  homeRecommendations,
  recommendationBasis,
} from "./home.ts";
import type { AppNotification } from "./notifications.ts";
import type { DemoState } from "./types.ts";

/** The notification title's lead-in, e.g. "Event invitation" or "Time changed". */
const kicker = (n: AppNotification) => {
  const lead = n.title.includes(":") ? n.title.split(":")[0] : "Announcement";
  return n.kind === "update" ? `${lead} · Synthetic update` : lead;
};

const tone = (category: string, topic: string) =>
  topic === "Arts & culture" ? "arts" : category.toLowerCase();

/** Announcement banner: one slide at a time, each opening its event. */
function Announcements({
  list,
  readIds,
  onOpen,
  onViewAll,
}: {
  list: AppNotification[];
  readIds: string[];
  onOpen: (n: AppNotification) => void;
  onViewAll: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef((_by: number) => {});
  const touch = useRef<{ x: number; y: number } | null>(null);
  const many = list.length > 1;
  // Two-finger trackpad swipe (Mac): horizontal wheel events change slide
  // once per gesture. The listener is non-passive so the swipe does not
  // also trigger the browser's own back/forward gesture.
  useEffect(() => {
    const el = slideRef.current;
    if (!el || !many) return;
    const swipe = createWheelSwipe();
    const onWheel = (ev: WheelEvent) => {
      if (Math.abs(ev.deltaX) <= Math.abs(ev.deltaY)) return;
      ev.preventDefault();
      const by = swipe(ev.deltaX, ev.deltaY, ev.timeStamp);
      if (by) stepRef.current(by);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [many]);
  if (!list.length) return null;
  const at = Math.min(index, list.length - 1);
  const n = list[at];
  const e = EVENTS.find((x) => x.id === n.eventId)!;
  const step = (by: number) => setIndex((at + by + list.length) % list.length);
  stepRef.current = step;
  return (
    <section
      className="home-announce"
      aria-roledescription="carousel"
      aria-label="Announcements"
    >
      <div className="section-bar">
        <h2>
          <Icon name="megaphone" /> Announcements
        </h2>
        <button className="text-btn" onClick={onViewAll}>
          All notifications <Icon name="arrow" />
        </button>
      </div>
      <div
        ref={slideRef}
        className={`announce-slide ${n.kind === "update" ? "update" : ""}`}
        aria-roledescription="slide"
        aria-label={`${at + 1} of ${list.length}`}
        // Touch-screen swipe.
        onTouchStart={(ev) => {
          const t = ev.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(ev) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !many) return;
          const t = ev.changedTouches[0];
          const dx = t.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y))
            step(dx < 0 ? 1 : -1);
        }}
      >
        <button
          className="announce-main"
          onClick={() => onOpen(n)}
          aria-label={`${n.title}. Open event details for ${e.title}`}
        >
          <span className="announce-copy">
            <span className="announce-kicker">
              {kicker(n)}
              {!readIds.includes(n.id) ? (
                <span className="announce-new">New</span>
              ) : null}
            </span>
            <span className="announce-title">{e.title}</span>
            <span className="announce-body">{n.body}</span>
            <span className="announce-meta">
              <Icon name="calendar" />
              {DAYS[e.day]}, {dayLabel(e.day)} · {time(e.start)}
              <Icon name="pin" />
              {e.location}
            </span>
            <span className="announce-cta">
              View event details <Icon name="arrow" />
            </span>
          </span>
          <span
            className={`announce-art poster ${tone(e.category, e.topic)}`}
            aria-hidden="true"
          >
            <small>
              {DEMO.campus_name} / {dayLabel(e.day)}
            </small>
            <b>
              {e.poster.split(" / ").map((part, i) => (
                <span key={part}>
                  {i > 0 ? <br /> : null}
                  {part}
                </span>
              ))}
            </b>
          </span>
        </button>
        {many ? (
          <>
            <button
              className="announce-arrow prev"
              aria-label="Previous announcement"
              onClick={() => step(-1)}
            >
              <span>
                <Icon name="chevronLeft" />
              </span>
            </button>
            <button
              className="announce-arrow next"
              aria-label="Next announcement"
              onClick={() => step(1)}
            >
              <span>
                <Icon name="chevronRight" />
              </span>
            </button>
            <div className="announce-dots">
              {list.map((x, i) => (
                <button
                  key={x.id}
                  className={i === at ? "active" : ""}
                  aria-label={`Show announcement ${i + 1}`}
                  aria-current={i === at ? "true" : undefined}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

export function Home({
  state,
  notifications,
  onOpenAnnouncement,
  onViewNotifications,
  onCategory,
  onExplore,
  onProfile,
  onAdd,
  onSave,
  onDetail,
  onCalendar,
}: {
  state: DemoState;
  notifications: AppNotification[];
  onOpenAnnouncement: (n: AppNotification) => void;
  onViewNotifications: () => void;
  onCategory: (filter: string) => void;
  onExplore: () => void;
  onProfile: () => void;
  onAdd: (id: string) => void;
  onSave: (id: string) => void;
  onDetail: (id: string) => void;
  onCalendar: () => void;
}) {
  const recs = homeRecommendations(state);
  return (
    <div className="home">
      <h1 className="visually-hidden">Home</h1>
      <Announcements
        list={announcements(notifications)}
        readIds={state.readNotificationIds}
        onOpen={onOpenAnnouncement}
        onViewAll={onViewNotifications}
      />
      <section className="home-categories" aria-labelledby="home-cat-title">
        <h2 id="home-cat-title">Browse by category</h2>
        <ul>
          {HOME_CATEGORIES.map((c) => (
            <li key={c.label}>
              <button
                className={`cat-entry ${c.tone}`}
                onClick={() => onCategory(c.filter)}
              >
                <span className="cat-circle">
                  <Icon name={c.icon} />
                </span>
                <strong>{c.label}</strong>
                <small>{categoryCount(c.filter)} events</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="home-recs" aria-labelledby="home-recs-title">
        <div className="section-bar">
          <div>
            <h2 id="home-recs-title">
              <Icon name="spark" /> Recommendations for you
            </h2>
            <p className="sub">
              {recommendationBasis(state, recs.personalized)}{" "}
              <button className="text-btn inline" onClick={onProfile}>
                {recs.personalized ? "Edit preferences" : "Set your interests"}
              </button>
            </p>
          </div>
          <button className="text-btn" onClick={onExplore}>
            See all events <Icon name="arrow" />
          </button>
        </div>
        {recs.events.length ? (
          <div className="event-grid home-grid">
            {recs.events.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                state={state}
                onAdd={onAdd}
                onSave={onSave}
                onDetail={onDetail}
                onCalendar={onCalendar}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="compass" />
            <h3>Your week is full</h3>
            Every open event is already in your plan or clashes with it.
            <p>
              <Button onClick={onExplore}>Explore events</Button>
            </p>
          </div>
        )}
        <p className="label home-label">
          Simple preference ranking · No live AI · Fictional events
        </p>
      </section>
    </div>
  );
}
