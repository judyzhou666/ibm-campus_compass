/** Clicking anywhere on an event card opens its page; its own buttons keep their job. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cardClick } from "../frontend/src/components.tsx";

const card = { id: "card" };
const fakeEvent = (control: object | null) =>
  ({
    currentTarget: card,
    target: { closest: () => control },
  }) as never;

test("a click on white space or text opens the event page", () => {
  let opened = 0;
  cardClick(() => opened++)(fakeEvent(null));
  assert.equal(opened, 1);
});

test("a click on the bookmark or Add to calendar does not open the page", () => {
  let opened = 0;
  cardClick(() => opened++)(fakeEvent({ tagName: "BUTTON" }));
  assert.equal(opened, 0);
});

test("selecting text on a card does not open the page", () => {
  let opened = 0;
  const g = globalThis as { getSelection?: () => { toString(): string } };
  g.getSelection = () => ({ toString: () => "Film club" });
  try {
    cardClick(() => opened++)(fakeEvent(null));
  } finally {
    delete g.getSelection;
  }
  assert.equal(opened, 0);
});
