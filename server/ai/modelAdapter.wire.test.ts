// Wire-level checks for the real Anthropic adapter: the actual SDK client talks HTTP to a local
// stand-in for the Messages API (no key, no network, no paid call). This covers what fake-adapter
// tests cannot: the request the server really sends, structured-output parsing, stop reasons and
// error mapping. It is not live-AI evidence; `npm run smoke:live-ai` with a real key is.

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_DOCUMENT_SOURCES, RawBookingExtractionSchema, SAMPLE_RAW_EXTRACTIONS } from '../../src/core/index.ts';
import { loadConfig, type AiConfig } from '../config.ts';
import { runSmoke } from '../liveSmoke.ts';
import { createAnthropicAdapter, type ModelAdapter } from './modelAdapter.ts';

type Seen = { method: string; path: string; headers: IncomingMessage['headers']; body: Record<string, unknown> };
type Reply = { status: number; body: unknown; headers?: Record<string, string>; delayMs?: number };

let server: Server;
let baseURL = '';
const seen: Seen[] = [];
let respond: (req: Seen) => Reply = () => ({ status: 500, body: {} });

const message = (text: string, stop_reason = 'end_turn', model = 'claude-opus-5-5') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model,
  content: text ? [{ type: 'text', text }] : [],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 120, output_tokens: 80 },
});
const apiError = (status: number, type: string): Reply => ({
  status,
  body: { type: 'error', error: { type, message: `${type} (test)` } },
  headers: { 'x-should-retry': 'false', 'request-id': 'req_test' },
});

/** The provider stand-in answers each sample confirmation with its reviewed raw extraction. */
function sampleReply(req: Seen): Reply {
  const messages = req.body.messages as { content: string }[];
  const input = messages[0]?.content ?? '';
  const id = Object.entries(DEMO_DOCUMENT_SOURCES).find(([, d]) => input.includes(d.text))?.[0];
  const raw = id ? SAMPLE_RAW_EXTRACTIONS[id] : undefined;
  return raw ? { status: 200, body: message(JSON.stringify(raw)) } : apiError(400, 'invalid_request_error');
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const s: Seen = { method: req.method ?? '', path: req.url ?? '', headers: req.headers, body: data ? JSON.parse(data) : {} };
      seen.push(s);
      const r = respond(s);
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(r.status, { 'content-type': 'application/json', ...r.headers });
        res.end(JSON.stringify(r.body));
      }, r.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  seen.length = 0;
  respond = sampleReply;
});

function adapter(env: Record<string, string> = {}): ModelAdapter {
  const ai = loadConfig({ ANTHROPIC_API_KEY: 'sk-test-not-a-real-key', WAYFARE_ANTHROPIC_BASE_URL: baseURL, ...env }).ai;
  if (ai.provider !== 'anthropic') throw new Error('expected an anthropic config');
  return createAnthropicAdapter(ai as Extract<AiConfig, { provider: 'anthropic' }>, () => {});
}
const hotel = DEMO_DOCUMENT_SOURCES['doc-demo-hotel-confirmation']?.text ?? Object.values(DEMO_DOCUMENT_SOURCES)[0]!.text;
const call = (a: ModelAdapter, input = `<document>\n${hotel}\n</document>`) =>
  a.generateStructured({ task: 'booking-extraction', requestId: 'req-wire', system: 'Extract facts.', input, schema: RawBookingExtractionSchema });

describe('real adapter over HTTP (local provider stand-in)', () => {
  it('sends one Messages request with the server key, structured output format, effort and default fallbacks', async () => {
    const r = await call(adapter());
    expect(r.ok).toBe(true);
    expect(seen).toHaveLength(1);
    const [req] = seen;
    expect(req!.method).toBe('POST');
    expect(req!.path.split('?')[0]).toBe('/v1/messages');
    // The server's own key, and only it (SDK 1.x sends it as a bearer token).
    const auth = req!.headers['x-api-key'] ?? String(req!.headers.authorization ?? '').replace(/^Bearer /, '');
    expect(auth).toBe('sk-test-not-a-real-key');
    expect(String(req!.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(req!.body).toMatchObject({ model: 'claude-opus-5-5', system: 'Extract facts.', fallbacks: 'default', output_config: { effort: 'medium' } });
    const format = (req!.body.output_config as { format: { type: string; schema: unknown } }).format;
    expect(format.type).toBe('json_schema');
    expect(format.schema).toBeTypeOf('object');
    expect((req!.body.messages as { role: string; content: string }[])[0]).toMatchObject({ role: 'user' });
    if (r.ok) expect(r.value).toMatchObject({ model: 'claude-opus-5-5', usage: { inputTokens: 120, outputTokens: 80 } });
  });

  it('omits the fallback beta for models that do not accept it', async () => {
    await call(adapter({ WAYFARE_AI_MODEL: 'claude-haiku-5-5' }));
    expect(seen[0]!.body.fallbacks).toBeUndefined();
    expect(String(seen[0]!.headers['anthropic-beta'] ?? '')).not.toContain('server-side-fallback');
  });

  it('maps refusal, truncation and invalid output to provider errors, never to data', async () => {
    respond = () => ({ status: 200, body: message('', 'refusal') });
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'provider_error', retryable: false } });
    respond = () => ({ status: 200, body: message('{"is_booking_confirmation": tr', 'max_tokens') });
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'provider_error', retryable: true } });
    respond = () => ({ status: 200, body: message('{"not": "the schema"}') });
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'provider_error', retryable: true } });
  });

  it('maps HTTP failures to the shared error codes', async () => {
    respond = () => apiError(401, 'authentication_error');
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'not_configured', retryable: false } });
    respond = () => apiError(429, 'rate_limit_error');
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
    respond = () => apiError(529, 'overloaded_error');
    expect(await call(adapter())).toMatchObject({ ok: false, error: { code: 'provider_error' } });
  });

  it('times out at the configured limit', async () => {
    respond = () => ({ status: 200, body: message('{}'), delayMs: 1_000 });
    const r = await call(adapter({ WAYFARE_AI_TIMEOUT_MS: '100' }));
    expect(r).toMatchObject({ ok: false, error: { code: 'timeout' } });
  });

  it('rejects oversized input before any request', async () => {
    const r = await call(adapter({ WAYFARE_AI_MAX_INPUT_CHARS: '10' }));
    expect(r).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(seen).toHaveLength(0);
  });

  it('the smoke check runs all four sample confirmations through the real adapter and extraction path', async () => {
    const rows = await runSmoke(adapter());
    expect(rows.map((r) => [r.name, r.ok, r.model, r.differences])).toEqual([
      ['flight BLA7Q2', true, 'claude-opus-5-5', []],
      ['hotel HLH-48213', true, 'claude-opus-5-5', []],
      ['activity SKW-90551', true, 'claude-opus-5-5', []],
      ['transfer MLT-3307', true, 'claude-opus-5-5', []],
    ]);
    expect(seen).toHaveLength(4);
    for (const s of seen) expect((s.body.messages as { content: string }[])[0]!.content.startsWith('<document>\n')).toBe(true);
  });
});
