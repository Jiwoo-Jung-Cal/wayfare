// Feature module registration contract (v1).
//
// Each feature owner exports `feature` from src/features/<name>/index.ts(x).
// The shell discovers these files automatically; no shell edit is needed.
// Features talk to each other only through the repository and these hooks,
// never by importing another feature's private files.

import type { ComponentType } from 'react';
import type { Id } from './ids.ts';
import type { Result } from './result.ts';
import type { Clock } from './time.ts';
import type { WorkspaceRepository } from './repository.ts';
import type { ExtractionService } from './extraction.ts';

export const FEATURE_KEYS = ['wayfinder', 'intake', 'reroute', 'tripwallet'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Services every feature receives. `clock` is the single active clock. */
export type FeatureContext = {
  repo: WorkspaceRepository;
  clock: Clock;
  /** Booking extraction for the intake UI (live AI in connected mode, simulated in sample mode). */
  extraction: ExtractionService;
  /** Ask the shell to reload shared trip data after a write. */
  refresh(): Promise<void>;
  /** ReRoute calls this after a successful (non-replayed or replayed) ActionRecord write. */
  notifyActionRecorded(input: { tripId: Id; actionRecordId: Id }): Promise<void>;
};

export type FeaturePageProps = { tripId: Id; ctx: FeatureContext };

export type ClaimSyncResult = { created: number; existing: number };

export type FeatureModule = {
  key: FeatureKey;
  title: string;
  /** Route segment under /trips/:tripId/, e.g. "reroute". */
  path: 'plan' | 'import' | 'reroute' | 'wallet';
  Page: ComponentType<FeaturePageProps>;
  /** Optional dashboard card; shows the owner's own results (no recalculation in the shell). */
  DashboardPanel?: ComponentType<FeaturePageProps>;
  /** TripWallet only: idempotent claim sync, called after actions and on wallet load. */
  syncClaimsFromActions?: (input: { tripId: Id }, ctx: FeatureContext) => Promise<Result<ClaimSyncResult>>;
  /** ReRoute only: supported demo disruption trigger used by the demo controls. */
  triggerDemoDisruption?: (input: { tripId: Id }, ctx: FeatureContext) => Promise<Result<{ disruptionId: Id }>>;
};
