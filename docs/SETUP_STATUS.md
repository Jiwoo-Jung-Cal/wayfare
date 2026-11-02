# Coordination setup — current release gates

Checked November 2, 2026 (America/Los_Angeles), against main `d7b0fd16cddf42012fefddb3d716a0978850fbb2` and current Issue/PR records. Later owner reports and merged PRs supersede this checkpoint. This is coordination evidence, not accepted-release evidence.

- Private repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Existing dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Design handoffs: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Integration dependency: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Final verification: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9

The existing reporting/dashboard system is installed; reuse it. CI task #5 is complete. Structured reports refresh the dashboard but do not wake paused assistants.

## Preparation is merged; final verification is pending

[PR #20](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/20) merged at `cab1167f6715d8f9915760164369303dc44dccb4`, preserving the release runbook and blank NOT VERIFIED evidence template. Its final head `7803027` passed application and coordination checks. Issue #9 was closed shortly after that merge, while its final acceptance criteria and #8 were still pending. Agent 3 reopened the existing issue for final verification; there is no replacement tracker or completed-release claim.

Agent 1 has not supplied an accepted integrated release commit/demo. Final checks must wait for that exact source and executable demo; this current main checkpoint is not a substitute.

## ReRoute exists; contract and integration are published

[Draft PR #37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37), head `b69d02e1ba32646a2a9f6d3c7661f51a56faf2a9`, implements disruption/options, CancelClock, explicit simulation approval, stable per-booking actions and partial-failure retry. Its feature-owned browser journey drives actual controls through four automatic claims/$820, a $400 hotel confirmation, $250 then $150 receipts, and $420 remaining on the other claims. It seeds no ActionRecords. These are owner-reported branch results, not an accepted integrated release.

Agent 1 implemented the [atomic-precondition request in PR #38](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/38), head `42950fca991565144f985f2254d42821eab81e5c`. It checks policy/clock preconditions inside the same write and preserves successful idempotent replays; the contract is additive and published, not merged. [Adoption instructions are on #6](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6#issuecomment-6587121895). Kelvin must adopt the seam and feature regression. Do not repeat the obsolete “contract unpublished” blocker.

[Agent 1's review of #37](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37#issuecomment-6587326231) identifies a navigation failure: “Open TripWallet” and the relative import links leave the trip and resolve to `/#/`. That functional bug is routed to Kelvin; Agent 3 does not edit the feature. [Draft #39](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/39), head `846996e75270a8ed1489a36d89f47fcdd614ea8d`, replaces the two shared browser placeholders and integration todos on its branch. Its tests use shell navigation and do not establish that Kelvin's broken link is fixed. Agent 1's merge order is #38, updated #37, then #39. Merges still require Jiwoo's approval; no accepted integrated release commit/demo is supplied.

Brian's cash-wallet milestone is already merged (#25/#27); shared receipt-allocation/evidence-transport dependencies are resolved. His current #7 follow-up covers feature-owned evidence extraction/review and remaining asset/acceptance work. Wayfinder/intake's interim-r1 work is merged (#21); [PR #36](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/36) adds shared state/layout browser coverage and remains open. Agent 1 owns shared integration and acceptance, including conversion of remaining shared journey skips/todos.

## Verified check metadata

| Target | Current evidence | Limit |
| --- | --- | --- |
| Main `d7b0fd1` | [Application 41383324098](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41383324098) and [Coordination 41383324183](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41383324183) succeeded | API check metadata verified; no accepted release source/demo yet |
| PR #20 head `7803027` | [Application 41355457546](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41355457546) and coordination passed before merge | Preparation only; the earlier pending application result is now complete |
| PR #37 head `b69d02e1` | [Application 41400613022](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41400613022) and coordination succeeded | Draft/unmerged; adoption of published #38 and navigation fix pending; counts and actual-control results are attributed to [Kelvin's report](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6#issuecomment-6570772236) |
| PR #38 head `42950fca` | [Application 41515240720](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41515240720) and coordination succeeded | Published additive contract; ReRoute adoption/merge pending |
| Draft #39 head `846996e7` | [Application 41528332469](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41528332469) and coordination succeeded | Shared journey implemented on branch; navigation fix/adoption/approved merges and final acceptance pending |
| PR #36 head `dbfa3bc6` | [Application 41383578002](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41383578002) and coordination succeeded | Open/unmerged; do not add its browser counts to main's results |

Other owner-managed fixes remain open with successful checks: [#40](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/40) fixes intake notice order (Agent 2), and [#41](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/41) fixes shared root font scale (Agent 1). These are proposed changes, not merged/approved visual acceptance.

This documentation pass does not rerun application suites or copy branch counts into a final release record. Use [RELEASE_GUIDE.md](RELEASE_GUIDE.md) and [the evidence template](templates/release-evidence.md) after Agent 1 supplies the accepted commit/demo. Route any application failure with its command, error, tested SHA and log link to its feature owner or Agent 1; do not absorb product debugging into coordination work.

## Deadline and judge links

**Official instructions are still missing.** The team-provided deadline is November 10, 2026 at 11:59 PM, with no confirmed official timezone/year source in repository records. Agent 3 requested the organizer's Round 2 instructions (URL or text). Do not assume Pacific time, convert to UTC, or label the timezone confirmed before that source is available. Record the organizer's exact deadline, timezone/offset and source in the final evidence.

[PROJECT_BRIEF.md](PROJECT_BRIEF.md) records the team's requirement for working code, a GitHub repository and a demo; it is not a copy of the official submission form. Required URL formats, recording length, additional Figma links and private-access rules remain unconfirmed.

| Artifact | Current link / evidence | Remaining confirmation |
| --- | --- | --- |
| GitHub repository and accepted source | [Private repository](https://github.com/Jiwoo-Jung-Cal/wayfare); accepted release SHA not supplied | Confirm official source-link/private-access rules, record accepted commit, and verify access as the intended judge |
| Runnable demo | [Code Layer `24:1182`](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182) is an imported editor surface; no verified judge-facing runnable URL is recorded | Confirm permitted demo format; obtain the actual runtime URL/version and verify the full journey and judge access |
| Recording/video | No URL recorded | Confirm whether required, format/duration and viewing permissions; if required, record and verify the final demo recording |
| Figma/prototype | [Native design file](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK); design map in [DESIGN_MAP.md](DESIGN_MAP.md) | Confirm whether an additional design link is required; a design prototype does not replace the runnable app |
| Submission form/portal | No official URL recorded | Obtain the organizer's form, required fields and final submission receipt |

An authenticated owner's repository read or Figma editor session does not verify judge access. Do not make the repository public, invite guessed accounts or change permissions to satisfy an unknown access rule. Record actual access outcomes against the official instructions.

## Design, runtime and access limits

Native r1-draft designs and exports exist, and the interim look is applied. Every feature in `design/approvals.json` still has pending approval/null revision. [Agent 1 reports a Code Layer import](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6564005638) from `5249cb7`; a signed-in preview check and actual runtime/source alignment remain unverified. Agent 1 also reports that Vite rejects non-localhost Host headers with 403; the actual Figma preview hostname is still needed before a scoped host allowance is considered. This is routed to Agent 1/#8, not fixed speculatively by Agent 3. Agent 3 made no Figma or deployment changes.

Known collaborator handles remain `Wildtypers` (Kelvin) and `brianren-cmd` (Brian). Their published work/reports supersede bootstrap-era missing-handle statements; this pass makes no new permission claim and sends no invitations. Collaborator access is separate from judge access.

Live AI and hosted backend/demo remain unverified. Label sample/manual extraction and simulated provider actions honestly; verify real AI only if it will be claimed live. Agent 1/eligible reviewers retain technical acceptance and merging; Jiwoo retains visual approval. No environment configuration/publication, visibility, billing or branch-protection changes are part of this refresh.
