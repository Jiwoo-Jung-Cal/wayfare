# Release preparation runbook

Source checkpoint: main `d7b0fd16cddf42012fefddb3d716a0978850fbb2` (checked November 2, 2026, America/Los_Angeles). Preparation PR #20 is merged; final submission verification is pending under reopened #9. This guide is not release sign-off. Agent 1 approves technical accuracy; Jiwoo approves design.

[Release task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) · [Release checklist](RELEASE_CHECKLIST.md) · [Evidence template](templates/release-evidence.md) · [Architecture and tool decisions](ARCHITECTURE.md)

## Gate for final verification

ReRoute exists in [draft PR #37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37), head `b69d02e1ba32646a2a9f6d3c7661f51a56faf2a9`. Its feature-owned browser check drives approval through automatic wallet claims and hotel receipt reconciliation without seeded ActionRecords. That branch's passing CI is not acceptance of an integrated release. The remaining [atomic-precondition request](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6570629325) belongs to Agent 1: policy/clock changes between the final read and action write must be checked inside the transaction, while successful idempotent replays remain supported.

Before running final release checks, obtain Agent 1's explicit acceptance link, full integrated commit SHA, executable complete-demo script, actual demo/runtime source mapping and known limitations under #8. None is supplied by merging the preparation guide. Record the official submission deadline/timezone and required judge-link/access rules from the organizer's instructions; the current [submission checklist](SETUP_STATUS.md#deadline-and-judge-links) marks those inputs unresolved.

## Reproduce the current sample app

Use the existing private repository with authorized access. At its root, record `git rev-parse HEAD` and use Node 24.21.0 / npm 11.19.0, matching CI. A final release must record Agent 1's accepted integrated commit rather than reuse this preparation checkpoint.

```text
node --version
npm --version
npm ci
npm run dev
```

Open the URL Vite prints. For sample mode, leave `VITE_WAYFARE_API_URL` unset in both the shell and Vite environment files. No API server or AI credential is required. Start from a separate browser profile if testing workspace isolation. Sample snapshots persist in IndexedDB, with writes protected by a workspace Web Lock; older localStorage snapshots migrate on mutation. This is separate from connected-mode server storage.

The current main smoke sequence is load the sample trip, compare/select a Wayfinder plan, reload and confirm selection, then review/save a canonical confirmation through intake. Replaying an import should not duplicate it; unknown policy should remain unknown. The merged wallet browser test covers claim sync, reviewed confirmation, partial/final receipts, duplicate protection and reload using canonical action fixtures. PR #37 adds a real-control ReRoute-to-wallet check on its own branch; the atomic contract and accepted shared journey still await integration.

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

Expired sessions return 401 and the app offers “Start a new guest session”. Session/extraction limits return 429 with `Retry-After`.

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

Current checkpoint evidence, not final-release sign-off: main `d7b0fd16cddf42012fefddb3d716a0978850fbb2` has successful [Application run 41383324098](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41383324098) and [Coordination run 41383324183](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41383324183). Preparation PR #20's final head `7803027` also completed its application/coordination checks successfully. The API confirms the current check results; no raw application logs were reread or application suites rerun in this documentation pass. PR #37's [branch CI](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41400613022) is green, but its owner-reported counts and real-control journey remain branch evidence until Agent 1 accepts the integrated commit. Preserve remaining shared skips/todos explicitly; do not use any of these records as final-release results.

Main includes `.figma/make/{install,dev,deploy,deploy-preview}` lifecycle scripts (#31) for a static sample-mode Code Layer. [Agent 1 reports a successful import](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6564005638) at source `5249cb7` into [Code Layer `24:1182`](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182). The scripts are now merged; successful import is distinct from a running preview. The latest owner report still marks the preview NOT VERIFIED and asks a signed-in human to open it. Actual preview/runtime-to-source alignment and judge access remain unverified. The native design prototype is a separate surface. Do not run a deployment merely to prepare this guide.

Fonts are bundled through the pinned `@fontsource/inter` and `@fontsource/roboto-mono` packages; the app needs no network font service at runtime. [Architecture](ARCHITECTURE.md) records the technical rationale and Agent 1's static-build check at an earlier checkpoint, served under `/wayfare/demo/` without rewrites.

## Capability labels at this checkpoint

| Capability | Label | Evidence / limit |
| --- | --- | --- |
| Shell, shared clock and reload persistence | Working sample behavior | Browser workspace uses IndexedDB and Web Locks; sample checks include duplicate imports and reload |
| Wayfinder comparison and selection | Working with simulated travel data | #17/#18 merged; bounded fictional candidates, no live booking/search |
| Intake review/save and duplicate protection | Working with sample extraction | Source-backed review; disputed terms remain unknown |
| Connected API and persistence | Browser and CI verified, local only | Owner-reported file persistence; browser tests cover two isolated in-memory workspaces, scoped reset and reload; not hosted |
| Live AI extraction | Unverified | No recorded successful configured model call |
| ReRoute / CancelClock | Implemented in draft #37; final contract/integration pending | Kelvin's real-control journey exists; Agent 1's atomic policy/clock preconditions and accepted #8 release commit are outstanding |
| TripWallet cash reconciliation | Working milestone (#25/#27); further #7 acceptance pending | Actual wallet controls cover $400 confirmed, $250 received, $150 outstanding, final receipt, duplicate import, follow-up draft and reload; upstream actions are seeded fixtures |
| Wallet AI and noncash assets | Partial / unverified | Reviewed sample evidence and separate voucher/points displays exist; live wallet AI, executable asset eligibility and remaining asset workflows are not established |
| Real provider booking/cancellation/refund | Simulated boundary | No live provider execution claimed |
| Native editable designs and interim styling | Draft r1 exists and is applied | Native frame map/exports exist; all formal approvals remain pending |
| Figma Code Layer | Imported per Agent 1; running preview unverified | Code Layer `24:1182`, import source `5249cb7`; signed-in preview confirmation and actual runtime/source alignment remain outstanding |
| Judge access and hosted demo | Unverified | Private source access is not judge access |

Sources: [Agent 1 handoff](handoffs/agent-1.md), [Agent 2 handoff](handoffs/agent-2.md), later [integration reports](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8), and [design approvals](../design/approvals.json). Later merged work and evidence supersede this checkpoint.

## Evidence still needed from owners

| Owner | Required final handoff |
| --- | --- |
| Agent 1 | Publish atomic action preconditions, review/integrate #37 with the wallet milestone, and supply the accepted full commit/demo, complete shared journey and retry/reload/race evidence, capability labels and technical acceptance |
| Kelvin / Agent 4 | Integrate Agent 1's contract and race regression in #37, retain policy/deadline/approval/retry checks and obtain formal visual acceptance; implementation is already published |
| Brian / Agent 5 | Remaining #7 acceptance/asset behavior, feature-owned wallet evidence handler/client wiring and any live AI evidence; current limitations and r1 feature composition. The shared wallet evidence transport and atomic cross-claim allocation seam are already on main (#26/#27) |
| Agent 2 | Any remaining design-revision implementation and feature limitations; current #4 acceptance evidence |
| Jiwoo | Approved design revisions; actual Figma/runtime version and code mapping; judge repository/demo access; confirmed official submission timezone |
| Agent 3 | Assemble the evidence template, run/inspect accepted-commit checks once, route failures and record the release outcome after #8 |

Keep release #9 open until its acceptance evidence exists. Judge-access verification must use the intended judge access path; the owner's signed-in session is insufficient. This preparation does not change repository visibility, invitations, billing or design.

## Execute the accepted-commit pass

Use [the evidence template](templates/release-evidence.md) to create the actual release record only after the acceptance inputs exist. Verify the checked-out SHA and target/runtime before each recorded suite. Inspect same-commit CI logs when available, then run required checks that remain unexecuted; record commands, exit status, actual test counts, skips/todos and run/log links. Do not copy old green counts. The shared approval-to-wallet scenarios must execute rather than remain placeholders. Verify the atomic policy/clock race regression, successful replays, partial-failure retry, deadline boundary, duplicate protection and reload at that accepted source.

Check every required judge link through the organizer's intended access path, including the actual runnable demo and recording if required. An authenticated owner's repository read or Figma editor session is insufficient. Record the official timezone/source and the demo/runtime's exact source version. Exercise live AI only if it will be claimed as live; otherwise retain explicit sample/simulated/unconfigured labels.

For a failed check, record the command/scenario, short useful error, tested commit and run/log link. Route ReRoute failures to Kelvin/#6, Wayfinder/intake to Agent 2/#4, wallet to Brian/#7, and shared/backend/integration failures to Agent 1/#8. Agent 3 fixes only coordination/CI/documentation defects in its scope; it does not bypass failures, disable assertions or take over feature debugging. Leave #9 blocked until required failures are resolved and acceptance evidence is complete.
