// Connected-mode clients: WorkspaceRepository and ExtractionService over the
// WayFare API. Network or server failures are returned as errors; they never
// fall back to sample data.

import { appError, parseWith, AppErrorSchema, type Result } from '../result.ts';
import type { WorkspaceRepository, RepositoryCapabilities } from '../repository.ts';
import { ExtractBookingRequestSchema, type BookingExtraction, type ExtractBookingRequest, type ExtractionService } from '../extraction.ts';
import type { Id } from '../ids.ts';
import type { KeyValueStorage } from '../store/localRepository.ts';
import type { z } from 'zod';
import { WalletEvidenceRequestSchema, WalletEvidenceEnvelopeSchema, type WalletEvidenceService } from '../walletEvidence.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  /** e.g. "http://localhost:8787" (no trailing slash). */
  baseUrl: string;
  token: string;
  fetch?: FetchLike;
};

async function call<T>(opts: { baseUrl: string; token?: string; fetch?: FetchLike }, path: string, body: unknown): Promise<Result<T>> {
  const doFetch = opts.fetch ?? ((i: string, init?: RequestInit) => globalThis.fetch(i, init));
  let response: Response;
  try {
    response = await doFetch(`${opts.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: appError('unavailable', `Could not reach the WayFare server (${(e as Error).message})`) };
  }
  const requestId = response.headers.get('x-request-id') ?? undefined;
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: appError('unavailable', `Server returned a non-JSON response (HTTP ${response.status})`, { requestId }) };
  }
  const j = json as { ok?: boolean; value?: unknown; error?: unknown };
  if (j.ok === true) return { ok: true, value: j.value as T };
  const parsed = parseWith(AppErrorSchema, j.error);
  return { ok: false, error: parsed.ok ? parsed.value : appError('internal', `Unexpected server response (HTTP ${response.status})`, { requestId }) };
}

const OPERATIONS = [
  'getWorkspace', 'snapshot', 'getClock', 'setClock', 'resetDemo', 'listTrips', 'getTrip', 'saveTrip', 'listPlans', 'savePlan',
  'selectPlan', 'listQuotes', 'saveQuote', 'listDocuments', 'getDocument', 'putDocument', 'listBookings', 'getBooking', 'saveBooking',
  'listPolicies', 'getPolicy', 'savePolicy', 'saveReviewedBooking', 'listDisruptions', 'recordDisruption', 'listRecoveryOptions',
  'replaceRecoveryOptions', 'listActions', 'recordBookingAction', 'listClaims', 'ensureClaims', 'saveClaim', 'listReceipts',
  'putReceipt', 'saveReceipt', 'listAssets', 'saveAsset',
] as const satisfies readonly (keyof WorkspaceRepository)[];

export function createHttpRepository(opts: ApiClientOptions): WorkspaceRepository {
  const capabilities: RepositoryCapabilities = {
    mode: 'connected',
    persistence: 'server',
    durable: true,
    description: `Connected mode: workspace stored on ${opts.baseUrl}. Provider actions remain simulated.`,
  };
  const repo: Record<string, unknown> = { capabilities };
  for (const op of OPERATIONS) {
    repo[op] = (...args: unknown[]) => call(opts, `/api/repo/${op}`, { args });
  }
  return repo as unknown as WorkspaceRepository;
}

export function createHttpExtractionService(opts: ApiClientOptions & { aiConfigured: boolean }): ExtractionService {
  return {
    capability: opts.aiConfigured ? 'live' : 'simulated',
    description: opts.aiConfigured
      ? 'Connected mode: confirmations are extracted by the server AI model and must be reviewed before saving.'
      : 'Connected mode without AI credentials: only the WayFare sample confirmations can be extracted (simulated).',
    async extractBooking(request: ExtractBookingRequest): Promise<Result<BookingExtraction>> {
      const parsed = parseWith(ExtractBookingRequestSchema, request);
      if (!parsed.ok) return parsed;
      return call<BookingExtraction>(opts, '/api/extract/booking', parsed.value);
    },
  };
}

export function createHttpWalletEvidenceService(opts: ApiClientOptions & { handlerRegistered: boolean }): WalletEvidenceService {
  return {
    available: opts.handlerRegistered,
    description: 'Server-backed wallet evidence transport. Each result identifies live or simulated extraction; review is required.',
    async extract<S extends z.ZodType>(request: Parameters<WalletEvidenceService['extract']>[0], schema: S) {
      const input = parseWith(WalletEvidenceRequestSchema, request);
      if (!input.ok) return input;
      const result = await call<unknown>(opts, '/api/extract/wallet', input.value);
      if (!result.ok) return result;
      const envelope = parseWith(WalletEvidenceEnvelopeSchema, result.value, 'Invalid wallet evidence response');
      if (!envelope.ok) return envelope;
      const data = parseWith(schema, envelope.value.data, 'Wallet evidence did not match the feature schema');
      if (!data.ok) return data;
      return { ok: true as const, value: { ...envelope.value, data: data.value } };
    },
  };
}

export type ServerHealth = { service: string; time: string; ai: { configured: boolean; provider: string; model?: string; reason?: string }; persistence: string; walletEvidence?: { handlerRegistered: boolean } };

export async function fetchHealth(baseUrl: string, fetchImpl?: FetchLike): Promise<Result<ServerHealth>> {
  const doFetch = fetchImpl ?? ((i: string, init?: RequestInit) => globalThis.fetch(i, init));
  try {
    const r = await doFetch(`${baseUrl}/api/health`);
    const j = (await r.json()) as { ok: boolean; value: ServerHealth };
    return j.ok ? { ok: true, value: j.value } : { ok: false, error: appError('unavailable', 'Server health check failed') };
  } catch (e) {
    return { ok: false, error: appError('unavailable', `Could not reach the WayFare server (${(e as Error).message})`) };
  }
}

const sessionKey = (baseUrl: string) => `wayfare:v1:session:${baseUrl}`;

/** Reuse this browser's guest session for the server, or create one. */
export async function getOrCreateGuestSession(
  baseUrl: string,
  storage: KeyValueStorage,
  fetchImpl?: FetchLike,
): Promise<Result<{ token: string; workspaceId: Id }>> {
  const stored = storage.getItem(sessionKey(baseUrl));
  if (stored) {
    try {
      return { ok: true, value: JSON.parse(stored) as { token: string; workspaceId: Id } };
    } catch {
      storage.removeItem(sessionKey(baseUrl));
    }
  }
  // Concurrent callers (e.g. React StrictMode double effects) share one creation request.
  let pending = inFlightSessions.get(baseUrl);
  if (!pending) {
    pending = call<{ token: string; workspaceId: Id }>({ baseUrl, fetch: fetchImpl }, '/api/session', {}).then((created) => {
      if (created.ok) storage.setItem(sessionKey(baseUrl), JSON.stringify(created.value));
      inFlightSessions.delete(baseUrl);
      return created;
    });
    inFlightSessions.set(baseUrl, pending);
  }
  return pending;
}

const inFlightSessions = new Map<string, Promise<Result<{ token: string; workspaceId: Id }>>>();

export function forgetGuestSession(baseUrl: string, storage: KeyValueStorage): void {
  storage.removeItem(sessionKey(baseUrl));
}
