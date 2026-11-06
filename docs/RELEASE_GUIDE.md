# Release preparation runbook

Latest checked source/CI and workflow deployment checkpoint: `ecd5bbc274c932e7467b2d55f8149b2503aebe1a`, checked November 5, 2026 (America/Los_Angeles). Agent1 supplied ecd5bbc after #68/#69; affected evidence is refreshed. Hosting works, r2-final is approved, and #58/#60/#59/#62 are merged. Since `323592a`, #64/#65/#66 and documentation #42 also merged; the replacement changes e2e/server/docs, with identical browser source/build inputs. **Final demo/submission sign-off remains pending under #9.**

[Release #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Candidate handoff #8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6672883600) · [Current demo walkthrough](DEMO.md) · [Checklist](RELEASE_CHECKLIST.md) · [Evidence template](templates/release-evidence.md) · [Architecture/tool decisions](ARCHITECTURE.md)

## Current evidence and remaining requirements

[SETUP_STATUS.md](SETUP_STATUS.md#verified-source-and-ci) records independently checked exact-main application/coordination CI and Pages job/step metadata. The Pages workflow's live provenance check passed; Agent 1 reports `version.json` matched this SHA in sample mode. This container cannot reach `github.io`, so no independent live-site visit is claimed.

Agent 1 reports 184 tests and 37 no-retry browser checks for new candidate ecd5bbc, including production-build `/wayfare/`, desktop/mobile, local-connected and shared UI regressions. Keep these owner-reported counts distinct from exact-main CI metadata. #59 integration and both shared findings (issue keys and mono-input cascade, fixed in #62) are resolved in source. Jiwoo's r2-final approval supersedes r1-pending statements; Kelvin's #55 and Brian's #56 implementation reviews remain separate.

The remaining gates are final accepted-deployed-candidate verification; Kelvin's r2 review; Brian's evidence/asset follow-up or accepted limitations; live-AI proof if claimed; and authoritative deadline/submission/access rules. See the [current gate table](SETUP_STATUS.md#remaining-release-gates) and [judge-link record](SETUP_STATUS.md#deadline-and-judge-links). Preserve Agent 1's newer `docs/DEMO.md` launch, walkthrough and hosting content.

[Agent 3's candidate verification](releases/ecd5bbc-verification.md) records direct local walkthrough/visual passes, the resolved #68/#69 favicon/booked-label findings, remaining Plan product decisions, inaccessible live/judge checks, and the resolved historical PR42 CI race (#65). Earlier direct browser observations are explicitly reused only after input identity was verified; current CI/provenance targets `b54eb5e`. Candidate availability is satisfied; owner findings and final requirements remain.

## Reproduce the sample app

Use an authorized private-repository checkout and record `git rev-parse HEAD`. Agent 1/CI use Node 24.21.0 and npm 11.19.0.

```text
node --version
npm --version
npm ci
npm run dev
```

Open Vite's local URL. Leave `VITE_WAYFARE_API_URL` unset in both the shell and Vite environment files for sample mode; no API server or AI credential is required. Browser workspaces persist in IndexedDB with a workspace Web Lock. Use a separate browser profile to check workspace isolation.

The [10-step demo](DEMO.md#walkthrough-about-5-minutes) starts with the reference NY Trip already booked and BL 214 cancelled (simulated). Returning empty workspaces enter it once; **Show the reference scenario** restores it. Follow Overview → Plan → Import → Itinerary → ReRoute → Approve → TripWallet/receipts → Ask WayFare → Reload. The hotel cutoff drops sample recovery from $820 to $620; $400 claim/$250 receipt leaves $150, and the final receipt resolves it. Provider actions and assistant replies remain simulated/scripted.

The [public Pages sample app](https://jiwoo-jung-cal.github.io/wayfare/) redeploys on main pushes. Record its actual `version.json` source, dirty flag, mode and build time during final verification; do not assume a moving URL still serves this checkpoint. The older Figma Code Layer `24:1182` was imported from `5249cb7` and is not this candidate. Vercel is prepared by #63 but has no deployment; it is optional while Pages works. This documentation pass changes no hosting configuration.

## Optional local connected mode

Connected API/persistence are tested locally and in CI with AI disabled; they are not hosted. In one PowerShell terminal:

```powershell
$env:WAYFARE_AI_PROVIDER = "none"
npm run server
```

In another:

```powershell
$env:VITE_WAYFARE_API_URL = "http://localhost:8787"
npm run dev
```

Use equivalent environment settings on other shells. Restart Vite after configuration changes. Its default strict port is 5173; align any changed frontend origin with `WAYFARE_ALLOWED_ORIGINS`. The server reads its process environment, not `.env.local`; Vite loads its own environment files. Provider `none` exercises storage/API without a model call. To return to sample mode, remove the API URL from the shell and Vite environment files and restart. Browser and server workspaces are separate.

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

Reuse successful evidence for its actual target. At final acceptance, run only outstanding checks or those justified by source/runtime changes; do not repeat successful application suites merely for documentation edits.

```text
npm ci
npm run typecheck
npm test
npm run build
npm run e2e
node --test coordination/update-dashboard.test.cjs
python3 -m unittest discover -s coordination -p 'test_*.py'
```

Browser tests default to Google Chrome. `PW_CHANNEL=` selects installed Playwright Chromium; install it first if using that option. Playwright manages sample Vite 5174, production-build preview 5176 under `/wayfare/`, connected Vite 5175 and the in-memory API 8788. AI is disabled for these tests. Avoid unrelated processes on these ports. CI normally allows one retry; Agent 1's reported 36-browser local result explicitly disabled retries. Record retries/flaky/skipped/todo results accurately rather than inferring them from a green conclusion.

`npm run smoke:live-ai` is an additional server-only command, not evidence of a successful live call. [Agent 1's live-AI readiness note](handoffs/agent-1.md#live-ai-readiness-booking-extraction) describes secure configuration and the actual extraction check; missing configuration exits 2. This bounded pass does not run a paid model call or request keys. Before a live claim, record a successful result/model/request identifier on the intended target and verify any connected runtime; otherwise retain sample/unverified labels.

## Execute the accepted-version pass

1. Reuse supplied-candidate evidence with its actual identity; latest integration `ecd5bbc274c932e7467b2d55f8149b2503aebe1a` refreshes #68/#69 and Pages provenance. Use the unchanged sample-mode URL and walkthrough. Verification is authorized and has proceeded; do not wait for another candidate handoff. Check whether later integration/deployment replaced it, and obtain final technical acceptance after the findings/required checks.
2. Record current deployment provenance and compare it with exact-target source/CI evidence. Review applicable logs and owner evidence; perform outstanding live walkthrough, visual and capability checks. Preserve the approved r2-final design record while collecting Kelvin/Brian implementation reviews.
3. Resolve Brian's outstanding evidence/asset scope through owner PR/commit/checks or explicit accepted limitations. Any resulting source change requires a new full SHA and refreshed affected checks, runtime mapping and capability evidence. #59/#62 no longer need integration fixes.
4. Confirm the official deadline/year/timezone/source and submission rules. Team records say November 10, 2026, 11:59 PM; no official timezone is established. Verify required repository, demo, recording, Figma and form links only as required by those instructions, using the intended judge path.
5. Fill the evidence record with actual targets, commands, outcomes and log links; distinguish passed/failed/skipped/todo/unrun. Keep #9 open and final evidence NOT VERIFIED until required acceptance exists.

For failures, record command/scenario, useful error excerpt, tested SHA and run/log link. Route Wayfinder/intake to Agent 2/#4, ReRoute to Kelvin/#6, wallet to Brian/#7 and shared/backend/integration to Agent 1/#8. Agent 3 repairs only owned coordination/CI/documentation defects. Technical acceptance/merging belongs to Agent 1/eligible reviewers; Jiwoo owns design. Pause after the bounded release-record update, without application debugging or idle monitoring.
