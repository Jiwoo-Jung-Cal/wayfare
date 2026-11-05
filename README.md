# WayFare — team workspace

Private repository for the round 2 build, coordinated across five development assistants. Wayfinder/intake, ReRoute/CancelClock and TripWallet are integrated. Jiwoo approved **r2-final** on November 3, 2026. [Agent 1's release candidate](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6650056430) is main `b54eb5e3cd19e5faa21d2f4e8eda310e17dc0b93`; final release acceptance remains pending under [#9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9).

**[Open the public sample demo](https://jiwoo-jung-cal.github.io/wayfare/)** · **[10-step walkthrough and hosting/provenance](docs/DEMO.md)**. The Pages workflow verified this candidate's live source SHA. Hosting is working; intended judge access and final deployed-candidate acceptance still require the release checks.

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

[CI PR #11](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/11) completed task #5. [TripWallet integration #27](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/27) merged the cash-wallet milestone, including receipt reconciliation and browser allocation fixes. Browser checks cover sample mode and a local connected API with AI disabled. See the [release runbook](docs/RELEASE_GUIDE.md) for the verified source/CI checkpoint and remaining release requirements.

[Preparation PR #20](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/20) is merged; [merged documentation PR #42](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42) established the release record; the current follow-up adds verification evidence without changing that PR. Current-main application and coordination CI passed. [Agent 1 reports](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6650056430) 184 tests, 36 no-retry browser checks and 20 parity repeats for the replacement handoff; these owner-reported counts are separate from independently checked exact-main CI metadata. PRs #58/#60/#59 and shared UI fixes #62 are merged, so their old blockers are resolved.

The [candidate verification record](docs/releases/b54eb5e-verification.md) now contains direct local walkthrough/390px visual observations, the planning label/reload finding and local favicon 404 routed to owners. The earlier PR42 test race is resolved by #65 and green merged-head/current-candidate CI. Live/judge-path checks remain inaccessible here.

Remaining requirements are Kelvin's r2 review, Brian's evidence/asset follow-up, live-AI verification if claimed, official deadline/submission/access instructions and final accepted-candidate verification. Formal design approval is already recorded. Extraction uses sample documents; provider actions and Google sign-in/calendar sync are simulated; Ask WayFare uses scripted replies. No hosted backend or successful live AI call is established. See [the current evidence and remaining gates](docs/SETUP_STATUS.md). Any later source integration requires updating affected checks and runtime/capability evidence.
