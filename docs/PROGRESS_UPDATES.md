# Shared progress updates

The source of truth is the GitHub task Issue and its structured reports. Native designs remain in the shared Figma file. The shared dashboard is live at https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1; updates are verified through GitHub Actions.

## Reporting cadence

Each agent reports when starting/resuming a session, after a meaningful commit/PR milestone, immediately when blocked, and before pausing/finishing. Push actual code and relevant files before reporting that others can consume them. Include a current branch/commit or PR, completed behavior, tests and actual results, next step, blocker/dependency, and relevant Figma link.

Task keys:
- Agent 1: foundation, then integration.
- Agent 2: wayfinder-intake.
- Agent 3: coordination, then release.
- Agent 4 / Kelvin: reroute.
- Agent 5 / Brian: tripwallet.

## With GitHub CLI

```bash
python scripts/report_progress.py --task reroute --status in_progress --summary "Recovery cards implemented; calculation checks pass" --next "Implement deadline timeline"
```

Add --branch, --commit, --pr, --figma and --checks with real evidence when available. Use status ready, in_progress, blocked, review, or done. Status done is a report only; the dashboard requires the actual Issue to be closed before counting completion.

## With a GitHub connector

Run the same command with --dry-run to get the structured comment body, or compose the equivalent JSON. Resolve the real Issue number from coordination/config.json, post it as an Issue comment through the connected GitHub tool, and verify the returned comment URL. Do not email the report.

```text
<!-- wayfare-progress -->
```
Follow that marker with a fenced json object containing agent (number), task, status, summary, next, blocker, branch, commit, pr, figma and checks. See the reporter for an exact body. Never fabricate a posted update when write access is unavailable.

## Automatic team view

.github/workflows/team-progress.yml refreshes one Team progress Issue after Issue/comment/PR changes and relevant coordination pushes. It reads trusted default-branch coordination code and GitHub metadata; it does not execute PR-head application code. It uses no LLM calls.

The table shows seven task Issues, owners/budgets, effective state, latest summary, next step/blocker, and linked PRs. Dependencies must be completed before a consuming task becomes Ready. The dashboard is eventual, not instantaneous. Check the workflow run if an update does not appear; the original task comment is still the authoritative posted report.

A PR must contain its task marker, for example <!-- wayfare-task:reroute -->, and reference the actual task Issue from coordination/config.json. Milestone PRs use Relates to #6 for ReRoute; only the final PR meeting all task acceptance criteria uses Closes #6. Do not close a task merely because a model says it is done.

## Design handoff

Jiwoo owns all visual design and canvas editing. Kelvin and Brian use design/handoffs/ and exports committed to GitHub. Include --design-revision in progress reports and the approved revision in PRs. Missing design states go to Jiwoo in the feature Issue; core logic/tests can proceed independently. Only Jiwoo records native Figma node IDs.

## Design ownership clarification

Jiwoo owns all visual design and Figma editing. Kelvin and Brian have no Figma access or native design tasks. They implement functionality and code UI from approved handoffs/exports in design/. Use design/README.md and design/approvals.json. Visual questions go to Jiwoo; shared technical changes go to Agent 1.
