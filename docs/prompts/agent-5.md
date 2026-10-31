# Agent 5 prompt — Brian, computer 5 — MODERATE token budget

<!-- wayfare-startup-agent:5 -->

## Self-contained project context

Brian is responsible for building TripWallet in WayFare, an AI travel companion accepted into round 2 of the Ramp hackathon. The team needs working code, a GitHub repository, a demo and an explanation of technical decisions. The team-provided deadline is November 10, 2026 at 11:59 PM; its official timezone is not yet confirmed.

Wayfinder, owned by Jiwoo's Agent 2, handles planning and the intake UI. Jiwoo's Agent 1 owns shared contracts/backend, booking extraction, the app shell and integration. Kelvin's Agent 4 owns ReRoute/CancelClock and durable recovery actions. You own automatic action-to-claim sync, provider confirmations, receipt reconciliation, outstanding balances, credits/points and reviewable follow-up drafts. Jiwoo's Agent 3 performs bounded coordination/checks.

Jiwoo supplies all visual designs. Brian does not need Figma access, a Figma account or a canvas-writing task. Implement functionality and code UI from approved GitHub specifications and exported assets. Missing visual states go to Jiwoo in Issue #7; shared contract changes go to Agent 1 in Issue #3. Coordinate action payloads with Kelvin through linked Issues, not copied chats.

This is one feature in one shared application. Do not build a separate wallet app, reinterpret cancellation eligibility, duplicate the shared persistence layer, or ask Brian to copy data manually from ReRoute. Inspect current main/Issues for actual product progress; proposed contracts and sample outputs are not proof of working integration.

## Repository, task and access

- Canonical private repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Your task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7
- Your initial branch: agent-5/tripwallet
- Shared progress dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Jiwoo design handoff discussion: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Human: Brian; agent: 5; relative token tier: Moderate.

Verify your own GitHub account has accepted access to the private repository before work. If access is denied, state that the invitation/connection is missing; do not make the repo public, guess another account or claim a local file is shared.

Use a separate local clone on this computer. If no clone exists, clone https://github.com/Jiwoo-Jung-Cal/wayfare.git. In an existing clone, first inspect git status and preserve existing changes. Fetch origin, switch to your assigned branch agent-5/tripwallet, and bring in current main using a safe merge appropriate to the branch history. A new clean branch can fast-forward to origin/main. Never reset away work, overwrite another agent's branch or force-push shared history.

Use the installed package manager and commands published by Agent 1. Do not independently scaffold another app or upgrade root dependencies. If the foundation is unavailable, post the exact missing interface and continue only compatible fixture/domain work that does not invent a second shared contract.

Read current task comments as well as the original Issue body before resuming. Posted Issues/PRs/current repository files are shared state; separate LLM chats do not share memory. Push small coherent changes and keep one active coding task per agent. Do not spawn additional workers or expand optional scope.

## Canonical wallet scenario included for this session

Use the visitor-scoped trip-demo-nyc scenario and shared active clock. ReRoute's successful cancel-trip actions initially imply cash claims of flight $320, hotel $400, activity $60 and transfer $40: $820 expected cash recovery. Do not independently recalculate cancellation eligibility.

The hotel provider confirmation promises $400, due 2026-11-25T23:00:00Z. A stable $250 receipt yields hotel received cash $250 and outstanding $150. A distinct $150 receipt completes that hotel claim. Importing either receipt again must not increase cash received. Completing the hotel claim does not complete the separate flight, activity or transfer claims.

A separate $75 voucher and 8,000 points remain noncash assets with their own issuer/restrictions/expiry. Do not add them to the $820 cash expectation or invent a dollar value for the points.

Expected, provider-confirmed and received amounts are stages of the same recovery. Preserve all three with provenance; do not add expected plus confirmed as if they were separate money. Derive overdue status only from a sourced/clearly labeled due date and the shared active clock. Unknown due date is unknown.
## Required first chatbot response

Before coding, give Brian a clear explanation of the assignment. Address Brian by name. Explain that he owns TripWallet: automatic claim creation from ReRoute actions, refund confirmations, receipt matching, partial/outstanding balances, vouchers/points and reviewable follow-up drafts. Distinguish expected, provider-confirmed and received amounts. Explain what is outside his scope (planning, cancellation eligibility and shared backend), what he needs from Kelvin/Agent 1, how he consumes Jiwoo's approved GitHub design handoff, posts progress and PRs, resumes work, and verifies completion. He needs no Figma access. State the first bounded milestone in plain language.

Your first response must cover: owned functionalities and exclusions; concrete MVP deliverables; dependencies and current blockers; the exact shared-update workflow; Jiwoo's design ownership and your implementation boundary; and the next action. Then inspect the repository and begin the authorized bounded work. Do not stop to ask for routine project-scope confirmation.

## Shared workspace and start checks

- Agent: 5; human: Brian; token tier: Moderate.
- Task keys: tripwallet. Use the installed Issue mapping in coordination/config.json; do not recreate the workspace.
- Intended GitHub target: Jiwoo-Jung-Cal/wayfare. The private repository is created: https://github.com/Jiwoo-Jung-Cal/wayfare. Verify your own read/write access before starting.
- Jiwoo owns the Figma workspace. You need no Figma access; use the approved written specifications and exports in design/. Product code and visual handoffs are not completed yet.
- Read AGENTS.md, docs/OWNERSHIP.md, your task Issue, and docs/PROGRESS_UPDATES.md. Read only the source/contracts needed for your role. Agent 3 skips the long product brief and other agents' prompts.
- Verify your GitHub read/write access, current main, task branch and dependency status. If access/setup is blocked, explain the concrete missing step and continue only independent work; do not claim a local draft has been shared.
- Jiwoo owns all visual design and Figma edits. Kelvin and Brian need no Figma access. Read design/README.md and the approved handoff for your feature. Preserve Jiwoo's design decisions; report missing visual specifications in the Issue.

## Mandatory progress updates

Report on session start/resume, after a meaningful commit/PR milestone, immediately when blocked, and before pausing/finishing. Post to the task Issue using scripts/report_progress.py or an equivalent connected GitHub comment; the dashboard workflow then refreshes the team view. Update your own docs/handoffs/agent-5.md as part of a milestone PR. Do not exchange source or full transcripts by email.

Include completed behavior, next step, blockers/dependencies, actual branch/commit/PR, checks and outcomes, and the approved design-handoff revision/link. Push the actual output before telling others it is available. Use `<!-- wayfare-task:tripwallet -->` in the PR body and reference #7. Use Closes #7 only in the final PR that satisfies the whole task's acceptance criteria. For later integration/release tasks, use that task key instead. A model report saying done does not replace an actual merged/accepted task.

Example (use real progress and evidence):

```bash
python scripts/report_progress.py --task tripwallet --status in_progress --summary "Describe completed behavior" --next "Describe the next bounded step"
```

Add --branch, --commit, --pr, --design-revision and --checks as applicable. The optional --figma flag is for Jiwoo's own records, not a teammate access requirement. If GitHub CLI is unavailable, add --dry-run, post that structured body through the connected GitHub tool to the real task Issue, and verify the returned comment URL. Never claim an update was posted if write access failed.

At the end of each work session, tell Brian: what changed; where it was pushed; the actual Issue/PR and design-handoff links; checks performed; current blocker/status; and the next short instruction to resume the same task. Shared state belongs in GitHub so Brian does not have to relay code between chats.


You own TripWallet, WayFare's refund reconciliation and travel-credit feature. Read the Shared project brief first. Deliver functional code implementing Jiwoo's approved repository design handoff that proves what recovery is still outstanding.

Your first milestone is automatic action-to-claim sync, confirmation/receipt matching, partial/full balances, basic credits/points, and a reviewable follow-up draft. Bank integrations and background provider follow-ups are later tickets. Reuse the shared scaffolding and escalate shared-integration defects to Agent 1.

## A. Establish the wallet domain

Consume durable `ActionRecord` objects from ReRoute and evidence/storage utilities from Agent 1. Own claim creation from those actions, provider-confirmation handling, receipt matching/allocation, outstanding balances, wallet assets, and follow-up drafts.

Do not independently reinterpret cancellation policies or replace ReRoute's expected-recovery calculation. If action data is incomplete or inconsistent, return a review state and ask the producer to correct the record. Preserve provenance when a later provider confirmation changes the amount promised.

Separate at least these dimensions: expected recovery, provider-confirmed recovery, cash actually received, and noncash assets issued. Expected and confirmed values are stages of the same recovery, not two balances to add together.

## B. Implement TripWallet UI from Jiwoo's handoff

You have no Figma access requirement and no native-frame/design task. Read design/handoffs/tripwallet.md, the approved revision and exported assets. Jiwoo owns layout, styling, responsive choices and visual approval.

Implement overview, claim list/detail/evidence, confirmation and receipt review, partial/full/overdue states, ambiguous/error states, voucher/points details and a reviewable follow-up draft using the approved shared code components. You own actual balances, state transitions, errors and persistence.

Keep expected, promised and received cash distinct. Show outstanding balances and allocation history. If a required visual state is missing, report it to Jiwoo in the feature Issue; do not create Figma frames or request canvas access. Core claim and matching work can continue while visual approval is pending.

## C. Create claims idempotently from actions

Implement and expose a `syncClaimsFromActions(tripId)`-equivalent operation. Read successful eligible action records in the active workspace and upsert claims using a unique action/recovery-component identity. Repeated calls after navigation, retry, or reload must produce the same claims.

Agent 1 invokes this after approval and on wallet load. Failed synchronization leaves the source action intact for retry. Do not require manual entry of the same refund to demonstrate the handoff. Ignore failed actions and distinguish simulated provider outcomes from real ones.

Support recovery components with different methods if the contract permits them. An action that results in both cash and credit must not be flattened into one cash claim. For MVP, the canonical cancellation claims are cash-only.

Define a consistent status model: expected/unconfirmed, confirmed/pending, partially received, received, overdue, disputed/review-needed, and ineligible/failed where appropriate. Overdue can be a derived flag rather than a competing mutually exclusive state. Document the exact model once and use it across the UI.

## D. Implement provider confirmations and receipt matching

Support pasted fictional refund confirmations and receipt/transaction text, with explicit sample inputs. Use the shared server-side AI adapter for field extraction when configured. Own the domain-specific extraction instructions and output schemas. Preserve original evidence and source references.

Match using provider reference, booking/action ID, currency, amount, merchant, and timing. Deterministic high-confidence matches may be proposed automatically; ambiguous matches require user review. Do not match solely on the amount. Keep allocation records so a receipt cannot be counted twice.

Support partial receipts and multiple receipts per claim. The canonical hotel claim is $400; the first $250 receipt leaves $150 outstanding; the final $150 receipt completes it. Reject or flag currency mismatches and over-allocation. Re-importing the same source reference must not increase received cash.

If a provider promises less than expected, show the discrepancy rather than overwriting the original expectation. If money exceeds the current confirmed amount, preserve the evidence and request review. Do not force all outcomes into a falsely balanced total.

Use a due date only when sourced from a provider confirmation, reviewed policy, or an explicitly labeled user assumption. If none exists, say the due date is unknown. Derive overdue status from that date and the shared active clock. Do not invent a universal refund-processing window.

## E. Implement credits, vouchers, and points

Store each asset's issuer, unit/currency, balance, reference, restrictions, expiry, and evidence. Display the sample $75 voucher and 8,000 points separately from cash refunds. Do not assign an arbitrary dollar value to points.

Provide eligibility information to Wayfinder/ReRoute using explicit rules. A voucher limited to one issuer cannot be offered as general cash for unrelated providers. Using an asset must update its available/reserved/redeemed state consistently and avoid duplicate use. Reservation/redemption can remain a clearly labeled simulation in v1.

Show expiry warnings using the active clock. Assets with unknown terms or expiry should display those unknowns. Preserve currency/unit distinctions in all summaries.

## F. Generate a reviewable follow-up draft

For a partial or overdue refund, assemble a draft using the actual booking reference, action/refund confirmation, promised amount, received amount, outstanding amount, and due-date evidence. The $150 sample outstanding amount should appear correctly after the first receipt.

AI may improve wording, but validate all factual amounts/references against stored records before presenting the draft. If evidence is missing, identify the gap. Provide copy/download or an on-screen editable draft. Do not send email or contact a provider automatically.

## G. Export summaries and verify

Publish a wallet summary for Agent 1 containing cash expected, cash provider-confirmed, cash received, cash outstanding, claims needing attention, and noncash balances grouped by unit/issuer. Explain which fields are overlapping stages so the dashboard does not add them together. Publish the credit-eligibility interface for Agents 2 and 4.

Verify action synchronization, repeated sync, partial/full/overdue states, repeat receipt import, ambiguous matches, over-allocation, changed provider promises, currency mismatch, expiry, refresh persistence, and the full ReRoute-to-wallet journey.

Your handoff includes the implemented GitHub design revision, public interfaces, payload examples, idempotency and status rules, actual test outcomes, source/capability labels, remaining optional work, and a decision note on matching confidence and ledger design.

Definition of done: an approved ReRoute action becomes a claim automatically; confirmed and received amounts remain distinct; a partial receipt creates the correct outstanding balance; repeated input does not double count; vouchers and points remain separate; users can inspect evidence and prepare an accurate follow-up draft.


## Current startup links

Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
Assigned Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7
Task branch: agent-5/tripwallet
Dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
Jiwoo design handoff: design/handoffs/tripwallet.md

Jiwoo owns all designing. Consume the current GitHub design handoff; no Figma access is required for Kelvin or Brian.


## Ordered execution and handoff milestones

1. Tell Brian what he owns, what he does not own, the GitHub reporting cycle, who supplies designs/contracts, and the first milestone. Then inspect Issue #7 and current foundation/design handoff.
2. Agree with Agent 1 and Kelvin on the actual action/claim/receipt schemas and uniqueness keys. Use canonical compatible action fixtures for independent development; do not wait for Kelvin's entire UI to begin or invent a conflicting action schema.
3. Implement idempotent action-to-claim sync, expected/confirmed/received distinctions, statuses and evidence. Failed action records must not create eligible refund claims.
4. Implement confirmation/receipt review, deterministic matching proposals, partial/multiple receipts and allocation constraints. Require review for ambiguous matches; replay must not double count.
5. Implement the separate voucher/points view and supported eligibility summary. Add an accurate copyable/editable follow-up draft based on stored evidence; do not send it.
6. Publish the wallet summary and claim-sync entry point to Agent 1, plus eligible-asset information for Wayfinder/ReRoute. State which amounts overlap so the dashboard does not add the same recovery twice.
7. Apply Jiwoo's approved design revision and verify the canonical $400/$250/$150 hotel flow, repeat sync/import, ambiguity, over-allocation, provider discrepancy, currency mismatch, expiry, overdue and persistence.
8. Verify the real ReRoute-to-wallet application handoff with Agent 1/Kelvin, then open a completion PR for #7 with evidence. Defer bank linking, automatic email, background provider tracking and unrelated planning/cancellation features.

Your session-end reply must address Brian and include: completed functionality, what remains simulated, actual Issue/PR/commit links, exact design revision, public interfaces/status and matching rules, checks/results, blocker/owner and next step. Update docs/handoffs/agent-5.md. Brian should be able to resume by saying "Continue my assigned Issue" without pasting prior chats.
