// Web-standard API handler: (Request) => Promise<Response>.
// Runs under the Node adapter (server/node.ts) and can be wrapped by any
// fetch-style runtime (Deno/Supabase Edge, Workers) without changes.
//
// Routes
//   GET  /api/health                     capabilities summary (no secrets)
//   POST /api/session                    -> { token, workspaceId } (guest workspace)
//   POST /api/repo/:operation            body { args: [...] } -> Result (bearer token)
//   POST /api/extract/booking            body ExtractBookingRequest -> Result<BookingExtraction> (bearer token)
// Every response body is the shared Result shape and carries x-request-id.

import { appError, toInstant, type AppError, type ErrorCode, type Result } from '../src/core/index.ts';
import { describeAi, type ServerConfig } from './config.ts';
import type { ModelAdapter } from './ai/modelAdapter.ts';
import { extractBooking } from './extraction.ts';
import type { WorkspaceRegistry } from './workspaces.ts';

/** Repository operations callable over HTTP, with their maximum argument count. */
export const REPOSITORY_OPERATIONS = {
  getWorkspace: 0,
  snapshot: 0,
  getClock: 0,
  setClock: 1,
  resetDemo: 1,
  listTrips: 0,
  getTrip: 1,
  saveTrip: 2,
  listPlans: 1,
  savePlan: 2,
  selectPlan: 1,
  listQuotes: 1,
  saveQuote: 1,
  listDocuments: 1,
  getDocument: 1,
  putDocument: 1,
  listBookings: 1,
  getBooking: 1,
  saveBooking: 2,
  listPolicies: 1,
  getPolicy: 1,
  savePolicy: 2,
  saveReviewedBooking: 1,
  listDisruptions: 1,
  recordDisruption: 1,
  listRecoveryOptions: 1,
  replaceRecoveryOptions: 1,
  listActions: 1,
  recordBookingAction: 1,
  listClaims: 1,
  ensureClaims: 1,
  saveClaim: 2,
  listReceipts: 1,
  putReceipt: 1,
  saveReceipt: 2,
  listAssets: 0,
  saveAsset: 2,
} as const;
export type RepositoryOperation = keyof typeof REPOSITORY_OPERATIONS;

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  duplicate: 409,
  precondition_failed: 412,
  rate_limited: 429,
  internal: 500,
  unsupported: 501,
  provider_error: 502,
  not_configured: 503,
  unavailable: 503,
  timeout: 504,
};

export type ApiDeps = {
  config: ServerConfig;
  registry: WorkspaceRegistry;
  adapter: ModelAdapter | null;
  now?: () => Date;
  log?: (event: Record<string, unknown>) => void;
};

export function createApiHandler(deps: ApiDeps): (request: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => undefined);

  return async (request) => {
    const requestId = `req-${globalThis.crypto.randomUUID()}`;
    const origin = request.headers.get('origin');
    const corsHeaders = corsFor(origin, deps.config.allowedOrigins);
    const respond = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'cache-control': 'no-store', ...corsHeaders },
      });
    const fail = (error: AppError) => respond(STATUS[error.code], { ok: false, error: { ...error, requestId } });
    const result = (r: Result<unknown>) => (r.ok ? respond(200, r) : fail(r.error));

    // Browsers send Origin; reject origins that are not explicitly allowed.
    if (origin && !corsHeaders['access-control-allow-origin']) {
      return fail(appError('forbidden', `Origin ${origin} is not allowed`, { retryable: false }));
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...corsHeaders, 'x-request-id': requestId } });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const started = Date.now();
    try {
      if (request.method === 'GET' && path === '/api/health') {
        return respond(200, {
          ok: true,
          value: { service: 'wayfare-api', time: toInstant(now()), ai: describeAi(deps.config.ai), persistence: deps.registry.persistence },
        });
      }

      if (request.method !== 'POST') return fail(appError('not_found', `No route ${request.method} ${path}`, { retryable: false }));

      if (path === '/api/session') return result(await deps.registry.createSession());

      const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      const ws = await deps.registry.repositoryFor(token);
      if (!ws.ok) return fail(ws.error);

      const body = await readJson(request, deps.config.maxBodyBytes);
      if (!body.ok) return fail(body.error);

      if (path === '/api/extract/booking') {
        const r = await extractBooking(body.value, requestId, { adapter: deps.adapter, now: () => toInstant(now()) });
        log({ event: 'extract_booking', requestId, workspaceId: ws.value.workspaceId, ok: r.ok, code: r.ok ? null : r.error.code, ms: Date.now() - started });
        return result(r);
      }

      const op = /^\/api\/repo\/([A-Za-z]+)$/.exec(path)?.[1];
      if (op && Object.hasOwn(REPOSITORY_OPERATIONS, op)) {
        const args = (body.value as { args?: unknown }).args ?? [];
        if (!Array.isArray(args) || args.length > REPOSITORY_OPERATIONS[op as RepositoryOperation]) {
          return fail(appError('validation_failed', `Invalid arguments for ${op}`, { retryable: false }));
        }
        const repo = ws.value.repo as unknown as Record<string, (...a: unknown[]) => Promise<Result<unknown>>>;
        const r = await repo[op]!(...args);
        log({ event: 'repo', op, requestId, workspaceId: ws.value.workspaceId, ok: r.ok, code: r.ok ? null : r.error.code, ms: Date.now() - started });
        return result(r);
      }
      return fail(appError('not_found', `No route POST ${path}`, { retryable: false }));
    } catch (e) {
      log({ event: 'unhandled', requestId, path, message: (e as Error).message });
      return fail(appError('internal', 'Unexpected server error'));
    }
  };
}

function corsFor(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-expose-headers': 'x-request-id',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

async function readJson(request: Request, maxBytes: number): Promise<Result<unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false, error: appError('validation_failed', `Request body exceeds ${maxBytes} bytes`, { retryable: false }) };
  if (!text) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: appError('validation_failed', 'Request body is not valid JSON', { retryable: false }) };
  }
}
