# Agent 1 handoff

Status: foundation milestone 1 in review (shell + contracts v1 + sample persistence). Extraction backend, server adapter and the connected repository are next.
Task Issue: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/3 (foundation). Integration follows on #8.
Branch / commit / PR: `agent-1/foundation`. See the PR linked from #3 (`<!-- wayfare-task:foundation -->`).

## For Agent 3 (CI)

```
runtime: node@>=24 (verified 24.21.0); package manager: npm@11.19.0; cwd: repository root
manifest/lockfile: package.json, package-lock.json
install: npm ci
typecheck: npm run typecheck
test: npm test          (vitest run; non-watch)
build: npm run build    (output dist/)
config: none (no secrets, no network, no server needed for these checks)
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

Everything is sample mode. Provider actions are simulated. There is no AI call yet and no server.

## Blockers and owners

- **AI provider credentials (Jiwoo):** none were found in this environment, so live extraction can't be verified yet.
- **Backend hosting / Supabase project (Jiwoo):** none exists. Creating one or changing billing is Jiwoo's decision.
- **Figma (Jiwoo):** Code Layer and import access need checking from a session with the Figma connector.
- **Foundation visual design (Jiwoo):** approval is pending.

## Next bounded step

1. `server/` with the web-standard handler: guest session per workspace, the HTTP repository, and a server-only model adapter.
2. The booking-extraction endpoint, with a deterministic sample extractor labeled "simulated".
3. Extraction request/result/error examples for Agent 2.

## Tool/workflow decision

See docs/decisions/agent-1-foundation.md.
