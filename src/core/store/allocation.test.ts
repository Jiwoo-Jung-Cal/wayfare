import { describe, expect, it } from 'vitest';
import {
  createLocalRepository, memoryStorage, demoCancelTripActions, demoReceipts,
  demoDocument, demoDisruption, DEMO_IDS, DEMO_TIMES, usd, unwrap, unknownValue,
  type RefundClaim, type WorkspaceRepository,
} from '../index.ts';
import { createWorkspaceRegistry } from '../../../server/workspaces.ts';
import { createApiHandler } from '../../../server/api.ts';
import { loadConfig } from '../../../server/config.ts';
import { createHttpRepository } from '../http/httpClient.ts';

export async function prepare(repo: WorkspaceRepository) {
  unwrap(await repo.resetDemo('booked'));
  const workspace = unwrap(await repo.getWorkspace());
  const ctx = { workspaceId: workspace.id, now: DEMO_TIMES.clockStart };
  unwrap(await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.disruptionNotice)));
  unwrap(await repo.recordDisruption(demoDisruption(ctx)));
  const actions = demoCancelTripActions(ctx);
  const claims: RefundClaim[] = [];
  for (const action of actions) {
    unwrap(await repo.recordBookingAction({ action, expectedBookingRevision: 1 }));
    const recovery = action.expectedRecovery[0]!;
    const expected = recovery.value.unit === 'money' ? recovery.value.amount : unknownValue('Noncash');
    claims.push({ id: `clm-${action.bookingId}`, workspaceId: workspace.id, tripId: action.tripId,
      bookingId: action.bookingId, actionRecordId: action.id, recoveryComponentId: recovery.id,
      expected, method: recovery.method, providerConfirmed: unknownValue('Not confirmed'), confirmationDocumentId: null,
      due: null, allocations: [], outstanding: expected, status: 'expected', revision: 1,
      createdAt: ctx.now, updatedAt: ctx.now });
  }
  const receipt = demoReceipts(ctx)[0]!;
  unwrap(await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.hotelReceipt1)));
  unwrap(await repo.putReceipt(receipt));
  return { claims, receipt };
}

const allocated = (claim: RefundClaim, receiptId: string, amount = usd(250)): RefundClaim => ({
  ...claim, allocations: [{ id: `alloc-${claim.id}`, receiptId, amount, allocatedAt: DEMO_TIMES.clockStart }],
});

describe('workspace receipt allocation invariant', () => {
  it('two independent stale repository instances cannot spend one receipt on different claims', async () => {
    const storage = memoryStorage();
    const a = createLocalRepository({ storage, workspaceId: 'ws-race' });
    const b = createLocalRepository({ storage, workspaceId: 'ws-race' });
    const { claims, receipt } = await prepare(a);
    unwrap(await a.ensureClaims(claims));
    await Promise.all([a.snapshot(), b.snapshot()]);
    const results = await Promise.all([
      a.saveClaim(allocated(claims[0]!, receipt.id), { expectedRevision: 1 }),
      b.saveClaim(allocated(claims[1]!, receipt.id), { expectedRevision: 1 }),
    ]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.find(r => !r.ok)).toMatchObject({ ok: false, error: { code: 'conflict' } });
    const saved = unwrap(await b.listClaims(DEMO_IDS.trip));
    expect(saved.flatMap(c => c.allocations).reduce((n, x) => n + x.amount.amountMinor, 0)).toBe(25000);
    expect(saved.filter(c => c.revision === 1)).toHaveLength(3);
  });

  it('valid split allocations may reach but never exceed the received amount', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-split' });
    const { claims, receipt } = await prepare(repo);
    unwrap(await repo.ensureClaims(claims));
    unwrap(await repo.saveClaim(allocated(claims[0]!, receipt.id, usd(100)), { expectedRevision: 1 }));
    unwrap(await repo.saveClaim(allocated(claims[1]!, receipt.id, usd(150)), { expectedRevision: 1 }));
    const before = unwrap(await repo.snapshot());
    const bad = await repo.saveClaim(allocated(claims[2]!, receipt.id, usd(1)), { expectedRevision: 1 });
    expect(bad).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });

  it('ensureClaims cannot insert preallocated claims that overspend a receipt', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-insert' });
    const { claims, receipt } = await prepare(repo);
    const r = await repo.ensureClaims([allocated(claims[0]!, receipt.id), allocated(claims[1]!, receipt.id)]);
    expect(r).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip))).toHaveLength(0);
  });

  it('rejects currency/trip mismatch, missing receipt, nonpositive and duplicate allocations', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-invalid' });
    const { claims, receipt } = await prepare(repo);
    unwrap(await repo.ensureClaims(claims));
    const claim = allocated(claims[0]!, receipt.id);
    for (const input of [
      allocated(claims[0]!, 'rcpt-missing'),
      allocated(claims[0]!, receipt.id, { amountMinor: 25000, currency: 'EUR' }),
      allocated(claims[0]!, receipt.id, usd(0)),
      { ...claim, tripId: 'trip-other' },
      { ...claim, allocations: [claim.allocations[0]!, claim.allocations[0]!] },
    ]) expect((await repo.saveClaim(input, { expectedRevision: 1 })).ok).toBe(false);
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip)).every(c => c.allocations.length === 0)).toBe(true);
  });

  it('receipt edits cannot shrink/change currency beneath already allocated cash', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-edit' });
    const { claims, receipt } = await prepare(repo);
    unwrap(await repo.ensureClaims(claims));
    unwrap(await repo.saveClaim(allocated(claims[0]!, receipt.id), { expectedRevision: 1 }));
    const before = unwrap(await repo.snapshot());
    expect((await repo.saveReceipt({ ...receipt, amount: usd(100) }, { expectedRevision: 1 })).ok).toBe(false);
    expect((await repo.saveReceipt({ ...receipt, amount: { ...receipt.amount, currency: 'EUR' } }, { expectedRevision: 1 })).ok).toBe(false);
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });

  it('simultaneous authenticated HTTP updates enforce the same workspace invariant', async () => {
    const config = loadConfig({ WAYFARE_AI_PROVIDER: 'none', WAYFARE_DATA_DIR: 'memory' });
    const registry = createWorkspaceRegistry({ dataDir: null });
    const session = unwrap(await registry.createSession());
    const handler = createApiHandler({ config, registry, adapter: null });
    const fetch = (url: string, init?: RequestInit) => handler(new Request(url, init));
    const options = { baseUrl: 'http://test', token: session.token, fetch };
    const a = createHttpRepository(options), b = createHttpRepository(options);
    const { claims, receipt } = await prepare(a);
    unwrap(await a.ensureClaims(claims));
    const results = await Promise.all([
      a.saveClaim(allocated(claims[0]!, receipt.id), { expectedRevision: 1 }),
      b.saveClaim(allocated(claims[1]!, receipt.id), { expectedRevision: 1 }),
    ]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.find(r => !r.ok)).toMatchObject({ error: { code: 'conflict' } });
    expect(unwrap(await a.listClaims(DEMO_IDS.trip)).flatMap(c => c.allocations)).toHaveLength(1);
  });
});
