import { expect, test } from '@playwright/test';
import { buildDemoSnapshot, demoCancelTripActions, demoReceipts, DEMO_IDS, DEMO_TIMES, unknownValue, type RefundClaim, type WorkspaceRepository } from '../src/core/index.ts';

declare global { interface Window { allocationTestRepo: WorkspaceRepository } }

test('two browser tabs cannot allocate the same receipt to different claims', async ({ page, context }) => {
  const workspaceId = 'ws-allocation-browser';
  const fixtureContext = { workspaceId, now: DEMO_TIMES.clockStart };
  const snapshot = await buildDemoSnapshot({ id: workspaceId, mode: 'sample', label: 'Allocation test', createdAt: DEMO_TIMES.clockStart }, 'booked');
  snapshot.actions = demoCancelTripActions(fixtureContext);
  snapshot.receipts = demoReceipts(fixtureContext).map(r => ({ ...r, sourceDocumentId: null }));
  snapshot.claims = snapshot.actions.map(action => {
    const recovery = action.expectedRecovery[0]!.value;
    const expected = recovery.unit === 'money' ? recovery.amount : unknownValue('Noncash');
    return ({
    id: `clm-${action.bookingId}`, workspaceId, tripId: action.tripId, bookingId: action.bookingId,
    actionRecordId: action.id, recoveryComponentId: action.expectedRecovery[0]!.id,
    expected, providerConfirmed: unknownValue('Unconfirmed'), method: 'original_payment',
    confirmationDocumentId: null, due: null, allocations: [], outstanding: expected, status: 'expected',
    revision: 1, createdAt: DEMO_TIMES.clockStart, updatedAt: DEMO_TIMES.clockStart,
  } satisfies RefundClaim); });
  await page.goto('/');
  await page.evaluate(({ snapshot, workspaceId }) => {
    localStorage.setItem(`wayfare:v1:workspace:${workspaceId}`, JSON.stringify(snapshot));
  }, { snapshot, workspaceId });
  const second = await context.newPage();
  await second.goto('/');
  for (const tab of [page, second]) {
    await tab.evaluate(async workspaceId => {
      const path = '/src/core/index.ts';
      const core = await import(/* @vite-ignore */ path) as typeof import('../src/core/index.ts');
      window.allocationTestRepo = core.createLocalRepository({ storage: localStorage, workspaceId });
      // Both repositories cache the same pre-allocation snapshot before the race.
      await window.allocationTestRepo.snapshot();
      return Boolean(navigator.locks);
    }, workspaceId);
  }
  const receiptId = snapshot.receipts[0]!.id;
  const results = await Promise.all([page, second].map((tab, index) => tab.evaluate(async ({ claim, receiptId }) => {
    return window.allocationTestRepo.saveClaim({ ...claim, allocations: [{
      id: `alloc-${claim.id}`, receiptId, amount: { amountMinor: 25000, currency: 'USD' }, allocatedAt: claim.createdAt,
    }] }, { expectedRevision: 1 });
  }, { claim: snapshot.claims[index]!, receiptId })));
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expect(results.find(r => !r.ok)).toMatchObject({ error: { code: 'conflict' } });
  const total = await page.evaluate(async tripId => {
    const r = await window.allocationTestRepo.listClaims(tripId);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.flatMap(c => c.allocations).reduce((n, a) => n + a.amount.amountMinor, 0);
  }, DEMO_IDS.trip);
  expect(total).toBe(25000);
});
