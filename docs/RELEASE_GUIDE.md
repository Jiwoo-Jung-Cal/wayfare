# Release preparation runbook

Preparation checkpoint: main `96be8039cfc242619e7cd0661eb036fab7b3aea3` (October 31, 2026, Pacific). This guide documents existing commands and outstanding evidence. It is not a completed release sign-off. Agent 1 approves technical accuracy; Jiwoo approves design.

[Release task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) · [Release checklist](RELEASE_CHECKLIST.md) · [Evidence template](templates/release-evidence.md)

## Reproduce the current sample app

Use the existing private repository with authorized access. At its root, record `git rev-parse HEAD` and use Node 24.21.0 / npm 11.19.0, matching CI. A final release must record Agent 1's accepted integrated commit rather than reuse this preparation checkpoint.

```text
node --version
npm --version
npm ci
npm run dev
```

Open the URL Vite prints. For sample mode, leave `VITE_WAYFARE_API_URL` unset in both the shell and Vite environment files. No API server or AI credential is required. Start from a separate browser profile if testing workspace isolation; browser storage persists across reloads.

The currently available smoke sequence is load the sample trip, compare/select a Wayfinder plan, reload and confirm selection, then review/save a canonical confirmation through intake. Replaying an import should not duplicate it; unknown policy should remain unknown. Agent 1's merged browser tests cover these flows. The ReRoute-to-TripWallet journey still awaits integration.

## Optional local connected mode

This path is reported locally verified by Agent 1; no hosted backend or live AI result is established by these instructions.

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

The equivalent shell environment settings can be used on other operating systems. Restart the Vite process after changing its configuration. The default API port is 8787 and default allowed browser origins use port 5173. If Vite selects another port, Agent 1 must align the exact origin in `WAYFARE_ALLOWED_ORIGINS`.

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

On Windows, use an available Python 3 interpreter if `python3` is not installed. Browser checks default to installed Google Chrome and start their own Vite server on port 5174 in sample mode. They do not need the optional API server. If using Playwright Chromium instead, follow the repository's `PW_CHANNEL` override and install that browser first. Preserve failures and route feature defects to their feature owner; shared/server/integration defects go to Agent 1.

Checkpoint evidence at `96be803`: [main application run](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41260960403) passed install/typecheck/build, 101 unit/integration tests passed (2 skipped, 3 todo), and 9 browser tests passed (3 skipped). [Main coordination run](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41260960371) passed. These counts must be replaced with final-commit evidence, and skipped feature steps do not establish a complete journey.

## Capability labels at this checkpoint

| Capability | Label | Evidence / limit |
| --- | --- | --- |
| Shell, shared clock and reload persistence | Working sample behavior | Agent 1 and merged browser checks; separate browser workspace |
| Wayfinder comparison and selection | Working with simulated travel data | #17/#18 merged; bounded fictional candidates, no live booking/search |
| Intake review/save and duplicate protection | Working with sample extraction | Source-backed review; disputed terms remain unknown |
| Connected API and file persistence | Owner-reported local verification | Agent 1's handoff; not a hosted service |
| Live AI extraction | Unverified | No recorded successful configured model call |
| ReRoute / CancelClock | Pending feature delivery/integration | Kelvin / #6; shell disruption facts alone are not recovery calculations |
| TripWallet / reconciliation | Pending feature delivery/integration | Brian / #7; claim notices alone are not a completed ledger |
| Real provider booking/cancellation/refund | Simulated boundary | No live provider execution claimed |
| Native designs and Figma working layer | Pending / unverified | Design approvals pending; runtime and source commit not aligned by this guide |
| Judge access and hosted demo | Unverified | Private source access is not judge access |

Sources: [Agent 1 handoff](handoffs/agent-1.md), [Agent 2 handoff](handoffs/agent-2.md), later [integration reports](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8), and [design approvals](../design/approvals.json). Later merged work and evidence supersede this checkpoint.

## Evidence still needed from owners

| Owner | Required final handoff |
| --- | --- |
| Agent 1 | Accepted integrated commit; executable demo sequence; complete journey and retry/reload evidence; actual capability labels; technical acceptance and tool-decision notes |
| Kelvin / Agent 4 | ReRoute/CancelClock PR/commit and checks; before/at/after deadline results; approved-action behavior; failure/unknown-policy handling |
| Brian / Agent 5 | TripWallet PR/commit and checks; idempotent action-to-claim sync; partial/final receipt reconciliation; separate cash/credit/points results |
| Agent 2 | Any remaining design-revision implementation and feature limitations; current #4 acceptance evidence |
| Jiwoo | Approved design revisions; actual Figma/runtime version and code mapping; judge repository/demo access; confirmed official submission timezone |
| Agent 3 | Assemble the evidence template, run/inspect accepted-commit checks once, route failures and record the release outcome after #8 |

Keep release #9 open until its acceptance evidence exists. Judge-access verification must use the intended judge access path; the owner's signed-in session is insufficient. This preparation does not change repository visibility, invitations, billing or design.
