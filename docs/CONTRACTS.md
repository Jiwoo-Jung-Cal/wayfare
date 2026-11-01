# Shared contracts index (v1)

Owner: Agent 1. Source of truth is the code below; this page explains it and gives examples. For the system overview and decision rationale, see [ARCHITECTURE.md](ARCHITECTURE.md). Do not copy schemas into feature code. Request changes in #3 (foundation) or #8 (integration).

## Runtime and commands (verified on Windows 11, Node 24.21.0, npm 11.19.0)

| Item | Value |
| --- | --- |
| Runtime | Node.js `>=24` (verified 24.21.0) |
| Package manager | npm 11 (`packageManager: npm@11.19.0`), lockfile `package-lock.json` at repo root |
| Working directory | repository root |
| Clean install | `npm ci` |
| Dev server | `npm run dev` (http://localhost:5173) |
| Typecheck | `npm run typecheck` |
| Tests (non-watch) | `npm test` |
| Production build | `npm run build` (output `dist/`, relative base, hash routing) |
| Browser E2E | `npm run e2e` (Playwright 1.64.1, using the installed Google Chrome via `channel: 'chrome'`; override with `PW_CHANNEL`). It starts sample-mode Vite on :5174, plus the API in memory with AI off on :8788 and connected-mode Vite on :5175 for `e2e/connected.spec.ts`. |
| API server (optional) | `npm run server` (Node 24 runs `server/node.ts` directly; default port 8787) |
| Required config | none for sample mode. No secrets, network or server needed for typecheck/test/build. Connected mode: see `.env.example`. |

Pinned stack: React 19.3.1, react-router 7.18.4 (hash router), Zod 4.6.7, Vite 8.3.5, TypeScript 6.0.3, Vitest 5.0.5, and `@anthropic-ai/sdk` 1.2.0 (server only). Root dependency changes go through Agent 1.

## Import path

```ts
import { usd, deadlineStatus, DEMO_IDS, type Booking, type FeatureModule } from '../../core/index.ts';
```

Relative imports with explicit `.ts`/`.tsx` extensions are used everywhere, so the same files also run on the server (Node 24 type stripping). TypeScript is configured with `verbatimModuleSyntax` and `erasableSyntaxOnly`: use `import type`, and avoid enums, namespaces and constructor parameter properties.

| Contract area | Source | Status |
| --- | --- | --- |
| Domain schemas (Zod, v1) | `src/core/schema.ts` | Published |
| Result and error shape | `src/core/result.ts` | Published |
| Money | `src/core/money.ts` | Published |
| Instants, deadlines, clock | `src/core/time.ts` | Published |
| IDs, hashing | `src/core/ids.ts` | Published |
| Persistence interface | `src/core/repository.ts` | Published |
| Sample-mode repository | `src/core/store/localRepository.ts`, `storeRepository.ts` | Implemented and tested |
| Feature registration | `src/core/feature.ts` | Published |
| Canonical fixture | `src/core/fixtures/demoNyc.ts`, `documents.ts`, `seed.ts` | Published |
| Shared UI components | `src/ui/index.tsx`, tokens `src/styles/tokens.css` | Functional placeholders (design pending) |
| Booking extraction contract | `src/core/extraction.ts` | Published |
| Sample extractor (simulated) | `src/core/fixtures/sampleExtractions.ts` | Implemented and tested |
| Connected clients (HTTP repo, extraction, guest session) | `src/core/http/httpClient.ts` | Implemented and tested |
| API server, guest sessions, model adapter | `server/api.ts`, `server/workspaces.ts`, `server/ai/modelAdapter.ts`, `server/extraction.ts` | Implemented and tested. The live AI path is unverified: no key is configured. |

## Semantics

**Money.** `{ amountMinor: integer, currency: "USD" }`. Unknown values are `{ unknown: true, reason: "..." }`, never 0. `sumMaybe` returns unknown if any input is unknown. Mixing currencies throws `MoneyError`. Use `formatMaybeMoney` or `<MoneyText>` for display.

**Instants.** Every persisted time is a UTC string like `2026-11-19T23:00:00Z`. Trip dates are `YYYY-MM-DD`. Display timezones are IANA names. `zonedWallTimeToInstant('2026-11-19T18:00', 'America/New_York')` returns `2026-11-19T23:00:00Z`.

**Deadline boundary (frozen).**
- A deadline `D` is met only when `actionTime < D`. At exactly `D` it has passed.
- Refund tiers use half-open windows: `startsAtOrAfter` is inclusive, `endsBefore` is exclusive.
- Hotel example: at `22:59:59Z` the $400 tier applies; at `23:00:00Z` the $200 tier applies.
- Helpers: `deadlineStatus`, `isInWindow`, `findInWindow`. ReRoute owns eligibility decisions built on them.

**Clock.** Use `ctx.clock.now()` for every comparison. In sample mode it returns the stored demo clock (starting at `2026-11-18T17:00:00Z`), which only demo controls change. In real mode it returns wall time. Repository writes stamp `createdAt`/`updatedAt` with the same active clock.

**IDs.** Kebab-case with a type prefix (`bk-demo-hotel`, `act-<uuid>`). Generate them with `newId('action')`. Prefixes are listed in `ID_PREFIX` in `ids.ts`.

**Errors.** Every repository method returns `Result<T>`, either `{ ok: true, value }` or `{ ok: false, error }`. The error is `{ code, message, retryable, issues?, requestId?, details? }`, and the codes are listed in `ERROR_CODES`. Render it with `<ErrorState error onRetry>`.

**Provenance and capability.** `DataProvenance.kind` is one of `sample | quote | estimate | imported_fact | ai_extracted | user_entered | provider_confirmation | received_transaction | computed`. A `capability` of `simulated` or `live` marks whether a provider action really happened.

## Repository operations (`WorkspaceRepository`)

All writes validate against the schema and are scoped to the workspace. A record carrying another workspace's `workspaceId` is rejected with `forbidden`. A failed write leaves state unchanged.

| Operation | Input → result | Idempotency / errors |
| --- | --- | --- |
| `saveTrip`, `savePlan`, `saveBooking`, `savePolicy`, `saveClaim`, `saveReceipt`, `saveAsset` | `(entity, { expectedRevision })` → stored entity | `null` inserts (requires `revision: 1`). Otherwise the stored revision must match, or the result is `conflict` with `details.currentRevision`. |
| `selectPlan` | `{ tripId, planId, expectedTripRevision }` → `Trip` | Updates the plan statuses and the trip together. |
| `putDocument` | `EvidenceDocument` → `{ document, created }` | Deduplicated by `(kind, contentHash)`. |
| `saveReviewedBooking` | `{ idempotencyKey, document, booking, policy }` → `{ document, booking, policy, replayed }` | Atomic. Replaying the same key, or importing the same document content, returns the original booking. |
| `recordDisruption` | `Disruption` → `{ disruption, created }` | Insert-if-absent by ID. |
| `replaceRecoveryOptions` | `{ tripId, disruptionId, options }` → options | Replaces the options for that pair. |
| `recordBookingAction` | `{ action: ActionRecord, expectedBookingRevision }` → `{ action, booking, replayed }` | Atomic. Sets `booking.state = action.resultingBookingState`. Replaying the same `idempotencyKey` returns the original. `precondition_failed` if the booking is already cancelled or replaced. |
| `ensureClaims` | `RefundClaim[]` → `{ claims, created, existing }` | Insert-if-absent by `(actionRecordId, recoveryComponentId)`. Never overwrites an existing claim; change one with `saveClaim`. |
| `putReceipt` | `Receipt` → `{ receipt, created }` | Unique by normalized `reference`. Same reference and amount is a replay; a different amount returns `duplicate` with `details.existingReceiptId`. |
| `resetDemo` | `'empty' \| 'planning' \| 'booked'` → snapshot | Resets **this** workspace only. |
| `getClock` / `setClock` | `ClockState` | Shared active clock. |

### Example: record a cancel action (ReRoute)

```ts
const r = await ctx.repo.recordBookingAction({
  expectedBookingRevision: hotel.revision,
  action: {
    id: newId('action'), workspaceId: hotel.workspaceId, tripId: DEMO_TRIP_ID, bookingId: DEMO_IDS.bookings.hotel,
    recoveryOptionId: option.id, disruptionId: DEMO_IDS.disruption, action: 'cancel', replacementQuoteId: null,
    idempotencyKey: `reroute:${option.id}:${DEMO_IDS.bookings.hotel}`,
    expectedRecovery: [{ id: 'rc-hotel-cash', kind: 'cash_refund', value: { unit: 'money', amount: usd(400) },
      method: 'original_payment', refundTierId: DEMO_IDS.tiers.hotelBefore, dueAt: null, dueAtSource: null }],
    resultingBookingState: 'cancelled',
    result: { status: 'simulated', detail: 'Sample mode: no cancellation sent to provider' },
    capability: 'simulated', approvedAt: ctx.clock.now(), createdAt: ctx.clock.now(),
  },
});
if (r.ok) await ctx.notifyActionRecorded({ tripId: DEMO_TRIP_ID, actionRecordId: r.value.action.id });
// error example: { ok: false, error: { code: 'conflict', message: 'Booking is at revision 2; reload and retry', retryable: false, details: { currentRevision: 2 } } }
```

### Claim sync handoff (ReRoute to shell to TripWallet)

1. ReRoute records the action, then calls `ctx.notifyActionRecorded(...)`.
2. The shell calls TripWallet's `feature.syncClaimsFromActions({ tripId }, ctx)`. It does this after every recorded action and again on wallet load.
3. TripWallet builds claims from `listActions`, then calls `ensureClaims`.
4. If the sync fails, the shell keeps the action and shows a "Retry claim sync" state. A recorded action and a successful claim sync are reported separately.
5. Opening `/trips/:tripId/wallet` always re-runs the sync, so an interrupted handoff recovers, including after a reload.
6. Requests that arrive while a sync is running are merged into one follow-up run, so a newly recorded action is never skipped.

The orchestration lives in `src/app/claimSync.ts` and the status notice in `src/app/ClaimSyncNotice.tsx` (shown on the dashboard, wallet and reroute routes). `src/app/integration.test.ts` tests the orchestration against a test double of the sync. Brian's real `syncClaimsFromActions` must be idempotent: calling it twice must not create a second claim.

## Feature registration

Export `feature: FeatureModule` from `src/features/<key>/index.ts(x)`. The shell finds it automatically.

| key | route | owner | optional hooks |
| --- | --- | --- | --- |
| `wayfinder` | `/trips/:tripId/plan` | Agent 2 | `DashboardPanel` |
| `intake` | `/trips/:tripId/import` | Agent 2 | |
| `reroute` | `/trips/:tripId/reroute` | Agent 4 | `triggerDemoDisruption`, `DashboardPanel` |
| `tripwallet` | `/trips/:tripId/wallet` | Agent 5 | `syncClaimsFromActions` (required for the handoff), `DashboardPanel` |

`Page` receives `{ tripId, ctx }`. `ctx` holds `repo`, `clock`, `extraction` (an `ExtractionService`), `refresh()` and `notifyActionRecorded()`. Do not import another feature's files.

## Canonical scenario (`src/core/fixtures/demoNyc.ts`)

`DEMO_IDS`, `DEMO_TIMES` and `DEMO_EXPECTED` are the only copy of the scenario. Feature tests assert against `DEMO_EXPECTED` and must not use their own literals.

- Trip `trip-demo-nyc`. Bookings: `bk-demo-flight-out` ($320), `bk-demo-hotel` ($450), `bk-demo-activity` ($80), `bk-demo-transfer` ($50).
- Policies `pol-demo-*`. Tiers include `tier-demo-hotel-before` ($400 before `2026-11-19T23:00:00Z`) and `tier-demo-hotel-after` ($200 from that instant).
- The flight is refunded $320 only when the carrier cancels (`tier-demo-flight-provider-cancels`).
- Activity: $60 before `2026-11-20T17:00:00Z`. Transfer: $40 before `2026-11-20T12:00:00Z`.
- Replacement quote `quote-demo-replacement-flight` ($360). Disruption `dis-demo-flight-cancel` (built by `demoDisruption`).
- Cancel-trip handoff fixture: `demoCancelTripActions(ctx)` returns the four `ActionRecord`s for approving the cancel-trip option (`opt-demo-cancel-trip`) at the clock start.
  - IDs: `act-demo-cancel-{flight,hotel,activity,transfer}`, each with one cash component `rc-demo-<kind>-cash` ($320 + $400 + $60 + $40 = $820).
  - ReRoute's approval should produce equivalent records. TripWallet's `syncClaimsFromActions` must turn them into exactly four claims, idempotently.
  - `src/app/integration.test.ts` runs these checks automatically against each real module once it is registered.
- Hotel refund confirmation: $400 due `2026-11-25T23:00:00Z` (`DEMO_HOTEL_REFUND_CONFIRMATION`).
- Receipts `rcpt-demo-hotel-1` ($250, ref `HLH-RF-0001`) and `rcpt-demo-hotel-2` ($150, ref `HLH-RF-0002`).
- Assets `asset-demo-voucher` ($75 Bayline Air, not cash) and `asset-demo-points` (8,000 Harbor Line Rewards).
- Plans `plan-demo-nonstop` ($900), `plan-demo-saver` ($815) and `plan-demo-flex` (unknown total).
- Verification documents: `doc-demo-unknown-policy`, `doc-demo-late-deadline-hotel`, `doc-demo-malformed`, `doc-demo-duplicate-receipt-1`.

Seed stages: `planning` creates the trip, plans, quote and assets. `booked` adds the four reviewed bookings and policies and selects `plan-demo-nonstop`.

## Persistence capabilities by mode

| Mode | Implementation | Durable | Shared | Notes |
| --- | --- | --- | --- | --- |
| Sample | `createLocalRepository` (IndexedDB `wayfare-v1` / `workspaces`; key `wayfare:v1:workspace:<id>`) | Survives reload in this browser | One visitor workspace; tabs on the same origin share it | Existing localStorage snapshots migrate on the next mutation. Corrupt data is reported as an error and is never silently reseeded. |
| Connected | `createHttpRepository` → `server/` (set `VITE_WAYFARE_API_URL`) | One JSON file per workspace under `WAYFARE_DATA_DIR` | No; one guest session (bearer token) per workspace | Failures are shown as errors. Sample mode is used only if the user explicitly chooses it. |

## Booking extraction (for Agent 2's intake UI)

Call it through `ctx.extraction.extractBooking(request)`. This is the same API in both modes. It **never saves**.

Steps:
1. **Request.** `ExtractBookingRequest` is `{ tripId, text }`. The text must be 20 to 20,000 characters.
2. **Result.** A `BookingExtraction` contains:
   - `capability`: `live` or `simulated`, plus `requestId` and `model`.
   - `fixture`: the canonical IDs when the text is a sample document.
   - `booking.*`: each field is `{ status: 'found', value, excerpt, confidence }` or `{ status: 'unknown', reason }`.
   - `policy`: `{ refundability, refundTiers[], deadlines[], unknownFields[] }` and `warnings[]`.
3. **Review UI.** Agent 2 renders the result and collects edits (`BookingReviewEdits`).
4. **Build the save input.** `reviewedBookingInput({ extraction, sourceText, workspaceId, tripId, now: ctx.clock.now(), edits })` returns a `SaveReviewedBookingInput`. If required facts are still unknown it returns `validation_failed` with one `issues[]` entry per field: `kind`, `provider`, `reference`, `startsAt`, `localTimezone`.
5. **Save.** `ctx.repo.saveReviewedBooking(input)`. Re-importing the same text returns `replayed: true`.

| Situation | Result |
| --- | --- |
| Sample confirmation text, any mode without AI | `capability: 'simulated'`, computed by the same deterministic normalization as live output |
| Server with AI configured | `capability: 'live'`, using `claude-opus-5-5` by default |
| Unrecognized text, no AI configured | `not_configured` error. It never produces a fabricated extraction. |
| Not a booking (for example `doc-demo-malformed`) | `validation_failed`, `details.reason: 'not_a_booking'` |
| Policy terms absent (`doc-demo-unknown-policy`) | `refundability: 'unknown'`, no tiers, saved with `reviewState: 'needs_review'` |
| Provider timeout, rate limit, outage or refusal | `timeout`, `rate_limited`, `unavailable` or `provider_error`, with `retryable` set |

Safety:
- The AI returns only strings: local wall times plus an IANA timezone, and decimal amounts. Code converts them to UTC instants and integer minor units.
- Any value whose excerpt is not found verbatim in the source becomes `unknown`, with a warning.
- The document is wrapped as `<document>` data, and the system prompt says to ignore instructions inside it.

Example (abridged) for the hotel sample:

```json
{ "ok": true, "value": { "requestId": "req-…", "capability": "simulated", "model": null,
  "fixture": { "bookingId": "bk-demo-hotel", "policyId": "pol-demo-hotel", "dependsOn": ["bk-demo-flight-out"] },
  "booking": { "paid": { "status": "found", "value": { "amountMinor": 45000, "currency": "USD" }, "excerpt": "Total charged: $450.00 USD", "confidence": "high" } },
  "policy": { "refundability": "partially_refundable",
    "refundTiers": [{ "label": "Cancel before 6:00 PM ET Nov 19: $400 refund", "window": { "startsAtOrAfter": null, "endsBefore": "2026-11-19T23:00:00Z" }, "refund": { "amountMinor": 40000, "currency": "USD" }, "condition": "any", "method": "original_payment", "excerpt": "…" }],
    "deadlines": [{ "label": "Hotel $400 refund deadline", "at": "2026-11-19T23:00:00Z", "displayTimezone": "America/New_York", "sourceWording": "6:00 PM ET on November 19, 2026", "excerpt": "…" }],
    "unknownFields": [] }, "warnings": [] } }
```

Error example: `{ "ok": false, "error": { "code": "not_configured", "message": "Live AI extraction is not configured. Sample mode only recognizes the WayFare sample documents.", "retryable": false, "requestId": "req-…" } }`

## API server (`server/`)

The handler is web-standard: `(Request) => Promise<Response>`. `server/node.ts` adapts it to Node, and the same handler can be wrapped for an edge runtime.

| Route | Auth | Body → result |
| --- | --- | --- |
| `GET /api/health` | none | `{ ai: { configured, provider, model?, reason? }, persistence }`, with no secrets |
| `POST /api/session` | none | creates a guest workspace (seeded `planning`) and returns `{ token, workspaceId }`. Only the SHA-256 of the token is stored. |
| `POST /api/repo/:operation` | Bearer | `{ args: [...] }` → the `Result` of that `WorkspaceRepository` operation, from an allowlist with arity checks |
| `POST /api/extract/booking` | Bearer | `ExtractBookingRequest` → `Result<BookingExtraction>` |

- HTTP status follows the error code: 400 validation, 401, 403, 404, 409 conflict or duplicate, 412, 429, 502 provider, 503 not_configured or unavailable, 504 timeout.
- Every response carries `x-request-id`.
- Guest sessions expire `WAYFARE_SESSION_TTL_HOURS` after creation (default 168). After that, requests get 401 `unauthorized` with `details.reason: 'session_expired'`, and the app offers "Start a new guest session". `POST /api/session` also returns `expiresAt`.
- Rate limits (fixed hourly window, in memory, single instance):
  - `POST /api/session`: `WAYFARE_SESSION_LIMIT_PER_HOUR` per client IP (default 20).
  - `POST /api/extract/booking`: `WAYFARE_EXTRACT_LIMIT_PER_HOUR` per workspace (default 30). This protects paid AI calls.
  - Exceeding a limit returns 429 `rate_limited` with a `Retry-After` header and `details.retryAfterSeconds`.
  - The client IP is the socket address. Set `WAYFARE_TRUST_PROXY=1` only behind a trusted proxy, to use `X-Forwarded-For` instead.
- CORS allows only the exact origins in `WAYFARE_ALLOWED_ORIGINS`. A browser request from any other origin gets 403. Add the Figma or hosting preview origin there explicitly; do not use a wildcard.
- Model provider: a single adapter (`server/ai/modelAdapter.ts`) using the official Anthropic SDK.
  - It uses `beta.messages.parse` with a Zod structured-output format and sets effort explicitly (`medium` by default).
  - It enables server-side `fallbacks: "default"`.
  - It applies an input limit and a timeout (60 s, one retry), and maps errors most-specific-first.
  - Logs carry the request ID, model, token counts and latency, never document text.
  - It is not a public proxy: only server handlers call it.


## TripWallet shared integration additions (#7 / #8)

### Atomic receipt allocation

Keep using `saveClaim(claim, { expectedRevision })`. Every snapshot mutation now validates receipt allocation totals across **all claims in the workspace**, inside the serialized commit. This also covers preallocated `ensureClaims` inserts and receipt edits. A receipt must exist; positive allocations must match receipt/known claim currencies and any assigned trip; duplicate allocation IDs within a claim are rejected. Aggregate allocations may not exceed the receipt's minor-unit amount. Valid split allocations are supported; TripWallet's MVP can continue allocating the full receipt to one claim.

Over-allocation returns `conflict` with `details.receiptId`; reload current claims/receipts and ask the user to resolve the match. The failed mutation changes no claim, revision or receipt. `Receipt.matchState` remains separate metadata; use claim allocations as the authoritative ledger.

Browser persistence acquires an origin-wide Web Lock named by the workspace storage key, then reads the canonical snapshot from IndexedDB. It validates the mutation and waits for the write transaction to commit before releasing the lock. Each operation reloads after acquiring the lock, including operations on previously cached repositories. localStorage alone was insufficient: separate renderer caches can lag after lock release. The active workspace ID remains in localStorage; pre-upgrade localStorage snapshots are read only when no IndexedDB snapshot exists and migrate on the next mutation. Browser contexts without Web Locks or IndexedDB fail explicitly rather than silently using an unsafe fallback. Tests/non-browser memory storage share a queue by storage identity/workspace. Connected API requests use the server's existing one-repository-per-workspace queue and the same invariant. The JSON-file demo server remains a single Node process, not a multi-host transactional database.

### Wallet evidence transport (feature-owned handler)

Shared request: `WalletEvidenceRequest` from `src/core/index.ts`:

```ts
{ tripId: DEMO_IDS.trip, kind: 'receipt' /* or 'refund_confirmation' */, text: 'source evidence, 20–20,000 characters' }
```

The shell supplies optional/backwards-compatible `ctx.walletEvidence: WalletEvidenceService`. Call:

```ts
const r = await ctx.walletEvidence?.extract(request, YourFeatureOwnedOutputSchema);
// Result<{ data: z.infer<typeof YourFeatureOwnedOutputSchema>, capability: 'live' | 'simulated', model: string | null, requestId: string }>
```

The output schema stays on the client for validation; neither it nor a model/system prompt is sent over HTTP. Sample mode returns `not_configured`; keep reviewed fields and explicit fictional sample inputs available. Connected mode posts to authenticated `POST /api/extract/wallet`. It verifies trip ownership, uses the existing workspace extraction rate limit, preserves request IDs/errors and never falls back silently. Health exposes `walletEvidence.handlerRegistered`; this describes registration, not proof of a live AI call.

Brian owns `src/features/tripwallet/server.ts`, exporting:

```ts
import type { WalletEvidenceHandler } from '../../../server/walletEvidence.ts';
export const walletEvidenceHandler: WalletEvidenceHandler = {
  async extract(request, ctx) {
    // Own receipt/refund-confirmation schemas, prompts, provenance and normalization here.
    // ctx: workspaceId, repo, adapter (server-only ModelAdapter | null), requestId, now().
    // Call ctx.adapter.generateStructured with your server-owned prompt and schema.
    // Return Result<{ data, capability: 'live' | 'simulated', model: string | null }>.
    // Unknown fields remain unknown; review before saving. Never write claims/receipts here.
  },
};
```

The Node entry point loads that fixed feature module at startup. Restart after adding it. An absent handler is reported as `not_configured`; an invalid existing module fails startup instead of disappearing silently. `server/featureHandlers.ts` and `server/walletEvidence.ts` remain Agent 1 infrastructure. No browser bundle imports the model adapter or server handler. No live wallet AI is claimed until Brian registers the handler, credentials are configured, and a real call is verified.
