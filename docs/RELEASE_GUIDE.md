# Release preparation runbook

Source/CI checkpoint: main `17623fc12bd60c33b5a4927562469dbbcb660857` (checked November 3, 2026, America/Los_Angeles). ReRoute #37 and integration #39 are merged. Final demo/submission verification remains pending under #9. Agent 1 owns technical acceptance; Jiwoo owns design approval.

[Release task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Integration #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8) · [Release checklist](RELEASE_CHECKLIST.md) · [Evidence template](templates/release-evidence.md) · [Architecture and tool decisions](ARCHITECTURE.md)

## Source evidence and remaining release gate

The merged sample-mode journey is working at the recorded source checkpoint. Kelvin's path-relative navigation fixes and atomic-precondition adoption are included through [#37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37), and [#39](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/39) merges that feature with the real shared approval-to-wallet journeys. Those are resolved code/integration items, not pending blockers.

[SETUP_STATUS.md](SETUP_STATUS.md#verified-source-and-ci) records independently checked GitHub merge/tree/check metadata and separately attributes the 174-test/20-browser counts to [Agent 1's report](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6596944284). Reuse applicable same-source evidence; do not repeat successful application suites without a reason.

The outstanding package is Agent 1's accepted demo/source: working demo URL, executable complete-demo script, actual runtime/source version and operating mode. Formal design approval, capability labels (sample versus live AI), intended judge access, official deadline/timezone and submission rules are still required. [Brian's #7 milestone](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7) also remains outstanding. A later wallet or other integration changes the source checkpoint and requires updating affected CI, capability and runtime evidence before final acceptance. The [deadline/judge-link record](SETUP_STATUS.md#deadline-and-judge-links) retains the recorded organizer-page review and missing authoritative instructions.

## Reproduce the current sample app

Use the existing private repository with authorized access. At its root, record `git rev-parse HEAD` and use Node 24.21.0 / npm 11.19.0, matching CI. A final release must record Agent 1's accepted integrated commit rather than reuse this preparation checkpoint.

```text
node --version
npm --version
npm ci
npm run dev
```

Open the URL Vite prints. For sample mode, leave `VITE_WAYFARE_API_URL` unset in both the shell and Vite environment files. No API server or AI credential is required. Start from a separate browser profile if testing workspace isolation. Sample snapshots persist in IndexedDB, with writes protected by a workspace Web Lock; older localStorage snapshots migrate on mutation. This is separate from connected-mode server storage.

Agent 1's source/CI report covers the integrated sample flow: import/review bookings, simulate disruption, approve recovery in ReRoute, create claims through shell sync, and reconcile through TripWallet/dashboard. The cases include $820 expected recovery/$400 hotel before the cutoff and $620/$200 exactly at it, the actual ReRoute wallet-link click, atomic policy/clock races, reload, idempotency and duplicate receipts. These are source-level test results, not a verification of the eventual judge-facing runtime. Use the accepted complete-demo script and matching runtime for the remaining release checks.

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

Verified checkpoint: main `17623fc12bd60c33b5a4927562469dbbcb660857` has successful [Application run 41568454043](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41568454043) and [Coordination run 41568454787](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41568454787). The API verifies those exact-source check conclusions and that main's tree equals reviewed #39 head `3c3e195271e43b1f7a5f5f471056c3e31f2c6a8b`. Agent 1 reports 174 tests passed (0 skipped, 0 todo), 20 browser checks passed (0 skipped), typecheck/build success and repeated no-retry journey runs on that reviewed source. Counts/runtime details are owner-reported; this documentation pass did not rerun or independently recount the application suites. The old shared placeholders and Kelvin-fix blockers are resolved.

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
| ReRoute / CancelClock | Working integrated sample behavior | #37/#39 merged; path-relative navigation, preconditions, races and real approval-to-wallet journey covered in the recorded source evidence |
| TripWallet cash reconciliation | Working milestone (#25/#27); further #7 acceptance pending | Actual wallet controls cover $400 confirmed, $250 received, $150 outstanding, final receipt, duplicate import, follow-up draft and reload; the shared journey now drives actual ReRoute approval into wallet claims |
| Wallet AI and noncash assets | Partial / unverified | Reviewed sample evidence and separate voucher/points displays exist; live wallet AI, executable asset eligibility and remaining asset workflows are not established |
| Real provider booking/cancellation/refund | Simulated boundary | No live provider execution claimed |
| Native editable designs and interim styling | Draft r1 exists and is applied | Native frame map/exports exist; all formal approvals remain pending |
| Figma Code Layer | Imported per Agent 1; running preview unverified | Code Layer `24:1182`, import source `5249cb7`; signed-in preview confirmation and actual runtime/source alignment remain outstanding |
| Judge access and hosted demo | Unverified | Private source access is not judge access |

Sources: [Agent 1 handoff](handoffs/agent-1.md), [Agent 2 handoff](handoffs/agent-2.md), later [integration reports](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8), and [design approvals](../design/approvals.json). Later merged work and evidence supersede this checkpoint.

## Evidence still needed from owners

| Owner | Required final handoff |
| --- | --- |
| Agent 1 | Supply the accepted full commit/demo, complete shared journey and retry/reload/race evidence, capability labels and technical acceptance |
| Kelvin / Agent 4 | Code fixes and integration are resolved. Supply current capability/limitation and design-acceptance inputs as applicable; do not repeat the old navigation/adoption blocker |
| Brian / Agent 5 | Outstanding #7 evidence schemas/handler/review milestone, remaining assets and acceptance inputs, with actual PR/commit/checks or an explicitly accepted limitation. Preserve the merged ledger/shared seams. Any new integration requires a new source checkpoint and affected evidence updates |
| Agent 2 | Any remaining design-revision implementation and feature limitations; current #4 acceptance evidence |
| Jiwoo | Approved design revisions; actual Figma/runtime version and code mapping; judge repository/demo access; confirmed official submission timezone |
| Agent 3 | Assemble the evidence template, run/inspect accepted-commit checks once, route failures and record the release outcome after #8 |

Keep release #9 open until its acceptance evidence exists. Judge-access verification must use the intended judge access path; the owner's signed-in session is insufficient. This preparation does not change repository visibility, invitations, billing or design.

## Execute the accepted-commit pass

Once Agent 1 supplies the accepted demo/source, use [the evidence template](templates/release-evidence.md) for the actual release record. Confirm the accepted SHA and runtime match the recorded source evidence. Reuse verified same-source CI, inspect the required logs/owner evidence, and run only checks that remain outstanding or are justified by a changed source/runtime. Record commands, target, exit status, actual counts and run/log links, keeping passed/failed/skipped/todo/unrun outcomes distinct. The navigation, precondition/race and shared approval-to-wallet source checks are already covered at `17623fc`; verify their applicability to the accepted version rather than treating the old code blockers as open.

If #7 or any later integration changes source, record the new full SHA and affected behavior, inspect or run the relevant checks, and refresh capability labels and runtime/source mapping. Do not carry the 174/20 counts onto a different commit without supporting evidence.

Check every required judge link through the organizer's intended access path, including the actual runnable demo and recording if required. An authenticated owner's repository read or Figma editor session is insufficient. Record the official timezone/source and the demo/runtime's exact source version. Exercise live AI only if it will be claimed as live; otherwise retain explicit sample/simulated/unconfigured labels.

For a failed check, record the command/scenario, short useful error, tested commit and run/log link. Route ReRoute failures to Kelvin/#6, Wayfinder/intake to Agent 2/#4, wallet to Brian/#7, and shared/backend/integration failures to Agent 1/#8. Agent 3 fixes only coordination/CI/documentation defects in its scope; it does not bypass failures, disable assertions or take over feature debugging. Leave #9 blocked until required failures are resolved and acceptance evidence is complete.
