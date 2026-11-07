// Sample destinations Wayfinder can plan in this demo build (Jiwoo, Nov 7). New York is the
// workspace's canonical trip (demoPlans in core fixtures). Chicago and Tokyo are fictional
// sample candidates that become real workspace trips when a plan is chosen. No provider is
// contacted; every price is a sample quote.
import {
  DEMO_TRIP_ID, demoPlans, demoTrip, unknownValue, usd,
  type DataProvenance, type DemoContext, type MaybeMoney, type PlanOption, type Trip,
} from '../../core/index.ts';

export type DestinationKey = 'nyc' | 'chi' | 'tyo';
export type Destination = {
  key: DestinationKey;
  tripId: string;
  title: string;
  name: string;
  code: string;
  aliases: string[];
  startDate: string;
  endDate: string;
  timezone: string;
  defaultBudget: string;
  /** The paid activity the "free time" choice replaces. */
  interest: { when: string; label: string };
};

export const DESTINATIONS: Record<DestinationKey, Destination> = {
  nyc: {
    key: 'nyc', tripId: DEMO_TRIP_ID, title: 'NY Trip', name: 'New York', code: 'JFK', aliases: ['new york', 'nyc', 'jfk', 'manhattan', 'brooklyn'],
    startDate: '2026-11-20', endDate: '2026-11-23', timezone: 'America/New_York', defaultBudget: '1000',
    interest: { when: 'Saturday morning', label: 'Skyline walk · $80' },
  },
  chi: {
    key: 'chi', tripId: 'trip-demo-chi', title: 'Chicago Weekend', name: 'Chicago', code: 'ORD', aliases: ['chicago', 'chi', 'ord', "o'hare", 'ohare'],
    startDate: '2026-12-11', endDate: '2026-12-13', timezone: 'America/Chicago', defaultBudget: '800',
    interest: { when: 'Saturday afternoon', label: 'Architecture boat tour · $48' },
  },
  tyo: {
    key: 'tyo', tripId: 'trip-demo-tyo', title: 'Tokyo in Spring', name: 'Tokyo', code: 'HND', aliases: ['tokyo', 'tyo', 'hnd', 'haneda', 'narita', 'japan'],
    startDate: '2027-03-27', endDate: '2027-04-03', timezone: 'Asia/Tokyo', defaultBudget: '3000',
    interest: { when: 'Second morning', label: 'Tsukiji food tour · $95' },
  },
};

export function destinationFor(text: string): Destination | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const word = (a: string) => new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u');
  return Object.values(DESTINATIONS).find((d) => d.aliases.some((a) => word(a).test(t))) ?? null;
}
export const destinationOfTrip = (tripId: string) => Object.values(DESTINATIONS).find((d) => d.tripId === tripId) ?? null;

const prov = (ctx: DemoContext, source: string): DataProvenance => ({ kind: 'sample', source, recordedAt: ctx.now, documentId: null, excerpt: null });
type Item = [kind: PlanOption['lineItems'][number]['kind'], description: string, price: MaybeMoney];
function plan(ctx: DemoContext, tripId: string, id: string, label: string, summary: string, items: Item[],
  convenience: PlanOption['convenience'], flexibility: PlanOption['flexibility'], assumptions: string[]): PlanOption {
  const lineItems = items.map(([kind, description, price]) => ({
    id: `pli-${id.replace(/^plan-/, '')}-${kind}`, kind, description, price, quoteId: null, expiresAt: null,
    provenance: prov(ctx, `Sample ${'unknown' in price ? 'estimate' : 'quote'}: ${description}`),
  }));
  const known = items.every(([, , p]) => !('unknown' in p));
  const total = known ? usd(items.reduce((n, [, , p]) => n + (p as { amountMinor: number }).amountMinor, 0) / 100) : unknownValue('A price is not quoted yet');
  return { id, workspaceId: ctx.workspaceId, tripId, revision: 1, createdAt: ctx.now, updatedAt: ctx.now, status: 'proposed', expiresAt: null,
    label, summary, lineItems, total, convenience, flexibility, assumptions };
}

/** The canonical candidate set for a destination; the handler accepts nothing else. */
export function catalogPlans(key: DestinationKey, ctx: DemoContext): PlanOption[] {
  if (key === 'nyc') return demoPlans(ctx);
  if (key === 'chi') {
    const t = DESTINATIONS.chi.tripId;
    return [
      plan(ctx, t, 'plan-chi-nonstop', 'Nonstop + Loop hotel', 'Morning nonstop on Bayline Air, 2 nights at The Loop Hotel, architecture boat tour, airport taxi.',
        [['flight', 'Bayline Air BL 530 SFO-ORD, Basic Saver', usd(280)], ['hotel', 'The Loop Hotel, 2 nights', usd(360)], ['activity', 'Chicago River architecture boat tour', usd(48)], ['transfer', "O'Hare taxi to the Loop", usd(45)]],
        'high', 'medium', ['Basic Saver fare is non-refundable unless the airline cancels.', 'Hotel refund drops 48 hours before check-in.']),
      plan(ctx, t, 'plan-chi-saver', 'One stop + River North stay', 'Connecting flight through Denver, 2 nights in River North, boat tour and the Blue Line train.',
        [['flight', 'SFO-ORD with one stop', usd(215)], ['hotel', 'River North hotel, 2 nights', usd(300)], ['activity', 'Chicago River architecture boat tour', usd(48)], ['transfer', 'CTA Blue Line fares', usd(10)]],
        'low', 'low', ['The connection adds about 2 hours.', 'Hotel is non-refundable.']),
      plan(ctx, t, 'plan-chi-flex', 'Refundable fare + flexible hotel', 'Fully refundable nonstop and a free-cancellation hotel. The airport ride isn’t quoted yet.',
        [['flight', 'Refundable nonstop SFO-ORD', usd(360)], ['hotel', 'Free-cancellation Loop hotel, 2 nights', usd(420)], ['activity', 'Chicago River architecture boat tour', usd(48)], ['transfer', 'Private car transfer', unknownValue('No transfer quote received yet')]],
        'high', 'high', ['Transfer price unknown until quoted.']),
    ];
  }
  const t = DESTINATIONS.tyo.tripId;
  return [
    plan(ctx, t, 'plan-tyo-nonstop', 'Nonstop + Shinjuku hotel', 'Nonstop to Haneda, 7 nights in Shinjuku, a Tsukiji food tour and the airport limousine bus.',
      [['flight', 'Nonstop SFO-HND, economy', usd(1240)], ['hotel', 'Shinjuku hotel, 7 nights', usd(1120)], ['activity', 'Tsukiji outer market food tour', usd(95)], ['transfer', 'Airport limousine bus', usd(25)]],
      'high', 'medium', ['Economy fare is non-refundable unless the airline cancels.', 'Hotel refund drops 3 days before check-in.']),
    plan(ctx, t, 'plan-tyo-saver', 'One stop + Asakusa ryokan', 'One stop via Seoul, 7 nights at a ryokan in Asakusa, food tour and the train from Haneda.',
      [['flight', 'SFO-HND with one stop', usd(980)], ['hotel', 'Asakusa ryokan, 7 nights', usd(1050)], ['activity', 'Tsukiji outer market food tour', usd(95)], ['transfer', 'Keikyu train from Haneda', usd(15)]],
      'low', 'low', ['The connection adds about 4 hours.', 'Ryokan deposit is non-refundable.']),
    plan(ctx, t, 'plan-tyo-flex', 'Refundable fare + flexible hotel', 'Fully refundable nonstop and a free-cancellation Ginza hotel. The airport ride isn’t quoted yet.',
      [['flight', 'Refundable nonstop SFO-HND', usd(1480)], ['hotel', 'Free-cancellation Ginza hotel, 7 nights', usd(1260)], ['activity', 'Tsukiji outer market food tour', usd(95)], ['transfer', 'Private car transfer', unknownValue('No transfer quote received yet')]],
      'high', 'high', ['Transfer price unknown until quoted.']),
  ];
}

/** A new workspace trip for a destination, created when its first plan is chosen. */
export function tripFor(key: DestinationKey, ctx: DemoContext): Trip {
  if (key === 'nyc') return demoTrip(ctx);
  const d = DESTINATIONS[key];
  return {
    id: d.tripId, workspaceId: ctx.workspaceId, title: d.title,
    origin: { name: 'San Francisco', code: 'SFO' }, destination: { name: d.name, code: d.code },
    startDate: d.startDate, endDate: d.endDate, displayTimezone: d.timezone, selectedPlanId: null, mode: 'sample',
    provenance: prov(ctx, `WayFare sample trip: ${d.title}`), revision: 1, createdAt: ctx.now, updatedAt: ctx.now,
  };
}

/**
 * Group pricing for the sample quotes: flights and tickets are per traveler, one hotel room
 * sleeps two, one car or shared ride carries four. Unknown prices stay unknown.
 */
export function groupQuantity(kind: string, travelers: number) {
  if (kind === 'flight' || kind === 'activity') return travelers;
  if (kind === 'hotel') return Math.ceil(travelers / 2);
  if (kind === 'transfer') return Math.ceil(travelers / 4);
  return 1;
}
