# Wayfinder and intake handoff

## r2-final — approved 2026-11-03 (current)

Shared foundations, shell and responsive rules: [`r2-final.md`](r2-final.md). Figma: `Screen · Plan (Wayfinder)` (`61:196`). Exports: `design/exports/wayfinder-intake/r2-plan-wayfinder-desktop.png`, `r2-plan-wayfinder-free-time-flexibility.png`, `r2-plan-composer-pickers.png`, `r2-plan-narrow-390.png`.

**Plan tab, top to bottom.**
1. Faint w-logo watermark, "Where to next?" (Figtree 600, 36) and "Describe the trip you want. WayFare compares options, shows every cost, and books it for you."
2. **Composer** (720 wide, 16 radius, hairline, `WF/Hover`): an empty textarea whose **grey placeholder** is the example request (submitting empty uses the placeholder). Controls row, all 34 px tall and vertically centred: attach (paper clip, opens booking import), travelers chip, dates chip, then the blue round send button on the right.
   - Travelers chip opens a popover: Adults (min 1) and Children steppers, total 1–9, "Done". Label "N traveler(s)" — no currency text.
   - Dates chip opens Leave / Return date inputs; return must be after leave (inline error).
3. "Or start from an example": three outline cards (Plan a weekend away · Keep it refundable · Find a cheaper flight), then "NY Trip · booked from this plan · 2 days ago".
4. Answer header with a blue sparkle: "I found 3 plans for New York, {dates} · {travelers}." plus the scope line.
5. **Wayfinder controls** card: Budget input ($), "What matters most" segmented (Price / Convenience / Flexibility), "Saturday morning" segmented (Skyline walk · $80 / Free time), and an info line explaining the order ("Ordered by listed cost. A plan with a missing price goes last." / "Ordered by {priority}, then by price. Budget checks stay the same."). Changing any control re-ranks immediately.
6. **Plan cards** (3-up): 3:2 photo with a tag (top card: "Best price" / "Most convenient" / "Most flexible"; booked plan: "Your current trip"), "OPTION n" (+ "· BOOKED"), title, summary, total (`WF/Money`; unknown shows "$1,010 + ?") with budget status in jade/coral, a stacked cost bar in category colours (unquoted part striped), Convenience and Flexibility as three dots, expandable "Where the money goes" (each line item with "Sample quote" / "No quote received yet", total or "Known so far", assumptions), and the action: "Choose this plan" (dark), "View your trip" (line) for the booked plan, or disabled with the reason underneath for unknown-price or over-budget plans. Choosing shows "Chosen · tap to undo" and a toast; nothing is booked.
7. **Side by side** table: Flight, Hotel, Activity (hidden with Free time), Airport ride, Total per plan; the lowest price per row is jade; unquoted shows "Not quoted".

Data and rules are unchanged from the merged Wayfinder module (#17): the same three sample candidates ($815, $900, unknown), integer cents, unknown never treated as free, free time removes the activity, a selected plan is not a booking. The plan photos are in `design/exports/prototype/r2/photos/`.

**Booking intake** keeps the r1 layout below, restyled with r2 foundations (tokens, type, buttons, tags). It is reached from the composer's attach button.

---

Design owner: Jiwoo. Code owner: Agent 2. Visual approval: **pending**. Latest draft: **r1-draft (2026-11-01)**, awaiting Jiwoo's review.

Required interactions:
- travel preferences;
- generation, loading and error states;
- two or three comparable options with line-item details;
- selected-plan persistence;
- pasted confirmation, then extraction and review with evidence;
- editable uncertain fields;
- save, error and duplicate states.

A plan remains distinct from a confirmed booking.

Jiwoo supplies the approved layout, mobile behavior, component/token references and exports. Agent 2 implements the code using the shared services and components. Backend and validation work can proceed before visual approval.

## Draft r1 frames

Agent 2's modules are already merged (#17). These designs follow that implemented behavior and do not add new capabilities.

| Frame | Node | Link | Export |
| --- | --- | --- | --- |
| Wayfinder — Desktop — Compare plans | `11:2` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=11-2) | `design/exports/wayfinder-intake/wayfinder-desktop-compare-plans.png` |
| Wayfinder — Desktop — Saved plan and states | `11:188` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=11-188) | `…/wayfinder-desktop-saved-plan-and-states.png` |
| Wayfinder — Mobile — Compare plans | `11:303` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=11-303) | `…/wayfinder-mobile-compare-plans.png` |
| Booking intake — Desktop — Paste and extract | `10:2` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=10-2) | `…/intake-desktop-paste-and-extract.png` |
| Booking intake — Desktop — Review before saving | `10:80` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=10-80) | `…/intake-desktop-review-before-saving.png` |
| Booking intake — Desktop — Results and states | `10:238` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=10-238) | `…/intake-desktop-results-and-states.png` |
| Booking intake — Mobile — Review before saving | `10:345` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=10-345) | `…/intake-mobile-review-before-saving.png` |

### Wayfinder (`/trips/:tripId/plan`)

**Layout.** A preferences card holds:
- a 4-up row: Origin, Destination, Start date, End date (`Field` Input);
- a 3-up row: Budget (Input), Interest (Select), Prioritize (Select);
- Primary "Generate options" (or "Regenerate options") and Ghost "Use supported sample".

Below it come a Simulated alert, then three `PlanCard`s ordered by the chosen priority, then an itemized `KeyValue` breakdown per plan, ending in a `Total` row.

**PlanCard states.**

| State | Shows | Button |
| --- | --- | --- |
| Default | "Within component budget" | Primary "Select plan" |
| Selected | 2 px accent border, "Selected · no reservation made" | Secondary "Selected plan" |
| Unknown price | Total reads "Unknown", with the known subtotal caption | Disabled |
| Over budget | Warning badge | Disabled |

**Values (sample).** Ordered by price: Saver $815.00, Nonstop $900.00, Flex Unknown (known subtotal $1,010.00 plus an unquoted transfer). "Free time" omits the $80 activity, so Saver drops to $735.00.

**States.**
- **Loading:** `StateBlock` Loading. Previous results stay visible.
- **Unsupported route:** `Field` Error plus a Danger alert. Results are unchanged.
- **Stale preferences:** a Warning alert, with Select disabled until the user regenerates.
- **Saved:** a Success alert "Plan saved. No reservation was made." Reselecting shows the Info message "This plan is already selected."

### Intake (`/trips/:tripId/import`)

**Paste.**
- `Field` Select "Sample document" plus Secondary "Use sample document".
- `Field` Textarea, with the character count in Help.
- Primary "Extract booking".
- Side column: a Simulated alert and the saved-bookings list (`StateBlock` Empty when there are none).

**Review.**
- A card with a Simulated badge and the request ID in `Mono/Small`.
- 2-up rows of `Field` plus `Evidence`. Help shows confidence ("High confidence"), or "Not found in the document" when the source didn't say.
- Timezone shows Medium confidence with a Warning "Check this" badge.
- A policy sub-card on `surface-muted` lists each tier as a `KeyValue` with its window text, followed by `Evidence`.
- Checkbox "Policy terms are uncertain or incorrect…" saves the policy as unknown, per the v1 decision on #3.
- Checkbox attestation, then Primary "Save reviewed booking" and Ghost "Start over".
- The side column shows the original document in `Mono/Small`.

**Result and error states.**

| State | Alert | Notes |
| --- | --- | --- |
| Saved | Success | Shows provider and reference |
| Duplicate | Info "Already imported…" | No duplicate created; new edits not applied |
| Extracting | — | Loading `StateBlock` plus a Loading button |
| `not_configured` | Danger | Textarea in Error state with the text preserved, plus Retry |
| Not a booking | Danger | Notes that instructions inside pasted text are ignored |
| Unknown policy / missing required field | Warning | Field Error "Required; not found in the document. Enter it to save." and a disabled Save |

**Mobile.** A single column with the same field/evidence pairs. Tiers appear as `KeyValue`s. Save is full width.

### Responsive behavior and owner

- **Wayfinder:** the plan cards stack below 768 px, and the preferences fields go 2-up and then 1-up.
- **Intake:** review rows go 1-up below 1024 px, and the original document moves below the form.
- **Owner:** Agent 2 implements both the visuals and the behavior.
- **Contracts:** no contract changes are required. Everything uses `ctx.extraction`, `reviewedBookingInput`, `saveReviewedBooking`, `selectPlan` and `savePlan` as they exist.

## Approval record

Approved revision: pending. Draft r1 (2026-11-01) is awaiting Jiwoo's review.
Export paths: `design/exports/wayfinder-intake/`
Responsive/state specifications: the "Draft r1 frames" section above
Approval Issue/commit: Issue #2 (pending)
Implementation PR: functional preview #17 is merged. Applying the visuals waits for approval.
