# TripWallet handoff

Design owner: Jiwoo. Code owner: Brian / Agent 5. Figma access for Brian: not required.

Visual approval: **pending**. Latest draft: **r1-draft (2026-11-01)**, awaiting Jiwoo's review.

**Status of the code.** Brian's TripWallet milestone (#25) and its integration (#27) were merged to `main` on 2026-11-01, while this draft was being made. The draft was designed from the requirements below and the canonical fixture, **not** from Brian's implemented screens, and the two have not been reconciled yet. Before applying visuals, Brian should compare the implemented states and controls with the frames below, and raise any difference in behavior or naming on #7 or #2. The design yields to tested behavior unless Jiwoo decides otherwise.

## Required behavior and states

- Overview and claims: expected, provider-confirmed, received and outstanding cash as distinct stages.
- Claim details: source action, evidence, due-date provenance and allocation history.
- Receipt intake/review: extracted fields, candidate matches, ambiguous/currency mismatch/duplicate handling and confirmation.
- Partial/full reconciliation: a $400 sample claim with $250 received leaves $150 outstanding; a further $150 resolves it.
- Credits/points: issuer, balance/unit, restrictions, expiry; keep them separate from cash.
- Follow-up draft: accurate outstanding amount and evidence; user reviews/copies it, no automatic sending.
- Empty/loading/error, partial, overdue, review-needed and resolved states.

Brian owns code, claim synchronization, matching/allocation, balances, state handling and tests. Jiwoo supplies visual layout, responsive behavior, component references and exports. Brian does not create Figma frames or choose the final visual design.

## Draft r1 frames (Figma page `06 — TripWallet`, node `1:7`)

| Frame | Node | Link | Export |
| --- | --- | --- | --- |
| TripWallet — Desktop — Overview | `13:2` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-2) | `design/exports/tripwallet/tripwallet-desktop-overview.png` |
| TripWallet — Desktop — Hotel claim and receipt match | `13:178` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-178) | `…/tripwallet-desktop-hotel-claim-and-receipt-match.png` |
| TripWallet — Desktop — Reconciled and receipt states | `13:287` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-287) | `…/tripwallet-desktop-reconciled-and-receipt-states.png` |
| TripWallet — Desktop — Follow-up draft | `13:420` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-420) | `…/tripwallet-desktop-follow-up-draft.png` |
| TripWallet — Mobile — Overview | `13:491` | [open](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-491) | `…/tripwallet-mobile-overview.png` |

Component sheets: `design/exports/foundation/component-claim-row.png`, `component-receipt-row.png`, `component-button.png`. Tokens and the component API: `design/handoffs/foundation.md`.

### Scoping rule (most important)

Every money figure says whether it is **trip-wide** or for **one claim**, and it is always **cash only**.

| Moment | Trip-wide (all 4 claims) | Hotel claim only |
| --- | --- | --- |
| After the first receipt (Nov 22) | Expected $820.00 · provider confirmed $400.00 (hotel only) · received $250.00 · **outstanding $570.00** | Expected $400 · confirmed $400 · received $250 · **outstanding $150** |
| After the second receipt (Nov 24) | **Outstanding $420.00** (flight $320 + walk $60 + transfer $40) | Received $400 · **outstanding $0.00**, status `Received` |

- Resolving the hotel does **not** resolve the other claims.
- The $75 voucher and 8,000 points (`AssetCard`, "Noncash" badge) are never added to any cash figure. Points have no cash value.

### Screens

**Overview (`13:2`, demo clock Nov 22).**
- A "Trip-wide cash" card with four Hero `MoneyStat`s: Expected, Provider confirmed, Received (Positive), Outstanding (Warning).
- A claims card with one `ClaimRow` per claim. Hotel is `Partially received`; the others are `Expected`.
- A receipts card: `ReceiptRow` `Matched` for HLH-RF-0001 $250.00, plus Primary "Import a receipt".
- Side column: a Simulated alert and "Credits and points" (voucher and points `AssetCard`s with a "never added to cash" note).

**Hotel claim (`13:178`, Nov 24).**
- Title states "One claim — amounts on this page are for the hotel only".
- Four Medium `MoneyStat`s for this claim.
- "Source and due date": the source action (Simulated), the due date "Nov 25, 2026, 6:00 PM EST" from the provider confirmation, and `Evidence` quoting the refund confirmation.
- "Allocation history": the matched `ReceiptRow`.
- Side card "Review new receipt":
  - `Evidence` quoting the statement credit;
  - `KeyValue` rows for reference, amount and match candidate, then a `Total` "Hotel outstanding after match $0.00";
  - a plain-language reason for the match;
  - Primary "Confirm match" and Ghost "Choose another claim".

**Reconciled and receipt states (`13:287`).**

| Panel | Content |
| --- | --- |
| Hotel claim resolved | Stats $400 / $400 / $0, plus an Info alert that trip-wide outstanding is $420 |
| Duplicate receipt | `ReceiptRow Duplicate` (HLH-RF-0001 re-sent) plus an Info alert "Already recorded — nothing changed" |
| Ambiguous match | `ReceiptRow Ambiguous` plus `Field` Select "Allocate to" — nothing is allocated until the user chooses |
| Currency mismatch | `ReceiptRow Currency mismatch` (€40.00) plus a Danger alert — no conversion, and the amount is not added |
| Overdue | `ClaimRow Overdue` (demo clock Nov 26, past the due date) plus Secondary "Draft a follow-up" |

**Follow-up draft (`13:420`).**
- `Field` Input for the subject, and `Field` Textarea with the editable message. The amounts come from the claim: confirmed $400, received $250 (HLH-RF-0001), outstanding $150, due Nov 25.
- Primary "Copy draft" and Ghost "Reset to generated text".
- A Simulated alert: "Sending is not part of WayFare".
- An "Evidence used" card with `KeyValue` rows.

**Empty, loading and error.** Use `StateBlock`:
- **Empty:** "No refund claims yet — they're created after you approve a recovery action in ReRoute".
- **Loading:** shown while claim sync runs. The shell also shows `ClaimSyncNotice`.
- **Error:** includes the error code, request ID and Retry.

### Responsive behavior

- **Below 1024 px:** the side column stacks under the main column, and the four stats go 2×2.
- **Below 768 px (mobile frame):**
  - one Hero "Outstanding (all claims)" figure plus `KeyValue` rows for the other stages;
  - claims as compact stacks: title, then "Outstanding $X of $Y", then a status badge;
  - a full-width "Import a receipt" button, then the credits and points cards;
  - `MobileTabBar` is active on Wallet.

### Implementation notes for Brian (no Figma needed)

- **Shared building blocks.** Data and fixtures come from `src/core`: `RefundClaim`, `Receipt`, `WalletAsset`, `demoReceipts`, `DEMO_HOTEL_REFUND_CONFIRMATION`, `DEMO_EXPECTED.hotelClaim` and `demoCancelTripActions`.
- **Claim sync.** Your `syncClaimsFromActions` must be idempotent (`ensureClaims`). The shell calls it after every recorded action and on every wallet load.
- **Receipts and claims.**
  - Receipts: `putReceipt` is unique by normalized reference; a different amount returns `duplicate`.
  - Allocations and status changes go through `saveClaim(claim, { expectedRevision })`.
- **Contract notes.** No contract change is needed for these screens.
  - Overdue is a status you derive from `claim.due.at` versus `ctx.clock.now()`.
  - Currency mismatch is detected by comparing the receipt and claim currencies; the money helpers throw on mixing.

## Approval record

Approved revision: pending. Draft r1 (2026-11-01) is awaiting Jiwoo's review.
Export paths: `design/exports/tripwallet/`
Responsive/state specifications: the "Draft r1 frames" section above
Approval Issue/commit: Issue #2 (pending)
Implementation PR: functional milestone #25 / #27 merged. Applying the visuals waits for approval and reconciliation.
