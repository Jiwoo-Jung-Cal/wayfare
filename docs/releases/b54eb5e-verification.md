# Replacement candidate b54eb5e — release verification

Checked November 4, 2026 (America/Los_Angeles). **Final release: NOT VERIFIED.** Agent 1 explicitly supplied `b54eb5e3cd19e5faa21d2f4e8eda310e17dc0b93` in [#8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6650056430), replacing `323592a` while Agent 3's verification was running. Candidate availability is satisfied; verification does not wait for another handoff.

[Task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Merged PR #42, preserved](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42) · [Unchanged demo instructions](../DEMO.md) · [Release checklist](../RELEASE_CHECKLIST.md) · [Direct 323592a observations/screenshots](323592a-verification.md) · [Browser input identity](b54eb5e-browser-inputs.json)

## Refreshed exact-source evidence

| Evidence | Result at full replacement SHA | Basis |
| --- | --- | --- |
| Source | Fetched `b54eb5e3cd19e5faa21d2f4e8eda310e17dc0b93`; all imported Git objects hash-verified and connectivity passed | Agent 3 direct Git/API checks |
| Application | [Run 41970222123](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41970222123) succeeded | Independently read exact-SHA metadata; full suite not repeated by Agent 3 |
| Coordination | [Run 41970222120](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41970222120) succeeded | Independently read exact-SHA metadata |
| Pages | [Run 41970222219, #26](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41970222219) build/provenance/deploy and live-source-check steps succeeded | Workflow evidence independently read; not Agent 3's direct live-site observation |
| Owner results | 184 tests, 36 no-retry browser checks, 20 parity repeats, Node 24.21.0/Chrome | Agent 1's report; not independently recounted |
| Vercel | No deployment; only token readiness step ran and deploy steps skipped | Owner report. Pages remains the working sample host; optional Vercel is not a Pages blocker |

## Reuse of direct browser observations

Agent 3 directly rebuilt and exercised `323592a` locally under `/wayfare/` with Node 24.19.0/npm 11.9.0/Chromium 154.0.8037.57. The [original record](323592a-verification.md) retains actual identity, dependency limitations, raw outcomes and six screenshots. Those observations are not relabeled as a fresh execution of `b54eb5e`.

After fetching the replacement, Agent 3 verified identical Git objects for:

- The entire `src/` tree: `1d00b28b5b7f3fb794ec03b4d3e69c5bc6e215a7`.
- `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json` and `.env.example`; no tracked `public/` directory in either version.
- `docs/DEMO.md`: blob `e546d4510bc00ca727cbaee5a480f8c22f678db4`.

The [identity record](b54eb5e-browser-inputs.json) contains each hash. Differences are release/handoff documentation, e2e specs and the server adapter/tests. This supports reuse of the sample-browser walkthrough and visual observations for unchanged browser code. It does not prove byte-identical built artifacts, a direct current live-site walkthrough, a new server/live-AI run or intended judge access. The new application/server checks and Pages provenance are refreshed above.

**Applicable local passes:** reference Overview; three plans and preference reranking; budget/unknown-price blocking; sample intake review/duplicate guard and explicit non-sample AI refusal; itinerary/day highlight/Calendar template href; $820 before/$620 at cutoff; four acknowledged simulated cancellations and automatic claims; $400 hotel claim with $250+$150 receipts; receipt/action reload and duplicate protection; separate credits/points; scripted assistant/credential-free Google demo labels; six pages with no horizontal overflow at 390px and loaded fonts. Selected desktop/390px layouts were structurally compared to approved r2 exports. This is not final human visual approval, exhaustive visual coverage or proof of planning-state persistence.

## Direct replacement checks — November 5

Main and the supplied replacement remain `b54eb5e3cd19e5faa21d2f4e8eda310e17dc0b93`; no later source was inferred. PR #67's **prior head `615361b`** completed [application](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41974443378), [coordination](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41974443329) and [dashboard](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41974443333) successfully. This closes the earlier pending-check snapshot for that head, not final release sign-off or a future head's check status.

The outstanding local checks below were run directly on a new clean tracked `b54eb5e` worktree/build, rather than relabeling the old `323592a` run. `version.json` and page meta name the full replacement SHA, `dirty: false`, `mode: sample`. Runtime remains Node 24.19.0/npm 11.9.0/Chromium 154.0.8037.57; the previous dependency caveat still applies. A production build enabled these checks; successful full suites/clean install were not repeated. [Raw attempts, follow-ups, provenance and screenshot hashes](b54eb5e/focused-checks-2026-11-05.json) retain the actual outcomes.

| Outstanding observation | Own result |
| --- | --- |
| Unknown price | PASS: after resetting this profile to planning, saved a reviewed sample hotel with blank price and uncertain policy. It displayed Unknown, not $0.00, after reload |
| Unknown policy | PASS: a separate policy-only sample saved with “Policy still needs review”; after reload the Itinerary details drawer explicitly shows **Refund rule: unknown**, with paid amount $450 unchanged. No storage/model internals inspected |
| Browser profile isolation | PASS: profile A had one saved booking; profile B independently had four reference bookings. Clearing/reloading A left No trips yet, while reloading B retained all four. This is sample-browser isolation, not a hosted multiuser API result |
| After cutoff | PASS: cancel recovery is $820 before the cutoff, $620 at it and **$620 at `2026-11-20T00:00:00Z`**, one hour after the hotel cutoff. No provider action was approved in this check |
| Dark theme | PASS after paint settles: desktop 1440px and narrow 390px Overview, both fonts loaded, no narrow horizontal overflow, and Dark mode remains selected after reload. Body changes from RGB255/255/255 with RGB34/34/34 text to RGB18/19/20 with RGB241/241/241 text. Structural review against the approved dark desktop export; no exhaustive visual/contrast or final human approval claim |

[Dark desktop observation](b54eb5e/overview-dark-desktop.png) · [390px observation](b54eb5e/overview-dark-390.png) · [Approved dark desktop reference](../../design/exports/dashboard/r2-overview-desktop-dark.png).

The first dark verifier sampled background colour immediately after the button state changed and **failed** while the paint was still light/mid-transition. That raw failed attempt and partial screenshot stay in the local audit, with its error in the committed JSON. The follow-up waited for finite colour transitions, captured the settled view and passed; this is a verifier timing correction, not an application fix. Zero page exceptions were observed; the known `/favicon.ico` 404/console warning remains open for owner disposition and is not filtered into a clean-console pass.

Fresh Pages and `version.json` attempts again failed at proxy CONNECT403, before an origin response. The current configuration lists API-only destinations; environment status reports enforcement state **unknown**, so no readiness/enforcement claim is made from that metadata. Actual request failures establish the access limitation. No visibility, network, access, deployment or Figma settings changed. Official submission/timezone/access requirements and owner inputs have no new authoritative evidence.

## Failures and dispositions

| Item | Current disposition / owner |
| --- | --- |
| Plan labels and post-reload display | **OPEN, Agent 2/#4:** “Plan saved. No reservation was made” contradicts BOOKED/View your trip; after reload Plan displays default budget/options rather than the saved display. Itinerary has zero bookings. Underlying selected-plan storage was not inspected; no backend-data-loss claim. [Reproduction and owner route](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6650364945), [captured state](323592a/planning-finding.png). Identical browser inputs make the finding applicable to this replacement |
| Local strict console-clean assertion | **OPEN disposition, Agent 1/#8:** failed on `GET /favicon.ico` 404 from the local static server, with zero page exceptions/failed network requests. Live impact unverified; [route](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6649878678) |
| Old PR42 `dfdbd35` browser failure | **RESOLVED as an active gate:** Agent 1 identifies async demo-control writes racing navigation; #65 merged. Final PR42 head `30c80e3289073662bfa61090b51bb92bad26cf23` has [successful application CI](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41969712663). #42 merged at this replacement source. Root-cause/20-repeat details are owner-reported; merge/check conclusions independently verified. Retain the old failed run as history; do not conflate it with the open Plan finding |

Agent 3 makes no product, schema, package, feature-test or backend edits. App findings stay with their owners.

## Changed server evidence and honest AI labels

Merged #66 changes adapter truncation/error mapping and adds SDK wire-level tests against a local provider stand-in. Agent 1 reports four sample confirmations returning `live` with zero differences in that stand-in path, and coverage of request fields/refusal/truncation/401/429/529/timeouts. This verifies the test path, not a live provider call. Reuse the new exact-source CI result; keep detailed local counts attributed to the owner.

**Live AI remains UNVERIFIED if claimed.** No server key/hosted backend is evidenced; Pages remains sample-only. `npm run smoke:live-ai` without server configuration exits 2 per Agent 1. Successful fake-provider tests, a configured model name or the word `live` in synthetic responses do not establish a real successful model request. Any real claim needs actual result/model/request evidence on the intended server/connected runtime. No keys, backend deployment or paid call were requested in this pass.

## Genuine remaining gates

- Agent 2's Plan finding/review disposition, Kelvin's #55 r2 review on #6, and Brian's #56 r2 review/#7 evidence/asset/manual-browser follow-up or accepted limitations. Formal Jiwoo r2-final design approval is already complete.
- Direct live walkthrough/current provenance and intended judge access remain **unverified here**: Pages and `version.json` requests fail at proxy CONNECT 403 with API-only configuration and directly observed proxy denial. This is an environment access denial, not an application-origin failure. Authenticated managed private-repo API reads are not anonymous/intended-judge proof. Pages admin-read permission and artifact/log download destinations are also inaccessible; no settings or permissions changed.
- Official Round 2 deadline timezone/source, submission portal, required links/formats, recording and public/private access rules are unconfirmed. Team time remains November 10, 2026, 11:59 PM without an inferred official timezone. No new official-source review or submission receipt is claimed.
- Actual live-AI proof only if claimed. Sample extraction, simulated provider/Google dialogs and scripted assistant labels remain accurate.
- Final technical/visual acceptance after owner findings and required checks. Old Figma Code Layer `24:1182` is source `5249cb7`, separate from either candidate; runtime/access/sync unverified if required by submission scope.

Keep #9 open and final sign-off NOT VERIFIED. Merged #42 is preserved; this record is a follow-up because its publication guard detected concurrent merge before writing. Any later source/deployment change requires refreshing affected evidence and recording the full new identity; do not copy old provenance/counts onto it.
