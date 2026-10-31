# CI activation

Owner: Agent 3, coordinated with Agent 1.

This starter has no app or active app-check workflow. After Agent 1 publishes the pinned runtime, package manager/lockfile and actual scripts, create .github/workflows/checks.yml using currently supported official checkout/setup actions.

Trigger on pull_request and pushes to main, with contents: read permissions. Install from the lockfile, run the real typecheck, focused test runner, and production build. Do not invent script names or make absent scripts a green skip. Agent 1 implements necessary application scripts; Agent 3 wires/runs them.

Run the workflow on a real PR, record its actual outcome, and request required checks/branch protection where the repo plan permits. Do not claim enforcement until settings are verified. Human review/approval rules remain visible.
