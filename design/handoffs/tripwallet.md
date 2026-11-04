# TripWallet engineering handoff — native draft

## r2-final — approved 2026-11-03 (current)

Shared foundations and shell: [`r2-final.md`](r2-final.md). Figma: `Screen · TripWallet` (`68:579`). Exports: `design/exports/tripwallet/r2-tripwallet-desktop.png`, `r2-tripwallet-narrow-390.png`.

1. "TripWallet" and "Money you’re owed, money that arrived, and credits you still have, grouped by type."
2. Three-tile totals card: COMING BACK (+, jade, "Expected"), RECEIVED (+, jade, "In your account"), LOST TO FEES (−, coral, "Can’t be recovered"). Values come from the wallet ledger; before any cancellation they read +$0 / +$0 / −$0.
3. Underline tabs: All · Refunds · Credits & points.
4. Groups with an icon header (Refunds, Credits & points). Each item is a hairline card: a 40 px rounded **company badge in the provider's category colour** with its icon, title, value on the right (cash in text colour, credits and points in violet `--wf-color-simulated`), restrictions line ("Bayline Air · For Bayline Air flights · code BLA-GW-75"), expiry and "N months left" with a thin time-left bar.
5. Refund items (after approval) use the same card with status tags (Expected, Provider confirmed, Received, Overdue) and the evidence-backed follow-up draft from the existing implementation.

Below 760 px the totals stack vertically. Money rules (cash vs noncash, unknown never $0, mixed currencies rejected) are unchanged.

---

Design owner: Jiwoo. Code owner: Brian / Agent 5. Brian does not need Figma access.

**Visual approval: pending. Approved revision: none.** Export bundle: `draft-tripwallet-2026-11-01-a`, inspected November 1, 2026. This is an engineering reference for existing native drafts, not approval to replace shared styles or claim final visual acceptance. `design/approvals.json` remains authoritative. Report `design_revision: null` until Jiwoo approves a revision.

## Screens available in GitHub

| Native draft | Editable source for Jiwoo | Export usable without Figma |
| --- | --- | --- |
| Desktop overview (1440 × 1292) | [Frame 13:2](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-2) | [Overview PNG](../exports/tripwallet/overview-desktop-draft.png) |
| Desktop hotel claim / receipt match (1440 × 940) | [Frame 13:178](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-178) | [Hotel claim PNG](../exports/tripwallet/hotel-claim-desktop-draft.png) |
| Mobile overview (390 × 1285) | [Frame 13:491](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-491) | [Mobile PNG](../exports/tripwallet/overview-mobile-draft.png) |

| Desktop reconciled / receipt states (1440 × 1545) | [Frame 13:287](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-287) | [States PNG](../exports/tripwallet/tripwallet-desktop-reconciled-and-receipt-states.png) |
| Desktop follow-up draft (1440 × 841) | [Frame 13:420](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=13-420) | [Follow-up PNG](../exports/tripwallet/tripwallet-desktop-follow-up-draft.png) |

**Update, later on November 1 (Agent 1 design pass r1-draft).** The earlier inspection of `13:287` caught the board mid-build, with a collapsed overdue row and cramped receipt rows. It has since been repaired:
- Each state panel (hotel claim resolved, duplicate, ambiguous match, currency mismatch, overdue) now spans the full width, so the `ReceiptRow` and `ClaimRow` components keep their designed columns.
- The panels hug their content, so nothing is clipped.

The board and the follow-up draft are now exported, in the two rows above. All five TripWallet frames form part of draft r1 (see `docs/DESIGN_MAP.md`) and remain unapproved.

Open review item for Jiwoo, from this handoff's money-scope note: the overview's "Provider confirmed $400.00" stat is captioned "1 of 4 claims (hotel)". Consider replacing it with a known-subtotal-plus-unknown-count presentation, so it can't read as "others confirmed $0". The code keeps its explicit unknown total until this is decided.

These exports document drafts. There is no automatic GitHub/Figma synchronization.

## Layout and components

Desktop overview: 1440 px canvas, 1200 px content with 120 px side margins. A full-width cash summary precedes a 784 px claims/receipts column and a 392 px assets column with 24 px gap. Claim detail uses approximately 736 px / 440 px columns and 24 px gap. Cards have visible boundaries, consistent padding and descriptive headings. Use existing shared code components and `--wf-*` tokens; do not independently replace the shared palette or typography.

Native references include NavBar, DemoClockBar, MoneyStat, Badge, ClaimRow, ReceiptRow, Button, Alert, AssetCard, KeyValue, Evidence, Field, MobileHeader and MobileTabBar. Agent 1 owns shared component implementation; request missing technical props through #8. Brian owns feature composition and behavior.

Mobile draft: 390 px canvas, 16 px gutters, one column. Summary values become stacked key/value rows; claim descriptions wrap above or beside their textual status; primary import action spans the available width. Keep money and currency readable at 320/360/390 px. Receipt/detail forms must stack when side-by-side content no longer fits; never collapse the description to zero width. Long references and evidence wrap within cards. Bottom navigation must not obscure actions or focused fields. Final breakpoints and unshown mobile detail states await Jiwoo's visual review.

## Money, scope and evidence

- Keep expected, provider-confirmed, received and outstanding stages separate. A recorded cancellation produces an expectation; it does not prove payment.
- The overview screenshot is trip-wide: $820 expected across four claims, $250 received, $570 outstanding. The $400 shown as provider-confirmed is only the known hotel confirmation (one of four claims). **Do not imply that all other providers confirmed zero.** The draft needs a known-subtotal/unknown-count label if a numeric partial subtotal is displayed. Retain the code's explicit unknown total until that presentation is resolved.
- Hotel detail is one claim: expected $400, confirmed $400, received $250, outstanding $150. After the second $150 receipt, hotel received is $400 and outstanding is $0; the other three claims still total $420 outstanding. Hotel resolution is not trip resolution.
- Source action, provider confirmation, original document, due-date provenance and allocation history remain inspectable. Use the active demo clock. Hotel refund is due at `2026-11-25T23:00:00Z`; at the boundary it is overdue if unresolved. Unknown due dates stay unknown.
- Changed promises, currency differences and over-receipts require review. Preserve the original expected amount and evidence. Do not hide discrepancies with clamping or invent a currency conversion.
- $75 voucher and 8,000 points are separate noncash assets. Show issuer, unit, restrictions, expiry and evidence; never add them to cash refunds.

## Required interactions and states

| Area | Required behavior |
| --- | --- |
| Wallet entry | Run idempotent claim sync from durable successful actions. Distinguish pending/retry/failed sync from action success. Reopening/reloading cannot duplicate claims. |
| Confirmation / receipt intake | Keep pasted evidence visible, show reviewed fields and explicit sample/live capability. Unknown or invalid fields stay reviewable. No save from an unreviewed AI proposal. |
| Match review | Show candidate claim, original evidence, receipt currency/amount and resulting outstanding amount. A proposal is not an allocation. Confirm explicitly; allow another reviewed claim. Ambiguous/no-match inputs remain unallocated. |
| Match commit | Allocate once. Reload current state on `conflict`; show that the receipt may have been allocated in another tab. Shared repository validates allocation totals atomically. Derive matched status from allocations. |
| Duplicate import | Preserve original receipt and allocations; report already imported. Changed amount with the same reference is a conflict to review, never another payment. |
| Partial / resolved | $250 leaves hotel $150 outstanding; subsequent $150 resolves only that claim. Repeat import/match or reload preserves both allocations without double counting. |
| Overdue / review | Explain the due source and unresolved amount in words. Use textual badges as well as color. Use a readable stacked row until Jiwoo repairs the native state-board layout. |
| Follow-up draft | Generate from current claim/evidence, including $150 outstanding in the partial state. Text stays editable; user copies it. Nothing sends automatically. |
| Empty / loading / error | Explain no claims vs sync pending vs no receipts. Disable duplicate submissions while busy. Preserve input and expose retryable errors in an accessible status/alert. |
| Assets | Display restrictions and expiry conservatively. Structured eligibility/reservation/redemption remains a separate unfinished Brian milestone, not implied by the draft. |

## Current implementation and boundaries

Brian's [PR #25](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/25), head `3665b6262e42d94e5131f24e0dfa3c86751c3313`, supplies the functional shared-component UI and ledger milestone. Agent 1 integrates it under [#8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8). It is not visually matched to this draft yet.

Shared contracts and wallet-evidence seam are documented in `docs/CONTRACTS.md`. Brian owns wallet schemas/prompts, `src/features/tripwallet/server.ts` and client integration. A route or health flag alone does not establish live AI. The present milestone uses user-reviewed fields and explicit fictional presets.

Brian updates #7 with branch/commit/PR/checks at start, milestones, blockers and handoff; keeps `docs/handoffs/agent-5.md` current; and links the actual approved revision when available. Jiwoo updates native designs and approval records. Native drafts, exports, code and approvals remain separate reviewable artifacts.

## Acceptance still pending

Jiwoo's visual approval; repair/approval of receipt-state and responsive detail layouts; final visual fidelity comparison; remaining wallet AI/asset milestones; and the complete ReRoute approval → wallet browser journey. Core logic, tests and integration may proceed independently. Do not close #7 on the strength of these exports.
