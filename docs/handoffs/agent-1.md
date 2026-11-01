# Agent 1 handoff

Status: shared foundation and Wayfinder/intake are merged. TripWallet milestone PR #25 is being integrated under #8; ReRoute is not delivered. The dated sections below retain historical checks; the latest milestone supersedes their status.
Task Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3 (foundation). Integration follows on #8.
Branch / commit / PR: main `bf4d2c7` (#12, #13 merged). Integration work is on `agent-1/integration` (PR linked from #8).

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
