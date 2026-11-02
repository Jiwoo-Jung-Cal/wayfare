# WayFare — team workspace

Private repository for the round 2 build, coordinated across five development assistants. The runnable foundation, Wayfinder, booking intake and a TripWallet cash-reconciliation milestone are on main. ReRoute now exists in [draft PR #37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37), awaiting adoption of [Agent 1's published atomic contract (#38)](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/38), its navigation fix and approved integration through [draft PR #39](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/39). Design draft r1 is the interim look; formal approval and accepted-release verification remain pending.

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

[Coordination protocol](docs/COORDINATION.md) · [Ownership](docs/OWNERSHIP.md) · [Contracts index](docs/CONTRACTS.md) · [Release checklist](docs/RELEASE_CHECKLIST.md) · [Release runbook](docs/RELEASE_GUIDE.md) · [Setup status](docs/SETUP_STATUS.md)

## Run the current sample app

Use Agent 1's published runtime: Node 24.21.0 and npm 11.19.0. After cloning the private repository, run these commands at the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Default sample mode uses browser storage and needs no app server or provider credentials. Use the app's sample trip and sample documents; arbitrary booking text is not live AI extraction in this mode.

## Verification and limits

The application workflow runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and `npm run e2e`. Browser tests need Google Chrome, or the alternative Chromium setup described in [Agent 1's handoff](docs/handoffs/agent-1.md). Coordination checks remain `node --test coordination/update-dashboard.test.cjs` and `python3 -m unittest discover -s coordination -p 'test_*.py'`.

[CI PR #11](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/11) completed task #5. [TripWallet integration #27](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/27) merged the cash-wallet milestone, including receipt reconciliation and browser allocation fixes. Browser checks cover sample mode and a local connected API with AI disabled. See the [release runbook](docs/RELEASE_GUIDE.md) for dated check evidence and remaining skipped cases.

[Preparation PR #20](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/20) is merged. [Release #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) was reopened for final submission verification; preparation did not complete that task. PR #37's feature-owned browser check exercises real ReRoute controls through wallet reconciliation without seeding actions, while main's shared journey still has pending ReRoute steps. The atomic contract is published in #38 and the shared journey is implemented on #39's branch; adoption, the [ReRoute navigation fix](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37#issuecomment-6587326231), merge approvals and Agent 1's accepted commit/demo remain required before release checks can be signed off. Provider actions are simulated. The [deadline and judge-link checklist](docs/SETUP_STATUS.md#deadline-and-judge-links) records unresolved official instructions and access requirements; a private repository link or imported Figma Code Layer alone does not establish judge access.
