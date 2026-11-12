# Event detail page redesign — build spec

Handoff spec for implementing the redesigned event detail page. It is
self-contained: the design canvas is private, so everything needed to build
the page is written here.

## Scope

- **Change:** `EventDetails` in `frontend/src/components.tsx` (lines ~353–738)
  and the `.event-detail-*` rules in `frontend/src/styles.css` (~1100–1330).
  One new prop is needed from `frontend/src/App.tsx` (see "You might also like").
- **Do not change:** the Rust backend, `data/*.json`, the enrollment/RSVP flow,
  planner logic (`planner.ts`), or update logic (`updates.ts`).
- Stack rules from `AGENTS.md` apply: React + TypeScript only, keep every
  "fictional" label, keep explicit student approval before calendar additions.

## Why (problems with the current page)

1. The time change is shown four times (hero tag, inline badge, notice block,
   and raw `start 630, end 720` text from `upd.details`).
2. The date only appears in the side panel; the main info list has no date.
3. The schedule conflict sits far below the action button it affects.
4. Access conditions are one long run-on line.
5. Related communities are bare links; there are no suggestions for what to
   do next.

## Layout (desktop, ≥ 701px)

Page content max-width 1200px, centred. Order top to bottom:

```
[Close bar — unchanged]
[Poster banner — full width]
[Share] [Save]                                    (right-aligned icon row)
┌ main column (flex 999 1 560px) ──────────────┐ ┌ aside (300–360px) ─┐
│ 1 Title block                                │ │ RSVP card          │
│ 2 Overview                                   │ │ (position: sticky) │
│ 3 Good to know                               │ │                    │
│ 4 Location                                   │ │                    │
│ 5 Hosted by + related communities            │ │                    │
│ 6 Record & evidence + report link            │ │                    │
│ 7 You might also like                        │ │                    │
└──────────────────────────────────────────────┘ └────────────────────┘
```

Sections 2–7 are separated by a 1px `--line` top border and 32px vertical
padding. Section headings: 26px, weight 800, `--green-dark`.

### Poster banner

- Wrapper: `--mint`-tinted band, radius 20px, horizontal padding
  `clamp(0px, 8vw, 120px)`.
- Inner poster: background from the existing `poster ${posterTone(e)}` class
  (or `--green` if a tone class is not suitable), min-height 340px,
  padding 44px 48px. Left: small caps line `{TOPIC} · {CATEGORY}` (13px, 700,
  letter-spacing .14em) above `e.poster` split on `" / "` into lines, 64–120px,
  weight 800. Right: date `TUE · NOV 3`, shown time range, shown location,
  `host_school`, separated from the art by a 2px top rule.
- Remove the old aside banner (`.event-detail-aside-banner`): the poster now
  lives here only.

### Share / save row

Two 44×44 icon buttons, right-aligned, directly under the banner.
- **Save:** `Icon name="bookmark"`, `aria-label={saved ? "Saved" : "Save event"}`,
  `aria-pressed={saved}`, calls `onSave(e.id)`. Filled icon when saved.
- **Share:** optional. Only include it if wired (e.g. copy
  `location.href` to the clipboard). No dead buttons.

### 1. Title block

- Tags row: category pill (`--mint` bg, `--green` text, uppercase 12px) and a
  dashed-border pill **"Fictional demo event"** (must stay visible).
- When `badge === "needs-confirmation"`, add the existing
  `badge badge--conflict` "Needs confirmation" pill in this row.
- `<h1 id="detail-title">` — keep the id (dialog `aria-labelledby`).
  `clamp(32px, 4vw, 46px)`, weight 800.
- **Host row** (only if `e.host_school`): 52px round avatar with the host's
  initials (first letter of the first two words, e.g. "SE"), "by
  **{host_school}**", subline "Fictional host · {e.topic}". A Follow button
  is in the design; include it only if it does something, otherwise omit.
- **When:** calendar icon + `Tuesday, November 3 · **{start}–{end}** ET`
  using the *shown* times (`shown` already accounts for `time_moved`). If
  moved, add a small blue "Time updated" pill.
- Keep the existing `viewerTime` row ("Starts … in your time zone") when set.
- **Where:** pin icon + `upd?.new_location ?? e.location` + " · Fictional
  campus". Keep the "Room changed" pill when `upd?.new_location`.
- **Update notice** (replaces today's `notice--updated` block, which echoes
  `upd.details`). Blue box, `role="status"`:
  - `time_moved`: **Moved earlier/later.** Now {new time},
    ~~was {original e.start–e.end}~~. Your schedule was re-checked.
    ("earlier" if `new_start < e.start`, else "later").
  - `room_changed`: **Room changed.** Now in {new_location}, ~~was {e.location}~~.
  - other kinds: `kindLabel(upd.kind)` plus `upd.details`.
  - Never render the raw minute values (`start 630, end 720`).
- Keep the existing `conflict` ("Needs confirmation") notice exactly as is.

### 2. Overview

- `e.description`, 17px, line-height 1.6, max-width 640px.
- "Good for" label + one mint pill per `e.goal_type` entry (capitalised).

### 3. Good to know

Two equal cards (white, `--line` border, radius 14px):

- **Highlights**: duration from `shown.end - shown.start` ("1.5 hours",
  "45 minutes"), "In person", `foodLabel(e.food)`, access label (existing
  open/members/full/unknown text).
- **Entry requirements**: one row per item, label left, value right:
  - RSVP → `e.rsvp`
  - Membership, Ticket, Minimum age, Capacity → `conditionLabel(...)`
  - Check icon in `--green` for confirmed values; a question-mark icon and
    amber text (`--notice-ink`) when the value is "Not confirmed".
  - Merge Membership and Ticket into one row when both are "Not required".
- Show the existing `reasons(e, state)` list here as "Why it fits you" (check
  icons, no ✓ characters) when there is no `problem`.

### 4. Location

- Left: venue name (bold) + "Fictional campus".
- Right: static map placeholder box (min-height 300px, light grid pattern)
  labelled **"Fictional campus map"**. No "Show map" button unless wired.
- "Getting there" walk/bike/transit links are in the design; omit them unless
  they lead somewhere. Keep the line: "Travel time between rooms counts toward
  conflict checks." (only when `state.buffer > 0`).

### 5. Hosted by

- Card: 64px initials avatar, `host_school`, subline "Fictional host
  department · Topics: {e.topic}". Contact/Follow only if wired.
- Below the card: "Related communities" label + pill links, same data and
  `onCommunity` handler as today
  (`COMMUNITIES.filter(c => c.topics.includes(e.topic))`). Keep the fineprint
  "Fictional local groups matching this record's topic."

### 6. Record & evidence

- Keep the `<details>` and every field in it unchanged. Move "Last checked
  {relativeTime}" into the `<summary>` row, right-aligned, and remove the
  separate "Last checked" paragraph.
- Optional centred "Report a problem with this record" link below, only if it
  goes somewhere (e.g. the existing data review page).

### 7. You might also like

- Heading + "More {e.topic} events this week."
- Up to 4 events: `effectiveEvents(appliedIds)` filtered to the same `topic`,
  excluding `e.id` and `state.cancelled`, sorted by `day`, then `start`.
- Row: title (18px bold), `when(ev)` date/time, `{location} · {Free | $cost}`,
  and a 150×84 poster tile (`poster ${posterTone(ev)}` with `ev.poster`).
  Optional small badge: "Same room" when `ev.location === shown location`;
  "Members" when `ev.access === "members"`.
- Clicking a row opens that event's details. **New prop:**
  `onDetail: (id: string) => void`; in `App.tsx` pass `onDetail={setDetail}`.
  Scroll `.event-detail-scroll` back to the top when the event changes.

### RSVP card (aside, sticky)

Replaces today's aside. White, radius 16px, `--shadow`, padding 20px,
`position: sticky; top: calc(var(--topbar-h) + 24px)`. The aside itself must
`align-self: stretch` so sticky works across the whole scroll.

- Line 1 (bold): `Free` or `$cost`, plus ` · RSVP required` when
  `e.rsvp === "RSVP required"`.
- Line 2: short shown date and start time, e.g. `Tue, Nov 3 · 10:30 AM`.
- **Issue strip** when `problem` (from `issue(e, state)`) is non-null and
  `!conflict`: amber box (`--notice-bg` / `--notice-ink`) with a warning
  icon and the problem text. Remove the separate `notice` block from the main
  column, so the conflict is only shown here.
- **Primary button** (52px tall, `--green`), calls the existing handlers:

  | State | Label | Action |
  |---|---|---|
  | `planned` | Remove from calendar | `onRemove(e.id)` |
  | any problem (schedule conflict, full, members, cancelled, invalid) | Can't add (disabled) | none; the issue strip explains why |
  | RSVP required, no problem | RSVP & add to calendar | `onAdd(e.id)` |
  | drop-in, no problem | Add to calendar | `onAdd(e.id)` |

  `enrollment.choose` rejects every event that has an issue, conflicts
  included, so there is no "Review & RSVP" path. This matches the event
  cards' "Can't add · See why".

  Do not add a new confirmation step. The existing `enrollment.choose` →
  `RsvpDialog` flow is the student's explicit approval.
- Fineprint, centred: "Nothing is added until you confirm. Fictional demo
  event, no real registration."
- Save moves out of the card to the icon row under the banner.

## Mobile (≤ 700px, existing breakpoint)

- Single column, 16px side padding; same section order.
- Banner: radius 16px, art 54px, date block shrinks to `TUE · NOV 3` + start time.
- Close button stays top-left; Share/Save move into the same top bar on the right.
- Good to know: cards stack; Highlights becomes a 2-column grid.
- Location map placeholder: 180px tall.
- Host card: Contact/Follow (if present) as a 2-column button grid.
- Related events: poster tile 88×64 on the left, text on the right.
- **RSVP card becomes a fixed bottom bar**: `position: fixed; bottom: 0`,
  white, top border, shadow `0 -8px 24px #183e3112`, padding
  `12px 16px calc(24px + env(safe-area-inset-bottom))`. Left: price/RSVP line
  and the issue text in amber (one line, ellipsis); right: the primary button.
  Fineprint underneath at 11px. Add bottom padding (~150px) to the scroll
  content so the bar never covers the last row.

## Tokens

Use the existing `:root` variables in `styles.css`. Add these two for the
blue update notice:

```css
--info-bg: #eef5fc;   /* border #c9dcf1 */
--info-ink: #1f4f82;  /* heading #173d66, struck-through old value #4f6a87 */
```

The amber issue strip uses `--notice-bg` / `--notice-ink`; strong text in it
uses `#6b4f1d`. Muted text uses `#5b665f` (not `--muted`) on white and mint
backgrounds so 13px text keeps 4.5:1 contrast.

Icons: use `Icon` from `icons.ts` (`calendar`, `clock`, `pin`, `food`, `users`,
`spark`, `bookmark`, `check`, `info`, `arrow`, `close`). Add a `share` and a
`warning` icon to `icons.ts` if needed, in the same stroke style. No emoji or
text checkmarks.

## Accessibility (keep what exists)

- Keep `role="dialog"`, `aria-modal`, `aria-labelledby="detail-title"`, the
  focus trap, Escape to close, focus return, and the body scroll lock.
- All controls are real `<button>` / `<a href>`; minimum 44×44px targets.
- Icon-only buttons need an `aria-label`; decorative icons `aria-hidden`.
- Update notice: `role="status"`.
- Never rely on colour alone: confirmed vs not-confirmed uses different icons.

## Test with

- **e1 "Learning with AI: a hands-on lab"** after applying the update batch
  that contains its `time_moved` update (`data/updates.json`). The notice
  should read "Moved earlier. Now 10:30 AM–12:00 PM, ~~was 3:00–4:30 PM~~",
  with the Research Methods conflict in the RSVP card.
- An event with no updates and no conflict: no notice, "Why it fits you"
  list shown, button reads "RSVP & add to calendar".
- A planned event: button reads "Remove from calendar".
- A members-only event (e.g. e12): "Membership not verified" in the card.
- The event that gets the conflicting cancelled/room notices: "Needs
  confirmation" pill and notice still shown.
- Width 375px: bottom bar visible, nothing hidden behind it, no horizontal
  scroll.

## Done when

- [ ] All sections render in the order above, from catalog data only (no
      invented facts).
- [ ] The time change appears once (notice + small pill), never as raw minutes.
- [ ] The conflict appears in the RSVP card next to the button.
- [ ] The RSVP card stays visible while scrolling on desktop; fixed bottom bar
      on mobile.
- [ ] "Fictional demo event" labels are still visible.
- [ ] Adding still goes through the existing RSVP dialog.
- [ ] `npm test` and `npm run build` pass; README updated per `AGENTS.md`.
