// Trip facts shared by the Overview tiles, notifications and the Ask WayFare demo
// assistant. Recovery amounts come from ReRoute's own comparison model
// (computeComparison), evaluated at the active clock or a given instant; this file
// adds no refund arithmetic of its own. Unknown amounts stay unknown.
import { computeComparison } from '../features/reroute/model.ts';
import {
  deadlineStatus,
  isUnknown,
  unknownValue,
  type Booking,
  type Instant,
  type MaybeMoney,
  type PolicyDeadline,
  type RecoveryOption,
  type WorkspaceSnapshot,
} from '../core/index.ts';

export type TripFacts = {
  bookings: Booking[];
  cancelTrip: RecoveryOption | null;
  continueTrip: RecoveryOption | null;
  /** Expected cash per booking if the whole trip is cancelled at `at`. */
  perBooking: { booking: Booking; cash: MaybeMoney }[];
  paid: MaybeMoney | null;
  /** True once cancel/replace actions are recorded for the active disruption. */
  approved: boolean;
  nextDeadline: { d: PolicyDeadline; booking: Booking; before?: MaybeMoney; after?: MaybeMoney } | null;
  disrupted: Booking | null;
};

export function tripFacts(s: WorkspaceSnapshot, tripId: string, at: Instant): TripFacts {
  const bookings = s.bookings.filter((b) => b.tripId === tripId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const disruption = s.disruptions.find((d) => d.tripId === tripId && d.status === 'active') ?? null;
  const cmp = computeComparison(s, tripId, at);
  const options = cmp.ok ? cmp.value.options : [];
  const cancelTrip = options.find((o) => o.kind === 'cancel_trip') ?? null;
  const continueTrip = options.find((o) => o.kind === 'continue') ?? null;
  const perBooking = bookings.map((booking) => ({
    booking,
    cash: cancelTrip?.bookingActions.find((a) => a.bookingId === booking.id)?.expectedRecovery ?? unknownValue('Not compared yet'),
  }));
  const approved = !!disruption && s.actions.some((a) => a.tripId === tripId && a.disruptionId === disruption.id && (a.action === 'cancel' || a.action === 'replace'));
  const deadlines = s.policies
    .filter((p) => p.tripId === tripId)
    .flatMap((p) => {
      const booking = bookings.find((b) => b.id === p.bookingId);
      return booking && booking.state !== 'cancelled' && booking.state !== 'replaced'
        ? p.deadlines.map((d) => ({
            d,
            booking,
            before: p.refundTiers.find((t) => t.window.endsBefore === d.at)?.refund,
            after: p.refundTiers.find((t) => t.window.startsAtOrAfter === d.at)?.refund,
          }))
        : [];
    })
    .filter((x) => deadlineStatus(at, x.d.at) === 'before_deadline')
    .sort((a, b) => a.d.at.localeCompare(b.d.at));
  return {
    bookings,
    cancelTrip,
    continueTrip,
    perBooking,
    paid: cancelTrip ? cancelTrip.cashPaidBeforeRefunds : null,
    approved,
    nextDeadline: deadlines[0] ?? null,
    disrupted: disruption ? (bookings.find((b) => b.id === disruption.bookingId) ?? null) : null,
  };
}

/** "$820" (whole) or "$820.50"; "Unknown" for unknown values. */
export function wholeMoney(m: MaybeMoney | undefined | null): string {
  if (!m || isUnknown(m)) return 'Unknown';
  const whole = m.amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(
    Math.abs(m.amountMinor) / 100,
  );
}
