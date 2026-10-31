# Shared contracts index (v1)

Owner: Agent 1. Source of truth is the code below; this page explains it and gives examples. Do not copy schemas into feature code. Request changes in #3 (foundation) or #8 (integration).

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
| Required config | none for sample mode. No secrets, network or server needed for typecheck/test/build. |

Pinned stack: React 19.3.1, react-router 7.18.4 (hash router), Zod 4.6.7, Vite 8.3.5, TypeScript 6.0.3, Vitest 5.0.5. Root dependency changes go through Agent 1.

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
| Booking extraction, model adapter, connected repository | `server/` | Not yet published (next milestone) |

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

## Feature registration

Export `feature: FeatureModule` from `src/features/<key>/index.ts(x)`. The shell finds it automatically.

| key | route | owner | optional hooks |
| --- | --- | --- | --- |
| `wayfinder` | `/trips/:tripId/plan` | Agent 2 | `DashboardPanel` |
| `intake` | `/trips/:tripId/import` | Agent 2 | |
| `reroute` | `/trips/:tripId/reroute` | Agent 4 | `triggerDemoDisruption`, `DashboardPanel` |
| `tripwallet` | `/trips/:tripId/wallet` | Agent 5 | `syncClaimsFromActions` (required for the handoff), `DashboardPanel` |

`Page` receives `{ tripId, ctx }`. `ctx` holds `repo`, `clock`, `refresh()` and `notifyActionRecorded()`. Do not import another feature's files.

## Canonical scenario (`src/core/fixtures/demoNyc.ts`)

`DEMO_IDS`, `DEMO_TIMES` and `DEMO_EXPECTED` are the only copy of the scenario. Feature tests assert against `DEMO_EXPECTED` and must not use their own literals.

- Trip `trip-demo-nyc`. Bookings: `bk-demo-flight-out` ($320), `bk-demo-hotel` ($450), `bk-demo-activity` ($80), `bk-demo-transfer` ($50).
- Policies `pol-demo-*`. Tiers include `tier-demo-hotel-before` ($400 before `2026-11-19T23:00:00Z`) and `tier-demo-hotel-after` ($200 from that instant).
- The flight is refunded $320 only when the carrier cancels (`tier-demo-flight-provider-cancels`).
- Activity: $60 before `2026-11-20T17:00:00Z`. Transfer: $40 before `2026-11-20T12:00:00Z`.
- Replacement quote `quote-demo-replacement-flight` ($360). Disruption `dis-demo-flight-cancel` (built by `demoDisruption`).
- Hotel refund confirmation: $400 due `2026-11-25T23:00:00Z` (`DEMO_HOTEL_REFUND_CONFIRMATION`).
- Receipts `rcpt-demo-hotel-1` ($250, ref `HLH-RF-0001`) and `rcpt-demo-hotel-2` ($150, ref `HLH-RF-0002`).
- Assets `asset-demo-voucher` ($75 Bayline Air, not cash) and `asset-demo-points` (8,000 Harbor Line Rewards).
- Plans `plan-demo-nonstop` ($900), `plan-demo-saver` ($815) and `plan-demo-flex` (unknown total).
- Verification documents: `doc-demo-unknown-policy`, `doc-demo-late-deadline-hotel`, `doc-demo-malformed`, `doc-demo-duplicate-receipt-1`.

Seed stages: `planning` creates the trip, plans, quote and assets. `booked` adds the four reviewed bookings and policies and selects `plan-demo-nonstop`.

## Persistence capabilities by mode

| Mode | Implementation | Durable | Shared | Notes |
| --- | --- | --- | --- | --- |
| Sample | `createLocalRepository` (localStorage key `wayfare:v1:workspace:<id>`) | Survives reload in this browser | No; one workspace per browser | Corrupt data is reported as an error and is never silently reseeded. |
| Connected | Server API plus guest session (next milestone) | Server | No; scoped per session | Failures are shown as errors and never fall back to sample data. |
