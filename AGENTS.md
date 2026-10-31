# WayFare agent instructions

## Start

Read this file, docs/OWNERSHIP.md, your assigned GitHub Issue, your own docs/prompts/agent-N.md, and relevant current contracts. Agents 1/2/4/5 read docs/PROJECT_BRIEF.md once. Agent 3 reads docs/COORDINATION.md and its own bounded prompt; it should not ingest all prompts or the source tree.

Independent LLM sessions have no persistent shared memory. Current repository files, Issues, and Figma mappings are authoritative. Check state on start/resume and handoff; do not continuously poll while idle.

## Owners

Agent 1: architecture, app/root configuration, shared schemas/data/backend/model adapter, booking extraction backend, technical code/Figma integration; Jiwoo owns visual design.
Agent 2: Wayfinder and intake/review UI.
Agent 3: .github/, coordination/ and reporting/setup scripts, coordination templates/indexes, release checks/document assembly. Reuse the prepared dashboard rather than rebuilding it.
Agent 4: ReRoute and CancelClock.
Agent 5: TripWallet.

See OWNERSHIP.md for paths. Each owner maintains its own feature tests, decision note, and handoff.

## Work

Use one active task and a short-lived branch per agent, with separate local clones. Fetch current main before work. Read only required context. Push small commits/PRs linked to real Issues. Do not invent identifiers, fabricate checks, overwrite another branch, or force-push shared history.

Request shared contract/config changes through Agent 1. A consumer may use a compatible stub but cannot redefine the shared schema. Agent 1 owns broad integration debugging.

Jiwoo owns all visual designs and Figma editing. Kelvin and Brian implement code against approved handoffs/exports in design/; they do not open Figma, create native frames or request writer slots.

## Finish

Run relevant real checks. Link the task, Figma frames, verification, capability labels, and changed paths in the PR. Update only docs/handoffs/agent-N.md for your status. Agent 3 routes failures to owners rather than debugging.

Keep secrets, private booking data, full chats, dependency folders, and build output out of commits. Native designs stay in Figma. Do not claim automatic Figma/GitHub synchronization without verification.

The user authorized five assigned development assistants. Do not create extra agent workers or expand optional features to consume lower-budget roles.

## Mandatory shared reports

Read docs/PROGRESS_UPDATES.md. Post a structured report to the assigned task Issue at session start, milestones, blockers, and before pausing. Include actual commit/PR/check/Figma evidence. The dashboard workflow refreshes the shared view; it does not wake inactive agents. Reuse the Figma file in docs/WORKSPACE_LINKS.md.

For Kelvin and Brian, your first chatbot response must explain the assigned features, scope boundaries, dependencies, update method, and completion criteria in plain language before starting work.


## Design ownership clarification

Jiwoo owns all visual design and Figma editing. Kelvin and Brian have no Figma access or native design tasks. They implement functionality and code UI from approved handoffs/exports in design/. Use design/README.md and design/approvals.json. Visual questions go to Jiwoo; shared technical changes go to Agent 1.
