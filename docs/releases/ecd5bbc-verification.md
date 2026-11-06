# Integrated release fixes — ecd5bbc verification

Checked November 5, 2026 (America/Los_Angeles). **Final release: NOT VERIFIED.** Original candidate `323592a` and Agent 1's replacement `b54eb5e` were supplied and verified as recorded; candidate availability is satisfied. During the next pass, #68/#69 merged into **latest checked source `ecd5bbc274c932e7467b2d55f8149b2503aebe1a`**. [Agent1 explicitly supplied ecd5bbc as the new candidate](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6672883600). This record refreshes affected source/deployment evidence; it does not call older observations new executions or assume final release acceptance.

[Task #9](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/9) · [Existing follow-up PR #67](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/67) · [Merged #42, preserved](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/42) · [Unchanged demo script](../DEMO.md) · [Original walkthrough](323592a-verification.md) · [b54eb5e direct continuation](b54eb5e-verification.md#direct-replacement-checks--november-5) · [Current raw evidence and input hashes](ecd5bbc/fix-verification.json)

## Refreshed workflow evidence

| Evidence at full ecd5bbc SHA | Observed result / basis |
| --- | --- |
| Source | Hash-verified Git import and connectivity passed; #68/#69 ancestors included; app changes are the icon entry and Plan booked-state re-read |
| Application | [Run42133762141](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762141) succeeded; exact-source metadata independently read. No new whole-suite rerun or count assertion by Agent3 |
| Coordination | [Run42133762483](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762483) succeeded at this source |
| Pages | [Run42133762140](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762140) build/provenance/deploy and “Verify the live build matches this commit” succeeded; workflow evidence, not Agent3's direct visit |
| Vercel | [Run42133762164](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42133762164) token check succeeded; checkout/deploy/live-check steps skipped. No Vercel deployment inferred |
| Earlier Pages failure | [Run42132871129](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/42132871129) at `948617b` failed to create a Pages deployment with HTTP500; live-source check skipped. The later ecd5bbc deployment/provenance succeeded; old failure retained as history, not an active hosting blocker |

The earlier b54eb5e owner counts (184 tests/36 browser/20 parity repeats) remain scoped to that handoff. PR69's owner reports 184 tests/37 browser/5 focused repeats on its feature head; those counts are not silently assigned to the combined main tree. Agent1's new ecd5bbc handoff reports local typecheck, 184 tests and 37 no-retry browser checks; these current counts are owner-reported. Current main's successful workflow conclusion is independently verified metadata; detailed counts/retries were not recounted.

## Direct verification of the affected fixes

Rebuilt clean tracked ecd5bbc under local `/wayfare/`, Node24.19.0/npm11.9.0/Chromium154.0.8037.57, using the disclosed existing dependency set. Local `version.json` and meta match the full new SHA, `dirty:false`, `mode:sample`. A build was needed for these changed-input checks; no fresh npm-ci integrity assertion or full application-suite repeat.

- **#68 favicon/resource fix — PASS:** actual icon link is an inline SVG. Opened Overview, Plan, Import, Itinerary, ReRoute and TripWallet in a fresh profile: zero console errors, page exceptions, failed requests, HTTP4xx/5xx responses or `/favicon.ico` requests. The older local favicon404 remains an accurate old-source observation, now resolved on this source.
- **#69 booked-label fix — PASS:** fresh reference → Plan → Demo controls → Load sample trip → Price/Free time/budget800 → choose $735. The card now shows **Selected plan** and “Saved to your trip. Nothing is booked or paid until you confirm.” Header says “plan selected, nothing booked yet”; BOOKED is absent. [Captured current Plan](ecd5bbc/plan-labels-fixed.png).
- **Stored selection / no reservation — PASS:** after reload, the $735 Red-eye/free-time plan remains visible on Overview; Itinerary has No bookings yet. There is no evidence of stored selection loss or actual booking creation.
- **Plan-view reload behavior — owner decision:** Plan still displays default budget1000/$815/Skyline-walk comparison after reload. Agent2 owns whether to restore preference controls/selection display. [Agent1's split disposition](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/4#issuecomment-6672683948) also leaves the pre-selection stale selected-plan display after a demo reset for Agent2's refresh decision; that related state is owner-reported, not separately re-tested here.

## Reuse limited to unaffected behavior

Git object identity is unchanged from b54eb5e for `src/app`, `src/styles`, `src/core`, intake, ReRoute, TripWallet, server, package/lock, Vite/TypeScript configuration and DEMO. [Hashes](ecd5bbc/fix-verification.json) support reuse of the earlier core recovery/wallet walkthrough and b54eb5e unknown-policy/price, after-cutoff, profile-isolation and dark Overview observations. They remain labeled with their actual source and runtime. Wayfinder's changed labels and HTML icon were directly checked above; no whole-browser-input or built-artifact identity claim is made for this integration.

`docs/DEMO.md` remains blob `e546d4510bc00ca727cbaee5a480f8c22f678db4`; no later demo content was overwritten. Other owners' code/handoffs were incorporated from main, not edited by Agent3. PR67's old head615361b application/coordination/dashboard succeeded; the new documentation head has separate automatic check status.

## Genuine remaining release gates

1. Agent2 decides Plan reload preferences/reset-state refresh and completes current implementation acceptance. Kelvin's #55 r2 review and Brian's #56 review/#7 evidence/asset/manual-browser follow-up or accepted limitations remain; formal Jiwoo r2-final design approval is already recorded.
2. Direct live walkthrough/current runtime and intended judge access remain unverified here. Fresh Pages/version requests fail at proxy CONNECT403 before an origin response. Configuration lists API-only destinations; the current enforcement metadata is unknown, so actual denial is used as evidence. Authenticated managed private-repo reads do not prove intended-judge/anonymous access.
3. Official deadline timezone/source, portal, required links/formats, recording and public/private access requirements remain unconfirmed. Team time is November10,2026,11:59PM with no inferred timezone. No official submission or receipt claimed.
4. Live-AI proof only if claimed: no real model result/server-key/hosted-backend evidence. SDK wire tests with a stand-in and synthetic `live` responses are not live-provider proof. Pages stays sample; provider/Google dialogs simulated; Ask WayFare scripted; Calendar template links are actual links.
5. Final technical/visual acceptance and any required Figma runtime/access check. Code Layer24:1182 remains old source5249cb7, separate from the deployed app.

Keep #9 open. Old Plan booked labels, favicon404, #42 test race and the superseded Pages500 are not current blockers at ecd5bbc. Any further integration/deployment requires a full new source identity and affected evidence refresh. No application debugging, access/configuration changes, merge or final sign-off by Agent3.
