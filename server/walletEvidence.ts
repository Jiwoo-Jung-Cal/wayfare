// Feature-owned handler seam. This module never contains TripWallet prompts.
import { WalletEvidenceRequestSchema, parseWith, err, ok, type WalletEvidenceRequest, type Result, type WorkspaceRepository, type Instant } from '../src/core/index.ts';
import type { ModelAdapter } from './ai/modelAdapter.ts';

export type WalletEvidencePayload = { data: unknown; capability: 'live' | 'simulated'; model: string | null };
export type WalletEvidenceContext = {
  workspaceId: string;
  repo: WorkspaceRepository;
  adapter: ModelAdapter | null;
  requestId: string;
  now(): Instant;
};
export interface WalletEvidenceHandler {
  extract(request: WalletEvidenceRequest, context: WalletEvidenceContext): Promise<Result<WalletEvidencePayload>>;
}

export async function extractWalletEvidence(input: unknown, handler: WalletEvidenceHandler | null, context: WalletEvidenceContext) {
  const parsed = parseWith(WalletEvidenceRequestSchema, input);
  if (!parsed.ok) return parsed;
  const trip = await context.repo.getTrip(parsed.value.tripId);
  if (!trip.ok) return trip;
  if (!handler) return err('not_configured', 'TripWallet evidence handler is not registered; use reviewed fields or explicit sample inputs', { retryable: false });
  const result = await handler.extract(parsed.value, context);
  if (!result.ok) return result;
  const value = result.value;
  if (!value || !['live', 'simulated'].includes(value.capability) ||
    (value.capability === 'live' && (!context.adapter || typeof value.model !== 'string' || !value.model)) ||
    (value.capability === 'simulated' && value.model !== null)) {
    return err('provider_error', 'Wallet evidence handler returned an invalid capability or model');
  }
  return ok({ ...value, requestId: context.requestId });
}
