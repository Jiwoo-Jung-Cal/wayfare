# WayFare Agent 1: cloud-session handoff

Paste this whole file as the first message of a new Claude Code cloud session on the GitHub repository **`Jiwoo-Jung-Cal/wayfare`** (default branch `main`). It replaces the history of the local session that did the work so far. The repository files, GitHub Issues and the Figma file are the source of truth. If they disagree with this document, they win.

Written 2026-11-01. At that time `main` was at `1d42523` ("Merge PR #31: Figma Code Layer lifecycle scripts").

---

## 1. Who you are

You are **WayFare Agent 1** (high budget). You own:

- the architecture, app/root configuration, shared schemas/contracts, data layer, backend and model adapter;
- the booking-extraction backend;
- the app shell and dashboard;
- **integration (Issue #8)**;
- technical code-to-Figma integration.

**Jiwoo** (`Jiwoo-Jung-Cal`, the user) owns all visual design and Figma editing, and approves every merge. For design pass r1, Jiwoo explicitly authorized Agent 1 to create native Figma content. Visual approval stays with Jiwoo.

Other owners. Do not edit their feature internals:

| Agent | Person | Area | Issue |
| --- | --- | --- | --- |
| 2 | Jiwoo | Wayfinder + booking intake UI | #4 |
| 3 | Jiwoo | `.github/`, `coordination/`, reporting scripts, release checks/docs | #5, #9 |
| 4 | Kelvin | ReRoute + CancelClock | #6 |
| 5 | Brian | TripWallet | #7 |

Other Issues: #1 is the team progress dashboard, #2 is Jiwoo's design handoffs/Figma, #3 is the shared foundation (done).

**Read first:** `AGENTS.md`, `docs/OWNERSHIP.md`, `docs/prompts/agent-1.md`, `docs/handoffs/agent-1.md`, `docs/PROGRESS_UPDATES.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/DESIGN_MAP.md`, `design/README.md`, `design/approvals.json`. Read `docs/PROJECT_BRIEF.md` once.

## 2. Hard rules (carry these over exactly)

- Never reset away work, overwrite another agent's branch, or force-push shared history. Use one short-lived branch per task (`agent-1/<slug>`) cut from a fresh `origin/main`.
- **Merges need Jiwoo's explicit approval in chat**, PR by PR. An auto-mode permission check blocked a merge of a teammate's PR (#21) without review. Don't work around that check; report it and let Jiwoo decide.
- Do not spawn extra agent workers or subagents to do assigned work. The user authorized five assistants only.
- Keep secrets server-side and out of commits. That covers `.env*` (except `.env.example`), `.data/`, `node_modules/`, `dist/`, test output, private booking data and full chats.
- Do not claim live AI, Figma sync, preview success or completion without real evidence.
- **Unknown amounts are never zero.** Money uses integer minor units. A deadline is met only when `t < D`.
- Label sample and simulated data honestly in the UI and in reports.
- Shared contract/config changes go through Agent 1 (you). Consumers may stub, but they may not redefine schemas.
- Post structured progress reports (session start, milestones, blockers, before pausing) with:
  ```bash
  python scripts/report_progress.py --task integration --status <ready|in_progress|blocked|review|done> \
    --summary "..." --next "..." --branch ... --commit ... --pr "#N" --figma "<url>" --checks "..."
  ```
  It posts to #8 via `gh`. If `gh` isn't authenticated in the cloud, use `--dry-run` and post the body with whatever GitHub tool is connected. Put design-specific details on #2.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 3. Stack and how to run checks

- Node **24** (CI pins 24.21.0) and npm **11.19.0** (`packageManager`). If the cloud image has an older npm, run `npm install --global npm@11.19.0`. The server runs TypeScript directly with Node type stripping.
- React 19.3.1, react-router 7.18.4 (hash router), Zod 4.6.7, Vite 8.3.5, TypeScript 6.0.3 (`erasableSyntaxOnly`, imports with `.ts`/`.tsx` extensions), Vitest 5.0.5, Playwright 1.64.1, `@anthropic-ai/sdk` 1.2.0 (server only), `@fontsource/inter` and `@fontsource/roboto-mono` 5.3.0.
- Checks, the same as `.github/workflows/app-checks.yml`:
  ```bash
  npm ci
  npm run typecheck
  npm test            # last local run: 133 passed, 1 skipped, 2 todo
  npm run build
  CI=1 npm run e2e    # last local run: 13 passed, 2 skipped
  ```
- **E2E in the cloud:** `playwright.config.ts` defaults to installed Google Chrome (`PW_CHANNEL ?? 'chrome'`). If Chrome isn't installed, run `npx playwright install --with-deps chromium` and then `PW_CHANNEL= CI=1 npm run e2e`. An empty string selects the bundled Chromium. Don't change the config to do this.
- **Modes:** without `VITE_WAYFARE_API_URL` the app runs in *sample mode* (browser storage, simulated extraction). With it set, the app runs in *connected mode* against `npm run server` (port 8787; see `.env.example`). Live AI extraction is **unverified** because no `ANTHROPIC_API_KEY` has ever been configured. Never commit one.
- Known wart: there's a `@ts-expect-error` for `duplex` in `server/node.ts`.

## 4. Architecture in one screen

- **Contracts:** `src/core` holds the contracts, money, time and IDs, plus `WorkspaceRepository`, which has local and store implementations with idempotency and `ensureClaims`. `src/core/http/httpClient.ts` is the connected-mode client (`/api/repo/*`, `/api/extract/booking`, `/api/extract/wallet`, `/api/health`, `/api/session`).
- **Server:** `server/` contains `api.ts`, `extraction.ts`, `walletEvidence.ts`, `workspaces.ts`, `rateLimit.ts`, `config.ts`, `featureHandlers.ts` and `node.ts`.
- **App shell:** `src/app/` contains `App.tsx` (shell, nav, mobile tab bar, clock bar), `AppServices.tsx` (mode selection), `Dashboard.tsx`, `DemoControls.tsx`, `featureRegistry.ts` (`FEATURES`, `ROUTE_TABLE`), `claimSync.ts` and `ClaimSyncNotice.tsx`.
  - Claim sync runs after a recorded action, on wallet load, and on retry.
- **Shared UI and styling:**
  - `src/ui/index.tsx` holds the shared components: Button, Card, StatusBadge, MoneyText, InstantText, CapabilityLabel, Loading/Error/EmptyState, Notice, MoneyStat, KeyValue.
  - `src/styles/tokens.css` holds the design-r1 tokens behind `--wf-*` names, matching the Figma variables 1:1. `src/styles/global.css` has the rest of the styling.
- **Feature modules:** each lives in its owner's folder and is registered through `featureRegistry`. Don't edit their internals.

## 5. What is done

| Item | Status |
| --- | --- |
| Shared foundation (#3), contracts, backend, extraction backend, shell, dashboard | Merged |
| Wayfinder/intake functional modules (Agent 2, #17) | Merged |
| TripWallet (Brian, #25/#27) + claim sync registration | Merged |
| Browser E2E journey + gated CI checks | Merged; `main` CI green |
| Figma design pass **r1-draft**: variables, 21 components, 19 screens on pages 02–06, clickable prototype, handoffs + exports (#28) | Merged; **approval pending** (`design/approvals.json` all `pending`) |
| r1 applied in code as the interim working design (#29) | Merged |
| `docs/ARCHITECTURE.md` refresh (#30) | Merged |
| Figma **Code Layer** lifecycle scripts `.figma/make/{install,dev,deploy-preview,deploy}`, `.mise.toml` (Node 24), `.gitattributes` LF pin (#31) | Merged |
| Running app imported into Figma as a Code Layer (sample mode, no server/AI) | Imported, **preview not verified** |
| Review on Agent 2's #21; re-review on Agent 3's #20 | Posted |
| Progress report on #8 for this pass | Posted |

## 6. What is open, in priority order

1. **PR #21** (Agent 2, `agent-2/wayfinder-intake`, "Fix booking review amount precision and stale extraction errors").
   - Reviewed; [review comment](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/21#issuecomment-6563929166).
   - Local checks with #21 on top of main passed.
   - **Waiting on Jiwoo's merge decision.** Don't merge without an explicit "merge #21".
2. **PR #20** (Agent 3 runbook): re-reviewed ([comment](https://github.com/Jiwoo-Jung-Cal/wayfare/pull/20#issuecomment-6563945079)). The owner's response or Jiwoo's merge is pending.
3. **Verify the Figma Code Layer preview.**
   - Layer: node `24:1182` on page `1:8` (Working demo). [Open it](https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=24-1182&autoplay-code-preview=24-1182).
   - The import returned `status: imported`, `preview: not_verified`, import seed `8f1e12ba…`.
   - The local session's browser wasn't signed in to Figma. A signed-in human (Jiwoo) has to open it and confirm `npm ci` + Vite start.
   - If it fails, look at the Vite `server.allowedHosts` / host check first. Any config change must be gated on `process.env.FIGMA`, and must not disable the host check globally.
   - Re-importing needs a **fresh** `send_code_to_figma` upload. Earlier imports can't be replaced, only repaired via the returned `repairFrom`.
4. **ReRoute + CancelClock (Kelvin, #6)** is the main missing feature for the full demo journey. When Kelvin's PR lands:
   - review it against contracts;
   - integrate it through `featureRegistry`;
   - make sure ReRoute recorded actions drive claim sync into TripWallet;
   - turn the remaining skipped/pending E2E steps into real tests;
   - confirm CI is green;
   - report on #8.
5. **Design approval:** Jiwoo reviews r1 in Figma.
   - On approval, update `design/approvals.json` and the handoffs, changing only what Jiwoo approved.
   - If Jiwoo requests visual changes, those go into Figma (Agent 1 has his authorization for the design pass) and then into `tokens.css` / `global.css`.
6. **Undecided (Jiwoo's call):**
   - live AI with a real key (server-side only);
   - hosting and judge access for the connected-mode demo;
   - release evidence with Agent 3 (#9).

## 7. Figma reference

- File: `ZZS9jEmANeCrjGxWxxCofK` (Jiwoo Jung, student plan, View seat, `code_layers_enabled: true`). The Figma MCP session ID used locally was `f20ddaeb-…`. Start a fresh one in the cloud with `create_session` if the Figma connector is available there.
- Pages: start `0:1`, foundations `1:2`, dashboard `1:3`, intake `1:4`, wayfinder `1:5`, reroute `1:6`, tripwallet `1:7`, working demo `1:8`.
- Components: Button `5:38`, Badge `5:53`, Field `5:122`, Checkbox `5:131`, Tab `5:136`, Alert `5:152`, MoneyStat `6:42`, BookingRow `6:75`, DeadlineRow `6:116`, ClaimRow `6:207`, ReceiptRow `6:248`, Evidence `6:249`, KeyValue `7:30`, PlanCard `7:91`, StateBlock `7:110`, AssetCard `7:127`, Dialog `7:128`, NavBar `7:230`, MobileTabBar `7:311`, MobileHeader `7:312`, DemoClockBar `7:318`.
- Boards: token board `16:688`, start guide `17:1785`, prototype banner `17:2`, prototype flow start `17:5`.
- Code Layer: `24:1182`.
- Full screen-to-node map: `docs/DESIGN_MAP.md`. Exports: `design/exports/**`.
- r1 look: teal accent `#0E6F7C`, slate neutrals, violet "simulated" `#5B3FA8` / `#F1ECFB`, Inter + Roboto Mono.
- Plugin-API lessons from the local session:
  - `appendChild` returns undefined, so use a helper.
  - Reset `primaryAxisSizingMode='AUTO'` after `resize()`.
  - Custom JavaScript properties on Figma nodes aren't allowed.
  - Always pass every text property on instances.
  - Retry `get_screenshot` one request at a time.

## 8. Cloud-environment checklist (do this first)

1. Run `git fetch && git status`. Confirm you are on fresh `main` (≥ `1d42523`), then branch.
2. Confirm the toolchain: `node -v` (24.x), `npm -v` (11.19.0); then run `npm ci`.
3. Run the checks in §3. Report any environment-only failures (for example missing Chrome) as environment issues, not code regressions.
4. Check `gh auth status`. If it isn't authenticated, use the connected GitHub tooling for PRs, comments and reports.
5. Check whether the Figma connector exists in the cloud. If it doesn't, Figma work (§6 items 3 and 5) stays with Jiwoo locally. Say so instead of guessing.
6. Post a session-start report on #8 (§2).

## 9. First message to send Jiwoo from the cloud

Briefly confirm what you checked in §8. Then list the decisions waiting on him: merge #21? #20? Has the Figma Code Layer preview been verified? Then continue with §6 item 4 as soon as Kelvin's ReRoute PR exists. Until then, keep checking `main` CI and the open PRs when resumed, without polling.
