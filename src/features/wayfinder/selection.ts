import { PlanOptionSchema, compareInstants, err, isUnknown, ok, type PlanOption, type WorkspaceRepository } from '../../core/index.ts';
import { costBreakdown } from './handler.ts';

function samePlan(a: PlanOption, b: PlanOption) {
  const content = (p: PlanOption) => [p.lineItems.map((i) => [i.id, i.kind, i.description, i.price, i.quoteId, i.expiresAt, i.provenance.kind, i.provenance.source]), p.total, p.label, p.assumptions];
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

export async function selectPlanningOption(repo: WorkspaceRepository, plan: PlanOption, now: string) {
  if (!PlanOptionSchema.safeParse(plan).success) return err('validation_failed', 'Invalid planning option');
  const costs = costBreakdown(plan);
  if (!costs.ok) return costs;
  if (isUnknown(costs.value.total)) return err('precondition_failed', 'A price is still unknown. Choose a complete option or revise your preferences.');
  if (JSON.stringify(costs.value.total) !== JSON.stringify(plan.total)) return err('validation_failed', 'Plan total does not match its line items');
  if (plan.status === 'expired' || plan.status === 'archived' || (plan.expiresAt && compareInstants(plan.expiresAt, now) <= 0)
    || plan.lineItems.some((i) => i.expiresAt && compareInstants(i.expiresAt, now) <= 0)) {
    return err('precondition_failed', 'A quoted price has expired. Generate new options.');
  }
  const [trip, plans] = await Promise.all([repo.getTrip(plan.tripId), repo.listPlans(plan.tripId)]);
  if (!trip.ok) return trip;
  if (!plans.ok) return plans;
  if (plan.workspaceId !== trip.value.workspaceId) return err('forbidden', 'Plan belongs to another workspace');
  const existing = plans.value.find((p) => p.id === plan.id);
  if (existing && !samePlan(existing, plan)) return err('conflict', 'This plan changed. Reload and regenerate before selecting.');
  if (existing && trip.value.selectedPlanId === existing.id) return ok({ trip: trip.value, plan: existing, replayed: true });
  if (!existing) {
    const saved = await repo.savePlan({ ...plan, status: 'proposed', revision: 1 }, { expectedRevision: null });
    if (!saved.ok) return saved;
  }
  const selected = await repo.selectPlan({ tripId: plan.tripId, planId: plan.id, expectedTripRevision: trip.value.revision });
  return selected.ok ? ok({ trip: selected.value, plan: existing ?? plan, replayed: false }) : selected;
}
