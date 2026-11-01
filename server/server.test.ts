import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import {
  DEMO_DOCUMENT_SOURCES,
  DEMO_IDS,
  DEMO_TIMES,
  SAMPLE_RAW_EXTRACTIONS,
  createHttpExtractionService,
  createHttpRepository,
  getOrCreateGuestSession,
  memoryStorage,
  ok,
  unwrap,
  usd,
  type ActionRecord,
  type Result,
} from '../src/core/index.ts';
import { createApiHandler } from './api.ts';
import { loadConfig } from './config.ts';
import { mapProviderError, type ModelAdapter } from './ai/modelAdapter.ts';
import { createWorkspaceRegistry } from './workspaces.ts';

const BASE = 'http://api.test';

function setup(adapter: ModelAdapter | null = null) {
  const config = { ...loadConfig({ WAYFARE_DATA_DIR: 'memory', WAYFARE_AI_PROVIDER: 'none', WAYFARE_ALLOWED_ORIGINS: 'http://localhost:5173' }) };
  const handler = createApiHandler({ config, registry: createWorkspaceRegistry({ dataDir: null }), adapter, now: () => new Date(DEMO_TIMES.clockStart) });
  const fetch = (url: string, init?: RequestInit) => handler(new Request(url, init));
  return { handler, fetch };
}

async function session(fetch: ReturnType<typeof setup>['fetch']) {
  const s = unwrap(await getOrCreateGuestSession(BASE, memoryStorage(), fetch));
  return { ...s, repo: createHttpRepository({ baseUrl: BASE, token: s.token, fetch }) };
}

function cancelHotel(workspaceId: string, key = 'reroute:test'): ActionRecord {
  return {
    id: `act-${key.replace(/[^a-z0-9]/g, '')}`,
    workspaceId,
    tripId: DEMO_IDS.trip,
    bookingId: DEMO_IDS.bookings.hotel,
    recoveryOptionId: null,
    disruptionId: null,
    action: 'cancel',
    replacementQuoteId: null,
    idempotencyKey: key,
    expectedRecovery: [{ id: 'rc-hotel-cash', kind: 'cash_refund', value: { unit: 'money', amount: usd(400) }, method: 'original_payment', refundTierId: null, dueAt: null, dueAtSource: null }],
    resultingBookingState: 'cancelled',
    result: { status: 'simulated', detail: 'test' },
    capability: 'simulated',
    approvedAt: DEMO_TIMES.clockStart,
    createdAt: DEMO_TIMES.clockStart,
  };
}

describe('API sessions and workspace isolation', () => {
  it('requires a valid bearer token', async () => {
    const { fetch } = setup();
    const r = await fetch(`${BASE}/api/repo/listTrips`, { method: 'POST', body: '{}' });
    expect(r.status).toBe(401);
    const bad = await createHttpRepository({ baseUrl: BASE, token: 'nope', fetch }).listTrips();
    expect(bad.ok ? null : bad.error.code).toBe('unauthorized');
  });

  it('two sessions cannot read, write into or reset each other', async () => {
    const { fetch } = setup();
    const a = await session(fetch);
    const b = await session(fetch);
    expect(a.workspaceId).not.toBe(b.workspaceId);
    unwrap(await a.repo.resetDemo('booked'));
    unwrap(await b.repo.resetDemo('booked'));
    unwrap(await a.repo.recordBookingAction({ action: cancelHotel(a.workspaceId), expectedBookingRevision: 1 }));

    // B cannot see A's action and cannot write a record scoped to A's workspace.
    expect(unwrap(await b.repo.listActions(DEMO_IDS.trip))).toHaveLength(0);
    const cross = await b.repo.recordBookingAction({ action: cancelHotel(a.workspaceId, 'reroute:cross'), expectedBookingRevision: 1 });
    expect(cross.ok ? null : cross.error.code).toBe('forbidden');

    unwrap(await b.repo.resetDemo('empty'));
    expect(unwrap(await a.repo.listActions(DEMO_IDS.trip))).toHaveLength(1);
    expect(unwrap(await a.repo.getBooking(DEMO_IDS.bookings.hotel)).state).toBe('cancelled');
  });

  it('replayed action over HTTP does not double records', async () => {
    const { fetch } = setup();
    const a = await session(fetch);
    unwrap(await a.repo.resetDemo('booked'));
    unwrap(await a.repo.recordBookingAction({ action: cancelHotel(a.workspaceId), expectedBookingRevision: 1 }));
    expect(unwrap(await a.repo.recordBookingAction({ action: cancelHotel(a.workspaceId), expectedBookingRevision: 1 })).replayed).toBe(true);
    expect(unwrap(await a.repo.listActions(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('rejects unknown operations and bad arguments', async () => {
    const { fetch } = setup();
    const a = await session(fetch);
    const r = await fetch(`${BASE}/api/repo/constructor`, { method: 'POST', headers: { authorization: `Bearer ${a.token}` }, body: '{}' });
    expect(r.status).toBe(404);
    const r2 = await fetch(`${BASE}/api/repo/getTrip`, { method: 'POST', headers: { authorization: `Bearer ${a.token}` }, body: '{"args":[1,2,3]}' });
    expect(r2.status).toBe(400);
  });
});

describe('API CORS and health', () => {
  it('allows only configured origins and exposes no secrets', async () => {
    const { handler } = setup();
    const allowed = await handler(new Request(`${BASE}/api/health`, { headers: { origin: 'http://localhost:5173' } }));
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const body = (await allowed.json()) as { value: { ai: Record<string, unknown> } };
    expect(body.value.ai).toMatchObject({ configured: false, provider: 'none' });
    expect(JSON.stringify(body)).not.toMatch(/api[_-]?key/i);
    const denied = await handler(new Request(`${BASE}/api/health`, { headers: { origin: 'https://evil.example' } }));
    expect(denied.status).toBe(403);
  });
});

describe('extraction endpoint', () => {
  const hotelText = DEMO_DOCUMENT_SOURCES[DEMO_IDS.documents.hotelConfirmation]!.text;

  it('without AI: sample document is simulated, other text is not_configured (no fake success)', async () => {
    const { fetch } = setup(null);
    const a = await session(fetch);
    const svc = createHttpExtractionService({ baseUrl: BASE, token: a.token, fetch, aiConfigured: false });
    const x = unwrap(await svc.extractBooking({ tripId: DEMO_IDS.trip, text: hotelText }));
    expect(x).toMatchObject({ capability: 'simulated', model: null });
    expect(x.requestId).toMatch(/^req-/);
    const other = await svc.extractBooking({ tripId: DEMO_IDS.trip, text: 'Totally different confirmation text, paid $12.00 USD' });
    expect(other.ok ? null : other.error.code).toBe('not_configured');
  });

  it('with AI: uses the adapter output, labels it live, and wraps the document as data', async () => {
    let seenInput = '';
    const adapter: ModelAdapter = {
      model: 'test-model',
      async generateStructured(req) {
        seenInput = req.input;
        return ok({ data: SAMPLE_RAW_EXTRACTIONS[DEMO_IDS.documents.hotelConfirmation] as never, model: 'test-model', usage: { inputTokens: 1, outputTokens: 1 } });
      },
    };
    const { fetch } = setup(adapter);
    const a = await session(fetch);
    const svc = createHttpExtractionService({ baseUrl: BASE, token: a.token, fetch, aiConfigured: true });
    const x = unwrap(await svc.extractBooking({ tripId: DEMO_IDS.trip, text: hotelText }));
    expect(x).toMatchObject({ capability: 'live', model: 'test-model' });
    expect(x.policy.deadlines[0]?.at).toBe(DEMO_TIMES.hotelDeadline);
    expect(seenInput.startsWith('<document>')).toBe(true);
  });

  it('with AI: provider failures surface as errors, never as sample results', async () => {
    const adapter: ModelAdapter = {
      model: 'test-model',
      async generateStructured(req): Promise<Result<never>> {
        return { ok: false, error: mapProviderError(new Anthropic.APIConnectionTimeoutError(), req.requestId) };
      },
    };
    const { fetch } = setup(adapter);
    const a = await session(fetch);
    const svc = createHttpExtractionService({ baseUrl: BASE, token: a.token, fetch, aiConfigured: true });
    const r = await svc.extractBooking({ tripId: DEMO_IDS.trip, text: hotelText });
    expect(r.ok ? null : r.error).toMatchObject({ code: 'timeout', retryable: true });
  });

  it('validates input size before any model call', async () => {
    const { fetch } = setup(null);
    const a = await session(fetch);
    const svc = createHttpExtractionService({ baseUrl: BASE, token: a.token, fetch, aiConfigured: false });
    const r = await svc.extractBooking({ tripId: DEMO_IDS.trip, text: 'x'.repeat(20_001) });
    expect(r.ok ? null : r.error.code).toBe('validation_failed');
  });
});

describe('config', () => {
  it('does not configure AI without a key and never inherits an unrelated base URL', () => {
    expect(loadConfig({ ANTHROPIC_BASE_URL: 'http://elsewhere' }).ai.provider).toBe('none');
    const c = loadConfig({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: 'http://elsewhere' });
    expect(c.ai).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', baseURL: 'https://api.anthropic.com' });
  });
});

describe('file persistence', () => {
  it('handles concurrent session creation and survives a registry restart', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'wayfare-test-'));
    try {
      const r1 = createWorkspaceRegistry({ dataDir: dir });
      const sessions = await Promise.all([r1.createSession(), r1.createSession(), r1.createSession()]);
      expect(sessions.every((s) => s.ok)).toBe(true);
      const first = unwrap(sessions[0]!);
      unwrap(await unwrap(await r1.repositoryFor(first.token)).repo.resetDemo('booked'));
      const r2 = createWorkspaceRegistry({ dataDir: dir });
      const again = unwrap(await r2.repositoryFor(first.token));
      expect(again.workspaceId).toBe(first.workspaceId);
      expect(unwrap(await again.repo.listBookings(DEMO_IDS.trip))).toHaveLength(4);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('hardening: session expiry and rate limits', () => {
  const hotelText = DEMO_DOCUMENT_SOURCES[DEMO_IDS.documents.hotelConfirmation]!.text;

  function hardened(over: Record<string, string>, nowRef: { t: number }) {
    const config = loadConfig({ WAYFARE_DATA_DIR: 'memory', WAYFARE_AI_PROVIDER: 'none', ...over });
    const now = () => new Date(nowRef.t);
    const registry = createWorkspaceRegistry({ dataDir: null, now, sessionTtlMs: config.sessionTtlMs });
    const handler = createApiHandler({ config, registry, adapter: null, now });
    const post = (path: string, body: unknown, opts: { token?: string; ip?: string } = {}) =>
      handler(
        new Request(`${BASE}${path}`, { method: 'POST', headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {}, body: JSON.stringify(body) }),
        { clientIp: opts.ip ?? '203.0.113.1' },
      );
    return { post };
  }
  const json = async (r: Response) => (await r.json()) as { ok: boolean; value?: { token: string; expiresAt: string }; error?: { code: string; details?: Record<string, unknown> } };

  it('expires guest sessions after the configured TTL', async () => {
    const clock = { t: Date.parse('2026-11-18T17:00:00Z') };
    const { post } = hardened({ WAYFARE_SESSION_TTL_HOURS: '1' }, clock);
    const s = await json(await post('/api/session', {}));
    expect(s.value?.expiresAt).toBe('2026-11-18T18:00:00Z');
    expect((await post('/api/repo/listTrips', {}, { token: s.value!.token })).status).toBe(200);
    clock.t += 3_600_000;
    const expired = await post('/api/repo/listTrips', {}, { token: s.value!.token });
    expect(expired.status).toBe(401);
    expect((await json(expired)).error).toMatchObject({ code: 'unauthorized', details: { reason: 'session_expired' } });
  });

  it('limits guest-session creation per client IP with Retry-After, and resets each hour', async () => {
    const clock = { t: Date.parse('2026-11-18T17:00:00Z') };
    const { post } = hardened({ WAYFARE_SESSION_LIMIT_PER_HOUR: '2' }, clock);
    expect((await post('/api/session', {}, { ip: 'a' })).status).toBe(200);
    expect((await post('/api/session', {}, { ip: 'a' })).status).toBe(200);
    const blocked = await post('/api/session', {}, { ip: 'a' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await json(blocked)).error?.code).toBe('rate_limited');
    expect((await post('/api/session', {}, { ip: 'b' })).status).toBe(200);
    clock.t += 3_600_000;
    expect((await post('/api/session', {}, { ip: 'a' })).status).toBe(200);
  });

  it('limits extractions per workspace, independently of other workspaces', async () => {
    const clock = { t: Date.parse('2026-11-18T17:00:00Z') };
    const { post } = hardened({ WAYFARE_EXTRACT_LIMIT_PER_HOUR: '2' }, clock);
    const a = (await json(await post('/api/session', {}))).value!.token;
    const b = (await json(await post('/api/session', {}))).value!.token;
    const body = { tripId: DEMO_IDS.trip, text: hotelText };
    expect((await post('/api/extract/booking', body, { token: a })).status).toBe(200);
    expect((await post('/api/extract/booking', body, { token: a })).status).toBe(200);
    expect((await post('/api/extract/booking', body, { token: a })).status).toBe(429);
    expect((await post('/api/extract/booking', body, { token: b })).status).toBe(200);
  });

  it('defaults are bounded: 7-day sessions, 20 sessions and 30 extractions per hour', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({ sessionTtlMs: 7 * 24 * 3_600_000, sessionLimitPerHour: 20, extractLimitPerHour: 30, trustProxy: false });
  });
});
