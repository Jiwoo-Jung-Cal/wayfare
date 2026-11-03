# Coordination setup — source evidence and remaining release gates

Checked November 3, 2026 (America/Los_Angeles), against main `17623fc12bd60c33b5a4927562469dbbcb660857` and current Issue/PR records. This is a verified source/CI checkpoint; final demo/submission verification remains pending. Later integrations require updating affected evidence.

- Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Existing dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Design approval: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Integration/runtime handoff: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Final release record: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9
- Existing documentation PR: https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42

CI task #5 and preparation PR #20 are complete. Issue #9 stays open for final verification; preparation and source CI do not complete demo, access or submission acceptance. Reuse the existing tracker/reporting workflow.

## Verified source and CI

[PR #39](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/39) merged at `17623fc12bd60c33b5a4927562469dbbcb660857`, carrying [Kelvin's corrected #37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37). GitHub marks both merged. The navigation-link fixes, adoption of merged atomic preconditions, policy/clock race regressions and real shared approval-to-wallet journeys are resolved source/integration items. Do not retain them as release blockers.

| Evidence | Recorded target/result | Verification basis |
| --- | --- | --- |
| Integrated source | Main `17623fc12bd60c33b5a4927562469dbbcb660857`; reviewed #39 head `3c3e195271e43b1f7a5f5f471056c3e31f2c6a8b` has the identical Git tree | GitHub merge metadata and Git object/tree identity checked independently |
| Main application CI | [Run 41568454043](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41568454043) succeeded at the full main SHA | Exact-source check metadata checked independently |
| Main coordination CI | [Run 41568454787](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41568454787) succeeded at the same SHA | Exact-source check metadata checked independently |
| Application results | 174 tests passed, 0 skipped/0 todo; 20 browser checks passed, 0 skipped; typecheck/build passed | [Agent 1's report](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6596944284) for the reviewed source whose tree matches main; not rerun or independently recounted by Agent 3 |
| Scope of demonstrated behavior | Integrated sample-mode import → disruption → ReRoute approval → shell claim sync → TripWallet/dashboard; $820 before the cutoff/$620 exactly at it, actual wallet-link click, retry/reload/idempotency/duplicate handling | Owner source/test evidence; not proof of a published runtime, judge access or live AI |

The earlier root-font, intake-order, atomic-contract and state/layout coverage PRs #41/#40/#38/#36 are also merged. Their code/check results do not imply formal visual approval. Previous documentation head `a43ed68` completed application/coordination/dashboard CI; later documentation heads have their own results recorded in PR #42 and #9.

Agent 3 runs only documentation/coordination checks in this bounded pass. Successful application suites are not repeated. Preserve applicable same-source CI evidence and distinguish it from checks still required on the accepted demo/runtime. Route any new application failure to its owner with command, error, tested SHA and log/run link.

## Remaining release gates

| Gate | Outstanding evidence / owner |
| --- | --- |
| Working demo and accepted runtime/source | Agent 1 supplies a working demo URL, executable complete-demo script, accepted full source SHA, actual deployed/embedded version and operating mode; verify runtime/source alignment and intended judge access |
| Formal design approval | Jiwoo approves the applicable revision. All entries in `design/approvals.json` remain pending with null revision; passing source/layout checks are separate evidence |
| Capability labels | Confirm the accepted demo's working/sample/simulated/blocked/unverified labels and limitations. Source tests demonstrate the sample journey; live AI, live travel-provider execution and hosted backend/demo are not established by those tests |
| Official submission/access rules | Jiwoo supplies authoritative Round 2 deadline/timezone, required judge links/formats and public/private access rules; verify actual URLs through the intended judge path |
| Brian's wallet milestone | [#7 remains open](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7). The latest [published follow-up report](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7#issuecomment-6567762044) is in progress for feature-owned evidence extraction/review; remaining asset/acceptance work and any live wallet AI evidence need actual owner PR/commit/checks or an explicitly accepted limitation |

Brian's existing cash ledger and shared atomic allocation/evidence-transport seams remain integrated. His outstanding milestone is not a reason to reintroduce the resolved ReRoute blocker. If #7 or any other later work changes source, record the new full SHA, inspect/run affected checks and update capability/runtime evidence before final acceptance. Do not copy the 174/20 results onto a new commit without supporting evidence.

## Deadline and judge links

The team-provided deadline is **November 10, 2026 at 11:59 PM**. The official timezone and organizer source remain unconfirmed; no Pacific-time assumption or UTC conversion is made.

The [recorded organizer-page review](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9#issuecomment-6589735905) identifies the [BBS x Ramp event page](https://luma.com/1gj6jag5), which supplied product/code-walkthrough context but omitted Round 2 deadline/timezone, submission-form, exact link-format, recording-duration and private-access details. This pass records that prior review, not a fresh page fetch. The authoritative Round 2 announcement/form/email text is still required.

[PROJECT_BRIEF.md](PROJECT_BRIEF.md) records the team's working-code/GitHub/demo requirements; it is not the official submission form.

| Artifact | Current record | Remaining confirmation |
| --- | --- | --- |
| GitHub source | [Private repository](https://github.com/Jiwoo-Jung-Cal/wayfare), verified integrated source `17623fc` | Final accepted SHA, official access rules and actual intended-judge access |
| Runnable demo | No verified judge-facing URL/version supplied | Working URL, complete-demo script, runtime/source mapping and permitted access path |
| Recording/video | No final URL or duration rule supplied | Whether required, official format/duration and viewing permissions |
| Figma/prototype | [Design file / imported Code Layer `24:1182`](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182); [DESIGN_MAP.md](DESIGN_MAP.md) | Whether required; running preview, applicable source version and judge access |
| Submission form/portal | No official URL supplied | Required fields/link rules and eventual submission receipt |

An owner's authenticated repository read or Figma editor session does not verify judge access. Visibility and invitations are unchanged.

## Runtime and capability limits

Code Layer `24:1182` was imported from older source `5249cb7`, not the current integration checkpoint. Its running preview and actual runtime/source alignment remain unverified. Agent 1 reported local lifecycle scripts working and foreign-Host requests returning 403; the real signed-in preview output is still needed. Agent 3 does not edit Figma, guess a preview hostname or deploy a replacement.

The main journey uses sample/manual evidence and simulated provider actions. A configured model adapter or passing mocked extraction tests do not establish a live AI call. Confirm live claims only from actual accepted-demo evidence; otherwise retain explicit sample/simulated/unconfigured labels. Brian retains feature-owned wallet evidence work.

Formal technical acceptance/merging belongs to Agent 1/eligible reviewers and visual approval to Jiwoo. This bounded refresh changes documentation only, keeps the final evidence template NOT VERIFIED, and makes no environment configuration/publication, visibility, billing or access changes.
