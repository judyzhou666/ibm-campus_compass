import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal browser stand-ins: a history stack that records pushes, a location,
// and a window that keeps the listeners navigation.ts installs.
class FakeHistory {
  entries: { state: unknown; url: string }[] = [
    { state: null, url: "/#dashboard" },
  ];
  index = 0;
  pushes = 0;
  lastGo = 0;
  get state() {
    return this.entries[this.index].state;
  }
  pushState(state: unknown, _title: string, url?: string) {
    this.entries.splice(this.index + 1);
    this.entries.push({ state, url: url ?? this.entries[this.index].url });
    this.index += 1;
    this.pushes += 1;
  }
  replaceState(state: unknown, _title: string, url?: string) {
    this.entries[this.index] = {
      state,
      url: url ?? this.entries[this.index].url,
    };
  }
  go(delta: number) {
    this.lastGo = delta;
  }
}
const fakeHistory = new FakeHistory();
const listeners = new Map<string, (event: unknown) => void>();
Object.assign(globalThis, {
  history: fakeHistory,
  location: { href: "http://demo.test/#dashboard", hash: "#dashboard" },
  window: {
    addEventListener: (type: string, fn: (event: unknown) => void) =>
      listeners.set(type, fn),
  },
});
const setActivation = (value: { isActive: boolean } | undefined) =>
  Object.defineProperty(globalThis.navigator, "userActivation", {
    configurable: true,
    value,
  });

const nav = await import("../frontend/src/navigation.ts");
const fire = (type: string, key?: string) => listeners.get(type)!({ type, key });
let links = 0;
/** Moves the fake history by `delta` and runs the app's popstate handler. */
function traverse(delta: number) {
  fakeHistory.index += delta;
  nav.handlePopState(
    { state: fakeHistory.state } as PopStateEvent,
    () => (links += 1),
    () => "#explore",
  );
}

test("nothing is pushed on load; a gesture fills the cushion", () => {
  setActivation(undefined); // e.g. Safari before 16.4
  nav.initHistory();
  assert.deepEqual(fakeHistory.state, { cc: "root", idx: 0 });
  assert.equal(fakeHistory.pushes, 0);
  fire("pointerdown"); // a touch pointer-down is not a gesture
  fire("keydown", "Escape");
  assert.equal(fakeHistory.pushes, 0);
  fire("click");
  assert.equal(fakeHistory.pushes, nav.CUSHION);
});

test("with userActivation, only an active gesture pushes", () => {
  traverse(-nav.CUSHION); // back to the root entry
  const before = fakeHistory.pushes;
  setActivation({ isActive: false });
  fire("pointerdown");
  assert.equal(fakeHistory.pushes, before);
  setActivation({ isActive: true });
  fire("pointerdown");
  assert.equal(fakeHistory.pushes, before + nav.CUSHION);
});

test("Back closes the innermost sub-page, then is absorbed on a tab", () => {
  const closed: string[] = [];
  const pushes = fakeHistory.pushes;
  nav.registerSubPage(() => closed.push("community"));
  nav.registerSubPage(() => closed.push("post"));
  traverse(-1);
  assert.deepEqual(closed, ["post"]);
  traverse(-1);
  assert.deepEqual(closed, ["post", "community"]);
  assert.equal(nav.openSubPageCount(), 0);
  traverse(-1); // on a tab: nothing closes, nothing is pushed
  assert.deepEqual(closed, ["post", "community"]);
  assert.equal(fakeHistory.pushes, pushes, "popstate must never push");
  assert.equal(fakeHistory.entries[fakeHistory.index].url, "#explore");
});

test("Forward is undone without changing anything", () => {
  const closed: string[] = [];
  nav.registerSubPage(() => closed.push("detail"));
  traverse(1);
  assert.equal(fakeHistory.lastGo, -1);
  assert.deepEqual(closed, []);
  traverse(-1); // the browser carrying out go(-1) is ignored
  assert.deepEqual(closed, []);
  assert.equal(nav.openSubPageCount(), 1);
  fire("click"); // refill the cushion (still an active gesture)
  traverse(-1); // a real Back still closes the sub-page
  assert.deepEqual(closed, ["detail"]);
});

test("a link or typed URL is treated as a tab switch", () => {
  fakeHistory.pushState(null, "", "#calendar");
  traverse(0);
  assert.equal(links, 1);
  assert.equal((fakeHistory.state as { cc: string }).cc, "tab");
});
