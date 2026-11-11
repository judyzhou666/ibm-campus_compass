import { useEffect, useRef } from "react";

/**
 * Back / swipe-back navigation.
 *
 * Sidebar tabs (Dashboard, My Calendar, Explore Events, …) are siblings: on a
 * tab, Back does nothing. Back only closes the innermost open sub-page (event
 * details, a forum community, a forum post or the post editor, the data
 * review). Forward is ignored.
 *
 * Browsers skip history entries that a page adds without a user gesture
 * (Chrome's history-manipulation intervention; WebKit does the same), so an
 * entry pushed on load or inside a popstate handler cannot hold the user on
 * the page — a real swipe goes straight past it and leaves the site. Instead
 * the app keeps a small cushion of entries above the first one and tops it up
 * only while the user is actually tapping, clicking or typing. Each Back uses
 * one entry: it closes a sub-page if one is open, otherwise nothing happens.
 *
 * Every entry the app owns carries `cc` (its kind) and `idx` (its distance
 * from the first entry), so a popstate can tell Back from Forward.
 */
interface SubPage {
  id: number;
  close: () => void;
}
interface Entry {
  cc: "root" | "tab";
  idx: number;
}
/** How many Backs in a row are absorbed after the last interaction. */
export const CUSHION = 3;
const stack: SubPage[] = [];
let nextId = 1;
let currentIdx = 0;
let ignoreNextPop = false;

const entryOf = (state: unknown): Entry | null =>
  state &&
  typeof state === "object" &&
  "cc" in state &&
  typeof (state as Entry).idx === "number"
    ? (state as Entry)
    : null;

/**
 * True while the browser treats this event as a user gesture. Browsers
 * without `navigator.userActivation` (e.g. Safari before 16.4) get a
 * conservative fallback: only a click or a non-Escape key press counts, never
 * a pointer-down, which on touch screens is not a gesture.
 */
export function isGesture(event: Pick<Event, "type"> & { key?: string }) {
  const activation = (
    navigator as Navigator & { userActivation?: { isActive: boolean } }
  ).userActivation;
  if (activation) return activation.isActive;
  return (
    event.type === "click" ||
    (event.type === "keydown" && event.key !== "Escape")
  );
}

/** Refill the cushion; only ever acts during a user gesture. */
function topUp(event: Event) {
  if (!isGesture(event as KeyboardEvent)) return;
  while (currentIdx < CUSHION) {
    currentIdx += 1;
    history.pushState({ cc: "tab", idx: currentIdx }, "", location.href);
  }
}

/**
 * Run once on startup: mark the first entry and start refilling the cushion on
 * every tap, click or key press (capture phase, before the app handles it).
 * Nothing is pushed until the user interacts.
 */
export function initHistory() {
  const entry = entryOf(history.state);
  if (entry) currentIdx = entry.idx;
  else {
    currentIdx = 0;
    history.replaceState({ cc: "root", idx: 0 }, "");
  }
  for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"])
    window.addEventListener(type, topUp, { capture: true });
}

/**
 * The app's single popstate handler. `onLink` handles a hash change from a
 * link or typed URL; `currentUrl` is the URL of the page now on screen.
 */
export function handlePopState(
  e: PopStateEvent,
  onLink: () => void,
  currentUrl: () => string,
) {
  const entry = entryOf(e.state);
  if (ignoreNextPop) {
    ignoreNextPop = false;
    if (entry) currentIdx = entry.idx;
    return;
  }
  if (!entry) {
    // A link or typed URL changed the hash (a new entry): treat as a tab.
    currentIdx += 1;
    history.replaceState({ cc: "tab", idx: currentIdx }, "");
    onLink();
    return;
  }
  if (entry.idx > currentIdx) {
    // Forward: return to where we were and change nothing.
    ignoreNextPop = true;
    history.go(currentIdx - entry.idx);
    return;
  }
  // Back: close the innermost sub-page, or absorb it on a top-level tab.
  currentIdx = entry.idx;
  stack.pop()?.close();
  history.replaceState(history.state, "", currentUrl());
}

/** Number of registered sub-pages. */
export const openSubPageCount = () => stack.length;

/** Registers a sub-page so Back closes it; returns the unregister function. */
export function registerSubPage(close: () => void) {
  const page = { id: nextId++, close };
  stack.push(page);
  return () => {
    const at = stack.indexOf(page);
    if (at >= 0) stack.splice(at, 1);
  };
}

/**
 * Registers a sub-page while `open` is true, so Back closes it. Returns the
 * function in-page Close / Back buttons should call.
 */
export function useSubPage(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    return registerSubPage(() => closeRef.current());
  }, [open]);
  return () => closeRef.current();
}
