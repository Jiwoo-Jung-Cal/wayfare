import { describe, expect, it } from 'vitest';
import {
  DEMO_EXPECTED, DEMO_IDS, DEMO_TIMES, DEMO_TRIP_ID, createLocalRepository, demoPlans, err,
  isUnknown, memoryStorage, money, ok, subtract, unwrap, usd,
  type PlanOption, type Result,
} from '../../core/index.ts';
import { budgetForDisplay, costBreakdown, createPlanGenerator, defaultPreferences, generatePlans, type CandidateProvider } from './handler.ts';
import { selectPlanningOption } from './selection.ts';

const context = { workspaceId: 'ws-wayfinder-test', tripId: DEMO_TRIP_ID, now: DEMO_TIMES.clockStart };
const defaults = () => defaultPreferences(context);
const generate = (p = defaults()) => generatePlans(p, context);

describe('sample planning behavior', () => {
  it('ranks three canonical options using computed component totals and transparent sample provenance', async () => {
    const result = unwrap(await generate());
    expect(result.capability).toBe('simulated');
    expect(result.options.map((o) => o.plan.id)).toEqual([DEMO_IDS.plans.saver, DEMO_IDS.plans.nonstop, DEMO_IDS.plans.flex]);
    expect(result.options[0]!.plan.total).toEqual(DEMO_EXPECTED.planTotals.saver);
    expect(result.options[1]!.plan.total).toEqual(DEMO_EXPECTED.planTotals.nonstop);
    expect(isUnknown(result.options[2]!.plan.total)).toBe(true);
    expect(result.options[2]!.budgetStatus).toBe('unknown');
    expect(result.options.every((o) => o.plan.lineItems.every((i) => i.provenance.kind === 'sample' && i.provenance.recordedAt))).toBe(true);
  });

  it('changes ranking for convenience and flexibility without changing prices', async () => {
    expect(unwrap(await generate({ ...defaults(), priority: 'convenience' })).options[0]!.plan.id).toBe(DEMO_IDS.plans.nonstop);
    expect(unwrap(await generate({ ...defaults(), priority: 'flexibility' })).options[0]!.plan.id).toBe(DEMO_IDS.plans.flex);
  });

  it('changes itinerary and integer totals when the paid interest is omitted, keeping a distinct stable plan ID', async () => {
    const result = unwrap(await generate({ ...defaults(), interest: 'free_time' }));
    const saver = result.options[0]!.plan;
    expect(saver.id).toBe(`${DEMO_IDS.plans.saver}-free-time`);
    expect(saver.lineItems.some((i) => i.kind === 'activity')).toBe(false);
    expect(saver.total).toEqual(subtract(DEMO_EXPECTED.planTotals.saver, DEMO_EXPECTED.bookingsPaid.activity));
    expect(unwrap(await generate({ ...defaults(), interest: 'free_time' })).options[0]!.plan.id).toBe(saver.id);
  });

  it('does not report over-budget or incomplete costs as within budget', async () => {
    const result = unwrap(await generate({ ...defaults(), budget: '800' }));
    expect(result.options.map((o) => o.budgetStatus)).toEqual(['over', 'over', 'unknown']);
    const exact = unwrap(await generate({ ...defaults(), budget: '815' }));
    expect(exact.options[0]!.budgetStatus).toBe('within');
  });

  it.each([
    { startDate: '2026-11-24' }, { startDate: '2026-02-30' }, { endDate: '2026-11-20' },
    { budget: '0' }, { budget: '-1' }, { budget: '10.001' }, { budget: 'USD 900' },
    { budget: '9999999999999999999999' }, { currency: 'EUR' }, { travelers: 2 }, { priority: 'anything' },
  ])('rejects invalid input %j', async (change) => {
    expect((await generatePlans({ ...defaults(), ...change }, context)).ok).toBe(false);
  });

  it.each([{ destination: 'Paris' }, { origin: 'LAX' }, { startDate: '2026-11-19' }, { endDate: '2026-11-24' }])('rejects unsupported inputs instead of silently returning NYC: %j', async (change) => {
    const result = await generatePlans({ ...defaults(), ...change }, context);
    expect(!result.ok && result.error.code).toBe('unsupported');
  });

  it('checks every currency even when another line is unknown', () => {
    const plan = structuredClone(demoPlans(context)[2]!);
    plan.lineItems[0]!.price = money(100, 'EUR');
    expect(costBreakdown(plan).ok).toBe(false);
  });

  it('rejects an invented candidate or altered sample price', async () => {
    const provider: CandidateProvider = { capability: 'simulated', candidates: async () => {
      const plans = demoPlans(context); plans[0]!.lineItems[0]!.price = usd(1); return ok(plans);
    } };
    const response = await generatePlans(defaults(), context, provider);
    expect(!response.ok && response.error.code).toBe('validation_failed');
  });

  it('returns a provider/model error without substituting a successful sample', async () => {
    const failure = err('timeout', 'Provider timed out');
    expect(await generatePlans(defaults(), context, { capability: 'simulated', candidates: async () => failure })).toEqual(failure);
  });

  it('ignores an older response after a newer request or changed input', async () => {
    const resolve: ((r: Result<PlanOption[]>) => void)[] = [];
    const generator = createPlanGenerator({ capability: 'simulated', candidates: () => new Promise((r) => resolve.push(r)) });
    const older = generator.generate(defaults(), context);
    const newer = generator.generate({ ...defaults(), priority: 'flexibility' }, context);
    resolve[1]!(ok(demoPlans(context)));
    expect(unwrap((await newer)!).options[0]!.plan.id).toBe(DEMO_IDS.plans.flex);
    resolve[0]!(ok(demoPlans(context)));
    expect(await older).toBeNull();
    const changed = generator.generate(defaults(), context); generator.invalidate(); resolve[2]!(ok(demoPlans(context)));
    expect(await changed).toBeNull();
  });
});

describe('selected plan persistence', () => {
  it('saves a generated option, replays selection without revision churn, reloads, and never creates bookings', async () => {
    const storage = memoryStorage();
    const repo = createLocalRepository({ storage, workspaceId: context.workspaceId });
    const plan = unwrap(await generate({ ...defaults(), interest: 'free_time' })).options[0]!.plan;
    const first = unwrap(await selectPlanningOption(repo, plan, context.now));
    expect(first.replayed).toBe(false);
    const again = unwrap(await selectPlanningOption(repo, plan, context.now));
    expect(again.replayed).toBe(true);
    expect(again.trip.revision).toBe(first.trip.revision);
    const reloaded = createLocalRepository({ storage, workspaceId: context.workspaceId });
    expect(unwrap(await reloaded.getTrip(DEMO_TRIP_ID)).selectedPlanId).toBe(plan.id);
    expect(unwrap(await reloaded.listPlans(DEMO_TRIP_ID)).filter((p) => p.id === plan.id)).toHaveLength(1);
    expect(unwrap(await reloaded.listBookings(DEMO_TRIP_ID))).toHaveLength(0);
  });

  it('uses the canonical plan after the clock changes, without rewriting its recorded sample source time', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: context.workspaceId });
    const later = { ...context, now: DEMO_TIMES.hotelDeadline };
    const plan = unwrap(await generatePlans(defaults(), later)).options[0]!.plan;
    const result = unwrap(await selectPlanningOption(repo, plan, later.now));
    expect(result.plan.lineItems[0]!.provenance.recordedAt).toBe(context.now);
  });

  it('refuses unknown prices, expired quotes, or a mismatched total', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: context.workspaceId });
    const plans = demoPlans(context);
    expect((await selectPlanningOption(repo, plans[2]!, context.now)).ok).toBe(false);
    expect((await selectPlanningOption(repo, { ...plans[0]!, expiresAt: context.now }, context.now)).ok).toBe(false);
    expect((await selectPlanningOption(repo, { ...plans[0]!, total: usd(1) }, context.now)).ok).toBe(false);
  });
});

describe('budget display fallback', () => {
  it('shows a validated budget exactly and an unreadable budget as unknown, never zero', () => {
    expect(budgetForDisplay('800.50')).toEqual(money(80050, 'USD'));
    const bad = budgetForDisplay('not-a-number');
    expect(isUnknown(bad)).toBe(true);
  });
});
