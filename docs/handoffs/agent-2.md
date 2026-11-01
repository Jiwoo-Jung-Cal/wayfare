# Agent 2 handoff

Status: functional Wayfinder/intake is merged (#17); exact-amount/stale-hash fixes and interim r1-draft feature layouts are ready for review in #21. Issue #4 remains open for formal visual acceptance.

- Task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4
- Active branch: `agent-2/wayfinder-intake`
- Active milestone PR: https://github.com/Jiwoo-Jung-Cal/wayfare/pull/21
- Main incorporated: `1d42523f7250ea3f58f95115c29efd0d92384f1c` (#29 shared r1 styling, TripWallet integration and #31 lifecycle scripts included).
- Merged feature milestone: #17, head `8642fcca3484b40a8afacd1b0d5e4e0931d88511`; #18/#19 added integrated browser coverage/narrow fixes.
- Earlier #21 head: `5dbd10ff47a11017ba129f0f9af69e0091d06f82`. Agent 1 accepted those hardening fixes; the expanded interim-layout milestone needs renewed review. Latest published SHA/CI links are in the structured #4 report.

## Completed behavior

Wayfinder validates sample preferences, compares three source-labeled options, ranks by price/convenience/flexibility, and recalculates integer totals when the paid activity is omitted. Invalid/unsupported inputs preserve previous results and prevent selection until regeneration succeeds. Unknown/over-budget prices are explicit and cannot be selected. Selection persists/replays through the shared repository without creating confirmed bookings.

Intake accepts pasted text or a deliberately chosen sample, extracts through Agent 1's service, renders editable facts beside verbatim evidence, and requires confirmed-booking attestation before saving. The original document is retained; missing prices stay unknown. Disputed policy saves as unknown/needs_review. Duplicate imports replay prior reviewed facts. Failed extraction preserves text; failed saves preserve corrections. Shared hashes and request generations reject mismatched/stale extraction.

Earlier #21 hardening preserves exact source minor units in review using shared currency precision, avoiding floating-point cent rounding. Saving remains USD-only. The post-hash invalidation check discards obsolete source-mismatch errors. Five regressions covered JPY/KWD precision, safe-integer USD rounding and the async error race. All four canonical imports retain shared booking IDs and total $900 in confirmed paid bookings, independent of plan selection.

## Interim design implementation

Implemented revision: **r1-draft (2026-11-01), interim demo only**. Formal approval remains **pending** in `design/approvals.json`; no Figma/approval records were changed.

- Handoff: https://github.com/Jiwoo-Jung-Cal/wayfare/blob/main/design/handoffs/wayfinder-intake.md
- Exports: `design/exports/wayfinder-intake/` (desktop/mobile compare and review references inspected).
- Authorization/shared elements: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6556949447 and merged #29. Agent 1 relayed Jiwoo's instruction to continue with the draft and published `MoneyStat`, `KeyValue`, Ghost buttons and Simulated/Accent tones.
- Figma: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK
- Frames: Wayfinder `11:2`, `11:188`, `11:303`; intake `10:2`, `10:80`, `10:238`, `10:345`.

Wayfinder implements the 4-up route/3-up choice rows, three plan cards, hero amounts, selected accent border/secondary button, itemized costs, field errors, stale-preference warning, and success/replay notices. Cards stack below 768px; preferences become 2-up below 1024px and 1-up below 480px.

Intake implements a two-column review/original-document composition, two-up field/evidence pairs, confidence labels and Check this badges, muted policy card, inline validation using existing `validateReview`, disabled Save for invalid facts/missing attestation, success/duplicate notices and Ghost Start over. Fields and document stack below 1024px; mobile Save fills its row. The source form stays accessible above review so sample/input replacement remains possible. Source edits invalidate review; Start over retains pasted text. This is supplied draft implementation, not pixel-exact final acceptance.

## Owned paths, exports and dependencies

- `src/features/wayfinder/`: `feature: FeatureModule`, key `wayfinder`, path `plan`; server-safe `generatePlans`/`createPlanGenerator`, `selectPlanningOption`, feature-local CSS, tests, browser verification and README.
- `src/features/intake/`: `feature: FeatureModule`, key `intake`, path `import`; `createIntakeExtractor`, `reviewDraft`, `validateReview`, `saveReviewedIntake`, feature-local CSS, tests and README.
- Only this handoff under `docs/` was changed for Agent 2's status.

The registry still auto-discovers both exports. Explicit services remain `ctx.repo`, `ctx.clock`, `ctx.extraction`, `ctx.refresh`. Repository operations: `getTrip`, `listPlans`, `savePlan`, `selectPlan`, `listBookings`, `saveReviewedBooking`. Extraction uses `ctx.extraction.extractBooking`; save construction uses shared `reviewedBookingInput` and schemas. Shared contract v1 is unchanged. No root dependency/configuration, shared token/schema, extraction backend, ReRoute or TripWallet code was authored in this milestone.

## Sources, capabilities and financial boundaries

Planning uses shared `demoPlans`, `demoTrip`, `DEMO_IDS`: fictional SFO–NYC, November 20–23, 2026, one traveler, USD. Listed-component defaults are $815, $900 and Unknown (known subtotal $1,010). Free time removes the $80 activity; budget $800 permits the $735 saver while the $820 nonstop remains over budget. Unknown cost is never free. Unquoted return travel, meals and separately itemized taxes/fees are excluded explicitly.

Intake samples use `DEMO_DOCUMENT_SOURCES`/`DEMO_IDS`: flight/hotel/activity/transfer, unknown policy, late hotel deadline and malformed text. Actual extraction capability and request/model are labeled. Connected sample extraction is browser-verified; live AI and live travel quotes remain unverified. No provider purchases/cancellations, OCR, email integration or wallet eligibility calculations were added.

V1 policy decision: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3#issuecomment-6551589743. Disputed terms become unknown/needs_review and retain the original source. Positive corrections require a separately scoped, source-validated contract; that does not block this MVP.

## Verification

Actual checks on current main plus #21 changes:

- `npm ci --prefer-offline`: passed; root manifest/lockfile unchanged by Agent 2.
- `npm run typecheck`: passed.
- `npm test`: **133 passed, 1 skipped, 2 todo**; includes all 54 owned Wayfinder/intake cases.
- `npm run build`: passed; existing advisory chunk-size warning remains (accepted by Agent 1 for the demo).
- Existing integrated Playwright suite: **13 passed, 2 skipped**, including sample/connected intake, selected-plan reload/replay, workspace isolation, TripWallet and narrow checks. ReRoute completion tests remain skipped.
- `node src/features/wayfinder/verify-browser.mjs`: passed. Starts a disposable sample-only Vite server and uses real controls for preference changes, stale/invalid/unsupported inputs, unknown/over-budget selection blocking, selection/replay/reload, intake edits, attestation/required fact/currency/date validation, evidence/original document, save/replay/reload, Start over, preserved extraction errors and unknown price/disputed policy. Populated layouts at **1440/1023/768/767/390/360/320px** had no horizontal overflow or page errors; mobile Save width is verified.
- Desktop/narrow browser screenshots were inspected against supplied draft exports. They are optional verification output, not committed product assets.
- `git diff --check`: passed. Latest published CI is linked in #4.

Local browser verification is now working. Playwright's CDN download still yielded an invalid archive; temporary Chromium 153 from npm ran successfully. Browser/server must share the same execution network environment. No browser package or temporary configuration was added to root dependencies. The owned script accepts `PW_EXECUTABLE_PATH`, `PW_CHANNEL`, optional `WAYFARE_VERIFY_OUTPUT`. Integrated E2E used a temporary executable-path configuration. The focused script is not automatically wired into shared CI; Agent 1 can add it under integration.

## Workflow and next step

Connected account `Jiwoo-Jung-Cal` has pull/push permission. Direct HTTPS lacks CLI credentials, so current main commits/tree/blobs were hydrated through connected GitHub with every object hash verified. Main was safely merged into the existing branch without reset/force-push. Publication uses a merge-parent commit and expected-head ref check. #21 remains Agent 2's single active PR; #4 remains open.

Next: Agent 1 reviews expanded #21; Jiwoo decides the merge and formal visual approval. Apply requested corrections within Agent 2's paths, then finish visual acceptance when the handoff is approved. Broad integration and ReRoute/TripWallet calculations remain with their owners. Resume: **Resume Agent 2 on #4 / PR #21; read current main, latest task/PR comments and design approval first.**
