# WayFare — team workspace

Private repository for the round 2 build, coordinated across five development assistants. The runnable foundation, Wayfinder and booking intake are on main. ReRoute, TripWallet and the complete release journey remain in progress; see the linked Issues for current evidence.

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

## Run the current sample app

Use Agent 1's published runtime: Node 24.21.0 and npm 11.19.0. After cloning the private repository, run these commands at the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Default sample mode uses browser storage and needs no app server or provider credentials. Use the app's sample trip and sample documents; arbitrary booking text is not live AI extraction in this mode.

## Verification and limits

The application workflow runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and `npm run e2e`. Browser tests need Google Chrome, or the alternative Chromium setup described in [Agent 1's handoff](docs/handoffs/agent-1.md). Coordination checks remain `node --test coordination/update-dashboard.test.cjs` and `python3 -m unittest discover -s coordination -p 'test_*.py'`.

[CI PR #11](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/11) is merged and [task #5](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/5) is complete. At the October 31 checkpoint, main `0eb41c4` has a Linux mobile-overflow failure. Agent 1's [fix PR #19](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/19) passes application and coordination CI but has not merged. Its tests report 101 passed, 2 skipped and 3 todo; browser tests report 9 passed and 3 skipped. These are PR results, not a verified release.

[Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) still awaits ReRoute and TripWallet. [Release #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) remains blocked. Provider cancellations/refunds are simulated. Live AI, hosted backend/demo, approved designs, Figma runtime alignment and judge access remain unverified. See [setup status](docs/SETUP_STATUS.md) for access and ownership details.
