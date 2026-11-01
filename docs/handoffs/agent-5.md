# Agent 5 / Brian — TripWallet

Task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7
Branch: agent-5/tripwallet
Status: milestone 1 draft for integration review; #7 remains open.
Base inspected: main f3a10dd3eca9bd10a58ee51fbbc800d0b2c5418c.

## Working behavior

Automatic shell-discovered cash claim sync from successful ActionRecords, insert-if-absent by action/component. Four canonical claims total $820; hotel expected $400. Failed/pending actions ignored; noncash components excluded. Repeated sync preserves claims and allocations.

Functional shared-component wallet page supports pasted evidence plus explicitly reviewed fields, canonical sample confirmation/receipt presets, provider-confirmation evidence/due provenance, exact-reference matching proposals with manual selection, partial/multiple/full receipt allocations, duplicate references, currency and over-allocation errors, claim/action/evidence inspection, vouchers/points in original units and issuer restrictions, editable/copyable follow-up drafts and downloadable summary. Nothing sends email or contacts providers.

Expected and provider-confirmed are stages of the same recovery. Receipt allocations are actual received cash. Outstanding uses confirmed if known, otherwise expected. Never sum expected plus confirmed plus received. Missing confirmation is unknown, not $0.

## Public entry points

`src/features/tripwallet/index.ts` exports `feature` (path wallet, key tripwallet) and ledger/evidence functions:
- `syncClaimsFromActions({ tripId }, ctx): Result<{ created, existing }>` — shell invokes after action and wallet load.
- `confirmClaim({ tripId, claimId, documentId, amount, dueAt }, ctx)` — existing confirmation document, positive/nonnegative structured money and sourced UTC due date (or null); original expectation retained.
- `importReviewedEvidence({ kind, text, amount, reference, merchant, bookingReference, at }, tripId, ctx)` — preserve raw evidence, put receipt uniquely by reference. Receipt posting instant required; confirmation due may be null. Amounts are integer minor units, e.g. `{ amountMinor: 25000, currency: 'USD' }`.
- `matchCandidates(receipt, claims, bookings, now)` — proposals only; never auto-allocates.
- `allocateReceipt({ tripId, receiptId, claimId }, ctx)` — full positive receipt allocation to one claim; repeat same receipt/claim is no-op, other claim rejected when already allocated. Expected revision protects a claim's updates.
- `claimState(claim, now)`, `received(claim)`, `followUpDraft(claim, booking, now)`, `walletSummary(claims, assets, now)`, conservative `assetEligibility(asset, { issuer, currency? }, now)`.

Status/matching/idempotency decisions: docs/decisions/agent-5-tripwallet.md.
Wallet summary provides currency-separated cash columns, unknown-currency IDs, attention IDs and noncash assets with issuer/units/restrictions. Noncash grouped totals and executable eligibility rules are not yet implemented.

## Verification

- `npm ci --ignore-scripts --no-audit --no-fund`: succeeded, pinned root dependencies unchanged.
- `npm test`: 7 files, 117 passed / 1 skipped / 3 todo. Includes 11 TripWallet tests and the shell's actual registered TripWallet $820/$400 sync journey test (no longer skipped).
- `npm run typecheck`: passed after final UI refresh dependency fix.
- `npm run build`: passed; Vite warns of >500 kB bundle. Final UI patch uses existing wf-input classes, no new dependencies/tokens.
- Tests cover $400/$250/$150, unchanged separate claims, repeat import/sync/allocation, reload persistence, duplicate-reference conflict, ambiguous/reference/merchant/timing matching, over-allocation, currency mismatch, changed promise/discrepancy/over-receipt, due boundary, failed/pending actions and separate assets.
- Browser verification attempted but unavailable: Playwright Chromium download returned invalid/truncated archives. `verify-browser.mjs` is a prepared **unexecuted** check: with dev server and installed Playwright Chromium, run `node src/features/tripwallet/verify-browser.mjs`. It seeds canonical successful actions (does not replace ReRoute UI acceptance) then exercises wallet controls/reload/mobile render. No browser or visual pass claimed.

## Design and blockers

Handoff: https://github.com/Jiwoo-Jung-Cal/wayfare/blob/main/design/handoffs/tripwallet.md
Approval: design/approvals.json has tripwallet pending, revision null. No approved revision implemented; functional preview uses shared components only. Jiwoo owns layout, responsive specifications, exports and visual approval. Brian needs no Figma access.

Agent 1 requests: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3#issuecomment-6552287955
- Shared saveClaim validates existence only; cross-claim receipt allocation needs atomic receipt-total enforcement. Current code is not concurrent cross-claim safe.
- Wallet AI extraction endpoint/client wiring missing (FeatureContext only exposes booking extraction). Current evidence intake is explicit user review, no live wallet AI.

Kelvin/Agent 1: ReRoute is not registered in pinned main; real ReRoute-to-wallet browser acceptance remains unverified. Shell fixture-to-wallet integration does pass.

Deferred: new noncash issuance from actions, reservation/redemption, executable asset eligibility/grouped balances, AI wallet extraction, automatic bank/provider follow-ups, visual acceptance, full browser integration. No bank integration or automatic sending.

## Resume

Say: “Continue my assigned Issue.” Read #7 and #3 comments plus current main first, preserve this branch, integrate atomic allocation and wallet AI contracts once published, run browser reconciliation and real ReRoute journey with Kelvin/Agent 1, then apply Jiwoo's approved design. Only close #7 when all acceptance requirements are verified.
