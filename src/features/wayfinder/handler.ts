// Feature-owned planning handler. Safe to call on the server; no model or browser dependencies.
import { z } from 'zod';
import {
  PlanOptionSchema, err, fromZodError,
  isUnknown, ok, parseMajorUnits, sum, sumMaybe, unknownValue,
  type DemoContext, type MaybeMoney, type Money, type PlanOption, type Result,
} from '../../core/index.ts';
import { DESTINATIONS, catalogPlans, groupQuantity, type DestinationKey } from './catalog.ts';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
}, 'Enter a valid calendar date');

// This is feature input, not a replacement for the shared Trip/PlanOption contracts.
export const PreferencesSchema = z.strictObject({
  origin: z.string().trim().min(1), destination: z.string().trim().min(1),
  startDate: date, endDate: date,
  budget: z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a positive USD amount with at most two decimal places'),
  currency: z.literal('USD'), travelers: z.number().int().min(1, 'At least one traveler').max(9, 'Up to nine travelers'),
  interest: z.enum(['skyline', 'free_time']),
  priority: z.enum(['price', 'convenience', 'flexibility']),
}).superRefine((p, ctx) => {
  if (p.endDate <= p.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must follow start date' });
  const budget = parseMajorUnits(p.budget, 'USD');
  if (!budget || budget.amountMinor <= 0) ctx.addIssue({ code: 'custom', path: ['budget'], message: 'Budget must be positive and within the supported amount range' });
});
export type Preferences = z.infer<typeof PreferencesSchema>;
/** Display-safe budget: an unparseable budget renders as unknown, never zero or a crash. */
export function budgetForDisplay(text: string): MaybeMoney {
  return parseMajorUnits(text, 'USD') ?? unknownValue('Budget could not be read as a USD amount');
}
export const SAMPLE_SCOPE = 'Sample only: from San Francisco (SFO) to New York (Nov 20–23), Chicago (Dec 11–13) or Tokyo (Mar 27–Apr 3), 1–9 travelers, USD.';

export function defaultPreferences(ctx: DemoContext, key: DestinationKey = 'nyc'): Preferences {
  void ctx;
  const d = DESTINATIONS[key];
  return { origin: 'San Francisco', destination: d.name, startDate: d.startDate, endDate: d.endDate,
    budget: d.defaultBudget, currency: 'USD', travelers: 1, interest: 'skyline', priority: 'price' };
}

export type CandidateProvider = {
  capability: 'simulated';
  candidates(ctx: DemoContext, destination?: DestinationKey): Promise<Result<PlanOption[]>>;
};
export const sampleProvider: CandidateProvider = {
  capability: 'simulated', candidates: async (ctx, destination = 'nyc') => ok(catalogPlans(destination, ctx)),
};
export type ComparedPlan = {
  plan: PlanOption; knownSubtotal: Money; budgetStatus: 'within' | 'over' | 'unknown'; explanation: string;
};
export type PlanningResult = { preferences: Preferences; options: ComparedPlan[]; capability: 'simulated' };

export function costBreakdown(plan: PlanOption): Result<{ total: PlanOption['total']; knownSubtotal: Money }> {
  // Check every currency even if another line is unknown (sumMaybe alone short-circuits).
  if (plan.lineItems.some((i) => !isUnknown(i.price) && (i.price.currency !== 'USD' || i.price.amountMinor < 0))) {
    return err('validation_failed', 'All planning prices must be nonnegative USD amounts');
  }
  try {
    return ok({ total: sumMaybe(plan.lineItems.map((i) => i.price), 'USD'),
      knownSubtotal: sum(plan.lineItems.flatMap((i) => isUnknown(i.price) ? [] : [i.price]), 'USD') });
  } catch {
    return err('validation_failed', 'Planning total exceeds the supported amount range');
  }
}

export async function generatePlans(input: unknown, ctx: DemoContext & { tripId: string }, provider: CandidateProvider = sampleProvider): Promise<Result<PlanningResult>> {
  const parsed = PreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fromZodError(parsed.error, 'Check your trip preferences') };
  const p = parsed.data;
  const origin = p.origin.trim().toLowerCase();
  const wanted = p.destination.trim().toLowerCase();
  const dest = Object.values(DESTINATIONS).find((d) => d.name.toLowerCase() === wanted || d.aliases.includes(wanted));
  if (!dest || ctx.tripId !== dest.tripId || !['san francisco', 'sfo'].includes(origin)
    || p.startDate !== dest.startDate || p.endDate !== dest.endDate) {
    return err('unsupported', `No sample candidates match these inputs. ${SAMPLE_SCOPE}`);
  }
  let candidates: Result<PlanOption[]>;
  try { candidates = await provider.candidates(ctx, dest.key); }
  catch { return err('provider_error', 'Planning provider failed; your previous results are still available'); }
  if (!candidates.ok) return candidates;
  // Only the canonical candidate set is permitted in this sample handler.
  // No adapter/model may invent an ID, price, source, or workspace.
  const allowed = catalogPlans(dest.key, ctx);
  const received = candidates.value;
  if (received.length !== allowed.length || new Set(received.map((c) => c.id)).size !== allowed.length
    || received.some((c) => !PlanOptionSchema.safeParse(c).success || !allowed.some((a) => JSON.stringify(a) === JSON.stringify(c)))) {
    return err('validation_failed', 'Planning provider returned candidates outside the supported sample set');
  }
  const budget = parseMajorUnits(p.budget, 'USD')!;
  const options: ComparedPlan[] = [];
  for (const candidate of received) {
    const plan: PlanOption = p.interest === 'free_time' ? {
      ...candidate, id: `${candidate.id}-free-time`, label: `${candidate.label} · free time`,
      summary: `${candidate.summary} Paid skyline walk omitted; that time is unscheduled.`,
      lineItems: candidate.lineItems.filter((i) => i.kind !== 'activity'),
      assumptions: [...candidate.assumptions, 'No paid activity selected; free time has no booked service.'],
    } : candidate;
    if (p.travelers > 1) Object.assign(plan, groupPriced(plan, p.travelers));
    const costs = costBreakdown(plan);
    if (!costs.ok) return costs;
    plan.total = costs.value.total;
    const budgetStatus = isUnknown(plan.total) ? 'unknown' : plan.total.amountMinor > budget.amountMinor ? 'over' : 'within';
    options.push({ plan, knownSubtotal: costs.value.knownSubtotal, budgetStatus,
      explanation: p.priority === 'price' ? 'Ordered by listed cost; an incomplete price follows complete prices.'
        : `Ordered by ${p.priority}; the listed price and budget check remain separate.` });
  }
  const rating = { low: 0, medium: 1, high: 2 };
  options.sort((a, b) => {
    if (p.priority !== 'price') {
      const difference = rating[b.plan[p.priority]] - rating[a.plan[p.priority]];
      if (difference) return difference;
    }
    const x = a.plan.total, y = b.plan.total;
    return isUnknown(x) ? isUnknown(y) ? a.plan.id.localeCompare(b.plan.id) : 1 : isUnknown(y) ? -1 : x.amountMinor - y.amountMinor;
  });
  return ok({ preferences: p, options, capability: 'simulated' });
}

/** The same plan priced for a group (catalog.groupQuantity); a distinct, stable plan ID per group size. */
function groupPriced(plan: PlanOption, travelers: number): PlanOption {
  const lineItems = plan.lineItems.map((i) => {
    const q = groupQuantity(i.kind, travelers);
    const unit = i.kind === 'hotel' ? 'room' : i.kind === 'transfer' ? 'vehicle' : 'traveler';
    return { ...i, id: `${i.id}-x${travelers}`,
      description: q > 1 ? `${i.description} · ${q} ${unit}s` : i.description,
      price: isUnknown(i.price) ? i.price : { ...i.price, amountMinor: i.price.amountMinor * q } };
  });
  return { ...plan, id: `${plan.id}-x${travelers}`, label: `${plan.label} · ${travelers} travelers`, lineItems,
    assumptions: [...plan.assumptions, `Group pricing for ${travelers} travelers: flights and tickets per person, one room per two, one car per four.`] };
}

/** Invalidating also cancels the right to commit a response; the provider need not support abort. */
export function createPlanGenerator(provider: CandidateProvider = sampleProvider) {
  let generation = 0;
  return {
    invalidate() { generation++; },
    async generate(input: unknown, ctx: DemoContext & { tripId: string }) {
      const ticket = ++generation;
      const result = await generatePlans(input, ctx, provider);
      return ticket === generation ? result : null;
    },
  };
}
