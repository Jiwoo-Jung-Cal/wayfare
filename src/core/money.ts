// Integer-minor-unit money (contract v1).
//
// Rules:
// - Amounts are integers in the currency's minor unit (USD cents). Never floats.
// - Every amount carries an explicit ISO 4217 currency code.
// - Different currencies are never combined; arithmetic throws MoneyError.
// - An unknown amount is represented as UnknownValue, never as 0. Any sum that
//   includes an unknown amount is itself unknown.

import { z } from 'zod';

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Expected ISO 4217 code such as "USD"');
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const MoneySchema = z.object({
  amountMinor: z.number().int('Money must be integer minor units'),
  currency: CurrencyCodeSchema,
});
export type Money = z.infer<typeof MoneySchema>;

/** A value the source did not state or the system cannot determine. Not zero. */
export const UnknownValueSchema = z.object({
  unknown: z.literal(true),
  reason: z.string().min(1),
});
export type UnknownValue = z.infer<typeof UnknownValueSchema>;

export const MaybeMoneySchema = z.union([MoneySchema, UnknownValueSchema]);
export type MaybeMoney = z.infer<typeof MaybeMoneySchema>;

export class MoneyError extends Error {
  readonly code: 'currency_mismatch' | 'invalid_amount';
  constructor(code: 'currency_mismatch' | 'invalid_amount', message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

export function unknownValue(reason: string): UnknownValue {
  return { unknown: true, reason };
}

export function isUnknown(value: MaybeMoney | UnknownValue | unknown): value is UnknownValue {
  return typeof value === 'object' && value !== null && (value as UnknownValue).unknown === true;
}

export function isKnownMoney(value: MaybeMoney): value is Money {
  return !isUnknown(value);
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError('invalid_amount', `Money amount must be a safe integer of minor units, got ${amountMinor}`);
  }
  return { amountMinor, currency: CurrencyCodeSchema.parse(currency) };
}

/** Convenience for fixtures/tests: whole US dollars. usd(320) = $320.00. */
export function usd(wholeDollars: number): Money {
  return money(wholeDollars * 100, 'USD');
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency);
}

export function minorDigits(currency: CurrencyCode): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError('currency_mismatch', `Cannot combine ${a.currency} and ${b.currency} without a conversion`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amountMinor, a.currency);
}

/** Sum known amounts. An empty list sums to zero in the given currency. */
export function sum(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce<Money>((acc, v) => add(acc, v), zero(currency));
}

/** Returns -1, 0, 1. Throws on currency mismatch. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amountMinor === b.amountMinor ? 0 : a.amountMinor < b.amountMinor ? -1 : 1;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

/** Add two possibly-unknown amounts. Unknown in, unknown out. */
export function addMaybe(a: MaybeMoney, b: MaybeMoney): MaybeMoney {
  if (isUnknown(a)) return a;
  if (isUnknown(b)) return b;
  return add(a, b);
}

export function subtractMaybe(a: MaybeMoney, b: MaybeMoney): MaybeMoney {
  if (isUnknown(a)) return a;
  if (isUnknown(b)) return b;
  return subtract(a, b);
}

/** Sum possibly-unknown amounts. If any is unknown the result is unknown, with all reasons kept. */
export function sumMaybe(values: readonly MaybeMoney[], currency: CurrencyCode): MaybeMoney {
  const unknowns = values.filter(isUnknown);
  if (unknowns.length > 0) {
    return unknownValue(unknowns.map((u) => u.reason).join('; '));
  }
  return sum(values as Money[], currency);
}

/** "$1,260.00". Uses the currency's own minor-unit digits. */
export function formatMoney(value: Money, locale = 'en-US'): string {
  const digits = minorDigits(value.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value.amountMinor / 10 ** digits);
}

/** Display text for a possibly-unknown amount. Unknown renders as words, never "$0.00". */
export function formatMaybeMoney(value: MaybeMoney, locale = 'en-US', unknownLabel = 'Unknown'): string {
  return isUnknown(value) ? unknownLabel : formatMoney(value, locale);
}

/**
 * Parse a decimal amount string exactly (no float math): "320", "320.5", "1,260.00", "$450.00".
 * Returns null when the text is not a plain amount or has more decimals than the currency allows.
 */
export function parseMajorUnits(text: string, currency: CurrencyCode): Money | null {
  const cleaned = text.trim().replace(/^[^\d-]+/, '').replace(/,/g, '');
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole = '0', fraction = ''] = match;
  const digits = minorDigits(currency);
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  if (!Number.isSafeInteger(minor)) return null;
  return money(sign ? -minor : minor, currency);
}
