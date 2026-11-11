import { useEffect, useRef } from "react";

/**
 * Back / swipe-back navigation.
 *
 * Sidebar tabs (Dashboard, My Calendar, Explore Events, …) are siblings, so
 * switching tabs replaces the current history entry instead of adding one.
 * Only sub-pages — event details, a forum community, a forum post or the post
 * editor, the data review — push an entry. Back closes the innermost open
 * sub-page; on a top-level tab it is absorbed, so it neither jumps to another
 * tab nor leaves the app. Forward is ignored.
 *
 * Every entry the app owns carries `cc` (its kind) and `idx` (its position),
 * so a popstate can tell Back from Forward.
 */
interface SubPage {
  id: number;
  close: () => void;
}
interface Entry {
  cc: "root" | "tab" | "sub";
  idx: number;
  id?: number;
}
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

function push(cc: Entry["cc"], url?: string, id?: number) {
  currentIdx += 1;
  history.pushState({ cc, idx: currentIdx, id }, "", url ?? location.href);
}

/**
 * Run once before anything pushes: mark the first entry as the root and add
 * one tab entry above it, so the first Back stays inside the app. After a
 * reload the existing entries are reused.
 */
export function initHistory() {
  const entry = entryOf(history.state);
  if (entry) {
    currentIdx = entry.idx;
    return;
  }
  currentIdx = 0;
  history.replaceState({ cc: "root", idx: 0 }, "");
  push("tab");
}

function release(id: number) {
  const at = stack.findIndex((s) => s.id === id);
  return at >= 0 ? stack.splice(at, 1)[0] : undefined;
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
    // A link or typed URL changed the hash: a new entry, treated as a tab.
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
  currentIdx = entry.idx;
  const top = stack.pop();
  if (top) top.close();
  else push("tab", currentUrl());
}

/** Number of registered sub-pages (for tests and debugging). */
export const openSubPageCount = () => stack.length;

/**
 * Registers a sub-page while `open` is true and pushes one history entry for
 * it, optionally at `url`. Returns a close function for in-page Back/Close
 * buttons: it consumes the history entry, so a later Back doesn't land on a
 * stale one.
 */
export function useSubPage(open: boolean, close: () => void, url?: string) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = nextId++;
    stack.push({ id, close: () => closeRef.current() });
    push("sub", url, id);
    idRef.current = id;
    return () => {
      release(id);
      if (idRef.current === id) idRef.current = null;
    };
    // An open sub-page whose URL changes is updated in place below.
  }, [open]);
  useEffect(() => {
    if (open && url && idRef.current !== null && location.hash !== url)
      history.replaceState(history.state, "", url);
  }, [open, url]);
  return () => {
    const id = idRef.current;
    const top = stack.at(-1);
    if (id !== null && top?.id === id && entryOf(history.state)?.id === id) {
      history.back(); // the popstate handler closes it
    } else {
      if (id !== null) release(id);
      closeRef.current();
    }
  };
}
