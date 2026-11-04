# Coordination setup — release evidence and remaining gates

Checked November 4, 2026 (America/Los_Angeles), against fetched main `323592aaa6d76f77a0b22eb79b0e269ae8455d93` and current Issues/PRs. This records verified source/CI and workflow deployment evidence. **Final release sign-off remains pending.**

- Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Existing dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Design approval: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Integration/runtime handoff: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Final release record: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9
- Existing documentation PR: https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42

CI task #5 and preparation PR #20 are complete. Reuse the existing tracker/reporting workflow; keep #9 open until final acceptance evidence exists.

## Verified source and CI

[Agent 1's candidate handoff](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6628324849) supersedes older integration and hosting blockers. Agent 3 independently checked GitHub merge/check metadata and fetched hash-verified Git objects; the imported history passes `git fsck --connectivity-only`.

| Evidence | Recorded target/result | Verification basis |
| --- | --- | --- |
| Current candidate source | Main `323592aaa6d76f77a0b22eb79b0e269ae8455d93` | GitHub main ref and hash-verified Git objects |
| Application CI | [Run 41807515792](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515792) succeeded at this full SHA | Exact-source check metadata independently read |
| Coordination CI | [Run 41807515805](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515805) succeeded at the same SHA | Exact-source check metadata independently read |
| Public sample deployment | [Pages run 41807515876](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41807515876), run #22: build, provenance, deploy and “Verify the live build matches this commit” succeeded at this SHA | Job/step metadata independently read; live `version.json` source/mode result attributed to the workflow and Agent 1 |
| Owner application results | Typecheck/build, 177 tests, 36 browser checks with `CI=1 npx playwright test --retries=0`, Node 24.21.0/Chrome | Agent 1 reports these on `07e30db` plus #62/#63 trees; Agent 3 did not rerun or independently recount them |
| Agent 2 review | Budget/cent labels, picker overflow, one-traveler scope and standalone browser verification | [#4 review](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6624715078); [Agent 1's reconciliation review](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/59#issuecomment-6626982076) supersedes its open-PR status |

Do not assign owner-reported counts to a different target without evidence. Current-main CI success is independently checked metadata; it is separate from final live walkthrough, visual acceptance and judge access. The cloud container cannot reach `github.io`; this pass does not claim an independent live-site visit.

### Resolved active blockers

- ReRoute #37/#39 and atomic/navigation/shared-journey fixes are merged; they are historical integration evidence.
- #58 merged at `fb2dbc364ce0bc1b18732bf7b40b88fefa813415` (returning-visitor reference scenario); #60 at `28cee1db1d231e05d77ac841c3ff262d520d94d8` (r2 narrow layout).
- **#59 is now merged**, at `07e30db5fd6b80e528d67bd1d6b7e41e4c654470`, after reconciliation with #58/#60 at head `b1edbfd655c77482e5327323fd6d5064ad35036a`. Its former integration gate is resolved.
- **Both shared UI findings are fixed in source by #62**, merged at `3010e6e2cd7cd4812ae2aa32474c1aa9f4e800dc`: duplicate `ErrorState` issue keys and the intake textarea's IBM Plex Mono cascade. The older #4 reports requesting those fixes are superseded by #8/#62. Owner-reported browser checks cover these regressions.
- **Formal design approval is complete:** [design/approvals.json](../design/approvals.json) records Jiwoo's November 3 approval of `r2-final` for foundation, Wayfinder/intake, ReRoute and TripWallet. The [r2 specification](../design/handoffs/r2-final.md) and [reference prototype](../design/exports/prototype/r2/index.html) apply. Kelvin/Brian implementation reviews remain separate.
- **Hosting works:** https://jiwoo-jung-cal.github.io/wayfare/ is the public sample demo. Candidate deployment provenance passed as recorded above. #63 prepares Vercel; no Vercel deployment exists, and that optional alternative is not a missing Pages-hosting gate.

## Remaining release gates

| Gate | Actual outstanding evidence / owner |
| --- | --- |
| Accepted deployed candidate / final verification | Agent 1 supplied candidate `323592a`, a URL and the [10-step walkthrough](DEMO.md). Final technical acceptance, actual live walkthrough/visual review, current runtime/source match and intended judge access remain to be recorded for the accepted version. This bounded documentation pass pauses before final sign-off |
| Kelvin's r2 implementation review | [#6 r2 review request](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/6#issuecomment-6621476208) for merged #55: confirm ReRoute/CancelClock functionality, implementation and current limitations against approved r2; old code-integration blockers stay resolved |
| Brian's evidence/asset follow-up | [#7](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7), including the [#56 r2 review request](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/7#issuecomment-6621477268), feature-owned evidence/review and remaining assets, and stale manual browser-label follow-up. Supply actual PR/commit/checks or explicitly accepted limitations; preserve the integrated cash ledger/shared seams |
| Live AI and capability verification | No successful live model call or hosted backend is evidenced. `npm run smoke:live-ai` exists; fake-adapter tests/configuration are not live proof. Verify any live claim on the accepted target, or retain explicit sample/scripted/simulated/unverified labels |
| Official submission/access requirements | Jiwoo supplies authoritative Round 2 deadline/timezone, required links/formats and public/private access rules. Verify every required artifact through the intended judge path and record the submission receipt when applicable |

Any Brian follow-up or other later integration changes the source checkpoint: record the full new SHA and refresh affected CI, runtime/source mapping, capability labels and reviews. Preserve applicable evidence, but do not carry counts or a moving Pages URL's old provenance onto a new candidate without support.

## Deadline and judge links

The team-provided deadline is **November 10, 2026 at 11:59 PM**. Official timezone and organizer source remain unconfirmed; no Pacific-time assumption or UTC conversion is made.

The [prior recorded organizer-page review](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9#issuecomment-6589735905) of the [BBS x Ramp event page](https://luma.com/1gj6jag5) found product/code-walkthrough context but no exact Round 2 deadline/timezone, form, mandatory link formats, recording duration or private-access rules. This pass records that prior review, not a fresh external-page fetch. The authoritative announcement/form/email text is still required. [PROJECT_BRIEF.md](PROJECT_BRIEF.md) records team working-code/GitHub/demo requirements, not the official form.

| Artifact | Current evidence | Remaining confirmation |
| --- | --- | --- |
| GitHub source | [Private repository](https://github.com/Jiwoo-Jung-Cal/wayfare), candidate `323592a` | Final accepted SHA, official source/access rules and intended-judge access |
| Runnable demo | [Public Pages sample app](https://jiwoo-jung-cal.github.io/wayfare/); workflow verified candidate provenance; [version.json](https://jiwoo-jung-cal.github.io/wayfare/version.json) identifies current deployment | Accepted deployed version, final walkthrough and intended-judge path; link is mutable on main pushes |
| Recording/video | No final URL or duration rule supplied | Whether required, official format/duration and viewing permissions |
| Figma/prototype | [Design file / Code Layer `24:1182`](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182); [DESIGN_MAP.md](DESIGN_MAP.md) | Whether required; old Code Layer source `5249cb7` is not this candidate; running preview/source alignment and judge access unverified |
| Submission form/portal | No official URL supplied | Required fields/link rules and eventual receipt |

An owner's authenticated repository read or Figma editor session does not prove judge access. No visibility, invitations or hosting settings are changed by this pass.

## Runtime and capability limits

[DEMO.md](DEMO.md) is Agent 1's current launch/walkthrough/hosting record and is preserved byte-for-byte from main in this PR. GitHub Pages serves a static sample build without a backend. Figma Code Layer `24:1182` is a separate older import, not a synchronized running copy. A new import requires Jiwoo's direction; Pages hosting does not establish Figma synchronization.

| Capability | Current label / evidence limit |
| --- | --- |
| Plan comparison, intake review, persistence, deadline arithmetic, atomic approval, claim sync and receipt reconciliation | Implemented in browser; sample-data journeys and local-connected mode covered by owner/CI evidence |
| Travel data / booking extraction | Fictional, one traveler, USD; bundled sample documents only in hosted sample mode; arbitrary pasted text is not live extraction |
| Disruption and provider actions | Simulated; no provider contacted and no money moved |
| Ask WayFare | Scripted replies from stored trip data; “No AI model is used” |
| Google sign-in / calendar sync | Demo dialogs; no Google credentials/account contact. Calendar template links are actual external links, not account synchronization |
| Connected API / live AI | API tested locally/in CI with AI disabled; no hosted backend or verified live model result. Wallet live-AI/remaining asset claims need Brian's evidence |
| Design / assets | r2-final approved; Figtree/IBM Plex Mono bundled. Plan illustrations are deliberate while photo licensing is unconfirmed; feature-owner reviews remain outstanding |
| Hosted demo / judge access | Pages hosting and workflow provenance established; final live acceptance and official intended-judge access unverified |

Technical acceptance belongs to Agent 1/eligible reviewers; Jiwoo owns visual design. Agent 3 assembles evidence and routes failures. For the next accepted-version pass, match the full SHA, runtime and mode; reuse exact-target CI and run only outstanding/change-justified release checks. Record passed/failed/skipped/todo/unrun outcomes and log links. Route Wayfinder/intake to Agent 2/#4, ReRoute to Kelvin/#6, wallet to Brian/#7, and shared/backend/integration to Agent 1/#8. Final evidence remains NOT VERIFIED until the required acceptance exists.
