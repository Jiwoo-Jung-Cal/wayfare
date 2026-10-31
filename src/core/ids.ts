// ID conventions (contract v1).
//
// IDs are lowercase kebab strings with a type prefix: "<prefix>-<suffix>".
// Fixture IDs are fixed and human-readable (e.g. "bk-demo-hotel").
// Generated IDs use a random UUID suffix (e.g. "act-0b9c...").
// IDs are stable: never re-generate an ID for an existing record.

import { z } from 'zod';

export const IdSchema = z
  .string()
  .min(3)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/, 'Expected a prefixed kebab-case ID like "bk-demo-hotel"');
export type Id = z.infer<typeof IdSchema>;

export const ID_PREFIX = {
  workspace: 'ws',
  trip: 'trip',
  plan: 'plan',
  planLineItem: 'pli',
  quote: 'quote',
  booking: 'bk',
  policy: 'pol',
  refundTier: 'tier',
  deadline: 'ddl',
  excerpt: 'ex',
  document: 'doc',
  disruption: 'dis',
  recoveryOption: 'opt',
  action: 'act',
  recoveryComponent: 'rc',
  claim: 'clm',
  allocation: 'alloc',
  receipt: 'rcpt',
  asset: 'asset',
} as const;
export type IdKind = keyof typeof ID_PREFIX;

export function newId(kind: IdKind): Id {
  return `${ID_PREFIX[kind]}-${globalThis.crypto.randomUUID()}`;
}

/** New random idempotency key for a user-initiated write that may be retried. */
export function newIdempotencyKey(scope: string): string {
  return `${scope}:${globalThis.crypto.randomUUID()}`;
}

/** SHA-256 hex of text, used for duplicate-document detection. Works in browser, Node and Deno. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalization applied before hashing imported documents so whitespace-only edits are duplicates. */
export function normalizeDocumentText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
