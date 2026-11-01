# Release preparation runbook

Source checkpoint: main `1d42523f7250ea3f58f95115c29efd0d92384f1c` (November 1, 2026, America/Los_Angeles). This guide documents existing commands and outstanding evidence. It is not a completed release sign-off. Agent 1 approves technical accuracy; Jiwoo approves design.

[Release task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) · [Release checklist](RELEASE_CHECKLIST.md) · [Evidence template](templates/release-evidence.md)

## Reproduce the current sample app

Use the existing private repository with authorized access. At its root, record `git rev-parse HEAD` and use Node 24.21.0 / npm 11.19.0, matching CI. A final release must record Agent 1's accepted integrated commit rather than reuse this preparation checkpoint.

```text
node --version
npm --version
npm ci
npm run dev
```

Open the URL Vite prints. For sample mode, leave `VITE_WAYFARE_API_URL` unset in both the shell and Vite environment files. No API server or AI credential is required. Start from a separate browser profile if testing workspace isolation. Sample snapshots persist in IndexedDB, with writes protected by a workspace Web Lock; older localStorage snapshots migrate on mutation. This is separate from connected-mode server storage.

The currently available smoke sequence is load the sample trip, compare/select a Wayfinder plan, reload and confirm selection, then review/save a canonical confirmation through intake. Replaying an import should not duplicate it; unknown policy should remain unknown. Agent 1's merged browser tests cover these flows. TripWallet claim sync, reviewed confirmation, partial/final receipts, duplicate protection and reload are covered by the merged wallet browser test. That test seeds canonical action records because ReRoute is absent; the real recovery/approval-to-wallet journey still awaits integration.

## Optional local connected mode

Agent 1 reports local verification, and the merged browser suite exercises two isolated connected visitors against an in-memory local API with AI disabled. No hosted backend or live AI result is established by these instructions.

In one PowerShell terminal at the repository root:

```powershell
$env:WAYFARE_AI_PROVIDER = "none"
npm run server
```

In a second PowerShell terminal at the repository root:

```powershell
$env:VITE_WAYFARE_API_URL = "http://localhost:8787"
npm run dev
```

The equivalent shell environment settings can be used on other operating systems. Restart the Vite process after changing its configuration. The default API port is 8787 and default allowed browser origins use port 5173. Vite uses a strict port and fails if 5173 is occupied. If you explicitly change the frontend port, align the exact origin in `WAYFARE_ALLOWED_ORIGINS`.

`npm run server` reads the server process environment; it does not automatically load `.env.local`. Vite does load its own environment files. Setting AI provider to `none` deliberately exercises the connected storage/API path without a paid model call. Sample document fallback remains distinct from live extraction.

To return to sample mode, stop Vite, remove `VITE_WAYFARE_API_URL` from that terminal's environment and any Vite environment file, and restart Vite. Browser storage and server workspaces are separate persistence modes.

## Configuration reference

Names/defaults were checked against [server/config.ts](../server/config.ts), [server/node.ts](../server/node.ts), [.env.example](../.env.example) and [playwright.config.ts](../playwright.config.ts).

| Name | Used by | Current default / purpose |
| --- | --- | --- |
| `VITE_WAYFARE_API_URL` | Browser build/dev | Unset selects browser sample mode; set to the API URL for connected mode |
| `PORT` | Server | `8787` |
| `WAYFARE_ALLOWED_ORIGINS` | Server | Exact origins `http://localhost:5173,http://127.0.0.1:5173` |
| `WAYFARE_DATA_DIR` | Server | `.data`; `memory` disables file persistence |
| `WAYFARE_SESSION_TTL_HOURS` | Server | `168`; guest-session lifetime |
| `WAYFARE_SESSION_LIMIT_PER_HOUR` | Server | `20`; session creations per client IP per hour |
| `WAYFARE_EXTRACT_LIMIT_PER_HOUR` | Server | `30`; booking extractions per workspace per hour |
| `WAYFARE_TRUST_PROXY` | Server | Disabled by default; only `1` trusts the first forwarded IP, behind a trusted proxy |
| `WAYFARE_AI_PROVIDER` | Server | `anthropic`; `none` disables the model adapter |
| `ANTHROPIC_API_KEY` / `WAYFARE_ANTHROPIC_API_KEY` | Server only | No default credential; the WayFare-prefixed value takes precedence |
| `WAYFARE_AI_MODEL` | Server | Configured default `claude-opus-5-5`; this name is not evidence of a successful call |
| `WAYFARE_AI_EFFORT` | Server | `medium` |
| `WAYFARE_AI_TIMEOUT_MS` | Server | `60000` |
| `WAYFARE_AI_MAX_INPUT_CHARS` | Server | `20000` |
| `WAYFARE_ANTHROPIC_BASE_URL` | Server | `https://api.anthropic.com` |
| `WAYFARE_MAX_BODY_BYTES` | Server | `512000` |
| `PW_CHANNEL` | Browser checks | `chrome`; an empty value selects installed Playwright Chromium |

Real credentials belong only in the server environment. A configured health response or model name does not prove a successful live extraction; record the actual result, model and request identifier before labeling it live.

## Established verification commands

Run these once on the accepted release commit and record exact outcomes, including skipped/pending cases:

```text
npm ci
npm run typecheck
npm test
npm run build
npm run e2e
node --test coordination/update-dashboard.test.cjs
python3 -m unittest discover -s coordination -p 'test_*.py'
```

On Windows, use an available Python 3 interpreter if `python3` is not installed. Browser checks default to installed Google Chrome and manage three servers: sample Vite on 5174, connected Vite on 5175, and the test API on 8788. The API uses in-memory data, AI provider `none`, and a session limit of 1000 for the test. No separately started API or app secret is required. Avoid unrelated processes on those ports when validating a release, so server reuse cannot pick up the wrong configuration. If using Playwright Chromium instead, follow the repository's `PW_CHANNEL` override and install that browser first. Preserve failures and route feature defects to their feature owner; shared/server/integration defects go to Agent 1.

Dated evidence, not final-release sign-off: the migration handoff records [application run 41301199384](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41301199384) and [coordination run 41301199320](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41301199320) at `c5784df071ba13b8b4d5be20572179e158eb89e6`: install/typecheck/build passed, 128 unit/integration tests passed (1 skipped, 2 todo), 13 browser tests passed (2 skipped), and 5 Node plus 4 Python coordination tests passed. Those remote logs were not reread in this documentation pass. The earlier cloud-onboarding pass in this chat independently passed the application build, 128 unit tests and 13 browser tests at that source checkpoint using Node 24.19.0 and system Chromium. Neither record establishes checks at the newer source checkpoint or an accepted release commit. Replace them with final-commit evidence; skipped ReRoute/full-flow steps do not establish a complete journey.

Main also contains `.figma/make/{install,dev,deploy,deploy-preview}` lifecycle scripts (#31), intended for a static sample-mode Code Layer. They require the Figma platform/tooling and its runtime configuration. Their presence is source evidence only: no successful Code Layer import, deployment, judge access or source-to-runtime alignment was verified in this pass. Do not run a deploy merely to prepare this guide.

## Capability labels at this checkpoint

| Capability | Label | Evidence / limit |
| --- | --- | --- |
| Shell, shared clock and reload persistence | Working sample behavior | Browser workspace uses IndexedDB and Web Locks; sample checks include duplicate imports and reload |
| Wayfinder comparison and selection | Working with simulated travel data | #17/#18 merged; bounded fictional candidates, no live booking/search |
| Intake review/save and duplicate protection | Working with sample extraction | Source-backed review; disputed terms remain unknown |
| Connected API and persistence | Local verification | Owner-reported file persistence; browser tests cover two isolated in-memory workspaces, scoped reset and reload; not hosted |
| Live AI extraction | Unverified | No recorded successful configured model call |
| ReRoute / CancelClock | Pending feature delivery/integration | Kelvin / #6; shell disruption facts alone are not recovery calculations |
| TripWallet cash reconciliation | Working milestone (#25/#27); further #7 acceptance pending | Actual wallet controls cover $400 confirmed, $250 received, $150 outstanding, final receipt, duplicate import, follow-up draft and reload; upstream actions are seeded fixtures |
| Wallet AI and noncash assets | Partial / unverified | Reviewed sample evidence and separate voucher/points displays exist; live wallet AI, executable asset eligibility and remaining asset workflows are not established |
| Real provider booking/cancellation/refund | Simulated boundary | No live provider execution claimed |
| Native editable designs and interim styling | Draft r1 exists and is applied | Native frame map/exports exist; all formal approvals remain pending |
| Running Figma Code Layer | Unverified | Lifecycle scripts exist; the design prototype is not the running app; no deployed runtime/source alignment established |
| Judge access and hosted demo | Unverified | Private source access is not judge access |

Sources: [Agent 1 handoff](handoffs/agent-1.md), [Agent 2 handoff](handoffs/agent-2.md), later [integration reports](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8), and [design approvals](../design/approvals.json). Later merged work and evidence supersede this checkpoint.

## Evidence still needed from owners

| Owner | Required final handoff |
| --- | --- |
| Agent 1 | Integrate delivered ReRoute with the existing wallet milestone; accepted integrated commit; executable demo sequence; complete journey and retry/reload evidence; actual capability labels; technical acceptance and tool-decision notes |
| Kelvin / Agent 4 | ReRoute/CancelClock PR/commit and checks; before/at/after deadline results; approved-action behavior; failure/unknown-policy handling |
| Brian / Agent 5 | Remaining #7 acceptance/asset behavior, feature-owned wallet evidence handler/client wiring and any live AI evidence; current limitations and r1 feature composition. The shared wallet evidence transport and atomic cross-claim allocation seam are already on main (#26/#27) |
| Agent 2 | Any remaining design-revision implementation and feature limitations; current #4 acceptance evidence |
| Jiwoo | Approved design revisions; actual Figma/runtime version and code mapping; judge repository/demo access; confirmed official submission timezone |
| Agent 3 | Assemble the evidence template, run/inspect accepted-commit checks once, route failures and record the release outcome after #8 |

Keep release #9 open until its acceptance evidence exists. Judge-access verification must use the intended judge access path; the owner's signed-in session is insufficient. This preparation does not change repository visibility, invitations, billing or design.
