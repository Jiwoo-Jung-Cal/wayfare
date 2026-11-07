# Agent 2 handoff

## Current checkpoint — November 6, 2026 (Pacific)

Jiwoo requested a recording-ready demo, the `wayfare-ramp.vercel.app` alias, and a slightly longer Plan typing animation. Main `0ad287457d06f467f596764f78d551a71fe315e7` merges Agent 1 PR #74; its source is identical to the previously verified `06ea885` snapshot. The existing Agent 2 PR #71 remains separate and is not included in this branch.

This focused change increases the default scripted Plan response pause from 650 to 1500 ms; the typing indicator, disabled send button, retry/error handling, abort handling and explicit “No AI model is used” label remain. Plan introduction now says it compares listed costs and helps choose a plan, matching the actual save-only behavior. No reservation or payment is made by selection.

Vercel accepted and verified `wayfare-ramp.vercel.app` for the existing project. The exact published source SHA, deployment ID and final checks are recorded in the latest structured report on [#4](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4). Only `src/features/wayfinder/{assistant.ts,index.tsx,wayfinder.css,verify-browser.mjs}` and this handoff change. Build output and browser artifacts remain outside commits. Agent 1 retains integration/merge ownership; Agent 3 retains release-evidence ownership.

The no-overlap resume confirmed main remains #74 merge `0ad2874` and no newer Agent 1 PR is published. All shared app/core/styles, ReRoute, TripWallet, design exports and dependencies byte-match Agent 1’s candidate. A further owned CSS fix scopes Plan message rules under `.wf-thread`: the unscoped flex rule was splitting shared Ask replies into narrow columns. The new regression fails on unchanged #74 CSS (actual `display:flex`) and checks reply wrapping at 1440/390/320px after navigating out of Plan. No design values or shared components change. Shared startup readiness/focus and after-cutoff timing findings remain routed to their owners; do not claim the full suite is green from the passing recording rehearsal.

Recording sequence: Overview → Plan (NY group price, then Chicago selection) → return to NY → hotel intake review/duplicate → Itinerary → ReRoute cutoff and reset → explicit simulated cancellation → Ask WayFare → TripWallet confirmation and two receipts → reload. Show Ask before receipt matching: its current shared reply uses the $820 total expected recovery, not the $420 still outstanding after $400 is received. This wording finding was routed to Agent 1 in #8. Wallet totals should be narrated as $820 total recovery, $400 received and $420 outstanding, with vouchers/points separate. `Start over` in intake clears the review and retains pasted text. Optional Tokyo/Paris, simulated Google, reminder and dark/mobile steps are covered by the existing demo script/tests.

Current capabilities supersede the historical scope below: group sample pricing for 1–9 travelers and Chicago/Tokyo sample plans were added by Agent 1 in #72; Plan/Ask remain scripted, extraction recognizes sample confirmations, and provider actions are simulated. This is not live AI or live booking search. Current approvals remain r2-final; no Figma edit or canvas comparison is claimed.

## Historical review checkpoint (superseded where noted above)

Status: **r2-final is approved**. Reviewed Agent 1's merged Plan visual layer (#57) on main `ca3974d4a8816f3adf2b46254b41d1d51de0c870`. This follow-up repairs the owned browser check and reproduced budget, picker-overflow and traveler-scope defects. Intake's existing layout and behavior pass review. Two shared findings are routed to Agent 1 below. Earlier r1 approval-pending instructions are superseded.

- Task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4
- Branch: `agent-2/r2-wayfinder-intake-review`, fresh from the source SHA above.
- Reviewed PR: https://github.com/Jiwoo-Jung-Cal/wayfare/pull/57 (Agent 1's visual implementation, not this agent's work).
- Design: [r2-final](../../design/handoffs/r2-final.md), [feature handoff](../../design/handoffs/wayfinder-intake.md), [approval record](../../design/approvals.json).
- Figma: [Plan 61:196](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=61-196).
- Reference: `design/exports/prototype/r2/index.html` and `design/exports/wayfinder-intake/r2-plan-*.png`. PR #57's illustrated fallback scenes are preserved.
- Published commit, follow-up PR and CI evidence: latest structured #4 report. No merge or Issue closure is authorized by this handoff.

## Reproduced corrections

| Defect on the source checkpoint | Follow-up behavior / proof |
| --- | --- |
| Clearing Budget, entering 0, a trailing decimal or excess precision left old plans selectable; `-1000` silently became `1000`. Invalid inputs had `aria-invalid=false`. | Every edit invalidates and uses the existing generator/validator. The exact typed value stays visible; invalid budgets disable selection with an associated field error. Returning to a valid amount re-ranks immediately. Previous valid results and their budget/date metadata remain coherent. |
| An $814.99 budget showed “$0 over budget” for an $815 plan; $1000.05 showed only $185 under. | Non-whole amounts retain cents: $0.01 over and $185.05 under. Whole-dollar reference labels remain unchanged. Arithmetic still uses the existing integer-money handler. |
| Route picker caused 50/80/120px page overflow at 390/360/320px; Dates caused 37px at 320px. | The same two-column fields shrink within their popup. All three pickers and Plan grids pass zero-overflow checks at 1440, 1024, 1023, 1000, 999, 768, 760, 759, 390, 360 and 320px. No layout redesign. |
| Choosing two travelers said the final price would update for the group, although the provider is fixed to one traveler. | The answer and quotes explicitly remain for one traveler; larger requested groups show “group pricing is not supported.” Adult/child steppers retain the approved 1–9 limits. |

Only `src/features/wayfinder/index.tsx`, `wayfinder.css`, `verify-browser.mjs` and this handoff change. `handler.ts`, `selection.ts`, intake, shared services/configuration, dependencies and design artifacts are unchanged.

## Repaired browser verification

`src/features/wayfinder/verify-browser.mjs` now covers current startup and controls:

- A fresh visitor gets the booked sample, automatic comparison and a working “View your trip” link.
- Separate isolated workspaces use the existing explicit planning seed for selection and import tests; existing storage is not reset.
- Price/convenience/flexibility rerank immediately; Free time produces $735 and an $800 budget blocks the $820 option. Unknown transfer remains “Not quoted” / $1,010 + ?, and cannot be selected.
- Invalid budgets, cent-level budget differences, date rejection, unsupported dates/origin/destination, recovery through “Use supported sample”, and sample scope are checked.
- Selection, replay, selected-card state after reload, no confirmed-booking side effect, and composer Attach navigation to the same trip's Import route are checked.
- Intake keeps editable fields, original text/excerpts, confidence/policy evidence, currency/date/required-field validation, attestation, duplicate protection and preserved input on extraction failure.
- Saved edited title and exactly one booking are read back through the public repository. Blank paid amount and disputed policy survive reload as Unknown / needs_review with no refund tiers and no $0.00 substitution.
- Intake keeps two columns on desktop, one below 1024px, full-width narrow Save, simulation notice before review and original document after it. Plan follows r2's 3/2/1 columns at 1000/760px, including open pickers and expanded sources.

The unmodified old check failed waiting for “Generate options”. The adapted regression then failed on the pre-fix empty-budget `aria-invalid=false`; the corrected feature passes. Before/after popup geometry and screenshots were inspected. There are no page exceptions. The known shared duplicate-key console warning is recorded separately below.

Reproduce with an installed Playwright browser:

```text
node src/features/wayfinder/verify-browser.mjs
```

Overrides retained: `PW_CHANNEL`, `PW_EXECUTABLE_PATH`, optional `WAYFARE_VERIFY_OUTPUT` for screenshots. The script starts and closes its own sample-only Vite server and browser; it makes no live model/provider request. It is still a standalone manual check; this pass does not change shared CI wiring.

## Validation and boundaries

Runtime: Node 24.22.1, npm 11.19.0; portable Chromium 153.0.8010.0 supplied outside the repository.

- `npm ci`, `npm run typecheck`, `npm test` (174 passed; no skipped/todo), `npm run build`: pass.
- `CI=1 npm run e2e`: 29 passed, retries disabled, using an external configuration that only overrides browser executable/working paths. The production-build, connected, desktop and mobile projects are included.
- Repaired standalone check: pass, including the new budget/precision/scope/picker and retained intake regressions.
- `git diff --check`, owned-path scope and unchanged handler/selection source checks: pass.

The exact published-source CI outcome is in #4 and the PR. These feature checks do not constitute final release/demo verification.

## Remaining shared findings and next step

1. [Shared error list keys](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6624492390): `src/ui/index.tsx` keys issues only by path. Two legitimate budget issues emit the same React key. Minimal payload and browser reproduction are posted. Feature validation works, but this console warning remains for Agent 1.
2. [Shared mono-input cascade](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6624532385): `.wf-input { font: inherit }` overrides `.wf-mono`, so the intake textarea computes Figtree while request ID/original document use IBM Plex Mono. A temporary browser-only mono override proves the cause. No feature compensation was committed.

No further owned defect remains from this bounded review. Quotes are fictional sample data for SFO–New York, November 20–23, 2026, one traveler, USD. Group/live pricing, arbitrary-route search and live AI are unverified/unsupported. Selection does not reserve or purchase anything; provider actions remain simulated.

Jiwoo/Agent 1 review the follow-up and Agent 1 handles the two shared findings. Pause after publication and the structured #4 report; resume for concrete review feedback, not optional planning features.

Historical attribution: `6052d47`, `eaf961f`, `15eb46d` and the earlier separate cloud Agent 2 report are external contributions, per [Agent 1's reconciliation](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6567977223). The r1 notice-order fix (#40), shared root-font fix (#41) and shared coverage (#36) are now merged. Their old approval blockers are not current status.
