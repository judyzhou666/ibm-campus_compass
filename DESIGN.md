---
name: Campus Compass
description: Green and white campus planning dashboard, extracted from the functional demo.
colors:
  green: "#235b45"
  green-dark: "#183e31"
  mint: "#e8f2e9"
  bg: "#f7f8f5"
  ink: "#22342b"
  muted: "#66736b"
  line: "#e1e7de"
  white: "#fff"
  focus: "#57a77a"
  poster-academic: "#e9eee0"
  poster-career: "#ece6f3"
  poster-social: "#f4e7ce"
  poster-arts: "#e8e8f0"
  poster-wellbeing: "#e1eeec"
  notice-bg: "#f8f0df"
  notice-ink: "#806028"
  cancelled-bg: "#f8e9e3"
  cancelled-ink: "#9c4938"
typography:
  headline:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-1px"
  title:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    letterSpacing: "-0.4px"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "14px"
  chat:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "13px"
    lineHeight: 1.7
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.7px"
rounded:
  field: "7px"
  button: "8px"
  navigation: "9px"
  composer: "10px"
  card: "12px"
  panel: "14px"
  dialog: "16px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "18px"
  panel: "22px"
  section: "24px"
  page-inline: "34px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.green-dark}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-text:
    textColor: "{colors.green}"
    padding: "4px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px"
  navigation-active:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.green}"
    rounded: "{rounded.navigation}"
    padding: "13px 15px"
  chip-active:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.field}"
    padding: "7px 12px"
  panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "22px"
  event-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
---

# Design System: Campus Compass

## Overview

The implemented system preserves the supplied green and white sidebar dashboard, weekly calendar, event cards, and chat beside a draft plan. Its dense desktop layout uses restrained borders and a dark green welcome panel; the supplied cat mascot makes the planner recognizable.

This is a code-led record of the current functional demo, not a new visual identity or an approval record. No creative metaphor or additional brand prohibitions were selected. CSS and behavior were extracted from `frontend/src/styles.css`, `frontend/src/App.tsx`, and `frontend/index.html`; the four dashboard/planner review screenshots were inspected. The final cascading CSS rules take precedence over earlier declarations and older captures.

**Key Characteristics:**
- Green navigation and actions on white surfaces.
- Five weekday columns with distinct busy, chosen, and cancelled states.
- Readable event details and explicit add actions.
- Supplied cat mascot in planner entry and conversation.

## Colors

The palette uses dark botanical greens, warm near-white surfaces, and muted category backgrounds. Frontmatter values are the extracted primitives; color names describe implementation roles, not newly approved brand language.

- **Primary:** `green` drives buttons, selected filters, icons, and links; `green-dark` anchors the welcome panel, toast, and primary hover state; `mint` marks active navigation and user chat bubbles.
- **Neutrals:** `bg` is the page canvas and assistant bubble; `white` is the panel surface; `ink` is primary text; `muted` is supporting text; `line` is the shared border and divider.
- **Categories:** academic/workshop posters use pale sage, career lavender, social warm cream, arts cool lilac, and wellbeing pale teal. Preserve the written category labels alongside these colors.
- **Status:** notices use warm cream with brown text; cancellation entries use pale peach with rust text and the word “Cancelled.”
- **Keyboard focus:** `focus` supplies a 3px outline with a 3px offset on common interactive elements.

## Typography

All roles use the installed-system stack `'Avenir Next', Avenir, 'Segoe UI', sans-serif`; no web font is downloaded. The scale is tuned per component rather than a fixed mathematical ratio.

- Page heading: 30px, weight 650, 1.2 line-height, -1px tracking; 25px at 700px and below.
- Hero heading: 30px, 1.2 line-height, -1px tracking; 27px at 1200px and below, then 26px at 700px and below.
- Section heading: 18px, weight 650, -0.4px tracking; dashboard section bars use 16px on mobile.
- Event heading: final override 15px, weight 650; mobile 16px. Draft headings are 14px.
- Root body size: 14px. Supporting page copy is 13px, 12px on mobile. Paragraph line-height is 1.65.
- Chat bubbles: 13px with 1.7 line-height. Event metadata and recommendation reasons are 12px after the readability overrides.
- Category tags: 10px, weight 700, uppercase, 0.7px tracking. Small labels and footer copy vary from 9–11px; these are observed sizes, not a blanket recommendation for new body copy.

## Layout

The desktop shell uses a fixed 226px sidebar, 82px topbar, and main content capped at 1600px with 30px 34px 40px padding. The dashboard main/rail grid is `minmax(0,1fr) 270px` with 24px gaps. Event cards use three equal columns with 15px gaps. The planner uses `minmax(0,1fr) 320px` with a 22px gap; chat height is 720px, minimum 620px, with an independently scrolling message region.

- At **1600px and above**, main padding becomes 38px 45px, event gaps 20px, posters 145px high, and the hero at least 230px high.
- At **1200px and below**, sidebar width becomes 200px, main padding 25px, dashboard rail 235px, planner rail 280px, and cards use two columns. The third card is hidden only when it is the third and final card. Semester text is hidden.
- At **960px and below**, the dashboard becomes one column; the supporting rail becomes two columns with its final panel hidden. Event cards return to three columns and the third card returns. The planner stacks chat above its rail, whose panels use two columns. Wide form layouts stack; breadcrumbs disappear. Full calendar content retains at least 650px width and scrolls horizontally.
- At **700px and below**, the sidebar becomes a 240px hidden drawer; `.open` restores visibility and slides it into view. The shell has no left margin. The header is 64px high and main padding is 24px 18px. Event cards become a single column, all three dashboard suggestions remain visible, posters are 130px high, and body padding is 16px. The rail retains only the planner teaser, arranged with mascot beside copy. Planner side panels stack and chat height becomes 660px. Forms use one column.
- The final mobile calendar rule keeps `.week` at least 570px wide inside `.week-scroll`; the full calendar remains at least 650px. Day labels remain horizontal, event titles 12px, times 11px, and add controls 36px high. Horizontal scrolling stays inside the calendar region: layout/planner children, stacks, and panels use `min-width:0`; `.week-scroll` uses `max-width:100%;min-width:0`; the narrow dashboard column uses `minmax(0,1fr)`. The final browser check reported a 390px document and viewport with a 318px calendar viewport around 570px content.

Spacing is compact and purpose-specific: 6–9px within navigation/filter groups, 12–18px within cards and forms, 22px panel padding, and 24px between desktop sections. Do not infer a universal spacing scale from these observed steps.

## Elevation & Depth

Most surfaces are flat white panels separated by a 1px `line` border on the warmer page canvas. Solid dark green and pale tint changes establish emphasis. Event posters use a thin low-opacity cropped circle as a graphic motif.

The shared shadow is `0 12px 36px #183e3114`, used for the detail dialog, toast, and mobile drawer. The dialog backdrop is `#15291f65`. Panels and event cards have no default shadow. Page entry animates opacity and a 5px vertical offset over 0.3s with `cubic-bezier(.16,1,.3,1)`; toast opacity/position and drawer position use 0.2s transitions. Reduced-motion preferences disable animations and transitions globally.

## Shapes

Panels and the hero use 14px corners, event cards 12px, dialog 16px, composer 10px, navigation and notices 9px, buttons 8px, and fields/chips/calendar entries 7px. Avatars and date highlights are circular. Icons are unfilled strokes with rounded caps and joins, usually 20px square. The cat mascot is a supplied raster asset with `object-fit:contain`; preserve its proportions.

## Components

### Buttons and filters

The primary button has green fill, white text, an 8px radius, 10px 15px padding, 12px semibold text, and a 38px minimum height. Hover darkens the fill. Secondary buttons use white, a shared 1px border, and mint hover with a stronger border. Small buttons use 6px 10px padding and 30px minimum height. Text actions are green and gain an underline on hover. Disabled buttons use 0.55 opacity and the default cursor.

Filter chips use 7px corners, 7px 12px padding, and an outlined default state. Selected chips use solid green and white text with `aria-pressed`. Saved-event icon buttons also expose `aria-pressed`. Mobile event add buttons have a 40px minimum height.

### Navigation

Sidebar items use a 9px radius, 13px 15px padding, a stroke icon, and 13px semibold labels. Active items use mint with green text and `aria-current="page"`. Mobile navigation has an accessible toggle with `aria-expanded` and `aria-controls`; Escape closes the drawer and returns focus to the toggle. Closed mobile navigation is hidden from layout visibility and keyboard traversal.

### Panels and event cards

Panels use white, 1px shared border, 14px corners, and 22px padding (17px mobile; rail panels use 20px). Event cards clip a category poster above title, metadata, fit/restriction reason, and an add action. Their 12px corners and explicit action hierarchy repeat across dashboard and discovery screens. Titles open details; saving and adding remain separate controls.

### Weekly calendar

Five weekday columns distinguish neutral busy commitments from green chosen events. Cancelled events use peach/rust and explicit text. Event entries open details; dashed add controls expose day-specific accessible names. The full calendar uses larger entries and start/end times. Preserve readable widths with internal horizontal scrolling on narrow screens.

### Planner and draft plan

Assistant bubbles have a square upper-left corner and three 12px corners; user bubbles mirror the square corner and use mint. Mascot images identify assistant messages; repeated decorative avatars use empty alt text. The composer has a 1px sage border, 10px corners, a labelled textarea, and an accessible icon-only send button. Enter submits; Shift+Enter preserves a line break. Prompt chips wrap. The message region announces updates politely. Draft items retain title, time, reasons, and a separate add button; an empty state explains how suggestions appear. Keep the simulated-response disclosure visible.

### Forms, dialogs, and feedback

Fields use white, 1px borders, 7px corners, and 11px padding within visible labels. Time-block errors use `role="alert"`. The native detail dialog uses 28px padding, max-width 530px, `width:calc(100% - 30px)`, and a labelled close control. Toasts use dark green, white text, 9px corners, and a polite live status region.

Global focus styling exists, but `.search input` and `.composer textarea` subsequently set `outline:none`; their focus treatment needs separate verification before claiming complete keyboard accessibility. Some icon and small controls are below 44px. No full WCAG conformance claim is made by this document. Accessible names, semantic buttons/forms, state attributes, labelled messages, and reduced-motion handling are observed implementation features.

## Do's and Don'ts

### Do:
- **Do** preserve the supplied green and white dashboard and cat mascot.
- **Do** retain explicit event titles, times, reasons, and separate add actions.
- **Do** keep the final responsive overrides when extracting components.
- **Do** preserve focus indicators, accessible names, status announcements, and reduced-motion behavior.

### Don't:
- **Don't** present simulated chat, fictional events, or disconnected calendars as live services.
- **Don't** imply a draft recommendation is already on the student's calendar.
- **Don't** shrink mobile calendar text to fit all five columns; preserve horizontal calendar scrolling.
