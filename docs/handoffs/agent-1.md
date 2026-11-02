# Agent 1 handoff

Status (2026-11-02, cloud session, later): main `87ad471` has foundation, Wayfinder/intake (#21, #40), TripWallet, interim design r1 (approval pending), the r1 root-font fix (#41), Figma Code Layer scripts, vendor chunk splitting, atomic action preconditions (#38) and the Wayfinder/intake e2e coverage (#36). ReRoute (#37, Kelvin) is integrated **on branch** in draft PR #39, which is green on current main and waits on Kelvin's link fix and precondition adoption in #37. The dated sections below keep their historical checks; the latest section supersedes their status.
Task Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3 (foundation, closed). Integration is tracked on #8.
Branch / commit / PR: main `87ad471` (after #36). Open: #37 (Kelvin, draft), #39 (Agent 1 ReRoute integration, draft, head `812f5a6`). Work goes on short-lived `agent-1/<slug>` branches cut from main.

## For Agent 3 (CI)

```
runtime: node@>=24 (verified 24.21.0); package manager: npm@11.19.0; cwd: repository root
manifest/lockfile: package.json, package-lock.json
install: npm ci
typecheck: npm run typecheck
test: npm test          (vitest run; non-watch)
build: npm run build    (output dist/)
config: none (no secrets, no network, no server needed for these checks)
optional: npm run server   (API on :8787; see .env.example. Not needed for CI.)
e2e: npm run e2e           (Playwright; needs Google Chrome, which GitHub ubuntu-latest has. Or set PW_CHANNEL= and
                            run `npx playwright install --with-deps chromium`. Sample mode; no server or secrets.)
```

## Working behavior

- One connected shell with hash routes `/`, `/trips/:tripId`, and `/trips/:tripId/{plan,import,reroute,wallet}`.
- Feature modules are discovered automatically from `src/features/<key>/index.ts(x)`. Unregistered routes show which owner they are waiting on.
- The dashboard shows the selected plan, deadlines (open or passed, judged by the active clock), bookings, disruption, actions and claims. It shows stored owner results only and recalculates nothing.
- Demo controls:
  - load the sample trip;
  - import the sample bookings through the reviewed-save operation (idempotent);
  - trigger the flight cancellation (through ReRoute's hook once it is registered; until then it records the disruption fact only);
  - adjust the clock: +1 hour, +1 day, 1 second before the hotel deadline, exactly at it, reset;
  - switch to real time;
  - reset or clear the workspace, which affects only this visitor's workspace.
- The claim-sync orchestration calls TripWallet's `syncClaimsFromActions` after `notifyActionRecorded`. A failure shows a retryable pending state, and the recorded action is kept.

## Changed owned paths

`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/core/**`, `src/app/**`, `src/ui/**`, `src/styles/**`, `src/main.tsx`, `docs/CONTRACTS.md`, `docs/decisions/agent-1-foundation.md`, and this file.

- **Contract version:** schema v1 (`SCHEMA_VERSION = 1`). See docs/CONTRACTS.md.
- **Design revision implemented:** none. The foundation design is still pending in `design/approvals.json`. `src/styles/tokens.css` holds neutral placeholder values behind stable `--wf-*` variable names.
- **Relevant Figma links:** https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK. This session had no Figma connector, so seat, Code Layer and import status are unverified.

## Checks and outcomes (2026-10-31, local)

- `npm ci` OK.
- `npm run typecheck` OK.
- `npm test`: 21 passed.
- `npm run build` OK.
- Browser check on the Vite dev server:
  - the dashboard rendered;
  - importing twice reported "already imported; nothing duplicated";
  - the disruption was recorded;
  - at the hotel deadline instant the deadline showed "Passed";
  - state survived a reload;
  - at 375px there was no horizontal scroll;
  - the console had no errors.

## Live versus simulated

- **Sample mode (default):** data lives in the browser. Extraction is simulated and recognizes the sample documents only.
- **Connected mode** (`VITE_WAYFARE_API_URL`): data lives in a server workspace. The connected path has been verified locally only.
- **AI extraction:** live only when `ANTHROPIC_API_KEY` is set on the server, which has **not been verified**. Without it, the sample documents are simulated and other text returns `not_configured`.
- **Provider actions** (cancellations, refunds) are always simulated.

## Access status (checked 2026-10-31)

- **Live AI:** not verified. The server environment has no `ANTHROPIC_API_KEY` or `WAYFARE_ANTHROPIC_API_KEY`, and no `ant` CLI. Agent 1 does not reuse its own coding-assistant credentials for the app.
- **Figma:** unverified. This Agent 1 session's connectors are only Claude Docs and scheduled-tasks, with no Figma connector, so the Code Layer, seat, import and preview checks could not be run. Nothing was imported, and nothing is claimed.

## Integration (#8) progress

- **Done in the shell:**
  - claim sync runs after a recorded action, on wallet load, and on manual retry;
  - requests that arrive during a running sync are merged, so a recorded action is never skipped;
  - a pending, retryable notice appears on the dashboard, wallet and reroute routes.
- **Tests:** `src/app/integration.test.ts` covers the orchestration and the extraction → reviewed-save import step. The steps that need the feature modules are listed as pending (`it.todo`) until Agents 2, 4 and 5 deliver.
- **Browser E2E** (`e2e/journey.spec.ts`, run with `npm run e2e`): the shell journey in real Chrome. It covers:
  - load, then import twice with no duplicates;
  - the disruption;
  - the clock at 22:59:59Z ("Open") and 23:00:00Z ("Passed");
  - reload persistence, then a confirmed reset of this workspace only;
  - claim sync on wallet load, shown in words;
  - keyboard skip link and navigation;
  - no horizontal scroll at mobile width.
  The feature steps are `test.fixme` until the modules exist.
- **Mutation check:** a deliberately broken deadline rule made the E2E fail.
- **Agent 2 (#4, PR #17):** reviewed and integrated on `agent-1/integrate-wayfinder-intake`. It uses the shared contracts only, with no schema, backend or root changes. Converted E2E steps:
  - plan comparison, with the unknown-price plan not selectable;
  - nonstop selection, shown on the dashboard after a reload, with reselect as a no-op;
  - hotel intake that keeps its evidence and the exclusive deadline window, saves once (a repeat save reports "Already imported");
  - the unknown policy, malformed document and unconfigured AI cases;
  - no horizontal scroll at mobile width on the plan and import pages.
- **Policy-correction request (#3):** v1 keeps Agent 2's conservative "disputed terms are saved as unknown" behavior. There is no positive policy-edit contract in v1.
- **Bundle size:** 512 kB (153 kB gzipped) is only a warning, and it's accepted for the demo.
- **Waiting on:** #6 and #7, which had no commits when checked.

## Release inputs (for Agent 3, #9)

- **Architecture, decisions and deployment options:** `docs/ARCHITECTURE.md`.
- **Static build:** verified on main `96be803`. `dist/`, served from a sub-path (`/wayfare/demo/`) on a bare static server, loaded the `/plan` deep link and kept imported bookings across a reload. There were no page errors and no failed requests.
- **Merged:**
  - #22: session expiry and rate limits. It adds `WAYFARE_SESSION_TTL_HOURS`, `WAYFARE_SESSION_LIMIT_PER_HOUR`, `WAYFARE_EXTRACT_LIMIT_PER_HOUR` and `WAYFARE_TRUST_PROXY`.
  - #23: a connected-mode E2E with two isolated visitors. `npm run e2e` now also starts the API on :8788 and a connected Vite on :5175.

## Blockers and owners

- **AI provider credentials (Jiwoo):** none were found in this environment, so live extraction can't be verified yet.
- **Backend hosting / Supabase project (Jiwoo):** none exists. Creating one or changing billing is Jiwoo's decision.
- **Figma (Jiwoo):** Code Layer and import access need checking from a session with the Figma connector.
- **Foundation visual design (Jiwoo):** approval is pending.

## Next bounded step

1. Jiwoo merges #12 and then the extraction PR. Agent 3 wires CI.
2. With an API key: run one live extraction of a sample confirmation and record the request ID and model here.
3. Integration on #8: register the features from Agents 2, 4 and 5; verify the claim-sync handoff; run the browser journey test; check Figma runtime access.

## Tool/workflow decision

See docs/decisions/agent-1-foundation.md.


## Brian shared-contract requests (#7)

Branch: agent-1/tripwallet-shared-contracts. Base: 6279d8c0e4bd5e8da215193f9eff39b88f23c6a9. Implements atomic workspace-wide receipt allocation bounds plus browser cross-tab lock/reload, and a server-only feature-owned wallet evidence handler seam with typed client transport. Existing `saveClaim` and `Receipt.matchState` usage remain compatible; `FeatureContext.walletEvidence` is optional for existing fixtures.

Local checks: typecheck/build pass; full unit/integration suite 116 passed, 2 skipped, 3 todo (11 new focused checks). Disabling the shared lock/reload causes the independent-stale-repositories regression to fail; the correct implementation is restored. Browser race coverage is in e2e/allocation.spec.ts. Local browser installation returned an invalid archive; actual browser verification must be recorded from the PR's GitHub Actions runner before merge. Live wallet AI remains unverified and the feature handler remains Brian-owned.


## TripWallet milestone integration and browser persistence follow-up (2026-11-01)

Branch: `agent-1/integrate-tripwallet`. Base: `503e2c14bd8a94b9d298f6b34065c8d2c182ad23`. Integrates Brian's exact PR #25 head `3665b6262e42d94e5131f24e0dfa3c86751c3313`, preserving its history and feature ownership.

PR #26 added workspace-wide allocation validation and the wallet evidence transport. Its overall CI job was green, but the browser log showed the cross-tab race failed once before passing on retry. Do not treat that as clean race verification. This follow-up replaces browser snapshot localStorage writes with IndexedDB commits under the same workspace Web Lock. Existing snapshots migrate without discarding data. The two-tab regression performs three independent races with retries disabled. Memory and single-process server storage retain their existing queues.

The browser journey now drives Brian's actual reviewed-confirmation, receipt import/matching, follow-up draft, duplicate import and reload controls. Because ReRoute UI is missing, only its canonical durable action outputs are seeded as fixtures; this does not verify cancellation approval through ReRoute. Actual TripWallet module claim sync is also checked at the contract boundary.

Design: `design/handoffs/tripwallet.md` includes native draft screen references, three usable exports, responsive/state guidance and the known receipt-state board defect. All approvals remain pending. The functional UI is a shared-component placeholder, not approved visual fidelity.

Local validation: typecheck and production build pass; 128 unit/integration tests pass, one ReRoute check is skipped and two full-flow checks remain todo. Feature discovery uses explicit .ts/.tsx patterns and the delivered TripWallet registration is a required test, not a conditional skip. The actual Chrome CI run will be recorded in the integration PR and #8 before merge. No local Chrome is installed; the browser installer returned an invalid archive. Do not claim local browser success.

Still pending: ReRoute #6 and the full approval-to-wallet browser flow; Brian's feature-owned wallet evidence handler/client wiring and live AI verification; remaining asset functionality; Jiwoo's visual approval and Figma running-app verification. The optional `ctx.walletEvidence` interface is available, but this milestone does not claim wallet AI.

Chrome verification history for this milestone: run [41291835118](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41291835118) passed all three no-retry cross-tab allocation races, typecheck, 128 tests and build. The new wallet UI test timed out locating its exact-text nested-label selector before confirmation; that run is not recorded as wallet-flow success. The selector now targets the labeled combobox by its stable prefix (nested option text must not become part of an exact label assumption). Wallet integration also runs with retries disabled. The corrected run must pass before merge.

The wallet browser flow also checks the populated/reconciled wallet at 390/360/320 px and opens evidence at 320 px. Shared capability labels may wrap; long card identifiers and preformatted evidence wrap within the card. Short status badges retain their existing presentation. This is a functional readability fix using current tokens, not visual design approval.


## Figma design pass r1-draft (2026-11-01, delegated by Jiwoo)

- **Task:** `docs/prompts/agent-1-figma-design.md`. Jiwoo explicitly authorized native Figma design for this pass, and he keeps visual approval.
- **Access:**
  - The Figma connector was connected in this session as Jiwoo Jung (student plan, **View** seat, Code Layers enabled).
  - Writes through the plugin API worked and persisted. Every write was read back in a later call, and all frames are on their pages.
  - The file's eight pages were empty when the pass started, so there were no manual edits to preserve.
  - Code Layer import of the running app was **not** attempted. The file holds native designs plus a design prototype, not the code-backed app.
- **Built in the Figma file:**
  - **Variables (all with `var(--wf-*)` code syntax):** 3 collections; 24 primitives, 23 semantic colors and 9 dimension variables.
  - **Styles:** 10 text styles and 2 effect styles.
  - **Components:** 21 sets or components with variants and text properties.
  - **Screens:** 20 desktop (1440) and mobile (390) frames across Dashboard, Intake, Wayfinder, ReRoute and TripWallet, plus a token specimen and a start guide.
  - **Prototype:** on page 07, 13 cloned screens and a flow "WayFare walkthrough (design prototype)", with click-throughs and nav tabs, labeled as a design prototype.
  - **Editability audit:** all 20 frames are native layers and instances, with **0 image fills**.
- **Where the details are:**
  - Node IDs: `docs/DESIGN_MAP.md`.
  - Specs: `design/handoffs/*.md`.
  - Exports: `design/exports/{foundation,dashboard,wayfinder-intake,reroute,tripwallet,prototype}/`.
  - `design/approvals.json` is unchanged; everything stays pending until Jiwoo approves.
- **Visual QA fixes made during the pass:**
  - Field and Alert variants were clipped because `resize()` had fixed their height.
  - Status badges were in fixed-width slots so columns align across states.
  - Checkbox labels now wrap.
  - Narrow-panel row collapse on the Intake and TripWallet state boards (rows now span the full width).
  - The ReRoute "Closing soon" copy (30 h).
  - The Points AssetCard text.
  - The spacing specimen overflow.
- **Not reconciled:** TripWallet code (#25 / #27) merged while the draft was being made. The frames follow the published requirements, and reconciling them with Brian's implemented states is an open review item. ReRoute code does not exist yet; its frames follow `design/handoffs/reroute.md`.


## Cloud session (2026-11-01)

- **Environment:** a Claude Code cloud container. The image ships Node 22 / npm 10, so checks ran on a checksum-verified Node 24.21.0 with npm 11.19.0 (matching CI). Google Chrome is installed, so `CI=1 npm run e2e` uses the default `chrome` channel. `PW_CHANNEL=` does **not** work in this image (the bundled headless shell for Playwright 1.64.1 is absent). That is an environment gap, not a code failure. `gh` is not authenticated here; reports and PRs go through the GitHub connector.
- **Baseline main `1d42523`:** typecheck and build pass; 128 unit/integration passed, 1 skipped, 2 todo; e2e 13 passed, 2 skipped. GitHub Application and Coordination checks green.
- **#32 (merged, Jiwoo-approved):** `vite.config.ts` Rolldown `codeSplitting` groups. A sourcemap breakdown showed react-dom/react-router/zod are about 90% of the bundle and feature pages about 60 kB of source, so I split out vendors instead of lazy-loading routes (which would need a `FeatureModule` contract change). Chunks: app 136 kB, vendor-react 219 kB, vendor-router 91 kB, vendor-zod 92 kB. No size warning. Built `dist/` was served from a sub-path and loaded in Chrome: all chunks 200, the dashboard and the plan/import/wallet routes render, no page errors. No Anthropic strings in any built JS chunk. This supersedes the "Bundle size" line under Integration above.
- **Figma:** the connector is available in the cloud (whoami: Jiwoo Jung, code layers enabled). The Code Layer `24:1182` preview is still **not verified**, and it predates #32.
- **Open, owner:**
  - ReRoute/CancelClock (#6, Kelvin): no code, no PR. When it lands, integrate it, verify ReRoute → TripWallet claim sync, and convert the 2 skipped e2e / 2 todo integration steps.
  - PR #21 (Agent 2) and PR #20 (Agent 3): Jiwoo's merge decision.
  - Design r1 approval, Code Layer preview, live AI, and hosting (Jiwoo).
  - Optional TripWallet `DashboardPanel` (Brian, #7).


## Cloud session: ReRoute integration (2026-11-02)

- **Atomic action preconditions, PR #38** (Kelvin's request: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6570629325).
  - `recordBookingAction` accepts optional `preconditions: { policyId, expectedPolicyRevision, validBefore, expectedClock?, replacementQuoteId? }`, defined by `ActionPreconditionsSchema`.
  - They're checked inside the same `StoreRepository` write, against the draft and the write's active-clock `now`. One implementation serves the browser Web Lock and the server workspace queue.
  - A stale check returns a non-retryable `conflict` (`details.precondition: true`; "Recovery preview expired; review again" at the cutoff) and commits nothing.
  - Successful idempotent replays return the original without re-checking. Omitting the field keeps the old behavior.
  - The contract is in `docs/CONTRACTS.md` → "Action preconditions"; adoption notes are on #6.
  - Tests: `src/core/store/actionPreconditions.test.ts`, 11 tests covering two local tabs and two HTTP clients, plus concurrent clock-vs-action races that must hit both interleavings. Disabling the check fails 9 of 11 (replay and compatibility correctly still pass).
- **#37 review** (https://github.com/Jiwoo-Jung-Cal/wayfare/pull/37#issuecomment-6587326231).
  - Contract use and ownership are fine, and Kelvin's real-Chrome `browser.test.ts` passed here.
  - **Bug:** `<Link to="../wallet">` and `<Link to="../import">` resolve to `/#/`, because React Router 7 resolves relative links against the route hierarchy and the shell's routes are flat. Fix: `relative="path"` or an absolute path.
  - Still to adopt: #38's preconditions.
  - Minor: points and voucher components are typed as money.
- **Integration, PR #39** (draft; branch `agent-1/integrate-reroute`, which merges #37 `b69d02e` and #38):
  - The two `test.fixme` journey steps are now real UI flows: approval → shell claim sync → TripWallet and the dashboard ($820, hotel $400). A second flow runs at the exact cutoff ($620, hotel $200) and covers reload, disabled re-approval, re-trigger, wallet-load sync and a duplicate receipt import.
  - The two `it.todo`s are replaced by a data-level journey through `prepareApproval`/`approveRecovery`, the orchestrator and TripWallet's real sync.
  - The ReRoute registration check is now required.
  - **Found:** Vitest 5's default `fsModuleCache` kept `featureRegistry`'s glob stale, so ReRoute was silently missing from the registry in local runs. Set `test.fsModuleCache: false`.
  - Results: 172 tests passed, 0 skipped, 0 todo; e2e 15 passed, 0 skipped (19 passed with #36 merged on top).
- **Figma Code Layer `24:1182`.**
  - The node exists: a 1512×982 code instance on page `1:8`.
  - Figma's server-side screenshot is an empty light-grey frame. That's neither a success nor a failure: a static render doesn't run the code.
  - Running `.figma/make/install` and `.figma/make/dev` from a clean worktree of main works: `npm ci` OK, Vite ready, `localhost` → 200 with the WayFare page.
  - **But any non-localhost `Host` header gets 403** "Blocked request. This host is not allowed" (Vite's host check). If Figma's preview reaches the dev server through a proxy hostname, it would show that page instead of the app.
  - Not fixed speculatively, because the real hostname is unknown. When a signed-in human opens the preview, Vite's error names the host. Then set `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<that host>` inside `.figma/make/dev` only. That keeps the change to Figma's runs, with no `vite.config.ts` change and no global disable.
  - The preview is still **not verified**. The cloud sandbox can't reach figma.com directly (proxy 403).
- **Open, owner:**
  - Kelvin (#6): fix the #37 links; adopt #38's preconditions and add a stale-precondition feature test.
  - Jiwoo:
    - merge decisions on #36, #38, then #37 and #39;
    - open the Code Layer preview and report any "Blocked request" host;
    - formal r1 approval;
    - live AI and hosting.
  - Agent 3 (#9): the release pass after #39 merges.


## Cloud session: merges and ReRoute status (2026-11-02, later)

- **Merged with Jiwoo's approval**, each pinned to its tested head SHA, after one combined check of all four on main `d7b0fd1`: typecheck; 145 passed / 1 skipped / 2 todo; build; e2e 18 passed / 2 skipped. main's tree after the four merges is byte-identical to the tested combination.
  - #38 preconditions: head `42950fc`, merge `6924b84`.
  - #41 root font fix: head `9d8122c`, merge `0a3332b`.
  - #40 Agent 2 notice order: head `4508cd4`, merge `d036cf5`.
  - #36 Wayfinder/intake e2e: head `dbfa3bc`, merge `87ad471`.
- **#41:** `html` stays at 100% (16px); only `body` gets `--wf-text-md`. A new e2e check asserts root 16px, body 15px, H1 26px and 1200px content at 1440px. It fails without the fix. This was Agent 2's finding (#4 comment 6587211156).
- **#37 (Kelvin):** unchanged at `b69d02e`. Coordination posted on #6 (comment 6589626202): merge main with a merge commit; add `relative="path"` to the three ReRoute links and click "Open TripWallet" in `browser.test.ts`; pass `preconditions` in `approveRecovery` and map `details.precondition` to `stale`; add a race test that moves the clock between the last read and the write. #37 merges cleanly with main `87ad471`.
- **#39:** main merged in (`812f5a6`). Results: typecheck; **172 passed, 0 skipped, 0 todo**; build; **e2e 20 passed, 0 skipped**. That covers the full journey (approval → claim sync → TripWallet/dashboard, the cutoff case, reload/idempotency), the type scale and the Wayfinder/intake states. **Not merged:** it carries #37's broken links and no precondition use yet. After Kelvin pushes: merge his head into #39, re-run everything, and add a shared e2e click on ReRoute's "Open TripWallet" link.
- **Figma preview, actual error not obtainable from the cloud.** No Figma MCP tool reports Code Layer runtime status or logs. `get_screenshot` is a static render (empty frame). `send_code_to_figma` itself states that importing does not verify preview. The sandbox proxy blocks figma.com. Known locally: `install`/`dev` work; Vite returns 403 "Blocked request. This host (…) is not allowed" for non-localhost Host headers. **External input needed from a signed-in human** (Jiwoo): open https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182&autoplay-code-preview=24-1182, wait for install and start, and copy exactly what the preview shows:
  - (a) a "Blocked request. This host ("X") is not allowed" page: send X. Fix: add `export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="X"` to `.figma/make/dev` only.
  - (b) an install/setup error or log text: send it verbatim.
  - (c) the WayFare dashboard: preview verified.
  
  Also note that layer `24:1182` was imported from source `5249cb7`, which predates #32 through #41. Previewing current main needs a fresh `send_code_to_figma` import, which adds a new layer, so it needs Jiwoo's go-ahead.
- **Open, owner:**
  - Kelvin: the #37 fixes above.
  - Jiwoo: open the Code Layer preview and report its exact output; approve a fresh import if current code should be previewed; r1 approval; live AI; hosting; merge of #37 and #39 once refreshed.
  - Agent 3 (#9): the release pass after #39.
