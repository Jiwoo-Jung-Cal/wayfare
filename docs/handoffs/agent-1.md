# Agent 1 handoff

Status: foundation v1 and milestone 2 are merged on main (`bf4d2c7`, PRs #12 and #13). Integration (#8) has started on branch `agent-1/integration`, and the feature modules have not been delivered yet.
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
