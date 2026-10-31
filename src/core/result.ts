// Shared structured result and error shape (contract v1).
// Every repository/service operation returns Result<T> instead of throwing for
// expected failures, so UI code can render a consistent error/retry state.

import { z } from 'zod';

export const ERROR_CODES = [
  'validation_failed', // input or stored data did not match the schema
  'not_found',
  'conflict', // revision mismatch / concurrent write
  'duplicate', // unique constraint (document hash, receipt reference) hit with different content
  'unauthorized', // no/invalid session
  'forbidden', // session valid but resource belongs to another workspace
  'precondition_failed', // e.g. action recorded for a booking in the wrong state
  'rate_limited',
  'timeout',
  'provider_error', // AI/model or external provider failure
  'not_configured', // capability requires configuration that is missing (e.g. no AI key)
  'unavailable', // backend unreachable
  'unsupported',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const AppErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  retryable: z.boolean(),
  /** Field-level issues for validation_failed. */
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  /** Request/trace ID when the error came from the server. */
  requestId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AppError = z.infer<typeof AppErrorSchema>;

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

const RETRYABLE: ReadonlySet<ErrorCode> = new Set(['rate_limited', 'timeout', 'unavailable', 'provider_error']);

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(
  code: ErrorCode,
  message: string,
  extra: Partial<Omit<AppError, 'code' | 'message'>> = {},
): Result<T> {
  return { ok: false, error: appError(code, message, extra) };
}

export function appError(
  code: ErrorCode,
  message: string,
  extra: Partial<Omit<AppError, 'code' | 'message'>> = {},
): AppError {
  return { code, message, retryable: extra.retryable ?? RETRYABLE.has(code), ...extra };
}

/** Convert a Zod failure into the shared validation error. */
export function fromZodError(error: z.ZodError, message = 'Validation failed'): AppError {
  return appError('validation_failed', message, {
    issues: error.issues.map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message })),
  });
}

/** Parse with a schema and return a Result instead of throwing. */
export function parseWith<S extends z.ZodType>(schema: S, input: unknown, message?: string): Result<z.infer<S>> {
  const parsed = schema.safeParse(input);
  return parsed.success ? ok(parsed.data) : { ok: false, error: fromZodError(parsed.error, message) };
}

/** Unwrap for tests and scripts; throws with the structured error attached. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  const e = new Error(`${result.error.code}: ${result.error.message}`);
  (e as Error & { appError: AppError }).appError = result.error;
  throw e;
}
