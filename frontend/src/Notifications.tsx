import { useEffect, useRef } from "react";
import { Empty, Icon } from "./components.tsx";
import {
  filterNotifications,
  formatSentAt,
  KIND_LABELS,
  NO_FILTER,
  type AppNotification,
  type NotificationFilter,
  type NotificationKind,
} from "./notifications.ts";

/** Dropdown under the bell: the student's unread notifications. */
export function NotificationMenu({
  unread,
  timeZone,
  updatesWaiting,
  onOpen,
  onViewAll,
  onCheckUpdates,
  onMarkAllRead,
  onClose,
}: {
  unread: AppNotification[];
  timeZone: string;
  updatesWaiting: boolean;
  onOpen: (id: string) => void;
  onViewAll: () => void;
  onCheckUpdates: () => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.(".bell-btn")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);
  return (
    <div
      className="notif-menu"
      id="notification-menu"
      role="dialog"
      aria-label="Unread notifications"
      ref={ref}
    >
      <div className="notif-menu-head">
        <h2>Notifications</h2>
        <button
          className="icon-btn"
          aria-label="Close notifications"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="notif-menu-list">
        {updatesWaiting ? (
          <button className="notif-menu-check" onClick={onCheckUpdates}>
            <Icon name="refresh" />
            <span>
              <strong>New synthetic event updates are available</strong>
              <small>Check for updates · Simulated</small>
            </span>
          </button>
        ) : null}
        {unread.length ? (
          <ul>
            {unread.map((n) => (
              <li key={n.id}>
                <button className="notif-menu-item" onClick={() => onOpen(n.id)}>
                  <span>
                    <strong>{n.title}</strong>
                    <small>{formatSentAt(n.sentAt, timeZone)}</small>
                  </span>
                  <i className="unread-dot" aria-label="Unread" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="notif-menu-empty">You’re all caught up.</p>
        )}
      </div>
      <div className="notif-menu-foot">
        {unread.length ? (
          <button className="text-btn" onClick={onMarkAllRead}>
            Mark all as read
          </button>
        ) : (
          <span />
        )}
        <button className="btn small" onClick={onViewAll}>
          View all
        </button>
      </div>
    </div>
  );
}

const KINDS = Object.keys(KIND_LABELS) as NotificationKind[];

/** The Notifications sub-page: every notification, with filters. */
export function NotificationsPage({
  list,
  readIds,
  timeZone,
  filter,
  setFilter,
  onOpen,
  onMarkAllRead,
}: {
  list: AppNotification[];
  readIds: string[];
  timeZone: string;
  /** Kept by the parent so it survives opening a message and coming back. */
  filter: NotificationFilter;
  setFilter: (
    change: (f: NotificationFilter) => NotificationFilter,
  ) => void;
  onOpen: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const set = <K extends keyof NotificationFilter>(
    key: K,
    value: NotificationFilter[K],
  ) => setFilter((f) => ({ ...f, [key]: value }));
  const shown = filterNotifications(list, readIds, filter, timeZone);
  const unreadCount = list.filter((n) => !readIds.includes(n.id)).length;
  const filtered = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="sub">
            {unreadCount
              ? `${unreadCount} unread · fictional demo notifications`
              : "All caught up · fictional demo notifications"}
          </p>
        </div>
      </div>
      <div className="notif-layout">
        <aside className="panel notif-filters" aria-label="Filter notifications">
          <h2>Filters</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={filter.unreadOnly}
              onChange={(e) => set("unreadOnly", e.target.checked)}
            />
            Show only unread
          </label>
          <label className="field">
            Sort by
            <select
              value={filter.sort}
              onChange={(e) =>
                set("sort", e.target.value as NotificationFilter["sort"])
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <label className="field">
            Type
            <select
              value={filter.kind}
              onChange={(e) =>
                set("kind", e.target.value as NotificationFilter["kind"])
              }
            >
              <option value="all">All types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Sent on or after
            <input
              type="date"
              value={filter.after}
              max={filter.before || undefined}
              onChange={(e) => set("after", e.target.value)}
            />
          </label>
          <label className="field">
            Sent on or before
            <input
              type="date"
              value={filter.before}
              min={filter.after || undefined}
              onChange={(e) => set("before", e.target.value)}
            />
          </label>
          {filtered ? (
            <button className="text-btn" onClick={() => setFilter(() => NO_FILTER)}>
              Clear filters
            </button>
          ) : null}
        </aside>
        <section className="panel notif-list">
          <div className="notif-list-head">
            <div>
              <h2>All notifications</h2>
              <p className="sub" aria-live="polite">
                {shown.length
                  ? `Showing ${shown.length} of ${list.length}`
                  : `Showing 0 of ${list.length}`}
              </p>
            </div>
            {unreadCount ? (
              <button className="btn small" onClick={onMarkAllRead}>
                <Icon name="check" />
                Mark all as read
              </button>
            ) : null}
          </div>
          {shown.length ? (
            <ul>
              {shown.map((n) => {
                const unread = !readIds.includes(n.id);
                return (
                  <li key={n.id}>
                    <button
                      className={`notif-row ${unread ? "unread" : ""}`}
                      onClick={() => onOpen(n.id)}
                    >
                      <span>
                        <span className="notif-title">{n.title}</span>
                        <small>
                          {formatSentAt(n.sentAt, timeZone)} ·{" "}
                          {KIND_LABELS[n.kind]}
                          {n.synthetic ? " · Synthetic update" : ""}
                        </small>
                      </span>
                      {unread ? (
                        <i className="unread-dot" aria-label="Unread" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No notifications match">
              Try clearing a filter or widening the date range.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}

/** One notification's full message. */
export function NotificationDetail({
  notification: n,
  timeZone,
  onBack,
  onViewEvent,
  onOpenCommunity,
  onExplore,
  onMarkUnread,
}: {
  notification: AppNotification;
  timeZone: string;
  onBack: () => void;
  onViewEvent: (id: string) => void;
  onOpenCommunity: (id: string) => void;
  onExplore: () => void;
  onMarkUnread: () => void;
}) {
  return (
    <>
      <button className="text-btn notif-back" onClick={onBack}>
        <span className="flip">
          <Icon name="arrow" />
        </span>
        All notifications
      </button>
      <article className="panel notif-detail">
        <p className="notif-kind">
          {KIND_LABELS[n.kind]}
          {n.synthetic ? " · Synthetic update" : ""}
        </p>
        <h1>{n.title}</h1>
        <p className="notif-sent">{formatSentAt(n.sentAt, timeZone)}</p>
        <p className="notif-body">{n.body}</p>
        <div className="notif-actions">
          {n.eventId ? (
            <button className="btn primary" onClick={() => onViewEvent(n.eventId!)}>
              View event
            </button>
          ) : null}
          {n.communityId ? (
            <button className="btn" onClick={() => onOpenCommunity(n.communityId!)}>
              Open community
            </button>
          ) : null}
          {n.opensExplore ? (
            <button className="btn primary" onClick={onExplore}>
              Explore events
            </button>
          ) : null}
          <button className="text-btn" onClick={onMarkUnread}>
            Mark as unread
          </button>
        </div>
      </article>
    </>
  );
}
