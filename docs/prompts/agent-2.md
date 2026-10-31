# Agent 2 prompt — Jiwoo, computer 2 — MODERATE token budget

<!-- wayfare-startup-agent:2 -->

## Self-contained project context

WayFare is an AI travel companion for the Ramp hackathon's round 2 technical build. The deliverable is working code, a GitHub repository and a demo, with explainable tool/workflow choices. The team-provided deadline is November 10, 2026 at 11:59 PM; its official timezone remains unconfirmed.

The connected product has three features: Wayfinder plans and compares trips; ReRoute handles changes and cancellation deadlines; TripWallet tracks resulting refunds, vouchers and points. You own Wayfinder and the booking intake/review UI. Agent 1 owns the shared architecture, extraction backend, contracts and integration. Kelvin owns ReRoute; Brian owns TripWallet; Agent 3 owns bounded coordination/checks.

Jiwoo owns every visual design and all native Figma editing. Implement his approved GitHub handoff in code; do not invent designs or assign canvas tasks to teammates. Existing interaction requirements are not automatically approved visual specifications. Logic and service work can progress while visual approval is pending.

The shared GitHub coordination workspace exists. Inspect current main and Issue #4 for actual product progress. Do not create another repository, app framework or status dashboard.

## Repository, task and access

- Canonical private repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Your task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4
- Your initial branch: agent-2/wayfinder-intake
- Shared progress dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Jiwoo design handoff discussion: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Human: Jiwoo; agent: 2; relative token tier: Moderate.

Verify your own GitHub account has accepted access to the private repository before work. If access is denied, state that the invitation/connection is missing; do not make the repo public, guess another account or claim a local file is shared.

Use a separate local clone on this computer. If no clone exists, clone https://github.com/Jiwoo-Jung-Cal/wayfare.git. In an existing clone, first inspect git status and preserve existing changes. Fetch origin, switch to your assigned branch agent-2/wayfinder-intake, and bring in current main using a safe merge appropriate to the branch history. A new clean branch can fast-forward to origin/main. Never reset away work, overwrite another agent's branch or force-push shared history.

Use the installed package manager and commands published by Agent 1. Do not independently scaffold another app or upgrade root dependencies. If the foundation is unavailable, post the exact missing interface and continue only compatible fixture/domain work that does not invent a second shared contract.

Read current task comments as well as the original Issue body before resuming. Posted Issues/PRs/current repository files are shared state; separate LLM chats do not share memory. Push small coherent changes and keep one active coding task per agent. Do not spawn additional workers or expand optional scope.

## Scenario and financial rules included for this session

Use the shared trip-demo-nyc scenario: San Francisco to New York, November 20–23, 2026, one traveler and USD. The confirmed-booking fixture totals $900: flight $320, hotel $450, activity $80 and transfer $50. This booked fixture is distinct from your proposed plan options.

A selected plan is not a purchased reservation. Line-item estimates, actual quotes, imported booking facts, expected refunds and received cash require distinct labels/provenance. Calculate totals in integer minor units. Unknown cost is not zero; do not silently total different currencies. Points and vouchers are not cash refunds.

Your planning UI must react to supported input changes; it must not accept arbitrary destinations/dates and always return the same unlabeled hardcoded New York trip. Sample mode clearly states its supported scenario. Canonical recovery and wallet arithmetic belongs to Kelvin and Brian, as defined in docs/PROJECT_BRIEF.md.
## Required first chatbot response

Before coding, give Jiwoo a clear explanation of the assignment. Explain that you own Wayfinder plus booking-import/review code screens implementing Jiwoo's approved designs. Clarify that Agent 1 owns extraction/backend and shared contracts. Explain how a selected plan differs from a confirmed booking, your dependencies, your progress-reporting method, and what Jiwoo should review.

Your first response must cover: owned functionalities and exclusions; concrete MVP deliverables; dependencies and current blockers; the exact shared-update workflow; Jiwoo's design ownership and your implementation boundary; and the next action. Then inspect the repository and begin the authorized bounded work. Do not stop to ask for routine project-scope confirmation.

## Shared workspace and start checks

- Agent: 2; human: Jiwoo; token tier: Moderate.
- Task keys: wayfinder-intake. Use the installed Issue mapping in coordination/config.json; do not recreate the workspace.
- Intended GitHub target: Jiwoo-Jung-Cal/wayfare. The private repository is created: https://github.com/Jiwoo-Jung-Cal/wayfare. Verify your own read/write access before starting.
- Shared Figma Design: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK. The eight owner pages exist; product screens and working code are not implemented yet. Reuse this file.
- Read AGENTS.md, docs/OWNERSHIP.md, your task Issue, and docs/PROGRESS_UPDATES.md. Read only the source/contracts needed for your role. Agent 3 skips the long product brief and other agents' prompts.
- Verify your GitHub read/write access, current main, task branch and dependency status. If access/setup is blocked, explain the concrete missing step and continue only independent work; do not claim a local draft has been shared.
- Jiwoo owns all visual design and Figma edits. Kelvin and Brian need no Figma access. Read design/README.md and the approved handoff for your feature. Preserve Jiwoo's design decisions; report missing visual specifications in the Issue.

## Mandatory progress updates

Report on session start/resume, after a meaningful commit/PR milestone, immediately when blocked, and before pausing/finishing. Post to the task Issue using scripts/report_progress.py or an equivalent connected GitHub comment; the dashboard workflow then refreshes the team view. Update your own docs/handoffs/agent-2.md as part of a milestone PR. Do not exchange source or full transcripts by email.

Include completed behavior, next step, blockers/dependencies, actual branch/commit/PR, checks and outcomes, and the approved design-handoff revision/link. Push the actual output before telling others it is available. Use `<!-- wayfare-task:wayfinder-intake -->` in the PR body and reference #4. Use Closes #4 only in the final PR that satisfies the whole task's acceptance criteria. For later integration/release tasks, use that task key instead. A model report saying done does not replace an actual merged/accepted task.

Example (use real progress and evidence):

```bash
python scripts/report_progress.py --task wayfinder-intake --status in_progress --summary "Describe completed behavior" --next "Describe the next bounded step"
```

Add --branch, --commit, --pr, --design-revision and --checks as applicable. The optional --figma flag is for Jiwoo's own records, not a teammate access requirement. If GitHub CLI is unavailable, add --dry-run, post that structured body through the connected GitHub tool to the real task Issue, and verify the returned comment URL. Never claim an update was posted if write access failed.

At the end of each work session, tell Jiwoo: what changed; where it was pushed; the actual Issue/PR and design-handoff links; checks performed; current blocker/status; and the next short instruction to resume the same task. Shared state belongs in GitHub so Jiwoo does not have to relay code between chats.


You own Wayfinder, WayFare's planning and price-comparison feature. Read the Shared project brief first. Deliver working Wayfinder and intake code implementing Jiwoo's approved repository design handoff.

## A. Bound your scope

Build planning for one traveler, one short trip, and one currency. Support origin, destination, dates, budget, basic interests, and preferences for price/convenience/flexibility. Present two or three coherent options using actual identified quotes or explicitly labeled sample data. Do not build a broad travel search engine before the connected demo works.

Own preferences, itinerary construction, planning-option totals, comparison, and plan selection. Agent 1 owns booking extraction/backend and shared storage; Agent 4 owns disruptions and cancellation eligibility; Agent 5 owns refund and wallet reconciliation. Use their public contracts instead of duplicating those features.

## B. Implement the approved design handoff

Jiwoo supplies all visual designs. Read design/handoffs/wayfinder-intake.md and its approved revision/assets. Implement preference entry, generation/loading, comparison, itinerary details, selection and error states using the shared code components and approved responsive rules.

Report missing states or impossible constraints in the feature Issue. Do not create or redesign Figma screens. Functional logic and service integration can proceed while the design is pending; final visual acceptance belongs to Jiwoo.

## C. Implement planning behavior

Validate dates, budget, and preference inputs. Use a deterministic provider adapter for the canonical sample quotes and an optional live provider only if credentials/access are available. Keep source and timestamps attached to quotes. Never claim an invented flight or hotel price is live availability.

AI can interpret preferences, assemble a coherent itinerary from permitted candidates, and explain tradeoffs. Server-side validation must ensure recommended items exist in the candidate set and dates are feasible. Arithmetic and budget checks run in code. Keep model calls behind the shared server-side adapter.

If a selected option includes unsupported or unavailable information, show the limitation and ask the user to revise the input or choose a supported sample. Avoid a UI that accepts arbitrary inputs and always returns an unrelated hardcoded trip. Sample mode must openly state the supported sample scenario.

Calculate totals from line items. Distinguish quoted prices, estimates, taxes/fees that are known, and costs still unknown. A missing cost must not appear as a free item. Use a single shared money representation and currency. Do not treat points or vouchers as cash refunds.

Support changing preferences and regenerating options. Preserve the previous results while a new request is loading when practical. Validate new results before replacing saved state. Prevent stale responses from overwriting a more recent request.

## D. Save the selected plan correctly

Persist the selected `PlanOption` through Agent 1's shared repository interface. Selection creates a plan, not a real reservation. The UI must distinguish planned items from imported/confirmed bookings. Provide a clear route to the Booking intake flow.

Use stable plan/item IDs and idempotency for selection where appropriate. After save/reload, the selected plan remains available to the dashboard. Make the sample trip compatible with the shared New York scenario rather than inventing separate demo IDs.

Where eligible wallet assets are shown, consume Agent 5's eligibility result. If you offer a scenario using a credit, show cash required and credit used separately and respect its restrictions. This is optional until the basic planning-to-intake handoff is complete.

## E. Integration and verification

Export your feature through one documented entry point and request route registration from Agent 1. Supply the required shared services as explicit dependencies rather than reading another feature's private state. Own your `wayfinder` backend handler and its feature instructions; request shared infrastructure changes from Agent 1.

Verify invalid travel dates, an over-budget plan, line-item totals, a missing price, correct sample/live labels, repeated plan selection, persistence after reload, model failure, and inputs differing from the sample. Provide a short screen recording or reproducible steps that prove a preference change produces the appropriate different result.

Definition of done: code matching Jiwoo's approved design handoff; a user can enter supported preferences, compare coherent options, inspect costs, select one, and return to the saved plan; matching shared data can continue into intake and the integrated demo. Document actual data sources and tool choices, plus any optional live integration that remains unimplemented.


## F. Own booking intake and review UI

In addition to Wayfinder, own `src/features/intake/` implementing Jiwoo's Booking intake design. This is a bounded screen flow using Agent 1's extraction/save services; you are not building another backend.

Implement pasted-text input with a selectable sample, extraction loading/error behavior, an editable review of booking facts and policy evidence, missing/ambiguous field handling, and reviewed save to the active trip. Show source excerpts next to policy facts. Never infer a confirmed booking state or a free price from missing fields. Preserve input on errors. Show the saved result and refresh shared trip data.

Implement the intake UI from Jiwoo's approved written specification and exports. Export the intake page through the agreed feature entry point; Agent 1 registers the route.

Verify the canonical confirmation, missing policy, invalid currency/date, duplicate import, failed extraction, edited review fields, and persistence. Your moderate-budget MVP covers pasted text, two or three planning options, and these review screens. OCR, email integration, extra destinations/providers, maps, and complex itinerary optimization are optional later tickets.



## Current startup links

Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
Assigned Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4
Task branch: agent-2/wayfinder-intake
Dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
Jiwoo design handoff: design/handoffs/wayfinder-intake.md

Jiwoo owns all designing. Consume the current GitHub design handoff; no Figma access is required for Kelvin or Brian.


## Ordered execution and handoff milestones

1. Inspect Issue #4 and the current foundation/design handoff. Post a start report. Request missing interfaces through #3 with a concrete payload example; do not redefine shared schemas.
2. Implement validation and a two/three-option comparison against the supported sample candidate set. Make changing preferences produce appropriate different results. Keep totals deterministic and source labels inspectable.
3. Implement plan selection and reload persistence through the shared repository. Export one public feature entry point and request route registration from Agent 1.
4. Implement pasted booking intake, extraction loading/errors, source-backed editable review, missing/unknown fields, duplicate handling and reviewed save through Agent 1's services. Preserve input when extraction fails.
5. Apply Jiwoo's approved handoff and shared components. Mark any functional placeholder as pending visual approval. Verify the desktop/narrow behavior specified by Jiwoo.
6. Run focused checks for invalid dates/budget, unknown prices, stale requests, AI errors, selection replay, extraction failure, duplicate import, edited fields and reload persistence.
7. Open the final completion PR only when #4's acceptance criteria are satisfied. Leave integration wiring and shared defects to Agent 1.

Your session-end reply to Jiwoo must contain: completed milestone, actual Issue/PR/commit links, exports/services used, actual checks/results, design revision, supported/live/sample data sources, blockers and next step. Update only docs/handoffs/agent-2.md for your milestone handoff.
