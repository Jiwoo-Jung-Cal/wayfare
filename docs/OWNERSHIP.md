# Ownership and token budgets

Relative planning weights: high ~3 moderate units; moderate ~1; low ~0.25. These are not measured token predictions. The low role routes application debugging to owners.

| Agent | Owns | Excludes |
| --- | --- | --- |
| 1 / Jiwoo / High | Root app/package/lockfile config; src/app, src/core, shared UI/styles; fixtures/clock/controls; shared schemas/migrations/server/model helpers; booking extraction backend; integration tests; implementation of Jiwoo's approved shared components and technical working layer | Other feature internals unless an explicit integration task transfers scope |
| 2 / Jiwoo / Moderate | src/features/wayfinder, src/features/intake, wayfinder handler; their code/tests implementing Jiwoo's design | Shared schemas, extraction backend, root dependencies |
| 3 / Jiwoo / Low | AGENTS.md, .github, coordination/, scripts/ reporting/setup helpers, coordination indexes/templates, release checklist, assembled README, CI wiring from established commands | Product UI, Figma mutations, app debugging, schema design, merge conflicts |
| 4 / Kelvin / Moderate | src/features/reroute and handler; ReRoute/CancelClock code and tests implementing Jiwoo's design | Intake, shared platform, wallet ledger |
| 5 / Brian / Moderate | src/features/tripwallet and handler; TripWallet code and tests implementing Jiwoo's design | Shared platform, cancellation eligibility, trip planning |

Each owner updates its own handoff and feature decision note. Agent 1 approves technical accuracy of release docs. Agent 3 administers task status; Jiwoo owns all canvas work and design approval; Agent 1 owns technical integration.

This is a coordination rule until actual GitHub enforcement is configured. Agent 1 may adapt paths once to an existing compatible scaffold, then publishes the final map. Do not invent implemented paths before that handoff.


## Design ownership clarification

Jiwoo owns all visual design and Figma editing. Kelvin and Brian have no Figma access or native design tasks. They implement functionality and code UI from approved handoffs/exports in design/. Use design/README.md and design/approvals.json. Visual questions go to Jiwoo; shared technical changes go to Agent 1.
