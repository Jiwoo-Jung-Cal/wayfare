# Candidate 323592a — release verification

Checked November 4, 2026 (America/Los_Angeles). **Final release: NOT VERIFIED.** Agent 1 explicitly supplied `323592aaa6d76f77a0b22eb79b0e269ae8455d93` for verification in [#8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6628324849). Candidate availability is satisfied; this pass proceeds with that source rather than waiting for another handoff.

[Task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Existing PR #42](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42) · [Demo instructions](../DEMO.md) · [Release checklist](../RELEASE_CHECKLIST.md) · [Machine-readable observations](323592a/observations.json)

This source is now superseded by [replacement `b54eb5e` and its refreshed evidence](b54eb5e-verification.md). The direct observations below were run on `323592a`; browser input identity is verified separately. PR #42 merged while this record was being assembled; it is preserved, and publication is through a follow-up. The earlier PR42 CI race is now resolved by #65 and green merged-head/replacement checks.

## Evidence boundaries

| Basis | Actual target and outcome |
| --- | --- |
| Agent 3 direct source/build | Clean tracked source in detached candidate worktree; `npm run build` passed to enable the outstanding walkthrough. Local Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57. The full application suite and clean install were not repeated |
| Agent 3 direct browser | Rebuilt production app at `http://127.0.0.1:4173/wayfare/`, not the remote deployment or its downloaded artifact. `version.json` and page meta matched full candidate SHA, `dirty: false`, `mode: sample`. Wallet/core journey passed; planning finding and strict console-clean failure remain below |
| Dependency limitation | Existing dependencies lacked Figtree/IBM Plex Mono. Only their imported CSS/font files and metadata were restored from official `fontsource/font-files` commit `5a72889057f592bb0659629e38337359f94d53b2`: both package versions 5.3.0 match the lock, 39 Git blobs hash-verified. This is not a new `npm ci` integrity assertion or a claim that the local bundle is byte-identical to Pages |
| Workflow evidence, reused | Exact-candidate [application](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515792), [coordination](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515805) and [Pages run #22](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515876) succeeded. Pages provenance and “Verify the live build matches this commit” steps succeeded. Those are workflow observations, not Agent 3's direct live-site visit |
| Owner-reported counts | Agent 1 reports 177 tests and 36 no-retry browser checks on `07e30db` plus #62/#63 trees (Node 24.21.0/Chrome). Agent 3 did not recount those results or assign the counts to a different target |

This candidate was current main when the local pass began; replacement `b54eb5e` was supplied during work. PR #42 application/config/lockfile and `docs/DEMO.md` match the candidate. This pass changes release records only; the demo document stays byte-for-byte blob `e546d4510bc00ca727cbaee5a480f8c22f678db4`.

## Direct walkthrough results

| Documented behavior | Own observation |
| --- | --- |
| First-visit Overview | PASS: NY Trip booked, BL 214 airline-cancelled; $820 back / $80 lost / $900 paid; sample/provider-simulation footer |
| Plan comparison/preferences | PASS: three sample options; Convenience puts Nonstop first; Price + Free time gives $735 at budget $800; over-budget and unknown-price choices disabled. Plan-only acceptance is **NOT PASSED** because of labels/reload finding below |
| Intake | PASS: sample hotel review, acknowledgement and duplicate guard. Fresh reference already contains the hotel, so saving reports Already imported. Evidence textarea uses IBM Plex Mono. Non-sample text explicitly reports “Live AI extraction is not configured” |
| Itinerary | PASS: four reference bookings, hotel refund deadline, day highlight retains the full list; actual Google Calendar TEMPLATE href inspected, not followed |
| ReRoute / deadline | PASS: $820 before and $620 exactly at hotel cutoff; Keep costs $360. Approval remains disabled until the simulated-action acknowledgement |
| Approval → wallet | PASS: four simulated cancellations, automatic shell claim sync and actual Open TripWallet navigation; no claim of real provider action |
| Wallet / receipts | PASS: hotel $400 claim; company confirmation; $250 receipt leaves $150; final $150 gives $400 received / 100%; $75 voucher and 8,000 points separate from cash |
| Assistant / Google dialogs | PASS: Ask WayFare says no AI model is used and gives a scripted stored-data answer; sign-in/calendar dialogs have no credential inputs and explicitly say no Google account is contacted |
| Reload / duplicates | PASS for actions, claims and receipts: four cancellations and $400 received persist; reimporting the $250 receipt does not double money. Planning UI reload is a separate finding |
| Narrow layout | PASS at 390px: Overview, Plan, Import, Itinerary, ReRoute and Wallet have document/body width 390, with Figtree and IBM Plex Mono loaded. This does not establish every breakpoint/browser/state |

Unknown-policy editing, every race/retry/after-cutoff case and connected-mode behavior were not independently repeated here; retain applicable candidate CI/owner evidence rather than calling those direct observations. No paid/live model call was attempted.

## Failures and routed findings

**Planning acceptance — Agent 2/#4.** Reproduce: fresh browser → Plan → Demo controls → Load sample trip → Convenience, then Price / Free time / Budget 800 → choose $735 plan. The success text says “Plan saved. No reservation was made.” while the card says “OPTION 1 · BOOKED” / “View your trip”, and the header says booked from this plan. After reload, Plan shows budget 1000, $815/Skyline walk and Choose this plan. Itinerary has zero bookings and explicitly says a selected plan is not a booking. The observed labeling and displayed reload state need owner disposition; the underlying selected-plan object was not inspected and no backend data-loss claim is made.

Owner report: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6650364945. [Captured Plan state](323592a/planning-finding.png). Agent 1 owns any shared startup/storage dependency; Agent 3 does not investigate or modify application code.

**PR #42 browser CI — Agent 1/#8.** Documentation head `dfdbd35a2390d24dc38957c0215d3ecb28d90eab` has a separate [failed application run](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41818793068/job/126536337826). Install/typecheck/unit tests/build passed; `npm run e2e` failed with exit 1, and failed-browser-evidence upload succeeded. The failing test/trace could not be read because log/artifact downloads redirect to blocked Azure storage. Do not infer the same cause as the local planning finding or overwrite the successful candidate-main CI result. Owner routing: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6649878678. **Subsequent resolution:** Agent 1 identified an async-control test race, merged #65, updated/merged #42 with successful application CI at head `30c80e3`, and supplied green replacement `b54eb5e`. Preserve the failed run as history; it is no longer an active release blocker.

**Strict clean-console check — local static resource.** The main walkthrough completed nine observation groups, then the no-console-errors assertion failed on one HTTP 404. The local server access log identifies `GET /favicon.ico`; there were zero page exceptions and zero failed network requests. Live-site impact is unverified. This observation is included in the Agent 1 route above for disposition, not silently filtered or identified as the PR CI cause.

Verification-only attempts are retained in the observation record: a supplementary verifier waited for a transient reset message and timed out; actual unbooked planning controls were then observed. The initial comparison check did not exercise custom-button preferences; the focused follow-up did. No product reset failure is inferred from the verifier timeout.

## Visual observations

Compared actual screenshots with approved repository r2 exports: Overview desktop/390, narrow ReRoute, and Wallet desktop. The boarding pass/stub, decision callout, money tiles, tab shell, option cards/chart, wallet groups and separate credits retain the r2 structure and fonts. The 390px approval dialog and its acknowledgement/disabled button were also inspected. Actual data, labels and extra evidence/demo controls differ from the static prototype; this is a structural spot review, not pixel-perfect parity, Jiwoo's final visual acceptance or Kelvin/Brian implementation approval. Dark theme and every visual state were not independently reviewed in this pass.

- [Overview desktop](323592a/overview-desktop.png) / [390px](323592a/overview-390.png), compared with [desktop reference](../../design/exports/dashboard/r2-overview-desktop.png) and [390px reference](../../design/exports/dashboard/r2-overview-narrow-390.png).
- [ReRoute 390px](323592a/reroute-390.png), compared with [r2 reference](../../design/exports/reroute/r2-reroute-narrow-390.png); [approval dialog 390px](323592a/approval-390.png).
- [Wallet 390px](323592a/wallet-390.png); reference layout reviewed against [r2 Wallet desktop](../../design/exports/tripwallet/r2-tripwallet-desktop.png). The runtime's claims reflect the real simulated approval, rather than prototype placeholder totals.

Screenshots are from the local rebuilt candidate, taken at page top to avoid full-page sticky-header scroll offsets. They are fictional sample data, not the live deployment.

## Access checks and remaining release gates

| Check / gate | Actual result and next owner |
| --- | --- |
| Live Pages and `version.json` | UNVERIFIED directly: both requests fail at proxy CONNECT with 403 under enforced API-only policy. This is an environment access failure, not an origin/application 403. Workflow deployment/provenance success remains valid |
| Intended judge repository access | UNVERIFIED: private repository read succeeds through managed authenticated GitHub API access. Even the curl request without an explicit token uses managed authentication; it is not anonymous or intended-judge proof |
| Pages admin API / artifacts | Pages admin read returns Resource not accessible by integration. Logs/Pages artifact redirect to blocked Azure storage. Neither establishes a hosting outage; no permissions/network/settings changes made |
| Candidate availability | SATISFIED: Agent 1 supplied this exact candidate/URL/walkthrough. Final technical acceptance remains after findings and required checks; no missing-candidate producer gate |
| Owner findings / reviews | Resolve or disposition the planning finding; the historical PR42 CI race is resolved by #65; Kelvin's #55 r2 review on #6; Brian's #56 review and #7 evidence/asset/manual-browser follow-up or accepted limitations |
| Official requirements | Deadline timezone/source, submission portal, required links/formats, recording and public/private judge access rules still unconfirmed. Team time is November 10, 2026, 11:59 PM; no official timezone inferred |
| Live AI | UNVERIFIED if claimed. Sample extraction, provider simulation and scripted assistant labels observed; no hosted backend or successful live model result established |
| Figma | Old Code Layer `24:1182` is source `5249cb7`, not this candidate. Runtime sync/access unverified; confirm only if required by official submission scope |

Keep #9 open. Finish required live/judge-path checks from an authorized accessible environment, obtain owner/official dispositions and record final technical/visual acceptance. If later feature integration changes source or deployment, record the new full SHA and refresh affected CI, walkthrough, capability, visual and access evidence.
