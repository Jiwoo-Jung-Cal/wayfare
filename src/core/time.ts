// Shared instants, deadline comparison primitives and the application clock (contract v1).
//
// Timestamp format: every persisted point in time is an ISO 8601 UTC instant
// string ending in "Z", second precision, e.g. "2026-11-19T23:00:00Z".
// Calendar dates (trip start/end) are "YYYY-MM-DD" LocalDate strings and are
// interpreted in the trip's displayTimezone. Display timezones are IANA names.
//
// DEADLINE BOUNDARY SEMANTICS (frozen for v1):
//   A deadline instant D is met only when the action time t is strictly
//   earlier: t < D. At exactly t === D the deadline has passed.
//   Time windows are half-open: [startsAtOrAfter, endsBefore).
//   Example: the hotel tier "$400 before 2026-11-19T23:00:00Z" applies at
//   22:59:59Z; at 23:00:00Z the "$200" tier applies.
//
// Shared helpers compare times only. ReRoute owns cancellation eligibility
// decisions built on top of these primitives.

import { z } from 'zod';

const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const InstantSchema = z
  .string()
  .regex(INSTANT_RE, 'Expected UTC instant like "2026-11-19T23:00:00Z"')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');
export type Instant = z.infer<typeof InstantSchema>;

export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected calendar date like "2026-11-20"')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');
export type LocalDate = z.infer<typeof LocalDateSchema>;

export const TimeZoneSchema = z.string().refine(isValidTimeZone, 'Expected IANA timezone like "America/New_York"');
export type TimeZone = z.infer<typeof TimeZoneSchema>;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Canonical instant string from a Date (drops ".000"). */
export function toInstant(date: Date | number): Instant {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toISOString().replace('.000Z', 'Z');
}

export function instantMs(instant: Instant): number {
  return Date.parse(instant);
}

export function compareInstants(a: Instant, b: Instant): -1 | 0 | 1 {
  const d = instantMs(a) - instantMs(b);
  return d === 0 ? 0 : d < 0 ? -1 : 1;
}

/** Strictly earlier. */
export function isBefore(a: Instant, b: Instant): boolean {
  return instantMs(a) < instantMs(b);
}

export type Duration = { days?: number; hours?: number; minutes?: number; seconds?: number };

export function addDuration(instant: Instant, d: Duration): Instant {
  const ms = (((d.days ?? 0) * 24 + (d.hours ?? 0)) * 60 + (d.minutes ?? 0)) * 60_000 + (d.seconds ?? 0) * 1000;
  return toInstant(instantMs(instant) + ms);
}

export const TimeWindowSchema = z.object({
  /** Inclusive lower bound; null = unbounded. */
  startsAtOrAfter: InstantSchema.nullable(),
  /** Exclusive upper bound; null = unbounded. */
  endsBefore: InstantSchema.nullable(),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

/** Half-open window membership: startsAtOrAfter <= t < endsBefore. */
export function isInWindow(t: Instant, window: TimeWindow): boolean {
  if (window.startsAtOrAfter !== null && isBefore(t, window.startsAtOrAfter)) return false;
  if (window.endsBefore !== null && !isBefore(t, window.endsBefore)) return false;
  return true;
}

/** First item whose window contains t (e.g. a refund tier), or undefined. */
export function findInWindow<T extends { window: TimeWindow }>(items: readonly T[], t: Instant): T | undefined {
  return items.find((item) => isInWindow(t, item.window));
}

export type DeadlineStatus = 'before_deadline' | 'deadline_passed';

/** now < deadline => before_deadline; now >= deadline => deadline_passed. */
export function deadlineStatus(now: Instant, deadline: Instant): DeadlineStatus {
  return isBefore(now, deadline) ? 'before_deadline' : 'deadline_passed';
}

/** Milliseconds remaining until the deadline; 0 or negative once passed. */
export function msUntil(now: Instant, deadline: Instant): number {
  return instantMs(deadline) - instantMs(now);
}

function zoneOffsetMs(utcMs: number, timeZone: TimeZone): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convert a wall-clock time in a timezone ("2026-11-19T18:00" in America/New_York)
 * to a UTC instant ("2026-11-19T23:00:00Z"). Used when normalizing extracted deadlines.
 * Returns null for unparseable input.
 */
export function zonedWallTimeToInstant(wallTime: string, timeZone: TimeZone): Instant | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(wallTime.trim());
  if (!m || !isValidTimeZone(timeZone)) return null;
  const [, y, mo, d, h, mi, s = '0'] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  let guess = naive - zoneOffsetMs(naive, timeZone);
  // Second pass corrects guesses that straddle a DST transition.
  guess = naive - zoneOffsetMs(guess, timeZone);
  return toInstant(guess);
}

/** Human display of an instant in a timezone, e.g. "Nov 19, 2026, 6:00 PM EST". */
export function formatInstant(instant: Instant, timeZone: TimeZone = 'UTC', locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(instantMs(instant)));
}

// ---------------------------------------------------------------------------
// Application clock. One active clock per workspace; every feature reads "now"
// from it so deadline comparisons agree across routes.

export const DEMO_CLOCK_START: Instant = '2026-11-18T17:00:00Z';

export const ClockStateSchema = z.discriminatedUnion('mode', [
  /** Sample mode: deterministic fixture clock, advanced only by demo controls. */
  z.object({ mode: z.literal('sample'), current: InstantSchema }),
  /** Real-time mode: wall clock. */
  z.object({ mode: z.literal('real') }),
]);
export type ClockState = z.infer<typeof ClockStateSchema>;

export interface Clock {
  readonly mode: ClockState['mode'];
  now(): Instant;
}

export function createClock(state: ClockState, realNow: () => Date = () => new Date()): Clock {
  if (state.mode === 'sample') {
    const current = state.current;
    return { mode: 'sample', now: () => current };
  }
  return { mode: 'real', now: () => toInstant(realNow()) };
}
