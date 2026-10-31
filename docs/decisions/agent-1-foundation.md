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

## Milestone 2: server, AI provider and extraction

**Choice.**
- One web-standard API handler (`server/api.ts`) running on Node 24 with no extra runtime. It provides guest bearer sessions, one JSON file per workspace, and the same `StoreRepository` constraints as sample mode.
- One server-only model adapter on the official Anthropic SDK. It defaults to `claude-opus-5-5` (`WAYFARE_AI_MODEL` overrides it) and uses Zod structured outputs with server-side `fallbacks: "default"`.
- Deterministic normalization (`src/core/extraction.ts`) shared by the live and sample paths.

**Why this provider.**
- The team has an Anthropic integration path, and its typed structured-output helper validates against the same Zod library the contracts already use. That avoids a second schema language.
- Credentials are not configured yet. The adapter interface keeps the provider swappable without touching handlers.

**Alternative considered.** Supabase Edge Functions plus Postgres RLS, as proposed in the brief. That is deferred until Jiwoo provisions a project: no paid resources were created. The handler is fetch-style, so it can be wrapped for Deno later. SQL migrations will mirror the store's unique keys:
- `(workspace, kind, contentHash)` for documents;
- `idempotencyKey` for actions;
- `(actionRecordId, recoveryComponentId)` for claims;
- normalized receipt `reference`.

**Tradeoff.**
- File persistence suits a single server instance for a demo. It is not horizontally scalable.
- Guest tokens never expire, and there is no rate limiting on `/api/session` yet.

**Verified.**
- 42 tests pass. The Node server was smoke-tested with curl: health, session, a scoped read, CORS preflight and file persistence.
- In the browser, connected mode imported bookings with replay protection, recorded the disruption, set the clock, and kept that state across a reload.
- A stale-token recovery action works.

**Not verified.** A real model call: no `ANTHROPIC_API_KEY` is available here. The adapter typechecks against SDK 1.2.0, and the SDK accepted the generated output schema locally.
