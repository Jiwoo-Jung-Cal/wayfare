# Agent 1 handoff

Status: milestone 1 (shell, contracts v1, sample persistence) is in PR #12. Milestone 2 (API server, guest sessions, connected repository, model adapter, booking extraction) is on branch `agent-1/extraction`, stacked on #12.
Task Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3 (foundation). Integration follows on #8.
Branch / commit / PR: `agent-1/foundation` (PR #12) and `agent-1/extraction` (stacked PR, linked from #3).

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
