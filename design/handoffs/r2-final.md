# WayFare design r2 — final (approved 2026-11-03)

Design owner: Jiwoo. **Status: approved, final.** This revision replaces draft r1 for every area. Feature owners implement it from this file, the feature handoffs and the exports; nobody needs Figma access.

- **Figma (native, editable):** page `09 — WayFare final` (`55:3`) in https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=55-3
- **Working reference page:** `design/exports/prototype/r2/index.html` (open it in a browser; it is a single-file design prototype with sample data and simulated provider actions, not app code).
- **Screen exports:** `design/exports/*/r2-*.png` (listed per feature below).
- **Colour decision:** keep the current white-and-blue palette with the light/dark toggle. No other palettes are approved.

Figma does not sync to GitHub. If Jiwoo changes the Figma page, the handoff and exports are updated in a new PR before code changes.

## 1. Foundations

### Colour tokens (Figma collection `WayFare`, modes Light / Dark)

Code keeps the existing `--wf-*` names where one exists. New names are marked **new**. Agent 1 owns `src/styles/tokens.css`.

| Figma variable | CSS variable | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| `bg/page` | `--wf-color-bg` | #FFFFFF | #121314 | Page background (also the top bar at rest) |
| `bg/surface` | `--wf-color-surface` | #FFFFFF | #1B1C1E | Cards, menus, dialogs |
| `bg/surface-2` | `--wf-color-surface-muted` | #F7F7F7 | #232427 | Tab track, segmented controls, hovers |
| `bg/surface-3` | `--wf-color-surface-strong` **new** | #F1F1F1 | #2A2B2F | Image placeholders, shimmer |
| `ticket/paper` | `--wf-color-paper` **new** | #FCFBF7 | #1F2024 | Boarding pass body |
| `ticket/paper-line` | `--wf-color-paper-line` **new** | #E3DED1 | #3A3B41 | Perforation and ticket dividers |
| `text/primary` | `--wf-color-text` | #222222 | #F1F1F1 | Body and headings |
| `text/muted` | `--wf-color-text-muted` | #6A6A6A | #A8A8A8 | Secondary text |
| `text/faint` | `--wf-color-text-faint` **new** | #929292 | #7C7C7C | Placeholders, hints, footers |
| `border/line` | `--wf-color-border` | #DDDDDD | #34353A | Card outlines (Airbnb-style hairlines) |
| `border/line-soft` | `--wf-color-border-soft` **new** | #EBEBEB | #2A2B2F | Row dividers, calendar grid |
| `accent/default` | `--wf-color-accent`, `--wf-color-focus` | #1F5FA8 | #7FA8FF | Brand blue: logo, links, send, NY Trip colour |
| `accent/soft` | `--wf-color-accent-subtle` | #EAF1FB | #1D2A44 | Highlights, assistant bubble |
| `money/gain` | `--wf-color-positive` | #0E7C62 | #4FD1A5 | Money coming back, always with "+" |
| `money/gain-soft` | `--wf-color-positive-bg` | #E6F4EF | #123228 | Positive chips |
| `money/loss` | `--wf-color-danger` | #C9402C | #FF8A73 | Money lost, extra cost, deadlines, always with "−" |
| `money/loss-soft` | `--wf-color-danger-bg` | #FDEEEB | #3A201C | Deadline chips and calendar deadlines |
| `status/amber` | `--wf-color-warning` | #8A5A00 | #FFC46B | "At risk" |
| — | `--wf-color-simulated` | #5E4DBF | #B3A6FF | Credits, points, Simulated labels |
| `category/flight` | `--wf-color-cat-flight` **new** | #1F5FA8 | #3E6FC2 | Flights (calendar, passes, cost bars) |
| `category/stay` | `--wf-color-cat-stay` **new** | #7A3E6B | #8E4A7E | Stays |
| `category/activity` | `--wf-color-cat-activity` **new** | #B4621A | #A9601F | Activities |
| `category/ride` | `--wf-color-cat-ride` **new** | #0F7381 | #13808C | Rides |

Money colour rule: jade with "+" means money coming back; coral with "−" means money lost or extra cost. Status is always written in words; colour only reinforces it.

### Type

Fonts change from Inter / Roboto Mono to **Figtree** (400, 500, 600) and **IBM Plex Mono** (400, 500). Agent 1 adds the `@fontsource` packages; Instrument Serif is not used.

| Figma text style | Font / size / line height | Use |
| --- | --- | --- |
| `WF/Display` | Figtree 600, 35/1.1, −2% | Page titles ("NY Trip", "Where to next?" at 36) |
| `WF/Heading` | Figtree 600, 22/1.2 | Section titles |
| `WF/Title` | Figtree 500, 16/1.4 | Card and row titles |
| `WF/Body` | Figtree 400, 15/1.5 | Body |
| `WF/Small` | Figtree 400, 13/1.45 | Meta, help |
| `WF/Label mono` | IBM Plex Mono 500, 11, +8%, uppercase | Small labels ("DECIDE WITHIN", "OPTION 1") |
| `WF/Airport code` | Figtree 400, 72/0.95, −3% | SFO / JFK on the boarding pass |
| `WF/Money` | Figtree 600, 24, −2%, tabular figures | Plan totals; money tiles use 32 Regular |

Bold is used sparingly: 600 for titles only, never for body text.

### Shape, elevation, motion

- Radii: 8 (buttons), 10–12 (inputs, cards, photos), 14–16 (large cards, calendar, menus), 18 (boarding pass), 22 (floating top bar), 999 (pills, tabs, chips).
- Effect styles: `WF/Pill` (tabs, tags), `WF/Hover` (composer, Ask pill), `WF/Lift` (menus, toasts, dialogs), `WF/Ticket` (boarding pass).
- Motion: 0.15–0.35 s ease; every transition is removed under `prefers-reduced-motion`.

### Icons and logo

- 37 outline icons (24 px grid, 1.6 stroke, round caps), Figma `Icons` row on `Foundations · tokens, icons, logo` (`55:39`). The source SVG paths are the `<symbol id="i-…">` entries in the reference page.
- **Logo:** a rounded lowercase "w" with a separate destination dot, in `accent/default`, next to the word "WayFare" (Figtree 600, 17). Components `Logo / w mark` (`55:271`) and `Logo / lockup` (`55:276`). **No hover effect.** The same w at 7% opacity is the watermark behind "Where to next?".

### Shared components (Figma `Components` board, `56:7`)

| Component | Node | Variants / properties |
| --- | --- | --- |
| Tag | `56:35` | tone = bad, ok, warn, info, mute · `Label` |
| Button | `56:47` | style = dark, line, primary, disabled · `Label`, `Show icon`, `Icon` |
| Nav tab | `56:59` | state = active, inactive · `Label`, `Show label`, `Icon` |
| Trip button | `56:60` | `Trip name`; dot colour = the trip's colour |
| Google sign-in | `56:65` | `Label` ("Sign in", "Connect Google Calendar") |
| Colour mode toggle | `56:72` | sun (light) / moon (dark) |
| Notifications bell | `56:80` | red dot when unread |
| Ask WayFare pill | `56:85` | white, blue 45% outline, blue sparkle, black text |
| Toast | `56:93` | `Title`, `Body`, status dot |
| Top bar | `56:234` | state = top, scrolled |

## 2. App shell (Agent 1)

**Navigation.** Five tabs in a centred pill: Overview, Plan, Itinerary, ReRoute, TripWallet. Mapping from the current app: Dashboard → **Overview**; Plan → **Plan** (Wayfinder); new **Itinerary** (calendar + whole-trip list); ReRoute; TripWallet. Booking import stays at its route and is reached from the Plan composer's attach button. There is **no sidebar**.

**Top bar** (`Top bar`, `56:234`):
- At rest it has the page background and no border.
- After about 12 px of scroll it becomes an inset, rounded (22 px) floating bar with a hairline outline, soft shadow and background blur. Transition 0.35 s, reversible, no layout shift (use a pseudo-element).
- Left: logo lockup, then the Trip button. Right: Google sign-in, colour-mode toggle, bell.

**Trip menu** (States board `72:541`, export `dashboard/r2-overview-trip-menu.png`): the Trip button opens a menu listing trips with their colour dot, dates and status (NY Trip blue, Chicago Weekend teal, Tokyo in Spring purple), a check on the current trip, and "Plan a new trip". Keyboard: arrows move, Esc closes. The button's dot always matches the selected trip's colour.

**Responsive** (export `dashboard/r2-overview-narrow-720.png`, `…-narrow-390.png`):

| Width | Behaviour |
| --- | --- |
| ≥ 1200 | 1140 content column centred; full top bar. |
| < 1140 | Tabs show icons only, except the active tab keeps its label; icons have tooltips. |
| < 1000 | Overview columns and the boarding pass stack; Plan cards go 2-up. |
| < 920 | "Sign in" shows the Google logo only. |
| < 760 | Top row stays one line (logo, trip button, Google, mode, bell). Tabs move to a floating bar at the bottom; Ask WayFare moves above it; page gets 90 px bottom padding. Plan cards and examples go 1-up. |
| < 480 | Trip button shows its dot and arrow only; the stamp reads "CANCELLED". |

Nothing may scroll sideways at any width (check 320–1440).

**Windowed mode.** Decorative motion that needs room is disabled when the window is not maximised (`outerWidth < screen.availWidth − 24`) or narrower than 1200 px. Today that is only the boarding-pass tear.

**Colour mode.** Sun/moon toggle, remembered per browser. Both modes use the same variables.

**Notifications.** Toasts appear top-right above everything (z-index above menus and drawers). There is no permanent "Flight cancelled" pop-up; that alert lives under the bell and on the Overview.

**Ask WayFare.** Bottom-right pill (see component). Opens an assistant panel (export `foundation/r2-ask-wayfare-panel.png`). In the reference page its replies are scripted; any real assistant must go through Agent 1's server-side model adapter and stay labelled until verified.

**Google sign-in and Google Calendar.** Designed states only (export `foundation/r2-signin-dialog.png`). The dialog has **no credential fields** and says it is a demo. Real OAuth is optional and needs Agent 1's backend; until then keep the "Demo" note. Per-booking "Add to Google Calendar" uses Google's public template link and needs no sign-in.

## 3. Screens

| Screen | Figma node | Owner | Exports |
| --- | --- | --- | --- |
| Overview | `60:116` | Agent 1 | `dashboard/r2-overview-desktop.png`, `…-desktop-dark.png`, `…-stub-hover.png`, `…-trip-menu.png`, `…-narrow-720.png`, `…-narrow-390.png` |
| Plan (Wayfinder) | `61:196` | Agent 2 | `wayfinder-intake/r2-plan-wayfinder-desktop.png`, `…-free-time-flexibility.png`, `…-composer-pickers.png`, `…-narrow-390.png` |
| Itinerary | `67:294` | Agent 1 | `dashboard/r2-itinerary-desktop.png` |
| ReRoute | `68:403` | Agent 4 | `reroute/r2-reroute-desktop.png`, `…-narrow-390.png` |
| TripWallet | `68:579` | Agent 5 | `tripwallet/r2-tripwallet-desktop.png`, `…-narrow-390.png` |
| States & responsive | `72:541` | all | trip menu, stub tear, sign-in, narrow window |

Feature details are in each feature handoff. The Overview and Itinerary specifications follow.

### Overview (Agent 1)

1. Header: "NY Trip" and the route/date/traveller line. No status pill next to the title.
2. **Boarding pass** (`Boarding pass` frame): blue band ("BAYLINE AIR" · "BOARDING PASS · ECONOMY · BASIC SAVER"), SFO/JFK codes, dashed route line with the plane at the destination end, and the coral **"CANCELLED BY AIRLINE" stamp tilted 7° and centred on the dashed line** (the plane passes behind it). Details row: Passenger, Flight, Date, Departs, Gate, Seat. Stub (290 px): BL 214 / BLA7Q2, From, To, Date, Refund (+$320), barcode, "HOVER TO TEAR OFF THE STUB".
   - **Hover (full screen only):** hovering the stub area tears the stub away by rotating it 11° around its bottom-left corner, with the interlocking torn edge showing. The large half does not move. A fixed invisible hit area over the stub's resting place prevents flicker. Disabled in windowed mode and when stacked (< 1000 px), where the stub sits under the main half with a dashed perforation.
3. **Decide within** card: coral outline, soft coral-to-white gradient, clock icon, live countdown ("29h 59m"), deadline sentence, dark "See what to do →" button.
4. Two columns: **What to do next** (three numbered steps, the active one with a dark "Choose" button) above three money tiles ("+$820 Expected", "−$80 If you cancel now", "$900 For 4 bookings"); **Your passes** (Apple-Wallet-style stack: the open flight pass in category blue, then stay/activity/ride passes in their category colours, overlapping; tapping one opens it; hover lifts it 14 px).

### Itinerary (Agent 1)

- Bar: legend (Booking dot, red Refund deadline), **Connect Google Calendar** button (becomes "Synced with Google Calendar"), and filter chips: Flights, Stays, Activities, Rides, Deadlines (each toggles).
- One month calendar with bookings and red deadlines merged: multi-day stays are coloured bars; deadlines are coral chips with a left rule and clock icon; today is a blue filled circle; days with deadlines have a red ring. The cancelled flight is struck through.
- **Whole trip list always shows every booking**, grouped by day. Clicking a day highlights that day's entries (accent-soft background, left accent rule) and scrolls to them; it never filters the list. Each row: time, category icon, title, meta, its own deadline line in red (or "No deadline · the airline owes you +$320"), amount, status tag, chevron to the details drawer (with photo, real-place link and "Add to Google Calendar").

## 4. Approval record

Approved by Jiwoo on 2026-11-03 as **r2-final**. `design/approvals.json` records it for every area. Implementation PRs must cite `r2-final` and the export paths they match.
