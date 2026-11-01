// Shared transport only. TripWallet owns evidence prompts and domain schemas.
import { z } from 'zod';
import { IdSchema } from './ids.ts';
import { err, type Result } from './result.ts';

export const WalletEvidenceRequestSchema = z.strictObject({
  tripId: IdSchema,
  kind: z.enum(['receipt', 'refund_confirmation']),
  text: z.string().min(20).max(20_000),
});
export type WalletEvidenceRequest = z.infer<typeof WalletEvidenceRequestSchema>;
export const WalletEvidenceEnvelopeSchema = z.strictObject({
  data: z.unknown(),
  capability: z.enum(['live', 'simulated']),
  model: z.string().min(1).nullable(),
  requestId: z.string().min(1),
});
export type WalletEvidenceExtraction<T> = Omit<z.infer<typeof WalletEvidenceEnvelopeSchema>, 'data'> & { data: T };

export interface WalletEvidenceService {
  readonly available: boolean;
  readonly description: string;
  /** schema stays in the feature/client; no model prompt or schema is sent over HTTP. */
  extract<S extends z.ZodType>(request: WalletEvidenceRequest, schema: S): Promise<Result<WalletEvidenceExtraction<z.infer<S>>>>;
}

export function createUnavailableWalletEvidenceService(): WalletEvidenceService {
  return {
    available: false,
    description: 'Wallet AI evidence extraction is unavailable. Use reviewed fields or explicit sample inputs.',
    async extract() { return err('not_configured', 'Wallet evidence extraction is not configured; use reviewed fields or explicit sample inputs', { retryable: false }); },
  };
}
