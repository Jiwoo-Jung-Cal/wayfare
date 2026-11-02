# Agent 4 — Kelvin — ReRoute and CancelClock implementation prompt
<!-- wayfare-startup-agent:4 -->


## Start here and explain the assignment

Before coding, address Kelvin directly. Explain what you own, what is already complete, the deliverables below, what belongs to other agents, how GitHub progress updates work, and your first milestone. Then inspect the repository and begin the authorized work. Do not stop after a plan or ask for routine implementation permission.

- Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Your task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6
- Integration owner / shared contract requests: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Team dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Design discussion: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Task key: `reroute`. Agent: 4. Human: Kelvin. Token tier: Moderate.
- Suggested new branch: `agent-4/reroute-v1`, created from current `origin/main`.
- Design handoff: `design/handoffs/reroute.md`; exported screens: `design/exports/reroute/`.
- Team-provided submission deadline: November 10, 2026, 11:59 PM. Agent 3 owns confirmation of its official timezone.

This prompt replaces the older startup instructions for this role. Verified starting checkpoint: `1d42523f7250ea3f58f95115c29efd0d92384f1c` on November 1, 2026. That is a historical checkpoint, not an instruction to check out an old commit. Fetch current main and read the latest task comments before resuming.

Read `AGENTS.md`, `docs/OWNERSHIP.md`, `docs/PROGRESS_UPDATES.md`, your task body/comments, your own handoff, relevant sections of `docs/CONTRACTS.md` and the design handoff. Read `docs/PROJECT_BRIEF.md` once; its proposed-bootstrap passages are historical where current code/contracts supersede them. Do not ingest other agents' entire prompts or rescan the whole repository on every turn.

Verify the connected GitHub account and repository read/write capability. With an existing local clone, inspect `git status --short` and preserve uncommitted work. Fetch origin, then create a fresh branch from current origin/main in a clean checkout/worktree. Inspect and preserve an existing branch with the suggested name; choose a new suffix when needed. Do not reset away work, force-push, or overwrite another agent's branch.

If terminal credentials are unavailable but the GitHub connector works, use that connector to read a source snapshot pinned to the actual SHA and publish a branch/commit/PR. Verify file/blob identities and guard branch updates with the expected head. Missing CLI authentication is not proof that repository access is missing. If repository access itself fails, identify the exact account/permission blocker to Kelvin; never make the repo public or ask for another person's credentials. Local-only work must be labeled as not yet shared.

## Design, ownership and collaboration rules

Jiwoo owns every native Figma edit and final visual approval. You do not need Figma access, create frames, request a writer slot, or redesign shared styles. Jiwoo has authorized the existing r1 draft as the interim working design; it is already applied to shared tokens/components and the shell. Use the GitHub handoff/exports and existing components now. Formal visual approval remains pending in `design/approvals.json`; do not mark it approved. While pending, report `design_revision: null` and state separately that the interim source is r1-draft.

Agent 1 owns `src/core`, `src/app`, `src/ui`, `src/styles`, root dependencies/configuration, shared server transports/loaders, and broad integration/E2E changes. Agent 2 owns planning/intake. Agent 3 owns coordination/CI/release assembly. Keep your feature code and tests in your owned directory and update only your own agent handoff/decision note.

Use `src/core/index.ts` and published feature hooks. Do not import another feature's private implementation, duplicate shared schemas, add root dependencies, change shared tokens, or build a separate app. For a missing shared capability, post the exact operation/type needed, example input/output, current error and smallest failing reproduction to #8, cross-link your task, and continue independent compatible work. A labeled test stub is not proof of integration.

Use one active milestone at a time. No additional agents, optional providers, OCR, bank linking, background monitoring, automatic email, or real purchases/cancellations. Provider actions remain explicit simulations. Keep cash, provider promises, received money and noncash assets distinct. Use integer minor units, explicit currency, stable IDs, evidence and `ctx.clock.now()`; unknown values remain unknown.


## Current state and your owned deliverables

The shared platform, booking intake, Wayfinder, TripWallet cash ledger, action-to-claim orchestration, browser persistence, design r1 and app styling are already on main. ReRoute has no uploaded implementation at the verified checkpoint. The old `agent-4/reroute` branch predates the current foundation; inspect it for any real work, but do not build from its stale starting snapshot.

Your GitHub username is not yet recorded in `coordination/config.json`. Report the actual connected username and access outcome in #6; Agent 3/Jiwoo can update the mapping. Do not invent an account or assume access is denied merely because the mapping is blank.

Own `src/features/reroute/**`, its feature tests, `docs/handoffs/agent-4.md` and `docs/decisions/agent-4-reroute.md`. Deliver:
1. A persisted, inspectable disruption and affected-booking analysis.
2. Two useful recovery choices: continue and cancel the trip.
3. CancelClock using reviewed policy tiers and the shared clock.
4. Explicit approval, stale-option protection, honest per-booking simulated results and safe retries.
5. Durable actions that automatically create Brian's claims through the shell.
6. Responsive code UI from Jiwoo's GitHub design handoff and meaningful verification.

Do not implement a booking parser, general itinerary planner, refund ledger, provider AI adapter or Figma runtime. Deterministic recovery must work independently of live AI. If an explanation handler needs a transport that is not published, request that specific seam from Agent 1 without delaying the deterministic milestone.

## Milestone 1 — disruption, comparison and CancelClock

Use `DEMO_IDS`, `DEMO_TIMES`, `DEMO_EXPECTED`, the canonical documents/quotes, reviewed policies, and shared money/time helpers. Preserve the scenario rather than creating look-alike fixtures with different IDs.

Scenario: one traveler, SFO–NYC, November 20–23, 2026; initial clock `2026-11-18T17:00:00Z`. Paid bookings are flight $320, hotel $450, activity $80 and transfer $50: $900 total. After the simulated provider flight cancellation:

| Metric | Continue with replacement | Cancel trip before hotel deadline |
| --- | --- | --- |
| Extra cash needed | $360 | $0 |
| Expected cash refunds | $320 | $820 |
| Cash paid before refunds arrive | $1,260 | $900 |
| Forecast cost / unrecovered original cost | $940 | $80 |

The cancellation recovery components are $320 + $400 + $60 + $40. The $75 voucher and 8,000 points stay separate and unchanged. Expected refunds are not receipts or proof of payment.

Persist the supported flight cancellation once with source evidence. Use booking dependencies and dates to explain which hotel/activity/transfer bookings may be affected, preserve unaffected bookings, and let users inspect why an item is flagged. An impact flag alone must never cancel a booking. For traveler-initiated cancellation, apply its actual reviewed policy condition; do not reuse a provider-cancels entitlement indiscriminately.

Generate schema-valid `RecoveryOption` records with evidence, assumptions, constraints, calculation time and validity. Unknown/unreviewed policy or missing quote data yields an incomplete/review-needed option, not a confident total treating unknown as zero. Use one eligibility function for option amounts and CancelClock.

The hotel cutoff is `2026-11-19T23:00:00Z`:
- Before it (`t < D`): hotel $400; total cancellation recovery $820; unrecovered $80.
- Exactly at and after it: hotel $200; recovery $620; unrecovered $280.
- Test one second before, at, and after the cutoff. Use the active clock, not the machine's current time.
- Show ordered deadlines, before/after recovery, passed/unknown states and source policy. Recompute when the clock changes without silently approving anything.

Publish this working comparison/clock milestone before expanding the action flow.

## Milestone 2 — approval and durable action handoff

Register your page through `src/features/reroute/index.ts` (or .tsx), exporting `feature: FeatureModule` with `key: 'reroute'`, `path: 'reroute'`, title and Page. Implement the published `triggerDemoDisruption({ tripId }, ctx)` hook so the existing demo control uses your feature and repeat triggering returns the same disruption ID.

At approval, reload current booking/policy/quote state and revalidate amounts, revisions, expiry and deadline boundaries. Show updated consequences and require renewed confirmation when an approved preview is stale. Approval itself is not a successful provider action.

Use `ctx.repo.recordBookingAction({ action, expectedBookingRevision })`. It atomically records one action and its resulting booking state. Follow the exact example in `docs/CONTRACTS.md` and schema in core:
- Stable workspace/trip/booking/action identities and idempotency keys.
- Cash component `kind: 'cash_refund'`, `value: { unit: 'money', amount: ... }` and `method: 'original_payment'`.
- Preserve source tier/evidence and only sourced due dates.
- Honest `capability: 'simulated'` and simulated action result; do not imply a real provider was contacted.

After a successful durable action write, including an idempotent replay of a successful action, call:

~~~ts
await ctx.notifyActionRecorded({
  tripId,
  actionRecordId: saved.value.action.id,
});
~~~

The shell then runs Brian's idempotent sync. ReRoute never creates claims directly. Action success and claim-sync success are separate; a pending sync keeps the action and offers the shell's retry.

For multiple booking actions, retain each outcome and retry only failed/pending items. Do not report all-success after a partial failure. Define operation/attempt identity so double clicks, rerender, reload or replay cannot cancel twice; regenerating an option must not create a new cancellation of an already completed booking. Distinguish a failed attempt from replaying a completed operation. Request an exact shared operation from Agent 1 if existing persistence cannot represent safe retry semantics.

Use `demoCancelTripActions(context)` as the contract expectation, not as a replacement for implementing approval. Your real pre-deadline approval should yield equivalent four valid cash outcomes totaling $820. The fixture may be used in isolated tests only when labeled.

## Milestone 3 — UI, verification and acceptance

Use `design/handoffs/reroute.md` and exports for disruption, affected bookings, comparison, CancelClock, approval dialog and result states. Shared `MoneyStat`, `KeyValue`, ghost buttons and simulated/accent badge tones are available. Keep evidence and actual/forecast scope readable; distinguish loading, empty, unknown policy, stale option, partial failure, action recorded and claim-sync pending.

Required focused checks:
- Canonical continue/cancel totals, including the hotel boundary change.
- Provider-cancellation condition versus other cancellation conditions.
- Dependency impacts and unaffected bookings.
- Unknown policy/amount/currency and expired or changed quote.
- Stale booking revision or crossed deadline between preview and approval.
- Repeated trigger/approval and reload; no duplicate actions or claims.
- Partial failure, retry of failed work only, and preserved successful records.
- Stored action/component schema validity and shell notification.
- Responsive layout, keyboard approval/cancel, and states conveyed in words.

Coordinate the real browser journey with Agent 1 and Brian: import bookings → trigger your disruption → compare → approve cancel-trip → four automatic claims/$820 expected → hotel confirmation/$400 → $250 receipt/$150 outstanding → final $150/$0 hotel outstanding → reload/repeat without duplicates. The other claims still have $420 outstanding after hotel resolution. Do not present fixture-seeded wallet tests as proof of your real approval UI.

Acceptance means your actual controls produce correct persisted state and public handoff behavior. Final visual acceptance waits for Jiwoo's review. Publish a first functional PR promptly, then bounded fixes; do not wait to submit one giant final feature.


## Checks, publication and shared progress

Use the root's published commands without upgrading dependencies: `npm ci`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`. Add focused tests for your changed business behavior. `npm run e2e` uses installed Google Chrome through Playwright and also exercises the connected-mode local API with AI forced off. Read `playwright.config.ts` for channel/port overrides.

If no browser is available or a browser archive fails to install, report the exact limitation and use the existing GitHub Actions browser runner or an already installed supported browser. Do not repeatedly download broken archives, weaken assertions, add arbitrary sleeps/retries, or claim an unexecuted browser script passed. Inspect failed/flaky logs even when a retry makes the job green. Do not change shared `e2e/journey.spec.ts` or the root Playwright configuration independently; give Agent 1 your accessible control names and feature-owned browser check/reproduction so it can activate the cross-feature journey.

Publish small milestone PRs. Each body must include `<!-- wayfare-task:reroute -->` and `Relates to #6`, actual changed paths, behavior, public interface/payload examples, test commands/results, capability labels, pending design status, and requested shared changes. Agent 1 handles integration review/merge. Use `Closes #6` only for a final accepted completion PR; core milestones and pending design/live-call/full-flow work must not close the task.

Update `docs/handoffs/agent-4.md` and a feature decision note with current behavior, interfaces, actual evidence, remaining work and blocker/owner. Remove superseded blockers instead of carrying old emails forward. Do not commit secrets, private travel data, full conversations, dependencies or build output.

Post a structured report to Issue #6 at session start/resume, meaningful published milestones, new blockers, and before finishing/pausing. Use `scripts/report_progress.py --task reroute` if the CLI is configured, or post the equivalent comment through the GitHub connector. The report begins with `<!-- wayfare-progress -->` followed by a fenced JSON object. Fill actual evidence; null means not yet available. Do not post placeholder claims.

```json
{
  "agent": 4,
  "task": "reroute",
  "status": "in_progress",
  "summary": "<verified session state or completed behavior>",
  "next": "<one concrete next milestone>",
  "blocker": null,
  "branch": null,
  "commit": null,
  "pr": null,
  "figma": null,
  "design_revision": null,
  "checks": "Not run yet."
}
```

Allowed statuses are `ready`, `in_progress`, `blocked`, `review` and `done`. The dashboard refreshes from reports/PRs but does not wake inactive chatbots; a report saying done does not close the task. Share code through GitHub, not emails or pasted transcripts.

At each milestone, tell Kelvin: what now works, what remains simulated/unverified, actual commit/PR/task links, implemented draft/approval status, checks/results, blocker/owner and the next step. End with a short resume instruction so Kelvin can later say “Continue my assigned Issue.”
