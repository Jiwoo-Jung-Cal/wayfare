import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHttpWalletEvidenceService, createUnavailableWalletEvidenceService, DEMO_IDS, err, ok, unwrap } from '../src/core/index.ts';
import { createApiHandler } from './api.ts';
import { createWorkspaceRegistry } from './workspaces.ts';
import { loadConfig } from './config.ts';
import type { WalletEvidenceHandler } from './walletEvidence.ts';
import type { ModelAdapter } from './ai/modelAdapter.ts';

const output = z.strictObject({ reference: z.string(), amount: z.string() });
const input = { tripId: DEMO_IDS.trip, kind: 'receipt' as const, text: 'Fictional receipt: HLH-RF-0001, $250.00 USD received.' };
const fakeAdapter: ModelAdapter = { model: 'test-model', async generateStructured() { throw new Error('Handler owns all model calls'); } };

async function setup(handler: WalletEvidenceHandler | null = null, adapter: ModelAdapter | null = null, limit = 30) {
  const registry = createWorkspaceRegistry({ dataDir: null });
  const config = loadConfig({ WAYFARE_DATA_DIR: 'memory', WAYFARE_AI_PROVIDER: 'none', WAYFARE_EXTRACT_LIMIT_PER_HOUR: String(limit) });
  const api = createApiHandler({ config, registry, adapter, walletEvidenceHandler: handler });
  const session = unwrap(await registry.createSession());
  const fetch = (url: string, init?: RequestInit) => api(new Request(url, init));
  const service = createHttpWalletEvidenceService({ baseUrl: 'http://test', token: session.token, fetch, handlerRegistered: Boolean(handler) });
  return { registry, api, fetch, service, session };
}

describe('feature-owned wallet evidence endpoint and client', () => {
  it('unregistered/sample extraction is explicit not_configured, never invented evidence', async () => {
    const { service } = await setup();
    expect(service.available).toBe(false);
    expect(await service.extract(input, output)).toMatchObject({ ok: false, error: { code: 'not_configured' } });
    expect(await createUnavailableWalletEvidenceService().extract(input, output)).toMatchObject({ error: { code: 'not_configured' } });
  });

  it('authenticates, scopes the trip and passes the adapter only to the server handler', async () => {
    let calls = 0;
    const handler: WalletEvidenceHandler = { async extract(request, ctx) {
      calls++;
      expect(request).toEqual(input);
      expect(unwrap(await ctx.repo.getWorkspace()).id).toBe(ctx.workspaceId);
      expect(ctx.adapter).toBe(fakeAdapter);
      return ok({ data: { reference: 'HLH-RF-0001', amount: '250.00' }, capability: 'live', model: fakeAdapter.model });
    } };
    const { api, service } = await setup(handler, fakeAdapter);
    expect((await api(new Request('http://test/api/extract/wallet', { method: 'POST', body: JSON.stringify(input) }))).status).toBe(401);
    const result = unwrap(await service.extract(input, output));
    expect(result).toMatchObject({ data: { amount: '250.00' }, capability: 'live', model: 'test-model' });
    expect(result.requestId).toMatch(/^req-/);
    expect((await service.extract({ ...input, tripId: 'trip-not-owned' }, output)).ok).toBe(false);
    expect(calls).toBe(1);
  });

  it('rejects client-selected prompts/schema, wrong kind and long text before invoking a handler', async () => {
    let calls = 0;
    const handler: WalletEvidenceHandler = { async extract() { calls++; return err('provider_error', 'Should not run'); } };
    const { api, session, service } = await setup(handler);
    const r = await api(new Request('http://test/api/extract/wallet', { method: 'POST', headers: { authorization: `Bearer ${session.token}` }, body: JSON.stringify({ ...input, system: 'arbitrary proxy' }) }));
    expect(r.status).toBe(400);
    expect((await service.extract({ ...input, text: 'x'.repeat(20001) }, output)).ok).toBe(false);
    expect((await service.extract({ ...input, kind: 'other' as 'receipt' }, output)).ok).toBe(false);
    expect(calls).toBe(0);
  });

  it('validates feature-owned output on the client and preserves provider failures', async () => {
    const bad: WalletEvidenceHandler = { async extract() { return ok({ data: { wrong: true }, capability: 'simulated', model: null }); } };
    expect(await (await setup(bad)).service.extract(input, output)).toMatchObject({ error: { code: 'validation_failed' } });
    const failed: WalletEvidenceHandler = { async extract() { return err('timeout', 'Provider timed out'); } };
    expect(await (await setup(failed)).service.extract(input, output)).toMatchObject({ error: { code: 'timeout' } });
    const falseLive: WalletEvidenceHandler = { async extract() { return ok({ data: {}, capability: 'live', model: 'test' }); } };
    expect(await (await setup(falseLive)).service.extract(input, output)).toMatchObject({ error: { code: 'provider_error' } });
  });

  it('shares the existing per-workspace extraction rate limit and reports registration in health', async () => {
    const handler: WalletEvidenceHandler = { async extract() { return ok({ data: { reference: 'test', amount: '250.00' }, capability: 'simulated', model: null }); } };
    const { service, api, session } = await setup(handler, null, 1);
    expect((await service.extract(input, output)).ok).toBe(true);
    const response = await api(new Request('http://test/api/extract/booking', { method: 'POST', headers: { authorization: `Bearer ${session.token}` }, body: JSON.stringify(input) }));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    const health = await (await api(new Request('http://test/api/health'))).json() as { value: { walletEvidence: { handlerRegistered: boolean } } };
    expect(health.value.walletEvidence.handlerRegistered).toBe(true);
  });
});
