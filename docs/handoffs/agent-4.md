# Agent 4 — ReRoute / CancelClock owner review

PR #70 is merged. This follow-up fixes the open ReRoute tooltip on current main after a clock change. Issue #6 remains open for final acceptance.

Task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6
Integration: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
Follow-up base is main `8132ea290df75af21bbc3d34c1a0cd0e578051fb`.
Account: Wildtypers; connected pull/push permissions verified. Local unpublished work was absent; previous snapshot branch preserved. Publication uses SHA-pinned source and expected-head guards, without force-pushing.

## Design and scope

Design revision: **r2-final**, approved in design/approvals.json. Source: design/handoffs/r2-final.md and the current r2 section of design/handoffs/reroute.md. Reference: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=68-403. Exports: design/exports/reroute/r2-reroute-desktop.png and r2-reroute-narrow-390.png. Historical r1 pending-approval language is superseded. No Figma access or native design edit is required for Kelvin.

Owned changes: src/features/reroute/**, this handoff and docs/decisions/agent-4-reroute.md. Shared contracts, shell and wallet remain owner-managed. The recovery calculation and approval transaction code are unchanged by this review.

## Review findings and fixes

| Finding | Reproduction / evidence | Resolution |
| --- | --- | --- |
| Chart warns of future losses on already-recorded refunds | Actual approveRecovery followed by chart render shows a flat $820 line but labels Hotel −$200, Ride −$40, Walk −$60. Partial approval with only transfer unfinished still labels hotel and activity losses. Two regressions fail before the fix. | Omit deadlines belonging to successful recorded cancel/replace actions. Preserve the comparison's totals and the unfinished transfer's −$40 marker. Clarify historical policy deadline amounts in Details and sources. |
| Chart tooltip overflows a narrow viewport | Browser regression on 72e186f fails at 320px: tooltip right edge is 391.6875px. [Reproduction run](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42145993731). | Bound the tooltip to chart width, wrap its text and shift its anchor with the pointer. Both edges are checked at 1440/390/320px. |
| Axis currency disagrees with comparison | A single-currency EUR comparison renders €820 in its accessible summary but $300/$600 axis labels. The added render regression fails before the fix. | Format axis ticks with the cancel comparison's currency. No conversion is introduced. |
| Radio choices lack arrow-key navigation | The two role=radio buttons both had default tab stops and no key handler. | Roving tab stop; arrows select/focus the other choice; Home/End select the first/last. Browser regression checks selection and focus. |
| Unknown-policy state loses its intake route | r2 shows a warning and disabled confirmation but removed the earlier Review policy in intake link. | Restore the path-relative link outside the radio button, with the selected option's full constraints. Browser regression edits hotel review state, checks Unknown/disabled approval and clicks through to the trip's intake route. |
| Choice cards use the superseded r1 breakpoint | CSS stacks below 1024px; current r2 feature handoff says below 760px. | Stack below 760px. Browser assertions cover 760/759 as well as desktop and 390/320. Chart/breakdown still stack below 1000px. |

## Preserved behavior and interfaces

- Source-backed simulated disruption; dependency/evidence inspection under Details and sources; continue/cancel comparison; shared policy eligibility and exclusive deadlines.
- Canonical continue: $360 extra / $320 expected refund / $1,260 paid before refunds / $940 forecast. Cancel: $820 expected / $80 unrecovered before hotel cutoff; $620 / $280 at and after it. Unknown stays unknown.
- prepareApproval and approveRecovery revalidate persisted state. recordBookingAction checks atomic policy revision, exclusive deadline, clock and replacement quote preconditions. Stale outcomes require renewed acknowledgment. Successful records survive deadlines, partial failure, retry and reload.
- Public feature module and triggerDemoDisruption remain unchanged. notifyActionRecorded hands successful actions to the shell; ReRoute never creates wallet claims directly. The shell's tripFacts consumes computeComparison, so no new shared feature hook is required by this review.
- Provider actions remain simulated. Expected refunds, provider promises and received money are distinct; voucher/points remain unchanged and outside cash totals.

## Verification and remaining acceptance

Local npm ci, typecheck, build and diff-check pass. Full npm test: 186 passed, 1 browser test skipped because Chrome is not installed. Feature suite: 29 passed, 1 browser skipped. The two chart defects were reproduced with failing tests before the fix; all three chart tests pass afterward.

Feature-owned browser coverage now adds radio keyboard operation, r2 breakpoint boundaries, completed/partial chart markers, unknown-policy intake navigation and the continue-choice replacement. A clock refresh can leave the tooltip open. On main, the comparison updated to $620 while a stationary pointer still showed $820 in the tooltip. The browser regression holds the chart in place through the real clock controls and checks $820 before the cutoff, $620 at the cutoff, and $820 after reset without moving the pointer. The tooltip now derives its amount from the current chart series. The updated suite passed all 197 tests with portable Chromium 153, and the production build passed. Existing approval → four automatic claims/$820 → hotel confirmation/$400 → $250/$150 receipts, stale cutoff/$620, partial failure/reload, Escape/focus return and narrow-layout assertions are retained. Final-head GitHub Actions browser results are recorded in the review PR and Issue #6; do not infer local browser or pixel-comparison success.

PR #43's r1 acceptance checklist is superseded by this handoff. Agent 1 reviews the tooltip follow-up after CI. Jiwoo and Agent 3 record final issue acceptance through the established workflow. Design approval itself is already recorded as r2-final. Live providers are outside this task.
