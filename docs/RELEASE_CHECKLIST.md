# Release checklist

Candidate: `ecd5bbc274c932e7467b2d55f8149b2503aebe1a` after #68/#69, explicitly supplied by [Agent1](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6672883600). Agent 3 assembles evidence; Agent 1 owns technical acceptance and Jiwoo owns design. See [source/CI evidence](SETUP_STATUS.md#verified-source-and-ci) and the unchanged [demo walkthrough](DEMO.md).

## Established evidence

- [x] Candidate source identified; exact-main application and coordination CI success metadata checked.
- [x] Pages sample hosting works; exact-candidate deployment and live provenance step passed in the workflow. This is workflow evidence, not an independent live walkthrough/judge-access check.
- [x] #58/#60/#59 are merged; #59 reconciliation/integration is complete.
- [x] Both shared UI findings are fixed in source by #62 (duplicate issue keys; IBM Plex Mono input cascade).
- [x] Jiwoo formally approved r2-final on November 3, 2026 for all four areas in `design/approvals.json`.

## Direct local candidate checks

Initial checks were performed on `323592a` and reused for `b54eb5e` only after browser input identity verification. The November 5 focused checks below were directly run on a clean local `b54eb5e` build. Current candidate CI/deployment evidence targets `b54eb5e`; no direct live-site observation is inferred.

[Actual observations, screenshots and owner routes](releases/ecd5bbc-verification.md) distinguish the rebuilt candidate from workflow/live evidence.

- [x] Local production build identifies supplied full SHA, clean tracked source and sample mode.
- [x] Reference Overview, intake duplicate/review, itinerary/day highlight/Calendar template, $820-before/$620-at cutoff, explicit acknowledgement and four simulated actions checked.
- [x] Automatic wallet sync, $400 claim/$250 receipt/$150 remaining/final receipt, separate credits/points, reload and duplicate protection checked locally.
- [x] Scripted assistant, credential-free Google demo labels and non-sample AI refusal checked.
- [x] Six critical pages fit 390px with loaded fonts; selected desktop/390px screenshots compared structurally with r2 exports. This is not final visual approval.
- [x] Direct b54eb5e: unknown price remains Unknown after reload; uncertain saved policy is visibly “Refund rule: unknown” in booking details.
- [x] Direct b54eb5e: profile A reset/clear/reload leaves profile B's four bookings intact.
- [x] Direct b54eb5e: one hour after hotel cutoff still returns $620.
- [x] Direct b54eb5e: settled dark Overview at 1440px/390px and theme preference after reload checked; initial timing failure retained in the evidence.
- [x] Direct ecd5bbc/#69: Selected plan/unbooked labels correct after reset/selection; saved $735 plan visible on Overview after reload, with no bookings created.
- [ ] Agent2/#4 decides Plan preference restoration and reset-state refresh; defaults still regenerate on Plan after reload, not stored-plan data loss.
- [x] Earlier PR42 `dfdbd35` CI race resolved by merged #65; final PR42 head `30c80e3` and replacement `b54eb5e` application CI succeeded.
- [x] Direct ecd5bbc/#68: inline favicon and six tabs produce zero console errors, page exceptions, failed requests or HTTP4xx/5xx. Old favicon404 retained as earlier-source failure; direct live access remains unverified.

## Final acceptance still required

- [x] Agent 1 supplied candidate full SHA, demo URL and sample mode; verification proceeded at that exact source.
- [ ] Final technical acceptance after findings and required checks; direct current live provenance/judge path remain unverified due network access.
- [ ] Actual live walkthrough completed against that accepted version, with visual/capability evidence and intended judge access.
- [ ] Kelvin's #55 r2 implementation review/limitations recorded on #6.
- [ ] Brian's #56 r2 review and outstanding #7 evidence/asset/manual browser follow-up have owner evidence or explicitly accepted limitations.
- [ ] Official deadline/year/timezone/offset and organizer source confirmed; no timezone inferred from the team-provided November 10, 2026, 11:59 PM.
- [ ] Official submission portal, required judge links/formats, recording rules and public/private access requirements sourced; all required URLs checked through the intended judge path.
- [ ] Figma/code/runtime version recorded where relevant; if Figma is required, its actual runtime alignment/access verified. Old Code Layer `24:1182` is source `5249cb7`, separate from Pages.
- [ ] Owner/CI evidence for accepted-source install/typecheck/tests/build and journeys reviewed with passed/failed/skipped/todo/retry/unrun outcomes distinguished; run only outstanding/change-justified checks.
- [ ] Accepted-runtime planning/preference selection, intake review/evidence/unknown-policy handling and persistence verified.
- [ ] Disruption/recovery choices, before/at/after deadline semantics and atomic policy/clock preconditions apply to the accepted version.
- [ ] Approval → automatic claim sync → wallet, $400 claim/$250 receipt/$150 outstanding/final receipt, duplicate protection, replay/reload and workspace isolation verified on the accepted target.
- [ ] Credits/points remain separate from cash; remaining asset limitations are explicit.
- [ ] Desktop/narrow controls and approved r2 implementation reviewed, including applicability of #59/#62 regression evidence.
- [ ] Capability labels verified: sample data/extraction, simulated provider actions and Google dialogs, scripted Ask WayFare, and actual Calendar template links. No live account sync/provider execution inferred.
- [ ] Any live-AI claim supported by successful configured-call result/model/request evidence; otherwise live AI remains unverified and hosted demo remains sample-only.
- [ ] Setup/configuration names, limitations and owner tool decisions assembled in the final evidence record.
- [ ] Any later integration/deployment has an updated full SHA and affected CI/runtime/capability/review evidence.
- [ ] Final submission/access outcome and receipt recorded where required; #9 acceptance complete before closure.

Record actual outcomes and route failures to owners. Established source/CI/design/hosting evidence does not complete unchecked final acceptance items.
