# Coordination setup — release evidence and remaining gates

Rechecked November 5, 2026 (America/Los_Angeles), against latest checked integration `ecd5bbc274c932e7467b2d55f8149b2503aebe1a` and current Issues/PRs. Agent1 supplied new candidate ecd5bbc after #68/#69; affected evidence was refreshed and independently checked; merged PR #42 is preserved. This records refreshed exact-source CI/deployment evidence plus explicitly reused browser observations. **Final release sign-off remains pending.**

- Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Existing dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Design approval: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Integration/runtime handoff: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Final release record: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9
- Merged documentation PR: https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42

CI task #5 and preparation PR #20 are complete. Reuse the existing tracker/reporting workflow; keep #9 open until final acceptance evidence exists.

## Verified source and CI

[Agent 1's candidate handoff](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6672883600) supersedes older integration and hosting blockers. Agent 3 independently checked GitHub merge/check metadata and fetched hash-verified Git objects; the imported history passes `git fsck --connectivity-only`.

| Evidence | Recorded target/result | Verification basis |
| --- | --- | --- |
| Latest checked integration | `ecd5bbc274c932e7467b2d55f8149b2503aebe1a` | GitHub main ref and hash-verified Git objects |
| Application CI | [Run 42133762141](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762141) succeeded at this full SHA | Exact-source check metadata independently read |
| Coordination CI | [Run 42133762483](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762483) succeeded at the same SHA | Exact-source check metadata independently read |
| Public sample deployment | [Pages run 42133762140](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762140): build, provenance, deploy and “Verify the live build matches this commit” succeeded at this SHA | Job/step metadata independently read; live `version.json` source/mode result attributed to the workflow and Agent 1 |
| Current owner results | Typecheck, 184 tests, 37 no-retry browser checks | Agent1 reports these for candidate ecd5bbc. Counts are not independently recounted; SDK stand-in tests are not live-provider proof |
| Agent 2 review | Budget/cent labels, picker overflow, one-traveler scope and standalone browser verification | [#4 review](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6624715078); [Agent 1's reconciliation review](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/59#issuecomment-6626982076) supersedes its open-PR status |

Do not assign owner-reported counts to a different target without evidence. Current-main CI success is independently checked metadata; it is separate from final live walkthrough, visual acceptance and judge access. The cloud container cannot reach `github.io`; this pass does not claim an independent live-site visit.

### Resolved active blockers

- ReRoute #37/#39 and atomic/navigation/shared-journey fixes are merged; they are historical integration evidence.
- #58 merged at `fb2dbc364ce0bc1b18732bf7b40b88fefa813415` (returning-visitor reference scenario); #60 at `28cee1db1d231e05d77ac841c3ff262d520d94d8` (r2 narrow layout).
- **#59 is now merged**, at `07e30db5fd6b80e528d67bd1d6b7e41e4c654470`, after reconciliation with #58/#60 at head `b1edbfd655c77482e5327323fd6d5064ad35036a`. Its former integration gate is resolved.
- **Both shared UI findings are fixed in source by #62**, merged at `3010e6e2cd7cd4812ae2aa32474c1aa9f4e800dc`: duplicate `ErrorState` issue keys and the intake textarea's IBM Plex Mono cascade. The older #4 reports requesting those fixes are superseded by #8/#62. Owner-reported browser checks cover these regressions.
- **Formal design approval is complete:** [design/approvals.json](../design/approvals.json) records Jiwoo's November 3 approval of `r2-final` for foundation, Wayfinder/intake, ReRoute and TripWallet. The [r2 specification](../design/handoffs/r2-final.md) and [reference prototype](../design/exports/prototype/r2/index.html) apply. Kelvin/Brian implementation reviews remain separate.
- **Hosting works:** https://jiwoo-jung-cal.github.io/wayfare/ is the public sample demo. Candidate deployment provenance passed as recorded above. #63 prepares Vercel; no Vercel deployment exists, and that optional alternative is not a missing Pages-hosting gate.

## Direct candidate verification

Earlier source-specific observations (later fixes are recorded below): Agent 3 directly ran supplied `323592a`, then fetched replacement `b54eb5e` and verified the entire `src` tree plus index/package/lock/Vite/TypeScript/env-example/DEMO inputs are identical. The direct observations remain labeled `323592a` and are reused for the unchanged browser code; new exact-source CI/deployment evidence above targets `b54eb5e`. No deployed-bundle byte-identity claim. See [the verification record](releases/b54eb5e-verification.md) for the local production walkthrough, desktop/390px screenshots and explicit evidence boundaries. Core recovery/wallet/receipt/reload behavior passed locally. Plan preference reranking passed, but the BOOKED wording and post-reload Plan state require Agent 2 disposition; the local strict console check failed on `/favicon.ico` 404. The earlier PR42 `dfdbd35` failure was resolved by Agent 1's merged #65 test-race fix; final PR42 head `30c80e3` and replacement-main CI are green. The old failure is retained as history, not an active integration gate. These results do not erase candidate-main CI success or establish a remote-site visit.

November 5 continuation directly checked a clean local `b54eb5e` build: unknown price/policy after reload, one hour after cutoff, two browser profiles/reset isolation, and settled dark Overview desktop/390px with theme persistence passed. [The dated continuation](releases/b54eb5e-verification.md#direct-replacement-checks--november-5) retains raw verifier failures and evidence limits. PR67 prior head `615361b` application/coordination/dashboard checks are now successful; any updated head has separate check status. Fresh live Pages/version requests still receive proxy CONNECT403; the current runtime policy state is unknown, so actual responses are used as evidence. Those b54eb5e findings were then addressed by #68/#69 below; remaining product/owner/submission gates stay open.

The source then advanced with #68/#69. [ecd5bbc verification](releases/ecd5bbc-verification.md) checks all six tabs with zero console/network/HTTP errors, the inline icon, corrected Selected plan/unbooked labels, and saved plan visibility on Overview after reload. Main application/coordination/Pages provenance passed at ecd5bbc; the earlier Pages500 is superseded. Prior b54eb5e observations above are kept with their original identities, not treated as new executions.

## Remaining release gates

| Gate | Actual outstanding evidence / owner |
| --- | --- |
| Live/judge-path verification and final acceptance | Original/replacement candidate supply is satisfied; latest checked integration is ecd5bbc with workflow provenance; candidate availability is satisfied and local verification has proceeded. Direct Pages/version requests fail at proxy CONNECT 403, so live walkthrough/current provenance and intended judge path remain unverified here. Final technical/visual acceptance follows findings and required checks |
| Remaining Plan product decisions | #68/favicon and #69/BOOKED labels are fixed and directly verified at ecd5bbc. The saved plan persists on Overview; Agent2/#4 decides preference restoration and related stale display after demo reset. No backend-data-loss claim. Old #42 race resolved by #65; earlier failures are source-scoped history |
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
| GitHub source | [Private repository](https://github.com/Jiwoo-Jung-Cal/wayfare), latest checked source `ecd5bbc` | Supplied candidate SHA recorded; final technical acceptance, official source/access rules and intended-judge access |
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

Technical acceptance belongs to Agent 1/eligible reviewers; Jiwoo owns visual design. Agent 3 assembles evidence and routes failures. For remaining checks, continue with the supplied candidate's full SHA/runtime/mode; reuse exact-target CI and run only outstanding/change-justified release checks. Record passed/failed/skipped/todo/unrun outcomes and log links. Route Wayfinder/intake to Agent 2/#4, ReRoute to Kelvin/#6, wallet to Brian/#7, and shared/backend/integration to Agent 1/#8. Final evidence remains NOT VERIFIED until the required acceptance exists.
