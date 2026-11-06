import { DEMO_IDS, type DemoContext, type PlanOption, type Trip } from '../../core/index.ts';
import { defaultPreferences, type Preferences } from './handler.ts';

/** Only restore facts the repository actually stores. Budget/ranking are absent in v1. */
export function restoredPreferences(trip: Trip, saved: PlanOption | null, ctx: DemoContext): Preferences {
  const defaults = defaultPreferences(ctx);
  const freeTimeIds = Object.values(DEMO_IDS.plans).map((id) => `${id}-free-time`);
  return {
    ...defaults,
    origin: trip.origin.name,
    destination: trip.destination.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    // This is the feature's own persisted variant convention, not a guess from price.
    interest: saved && freeTimeIds.includes(saved.id)
      && saved.assumptions.includes('No paid activity selected; free time has no booked service.')
      && !saved.lineItems.some((item) => item.kind === 'activity') ? 'free_time' : defaults.interest,
  };
}
