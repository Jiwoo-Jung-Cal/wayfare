// Builds a fresh workspace snapshot for a demo seed stage. Used by resetDemo
// in every repository implementation so sample and connected modes seed
// identical records.

import type { DemoSeedStage } from '../repository.ts';
import { SCHEMA_VERSION, type Workspace, type WorkspaceSnapshot } from '../schema.ts';
import { DEMO_CLOCK_START } from '../time.ts';
import {
  DEMO_IDS,
  demoAssets,
  demoBookingImports,
  demoDocument,
  demoPlans,
  demoReplacementQuote,
  demoTrip,
  type DemoContext,
} from './demoNyc.ts';

export function emptySnapshot(workspace: Workspace): WorkspaceSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    workspace,
    clock: { mode: 'sample', current: DEMO_CLOCK_START },
    trips: [],
    plans: [],
    quotes: [],
    documents: [],
    bookings: [],
    policies: [],
    disruptions: [],
    recoveryOptions: [],
    actions: [],
    claims: [],
    receipts: [],
    assets: [],
    idempotencyKeys: [],
  };
}

export async function buildDemoSnapshot(workspace: Workspace, stage: DemoSeedStage): Promise<WorkspaceSnapshot> {
  const snap = emptySnapshot(workspace);
  if (stage === 'empty') return snap;

  const ctx: DemoContext = { workspaceId: workspace.id, now: DEMO_CLOCK_START };
  const D = DEMO_IDS.documents;
  snap.trips.push(demoTrip(ctx));
  snap.plans.push(...demoPlans(ctx));
  snap.quotes.push(demoReplacementQuote(ctx));
  snap.assets.push(...demoAssets(ctx));
  snap.documents.push(...(await Promise.all([D.replacementQuote, D.voucher, D.points].map((id) => demoDocument(ctx, id)))));
  if (stage === 'planning') return snap;

  for (const imp of demoBookingImports(ctx)) {
    snap.documents.push(await demoDocument(ctx, imp.documentId));
    snap.bookings.push(imp.booking);
    snap.policies.push(imp.policy);
  }
  const trip = snap.trips[0]!;
  trip.selectedPlanId = DEMO_IDS.plans.nonstop;
  for (const plan of snap.plans) plan.status = plan.id === DEMO_IDS.plans.nonstop ? 'selected' : 'proposed';
  return snap;
}
