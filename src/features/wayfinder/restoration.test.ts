import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK_START, demoPlans, demoTrip } from '../../core/index.ts';
import { defaultPreferences, generatePlans } from './handler.ts';
import { restoredPreferences } from './restoration.ts';

const ctx = { workspaceId: 'workspace-restore', now: DEMO_CLOCK_START };
const trip = demoTrip(ctx);

describe('saved Plan restoration', () => {
  it('restores the stored free-time variant without inventing its original budget or ranking', async () => {
    const generated = await generatePlans({ ...defaultPreferences(ctx), budget: '800', interest: 'free_time', priority: 'convenience' }, { ...ctx, tripId: trip.id });
    if (!generated.ok) throw new Error(generated.error.message);
    const saved = generated.value.options.find((o) => o.plan.id === 'plan-demo-saver-free-time')!.plan;
    expect(restoredPreferences(trip, saved, ctx)).toMatchObject({ interest: 'free_time', budget: '1000', priority: 'price', travelers: 1 });
    expect(saved.total).toEqual({ amountMinor: 73500, currency: 'USD' });
  });

  it('uses actual trip route and dates, allowing existing unsupported-input validation to reject them', async () => {
    const preferences = restoredPreferences({ ...trip, origin: { name: 'Vienna', code: 'VIE' }, endDate: '2026-11-24' }, null, ctx);
    expect(preferences).toMatchObject({ origin: 'Vienna', destination: trip.destination.name, endDate: '2026-11-24' });
    const result = await generatePlans(preferences, { ...ctx, tripId: trip.id });
    expect(result).toMatchObject({ ok: false, error: { code: 'unsupported' } });
  });

  it('does not infer free time from an arbitrary ID or a missing paid activity alone', () => {
    expect(restoredPreferences(trip, null, ctx).interest).toBe('skyline');
    const sample = demoPlans(ctx)[0]!;
    expect(restoredPreferences(trip, { ...sample, id: 'arbitrary-free-time', lineItems: [], assumptions: ['No paid activity selected; free time has no booked service.'] }, ctx).interest).toBe('skyline');
    expect(restoredPreferences(trip, { ...sample, id: `${sample.id}-free-time`, lineItems: [] }, ctx).interest).toBe('skyline');
  });
});
