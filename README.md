# WayFare — team workspace

Private repository for the round 2 build, coordinated across five development assistants. The application implementation has not started; this repository currently contains the shared coordination infrastructure and instructions.

**[Team progress dashboard](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1)** · **[Jiwoo design handoffs](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2)**

## Start your assigned agent

| Agent | Human / token budget | Responsibility | Instructions | Task |
| --- | --- | --- | --- | --- |
| 1 | Jiwoo / High | Shared architecture/backend, code foundation and integration | [Agent 1](docs/prompts/agent-1.md) | [Foundation #3](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3), then [Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) |
| 2 | Jiwoo / Moderate | Wayfinder and booking intake/review implementation | [Agent 2](docs/prompts/agent-2.md) | [#4](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4) |
| 3 | Jiwoo / Low | Bounded coordination, checks and release documentation | [Agent 3](docs/prompts/agent-3.md) | [#5](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/5), then [Release #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) |
| 4 | Kelvin / Moderate | ReRoute and CancelClock functionality | [Agent 4](docs/prompts/agent-4.md) | [#6](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6) |
| 5 | Brian / Moderate | TripWallet and refund reconciliation | [Agent 5](docs/prompts/agent-5.md) | [#7](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7) |

Read [AGENTS.md](AGENTS.md), your own instructions and your Issue. Agents 1/2/4/5 also read the [shared product brief](docs/PROJECT_BRIEF.md); Agent 3 keeps its context bounded.

## Jiwoo owns all visual design

Jiwoo designs and edits all Figma screens. **Kelvin and Brian need no Figma access.** They implement UI and functionality against approved specifications/exports committed under [design/](design/README.md). Their first chatbot response must explain their functionalities, exclusions, dependencies, progress updates and next action.

[Figma workspace for Jiwoo](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK) · [Design approval records](design/approvals.json) · [Design/code map](docs/DESIGN_MAP.md)

## Keep progress shared

Every agent reports at start/resume, milestones, blockers and before pausing. Use [the reporting command or connected GitHub tool](docs/PROGRESS_UPDATES.md), push actual files and open a linked PR. The Team progress workflow refreshes the dashboard from Issues, reports and PRs without LLM calls. It does not wake inactive chatbots.

[Coordination protocol](docs/COORDINATION.md) · [Ownership](docs/OWNERSHIP.md) · [Contracts index](docs/CONTRACTS.md) · [Release checklist](docs/RELEASE_CHECKLIST.md) · [Setup status](docs/SETUP_STATUS.md)

## Verification and limits

Coordination behavior/safety tests: `node --test coordination/update-dashboard.test.cjs` and `python3 -m unittest discover -s coordination -p 'test_*.py'`.

Application install/build/test commands will be published by Agent 1 after scaffold selection. Product code, real AI/provider calls, backend provisioning and the working demo are not completed by coordination setup. Teammate access requires their verified GitHub usernames; no Figma invitations are needed.
