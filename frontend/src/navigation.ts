import { useEffect, useRef } from "react";

/**
 * Back / swipe-back navigation.
 *
 * Sidebar tabs (Dashboard, My Calendar, Explore Events, …) are siblings, so
 * switching tabs replaces the current history entry instead of adding one.
 * Only sub-pages — event details, a forum community, a forum post or the post
 * editor — push an entry. Back closes the innermost open sub-page; on a
 * top-level tab it is absorbed, so it neither jumps to another tab nor leaves
 * the app.
 */
interface SubPage {
  id: number;
  close: () => void;
}
const stack: SubPage[] = [];
let nextId = 1;

function release(id: number) {
  const at = stack.findIndex((s) => s.id === id);
  return at >= 0 ? stack.splice(at, 1)[0] : undefined;
}

/** Called from the app's popstate listener; true if a sub-page was closed. */
export function closeTopSubPage(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}

/** True while any sub-page is registered (for tests and debugging). */
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
    history.pushState({ cc: "sub", id }, "", url ?? location.href);
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
    if (id !== null && top?.id === id && history.state?.id === id) {
      history.back(); // popstate closes it through closeTopSubPage
    } else {
      if (id !== null) release(id);
      closeRef.current();
    }
  };
}
