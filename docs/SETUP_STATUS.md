# Coordination setup — source checkpoint

Source checked November 1, 2026 (America/Los_Angeles), against main `1d42523f7250ea3f58f95115c29efd0d92384f1c`. Later Issue reports and merged PRs supersede this checkpoint. This is preparation evidence, not release acceptance.

- Private repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Team dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1
- Jiwoo design handoffs: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Seven task Issues (#3–#9), dependencies and reporting instructions already exist; reuse them.
- Structured reports refresh the shared dashboard through trusted default-branch coordination code. They do not wake inactive assistants.
- Historical bootstrap verification: a real report appeared on the dashboard; nine coordination tests passed. https://github.com/Jiwoo-Jung-Cal/wayfare/issues/5#issuecomment-6549389794

## Application CI and integration

CI PR #11 merged at `0eb41c4b5c147443d8e61749e392f06b25f94754`; task #5 was completed. The workflow uses Node 24.21.0/npm 11.19.0 and the established install, typecheck, test, build and browser commands. The initial Linux mobile failure was fixed by Agent 1 in merged PR #19; it is historical, not an outstanding CI-installation task.

Wayfinder/intake are merged (#17/#18). Brian's TripWallet cash-wallet milestone (#25) was integrated through #27, including browser allocation fixes. Sample snapshots now commit to IndexedDB under a workspace Web Lock, with migration of older localStorage snapshots. Wallet browser tests exercise actual confirmation, receipt matching, duplicate import, follow-up draft and reload controls. They seed canonical action records because ReRoute is not delivered at this source checkpoint; they do not verify recovery approval through ReRoute.

Browser checks now start sample Vite on 5174, connected Vite on 5175 and an in-memory API on 8788 with AI disabled. Connected checks cover isolated visitors, scoped reset and reload. No separate hosted API or paid model call is required.

At main `1d42523`, this pass verified successful [Application run 41351300885](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41351300885) and [Coordination run 41351300895](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41351300895), including the exact source SHA and individual job-step results. Agent 1's [same-commit report](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6564154027) records 128 unit/integration passes (1 skipped, 2 todo) and 13 browser passes (2 skipped). Counts are owner-reported; raw application logs were not reread in this pass. Full release evidence still depends on Agent 1's accepted integrated commit, executable demo and complete journey under #8.

## Collaborator access

Brian's supplied handle is `brianren-cmd`; main's coordination metadata and the November 1 migration handoff record verified write access. Do not repeat the older claim that his handle is unknown or that his invitation is the blocker. This pass did not perform a fresh permission check.

Kelvin's supplied handle is `Wildtypers`, now recorded in coordination metadata. The migration handoff's last permission result was `none`; an earlier invitation was sent, but current acceptance/access is unverified. Recording his known handle does not grant access. Check current permissions/invitation state before any access-dependent work; do not send a duplicate invitation based on this status file. Neither teammate needs Figma access.

Judge access to the private repository and eventual demo remains separate evidence.

## Design, runtime and review limits

Native editable r1-draft frames, components, handoffs and exports exist in [DESIGN_MAP.md](DESIGN_MAP.md). PR #29 applied draft r1 to the app as its interim look. Every feature in `design/approvals.json` still has pending approval and a null revision. Jiwoo owns visual approval; feature-specific r1 composition remains with the feature owners.

Main includes Figma Code Layer lifecycle scripts (#31). [Agent 1 reports importing source `5249cb7`](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6564005638) into [Code Layer `24:1182`](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182), with preview NOT VERIFIED. A signed-in human still needs to open the preview; runtime/source alignment and judge access remain outstanding. The native design prototype remains separate from the Code Layer. Live AI and hosted backend/demo remain unverified. Provider booking/cancellation/refund actions are simulated.

The private-repository plan is documented as not enforcing branch protection. Agent 1/eligible reviewers retain technical acceptance and merge decisions. No invitations, visibility, billing, branch protection or publication were changed by this documentation pass. After Jiwoo published the environment, GitHub API access and structured reporting work. This resumed pass makes no further environment changes.

The team-provided deadline is November 10, 2026 at 11:59 PM; the official timezone remains unconfirmed. Keep #9 open until the release checklist and accepted-commit evidence are complete.
