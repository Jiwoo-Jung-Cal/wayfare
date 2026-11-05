// The single server-only model-provider adapter.
//
// Feature handlers supply their own instructions and Zod output schema; the
// adapter owns the provider call, structured-output validation, timeout,
// refusal/truncation handling, error mapping and request tracing. It is not
// exposed as a generic public model proxy: only server handlers call it.
// Routine logs contain request IDs, model and token counts, never document text.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { appError, err, ok, type Result } from '../../src/core/index.ts';
import type { AiConfig } from '../config.ts';

export type StructuredRequest<S extends z.ZodType> = {
  /** Short task name for logs, e.g. "booking-extraction". */
  task: string;
  requestId: string;
  system: string;
  /** User-turn content (the handler wraps untrusted documents as data). */
  input: string;
  schema: S;
  maxOutputTokens?: number;
};

export type StructuredResponse<T> = { data: T; model: string; usage: { inputTokens: number; outputTokens: number } };

export interface ModelAdapter {
  readonly model: string;
  generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<Result<StructuredResponse<z.infer<S>>>>;
}

export type Logger = (event: Record<string, unknown>) => void;
export const consoleLogger: Logger = (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));

/** Models that accept server-side `fallbacks: "default"` (not Haiku). */
const supportsDefaultFallback = (model: string) => /^claude-(opus|sonnet|fable)-/.test(model);

export function createAnthropicAdapter(config: Extract<AiConfig, { provider: 'anthropic' }>, log: Logger = consoleLogger): ModelAdapter {
  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: config.timeoutMs, maxRetries: 1 });

  return {
    model: config.model,
    async generateStructured(req) {
      if (req.input.length > config.maxInputChars) {
        return err('validation_failed', `Input exceeds ${config.maxInputChars} characters`, { requestId: req.requestId, retryable: false });
      }
      const started = Date.now();
      const fallback = supportsDefaultFallback(config.model);
      try {
        const response = await client.beta.messages.parse({
          model: config.model,
          max_tokens: req.maxOutputTokens ?? 16000,
          system: req.system,
          messages: [{ role: 'user', content: req.input }],
          output_config: { effort: config.effort, format: betaZodOutputFormat(req.schema) },
          ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        });
        const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
        log({ event: 'model_call', task: req.task, requestId: req.requestId, model: response.model, stopReason: response.stop_reason, ms: Date.now() - started, ...usage });

        if (response.stop_reason === 'refusal') {
          return err('provider_error', 'The AI model declined to process this document', { requestId: req.requestId, retryable: false });
        }
        if (response.stop_reason === 'max_tokens') {
          return err('provider_error', 'The AI response was cut off before completion', { requestId: req.requestId, retryable: true });
        }
        if (response.parsed_output === null || response.parsed_output === undefined) {
          return err('provider_error', 'The AI response was not valid structured output', { requestId: req.requestId, retryable: true });
        }
        return ok({ data: response.parsed_output as z.infer<typeof req.schema>, model: response.model, usage });
      } catch (e) {
        const mapped = mapProviderError(e, req.requestId);
        log({ event: 'model_error', task: req.task, requestId: req.requestId, model: config.model, code: mapped.code, status: (e as { status?: number }).status ?? null, ms: Date.now() - started });
        return { ok: false, error: mapped };
      }
    },
  };
}

/** Most-specific-first mapping of SDK errors to the shared error shape. Messages are safe for users. */
export function mapProviderError(e: unknown, requestId: string) {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return appError('timeout', 'The AI provider timed out', { requestId });
  if (e instanceof Anthropic.APIConnectionError) return appError('unavailable', 'Could not reach the AI provider', { requestId });
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return appError('not_configured', 'The server AI credentials were rejected', { requestId, retryable: false });
  }
  if (e instanceof Anthropic.RateLimitError) return appError('rate_limited', 'The AI provider is rate limiting requests; try again shortly', { requestId });
  if (e instanceof Anthropic.BadRequestError) return appError('provider_error', 'The AI provider rejected the request', { requestId, retryable: false });
  if (e instanceof Anthropic.InternalServerError) return appError('provider_error', 'The AI provider had an internal error', { requestId, retryable: true });
  if (e instanceof Anthropic.APIError) return appError('provider_error', `AI provider error (${e.status ?? 'unknown status'})`, { requestId });
  // Raised by the SDK's structured-output parser after a successful HTTP response (e.g. JSON cut
  // off at max_tokens, or output that fails the schema): the response was unusable, so retry.
  if (e instanceof Anthropic.AnthropicError) return appError('provider_error', 'The AI response was incomplete or not valid structured output', { requestId, retryable: true });
  return appError('internal', 'Unexpected error while calling the AI provider', { requestId });
}
