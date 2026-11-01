# ReRoute / CancelClock handoff

Design owner: Jiwoo. Code owner: Kelvin / Agent 4. Figma access for Kelvin: not required.

Visual approval: **pending**. Latest draft: **r1-draft (2026-11-01)**, awaiting Jiwoo's review. ReRoute code is **not implemented yet**. These screens were designed from the published requirements below and the canonical fixture; they do not show working behavior.

## Required behavior and states

- Disruption overview: affected trip/booking, event reason/time, sample/live status.
- Affected bookings: booking details, why each may be affected, keep/change/cancel eligibility and source policy evidence.
- Recovery comparison: at least continue and cancel choices, additional cash, expected cash refund, noncash effects, forecast total and assumptions.
- CancelClock: ordered deadlines with recoverable amounts before/after each cutoff, using the shared clock.
- Approval: explicit selected actions and consequences; clearly label simulated actions.
- Results: loading, success, partial failure, retry, stale option/deadline crossed and unknown policy.

Kelvin owns code, recovery calculations, state transitions, idempotent action records, errors and tests. Jiwoo supplies the visual layout, responsive behavior, component references and exports. Kelvin does not create Figma frames or choose the final visual design.

## Draft r1 frames (Figma page `05 — ReRoute`, node `1:6`)

| Frame | Node | Link | Export |
| --- | --- | --- | --- |
| ReRoute — Desktop — Disruption and options | `12:2` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=12-2) | `design/exports/reroute/reroute-desktop-disruption-and-options.png` |
| ReRoute — Desktop — Approve cancel-trip | `12:184` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=12-184) | `…/reroute-desktop-approve-cancel-trip.png` |
| ReRoute — Desktop — Results and states | `12:202` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=12-202) | `…/reroute-desktop-results-and-states.png` |
| ReRoute — Mobile — Options | `12:316` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=12-316) | `…/reroute-mobile-options.png` |

Component sheets: `design/exports/foundation/component-deadline-row.png`, `component-button.png`. Component reference and tokens: `design/handoffs/foundation.md`.

### Screen structure, top to bottom (desktop, 1200 content width)

1. **Disruption card.** Title "Flight BL 214 cancelled by Bayline Air", with a Simulated badge "Simulated disruption". It shows the detected time from the active clock, and an `Evidence` block quoting the carrier notice (`doc-demo-disruption-notice`).
2. **Affected bookings.** One `BookingRow` per booking. The flight is `Disrupted`; the others are `Confirmed`. `Meta` explains why each is affected and its refund rule with the deadline, for example "Depends on arriving Nov 20 · $400 back if cancelled before Nov 19, 6:00 PM EST".
3. **Recovery comparison.** Two cards side by side, each a list of `KeyValue` rows ending in a `Total`. The "Not recoverable" and "Cash paid before the refund arrives" rows use `Muted`.

   | Continue the trip (Sample quote badge) | | Cancel the trip ("All deadlines open" badge) | |
   | --- | --- | --- | --- |
   | Replacement BL 230 (quote valid until Nov 19, 6:00 PM EST) | $360.00 | Flight (airline cancelled, no deadline) | $320.00 |
   | Extra cash needed now | $360.00 | Hotel, before Nov 19, 6:00 PM EST | $400.00 |
   | Expected cash back, original flight | $320.00 | Skyline Walk, before Nov 20, 12:00 PM EST | $60.00 |
   | Cash paid before the refund arrives (Muted) | $1,260.00 | Transfer, before Nov 20, 7:00 AM EST | $40.00 |
   | **Forecast trip cost after expected refund** | **$940.00** | **Expected cash back** | **$820.00** |
   | | | Not recoverable (Muted) | $80.00 |

   - Continue ends with Secondary "Choose continue".
   - Cancel ends with Danger "Review cancel-trip actions", which opens the dialog.
   - Noncash note on Cancel: "Voucher ($75) and 8,000 points are unchanged and not counted as cash."
4. **CancelClock card.** One `DeadlineRow` per deadline, ordered by instant. Each shows the status badge in words, the local time plus UTC instant plus time left, the source wording, and "Before: $X / At or after: $Y".
   - `Closing soon` (Warning) applies under about 36 h; `Open` otherwise; `Passed` at or after the instant; `Unknown` when there is no reviewed policy.
   - A footnote states the boundary: at exactly `2026-11-19T23:00:00Z` the hotel recovery is $200, cash back is $620, and unrecovered cost is $280.

### Approval dialog (`Dialog` component, over a 55% scrim)

- **Title:** "Approve 4 cancel-trip actions?"
- **Body:** says the actions are simulated, and that approval does not prove a real cancellation.
- **Summary:** one line per `ActionRecord` with its expected amount, then the total and the noncash note.
- **Acknowledgment:** a required checkbox, "I understand these are simulated actions". Keep the Danger button disabled until it's checked; that rule is for code, and the static frame shows the enabled look.
- **Buttons:** Secondary "Cancel" and Danger "Approve 4 actions".

### Results and states (`12:202`)

| State | Content |
| --- | --- |
| Recorded | Success alert, plus an Info alert "Refund claims created in TripWallet · 4 claims · $820.00" and Secondary "Open TripWallet" |
| Partial failure | Danger alert naming the failed booking and the error code. `KeyValue` rows: "Recorded … $780.00" and "Not recorded … $40.00". Primary "Retry 1 failed action". Recorded actions stay recorded. |
| Claim sync pending | Warning alert worded as the shell's `ClaimSyncNotice`, plus "Retry claim sync" (shell-owned) |
| Deadline crossed / stale | Warning alert. The `DeadlineRow` shows `Passed`, and the recalculated amounts are $200 / $620 / $280. The stale $820 option can't be approved. |
| Unknown policy | Warning alert. Recovery and the trip total read "Unknown", never $0, plus "Review policy in intake". |

### Responsive behavior

- **Below 1024 px:** the comparison cards stack, Continue first.
- **Below 768 px (mobile frame):**
  - the disruption shows as a Danger alert, with a compact next-deadline card (badge, title, time, before/after);
  - the two option cards follow, full width;
  - affected bookings use compact stacks, like the Dashboard mobile view;
  - `MobileTabBar` is active on ReRoute.

### Implementation notes for Kelvin (no Figma needed)

- **Shared building blocks.** Data comes from `src/core` (`DEMO_IDS`, `DEMO_EXPECTED`, `demoCancelTripActions`). Deadlines use `deadlineStatus` / `findInWindow` with `ctx.clock.now()`.
- **Your inputs and outputs.**
  - Input: bookings, policies, the disruption and quotes from `ctx.repo`.
  - Output: a `RecoveryOption` per choice (stored via `replaceRecoveryOptions`), then one `ActionRecord` per booking on approval via `recordBookingAction`, then `ctx.notifyActionRecorded`.
- **Loading and errors.** Show `StateBlock` Loading while options compute. Render repository errors with `ErrorState` (code and request ID), and show retry where `retryable`.
- **Contracts.** No contract change is needed for any screen here. Partial-failure retry relies on per-action idempotency keys (already supported). "Choose continue" uses `action: 'replace'` with `replacementQuoteId`.

## Approval record

Approved revision: pending. Draft r1 (2026-11-01) is awaiting Jiwoo's review.
Export paths: `design/exports/reroute/`
Responsive/state specifications: the "Draft r1 frames" section above
Approval Issue/commit: Issue #2 (pending)
Implementation PR: not started (Kelvin, #6)
