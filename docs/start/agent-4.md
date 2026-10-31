## Required first chatbot response

Before coding, give Kelvin a clear explanation of the assignment. Address Kelvin by name. Explain that he owns ReRoute and CancelClock: supported disruptions, affected-booking visualization, recovery comparisons, cancellation deadlines, approval and durable sandbox action records. Explain what is outside his scope (booking extraction, shared backend, wallet reconciliation), the inputs he receives from Agent 1, and the action records Brian consumes. Explain how he consumes Jiwoo's approved GitHub design handoff, posts progress, opens a PR, resumes work, and verifies completion. He needs no Figma access. State the first bounded milestone in plain language.

Your first response must cover: owned functionalities and exclusions; concrete MVP deliverables; dependencies and current blockers; the exact shared-update workflow; Jiwoo's design ownership and your implementation boundary; and the next action. Then inspect the repository and begin the authorized bounded work. Do not stop to ask for routine project-scope confirmation.

## Shared workspace and start checks

- Agent: 4; human: Kelvin; token tier: Moderate.
- Task keys: reroute. Resolve actual Issue numbers from coordination/config.json after setup.
- Intended GitHub target: Jiwoo-Jung-Cal/wayfare. The private repository is created: https://github.com/Jiwoo-Jung-Cal/wayfare. Verify your own read/write access before starting.
- Shared Figma Design: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK. The eight owner pages exist; product screens and working code are not implemented yet. Reuse this file.
- Read AGENTS.md, docs/OWNERSHIP.md, your task Issue, and docs/PROGRESS_UPDATES.md. Read only the source/contracts needed for your role. Agent 3 skips the long product brief and other agents' prompts.
- Verify your GitHub read/write access, current main, task branch and dependency status. If access/setup is blocked, explain the concrete missing step and continue only independent work; do not claim a local draft has been shared.
- Jiwoo owns all visual design and Figma edits. Kelvin and Brian need no Figma access. Read design/README.md and the approved handoff for your feature. Preserve Jiwoo's design decisions; report missing visual specifications in the Issue.

## Mandatory progress updates

Report on session start/resume, after a meaningful commit/PR milestone, immediately when blocked, and before pausing/finishing. Post to the task Issue using scripts/report_progress.py or an equivalent connected GitHub comment; the dashboard workflow then refreshes the team view. Update your own docs/handoffs/agent-4.md as part of a milestone PR. Do not exchange source or full transcripts by email.

Include completed behavior, next step, blockers/dependencies, actual branch/commit/PR, checks and outcomes, and the approved design-handoff revision/link. Push the actual output before telling others it is available. Use `<!-- wayfare-task:reroute -->` in the PR body and Closes #ACTUAL_ISSUE_NUMBER. For later integration/release tasks, use that task key instead. A model report saying done does not replace an actual merged/accepted task.

Example (use real progress and evidence):

```bash
python scripts/report_progress.py --task reroute --status in_progress --summary "Describe completed behavior" --next "Describe the next bounded step"
```

Add --branch, --commit, --pr, --design-revision and --checks as applicable. The optional --figma flag is for Jiwoo's own records, not a teammate access requirement. If GitHub CLI is unavailable, add --dry-run, post that structured body through the connected GitHub tool to the real task Issue, and verify the returned comment URL. Never claim an update was posted if write access failed.

At the end of each work session, tell Kelvin: what changed; where it was pushed; the actual Issue/PR and design-handoff links; checks performed; current blocker/status; and the next short instruction to resume the same task. Shared state belongs in GitHub so Kelvin does not have to relay code between chats.
