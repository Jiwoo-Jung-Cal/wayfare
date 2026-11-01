# Booking intake functional milestone — Agent 2, #4

Implemented interim visual revision: **r1-draft (2026-11-01)** from `design/handoffs/wayfinder-intake.md` and its exports. Shared r1 tokens/components came from #29; Agent 1 relayed Jiwoo's authorization to use the draft for the demo in #4. Formal approval remains pending; no Figma or approval records were changed.

The code now composes a two-column review/original-document layout, two-up field/evidence pairs, confidence badges, a muted policy card with `KeyValue` rows, inline validation, success/duplicate notices and Ghost Start over. Below 1024px the fields and original document stack; mobile Save is full width. The source form remains accessible above review so users can replace input or select another sample. Source edits invalidate review; Start over retains pasted text. Existing `validateReview` is reused during render and save; invalid/incomplete facts or missing attestation disable Save without duplicating validation logic.

## Public integration

`index.tsx` exports `feature: FeatureModule`, key `intake`, path `import`, automatically registered at `/#/trips/:tripId/import`. Explicit dependencies arrive in `FeatureContext`: `repo`, `clock`, `extraction`, `refresh`. There is no extraction backend in this feature.

`review.ts` exports `createIntakeExtractor(service)`, `reviewDraft(extraction)`, `validateReview(draft)` and `saveReviewedIntake(input, ctx)` for the UI/tests. They consume the published `BookingExtraction`, `BookingReviewEdits`, `BookingSchema`, `PolicyEvidenceSchema` and `reviewedBookingInput` contracts. The save operation uses `repo.getTrip` and `repo.saveReviewedBooking`; initial/reloaded lists use `listBookings`. Persisted state remains the shared repository's responsibility.

The flow accepts pasted text or a deliberately selected canonical sample, extracts without saving, edits/reviews facts alongside their original evidence, requires an explicit confirmed-booking attestation, and then saves. Blank prices are unknown, not free. Dates are validated as actual UTC instants; end must follow start, IANA timezone must exist, and the single-currency trip rejects non-USD amounts. Review uses UTC inputs to avoid guessing a timezone during correction.

Review amount strings preserve the original integer minor units exactly, using the shared currency precision. This avoids both two-decimal assumptions for non-USD extractions and floating-point cent rounding on large valid USD amounts. Non-USD amounts are displayed in their original units and still rejected for this USD trip; no conversion or additional currency support is introduced.

Policy tiers/deadlines are displayed next to source excerpts. The reviewer can mark disputed policy terms unknown, preserving the verbatim original document for review. [Agent 1 confirmed this is the intended v1 behavior](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3#issuecomment-6551589743); no positive policy-edit contract is required for the MVP. Arbitrary positive corrections are outside v1. Missing policy stays `needs_review`. Policy terms are not presented as expected or received money; ReRoute owns recovery eligibility.

Extraction results are schema-checked, bound to the submitted normalized text hash, and rejected when superseded by a newer request or source edit. Input is preserved on extraction failure; draft corrections are preserved on save failure. Save replay returns existing reviewed facts, reports the duplicate explicitly, and never overwrites prior imports with newly entered edits. Later booking corrections need a distinct reviewed-edit flow.

The request guard is checked again after asynchronous hash verification, before showing a source-mismatch error. An obsolete extraction cannot replace newer input state with a late verification error. Regression tests reproduce the previous race with a controlled pending digest.

## Sources/capability

Selectable samples come directly from `DEMO_DOCUMENT_SOURCES` / `DEMO_IDS`: flight, hotel, activity, transfer, unknown policy, late hotel deadline, malformed document. The UI displays both the configured service description and the actual extraction's `capability`/request/model. All sample data is fictional. No OCR, email connection, provider booking action, or live AI verification is included. Connected extraction uses Agent 1's existing HTTP/server adapter only if configured; failures do not silently fall back to a successful sample.

## Verification

Current milestone on main `1d42523` plus PR #21: TypeScript/build passed; 133 unit/integration tests passed (1 skipped, 2 todo); 13 integrated browser tests passed (2 ReRoute cases skipped). Local Chromium 153 verification uses a temporary executable-path configuration without root configuration/dependency changes. Connected-mode intake is verified; live AI is not.

Run `node src/features/wayfinder/verify-browser.mjs` for the feature-owned browser regression. It starts its own sample-only Vite server and checks both features. Intake checks cover attestation/required fact/currency/date validation, editable facts beside excerpts, original document, save/replay/reload, preserved text on Start over and extraction errors, unknown price/disputed policy, populated desktop/narrow layouts and full-width mobile Save. Supports `PW_EXECUTABLE_PATH`, `PW_CHANNEL` and optional `WAYFARE_VERIFY_OUTPUT` screenshots. Shared CI runs its existing journeys; this extra focused script is reproducible but not auto-wired.

Run `npm test -- src/features/intake`, `npm test`, and `npm run build` at the root. Tests cover canonical extraction/save/evidence, explicit edits, duplicate replay, reload, source binding, unknown/disputed policy, missing price/required facts, invalid currency/date/amount/timezone, missing confirmation, failed write, malformed input, unconfigured AI, provider failure, and stale responses. No markup-only tests or root tooling changes were added.

The functional implementation was merged in PR #17. Agent 1 added intake browser coverage in PR #18 and the shared narrow-screen fix in PR #19. On main `96be8039cfc242619e7cd0661eb036fab7b3aea3`, [application CI](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41260960403/job/124713950843) passed typecheck, unit/integration tests (101 passed, 2 skipped, 3 todo), build, and browser journeys (9 passed, 3 skipped). Browser coverage includes hotel review/evidence, the exclusive policy deadline, save/duplicate replay, unknown-policy display, malformed/unconfigured extraction with input preserved, and route overflow checks at device width, 360px and 320px. Jiwoo's visual approval is still pending. Agent 2 verified the CI results and logs; these browser checks ran in GitHub Actions, not on Agent 2's computer.

Reproducible UI checks, including additional cases covered by the feature tests:

1. Start the existing app with `npm run dev -- --host 127.0.0.1`. Use the shell's planning seed in a fresh test workspace; open `http://127.0.0.1:5173/#/trips/trip-demo-nyc/import`.
2. Use the default hotel sample, extract, and inspect the fictional $450 charge, source excerpts, refund rules and deadline timezone. Nothing is saved yet.
3. Correct a booking field, confirm the booking attestation, and save. The saved result and dashboard must show it. Save again: the duplicate message appears and only one booking remains. Reload: saved booking persists.
4. Try an invalid currency or date before saving a fresh document: error details identify the field; text and edits remain. Blank paid amount must save as Unknown after review, never $0.
5. Use the unknown-policy sample: policy remains unknown with no invented refund rule. Mark the hotel's extracted terms uncertain before a fresh import: save retains the original document and a policy needing review.
6. Use the malformed sample, then unrecognized pasted text without server AI: explicit errors appear and text remains available. Replace text during extraction: no stale review may appear for the old text.
7. On desktop and a narrow viewport, check keyboard access, readable excerpts, visible errors and no horizontal overflow. The r1-draft responsive rules are implemented and browser-checked; Jiwoo's formal visual approval is still pending.

## Decision

Use the shared extraction/save boundary rather than adding a backend or model SDK. Reuse the shared document hash and repository idempotency rather than a feature-local persistence layer. The alternative of directly writing editable extraction output would lose validation, source binding and duplicate guarantees. Per Agent 1's v1 decision, restrict policy edits to an unknown/review state. A future positive correction contract would require source-validated excerpts and a separate scoped request.
