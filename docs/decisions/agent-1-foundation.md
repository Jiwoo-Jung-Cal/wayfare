# Agent 1 decision note: foundation stack and contracts

**Choice.**
- React 19 + TypeScript 6 + Vite 8, with npm and exact pins.
- Zod 4 schemas in `src/core/schema.ts` are the single contract source, and TypeScript types are inferred from them.
- One snapshot-backed `StoreRepository` enforces every constraint. Sample mode wraps it with browser storage, and the server will wrap it per workspace.
- Hash routing, and relative `.ts` imports that also run under Node 24 type stripping.

**Evidence.**
- 21 focused core tests pass: money, the deadline boundary, fixture totals, idempotency, isolation, atomic failure and reload.
- `npm run typecheck` and `npm run build` pass.
- In the browser, the shell persisted state across a reload. Repeating the sample import did not duplicate records, and at exactly `2026-11-19T23:00:00Z` the hotel deadline showed "Passed". The mobile 375px layout has no horizontal scroll.

**Alternatives considered.**
- TypeScript 7 (the native port): newer, but the ecosystem and editor support are less settled. TypeScript 6 is the lower-risk pin for five parallel agents.
- Separate hand-written types and JSON Schema: rejected because they would drift.
- Supabase client-side RLS from day one: no project or credentials exist yet, and creating one is Jiwoo's call. The repository interface lets the backend change without touching feature code.

**Tradeoff.**
- Sample-mode persistence is per-browser localStorage. That is durable across reloads but not across devices.
- Atomicity is per operation, by committing a cloned draft. That is adequate for one traveler per workspace, but it is not a multi-writer database.

**Figma.** This Agent 1 session has no Figma connector, so the Code Layer seat, import and compatibility checks are **unverified** and not claimed. The production build uses a relative base and hash routing so it can run from an embedded or static origin without rewrites.
