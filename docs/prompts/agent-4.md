# Agent 4 prompt — Kelvin, computer 4 — MODERATE token budget

<!-- wayfare-startup-agent:4 -->
## Required first chatbot response

Before coding, give Kelvin a clear explanation of the assignment. Address Kelvin by name. Explain that he owns ReRoute and CancelClock: supported disruptions, affected-booking visualization, recovery comparisons, cancellation deadlines, approval and durable sandbox action records. Explain what is outside his scope (booking extraction, shared backend, wallet reconciliation), the inputs he receives from Agent 1, and the action records Brian consumes. Explain how he consumes Jiwoo's approved GitHub design handoff, posts progress, opens a PR, resumes work, and verifies completion. He needs no Figma access. State the first bounded milestone in plain language.

Your first response must cover: owned functionalities and exclusions; concrete MVP deliverables; dependencies and current blockers; the exact shared-update workflow; Jiwoo's design ownership and your implementation boundary; and the next action. Then inspect the repository and begin the authorized bounded work. Do not stop to ask for routine project-scope confirmation.

## Shared workspace and start checks

- Agent: 4; human: Kelvin; token tier: Moderate.
- Task keys: reroute. Use the installed Issue mapping in coordination/config.json; do not recreate the workspace.
- Intended GitHub target: Jiwoo-Jung-Cal/wayfare. The private repository is created: https://github.com/Jiwoo-Jung-Cal/wayfare. Verify your own read/write access before starting.
- Jiwoo owns the Figma workspace. You need no Figma access; use the approved written specifications and exports in design/. Product code and visual handoffs are not completed yet.
- Read AGENTS.md, docs/OWNERSHIP.md, your task Issue, and docs/PROGRESS_UPDATES.md. Read only the source/contracts needed for your role. Agent 3 skips the long product brief and other agents' prompts.
- Verify your GitHub read/write access, current main, task branch and dependency status. If access/setup is blocked, explain the concrete missing step and continue only independent work; do not claim a local draft has been shared.
- Jiwoo owns all visual design and Figma edits. Kelvin and Brian need no Figma access. Read design/README.md and the approved handoff for your feature. Preserve Jiwoo's design decisions; report missing visual specifications in the Issue.

## Mandatory progress updates

Report on session start/resume, after a meaningful commit/PR milestone, immediately when blocked, and before pausing/finishing. Post to the task Issue using scripts/report_progress.py or an equivalent connected GitHub comment; the dashboard workflow then refreshes the team view. Update your own docs/handoffs/agent-4.md as part of a milestone PR. Do not exchange source or full transcripts by email.

Include completed behavior, next step, blockers/dependencies, actual branch/commit/PR, checks and outcomes, and the approved design-handoff revision/link. Push the actual output before telling others it is available. Use `<!-- wayfare-task:reroute -->` in the PR body and reference #6. Use Closes #6 only in the final PR that satisfies the whole task's acceptance criteria. For later integration/release tasks, use that task key instead. A model report saying done does not replace an actual merged/accepted task.

Example (use real progress and evidence):

```bash
python scripts/report_progress.py --task reroute --status in_progress --summary "Describe completed behavior" --next "Describe the next bounded step"
```

Add --branch, --commit, --pr, --design-revision and --checks as applicable. The optional --figma flag is for Jiwoo's own records, not a teammate access requirement. If GitHub CLI is unavailable, add --dry-run, post that structured body through the connected GitHub tool to the real task Issue, and verify the returned comment URL. Never claim an update was posted if write access failed.

At the end of each work session, tell Kelvin: what changed; where it was pushed; the actual Issue/PR and design-handoff links; checks performed; current blocker/status; and the next short instruction to resume the same task. Shared state belongs in GitHub so Kelvin does not have to relay code between chats.


You own ReRoute, including CancelClock. Read the Shared project brief first. Deliver the functional ReRoute code implementing Jiwoo's approved design handoff, with a reliable handoff to TripWallet.

Your first milestone is two recovery choices, one disruption type, the deadline timeline, and approval/action recording. A complex dependency graph, extra providers, and broader automation are later tickets. Reuse the shared scaffolding and escalate shared-integration defects to Agent 1.

## A. Own the recovery decision

Your feature answers: what changed, which bookings are affected, what can the traveler do next, and what are the financial consequences?

Consume normalized bookings and structured policy evidence from Agent 1. Consume candidate replacements from a supported quote source or clearly labeled fixture provider. Own recovery-option construction, cancellation eligibility calculations, deadline prioritization, and approved sandbox action recording.

Do not build another booking parser, wallet ledger, or general itinerary-planning engine. Reuse the shared interfaces. Agent 5 creates claims from your durable action records.

## B. Implement ReRoute UI from Jiwoo's handoff

You have no Figma access requirement and no native-frame/design task. Read design/handoffs/reroute.md, the approved revision and exported assets. Jiwoo owns layout, styling, responsive choices and visual approval.

Implement disruption summary, affected bookings, recovery comparison, CancelClock, explicit approval, loading/unknown-policy/stale/partial-failure/result states using the approved shared code components. Calculations and state handling remain your responsibility. A flagged booking is not automatically canceled.

Show additional cash, expected recovery, noncash effects and forecast cost distinctly. Keep source policy evidence inspectable. Report a missing visual state to Jiwoo through the task Issue; backend logic/tests can continue independently. Do not request Figma access or a canvas write slot.

## C. Implement disruptions and impact

Support an outbound-flight cancellation and traveler-initiated trip cancellation for v1. Store a disruption with a stable ID, affected booking, event time, and provenance. Use a declared dependency model and temporal checks to identify potentially affected hotel, activity, and transfer bookings.

Allow the user to inspect why an item is flagged and whether it can still be kept. Preserve unaffected bookings. Avoid silently converting an impact recommendation into a booking-state change.

Use the shared demo clock and booking timezones. Write deadline comparisons against precise instants; labels can be localized for display. Do not use the browser's current timezone as the policy timezone.

## D. Calculate and explain recovery options

Build two or three useful options: continue with a replacement flight, cancel the trip, and optionally keep/revise selected components. Calculate from paid bookings, supported replacement quotes, and reviewed structured policies. Use shared integer-money utilities. AI may explain options and identify constraints, but it must not invent eligibility rules or perform authoritative arithmetic.

For the canonical continue option, verify $360 additional cash, $320 expected cash refund, $1,260 cash paid before refunds, and $940 forecast cost after the expected refund. Keep these metrics visibly distinct.

For cancellation, verify $820 expected cash recovery and $80 forecast unrecovered cost before the hotel deadline. Show that those refunds are expected, with receipt status tracked later by TripWallet. Identify the $50 hotel, $20 activity, and $10 transfer unrecovered amounts as components of the sample $80 result, without adding them twice.

If policy information is unknown or unreviewed, return an incomplete/review-needed option. Let users inspect/correct the source booking through intake. Do not supply a confident total that assumes unknown refunds are zero or fully recoverable.

## E. Implement CancelClock

Show upcoming cancellation deadlines in order, recoverable amounts before/after each cutoff, and which action would preserve recovery. Use the shared policy representation and the same eligibility function used by option calculations.

The sample hotel recovery changes from $400 to $200 at the stated cutoff. Agree on exact boundary semantics with Agent 1 and verify just before, exactly at, and just after it. Recompute the option totals when the active clock changes. Announce changes clearly without silently approving actions.

## F. Record actions and hand off to TripWallet

Require an explicit user approval after presenting the selected actions. Revalidate the option against the current trip revision, policy evidence, and active clock at approval time. A stale quote or crossed deadline requires updated confirmation.

Implement an action adapter with an honest sample/sandbox implementation. A successful sample result records a simulated action; it must not claim that a real provider was contacted. Real provider actions are optional and require an actual supported integration.

Persist an `ActionRecord` with stable action/booking IDs, idempotency key, expected recovery components, mode, source, timestamps, and result. Use Agent 1's atomic repository helper for each booking action. Repeated clicks/retries must not repeat the cancellation or generate extra action records.

For multi-booking approval, record each action's result separately. If some actions fail, show the partial outcome and retry only failed/pending actions. Do not roll every booking into a false all-success status.

Return the durable action IDs to Agent 1's orchestration. Agent 5's sync operation creates claims idempotently. Your module must not implement its own parallel claim ledger. Distinguish an action record from a provider refund promise and a received payment.

## G. Verify and deliver

Verify correct dependency impacts, untouched unaffected bookings, before/at/after deadline behavior, unknown policies, actual/forecast financial distinctions, repeated approvals, stale options, partial failures, persistence, and the action-to-wallet handoff.

Your handoff includes the implemented GitHub design revision, changed paths, exported page/service interfaces, example successful/failed action results, the exact event/record contract consumed by TripWallet, focused test results, and a decision note about the impact representation and rule-based versus AI responsibilities.

Definition of done: the canonical disruption leads to inspectable recovery choices, deadline-aware calculations, an explicit approved sandbox action, durable records, and automatic claim synchronization through the agreed application flow.


## Current startup links

Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
Assigned Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6
Task branch: agent-4/reroute
Dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
Jiwoo design handoff: design/handoffs/reroute.md

Jiwoo owns all designing. Consume the current GitHub design handoff; no Figma access is required for Kelvin or Brian.
