// ReRoute -> TripWallet claim-sync orchestration (shell-owned, framework-free).
//
// TripWallet owns syncClaimsFromActions (idempotent). The shell only decides
// WHEN to call it: after a recorded action, on wallet load, and on manual
// retry. Requests that arrive while a sync is running are coalesced into one
// follow-up run, so a recorded action is never skipped. A failure leaves the
// recorded actions untouched and reports a retryable pending state; claims are
// recovered by the next wallet load or retry (including after a reload).

import { appError, type AppError, type ClaimSyncResult, type FeatureContext, type FeatureModule, type Id } from '../core/index.ts';

export type ClaimSyncReason = 'action_recorded' | 'wallet_load' | 'retry';

export type ClaimSyncState =
  | { status: 'idle' }
  | { status: 'syncing'; tripId: Id; reason: ClaimSyncReason }
  | { status: 'synced'; tripId: Id; result: ClaimSyncResult; at: string }
  | { status: 'pending_retry'; tripId: Id; error: AppError }
  | { status: 'not_registered'; tripId: Id };

export type ClaimSyncDeps = {
  provider: () => FeatureModule['syncClaimsFromActions'] | undefined;
  context: () => FeatureContext | null;
  onState: (state: ClaimSyncState) => void;
  /** Called after every run (success or failure), e.g. to refresh shared data. */
  onSettled?: () => Promise<void>;
  now?: () => Date;
};

export type ClaimSyncOrchestrator = {
  run(tripId: Id, reason: ClaimSyncReason): Promise<ClaimSyncState>;
  readonly state: ClaimSyncState;
};

export function createClaimSyncOrchestrator(deps: ClaimSyncDeps): ClaimSyncOrchestrator {
  let state: ClaimSyncState = { status: 'idle' };
  let running: Promise<ClaimSyncState> | null = null;
  let followUp: { tripId: Id; reason: ClaimSyncReason } | null = null;
  const now = deps.now ?? (() => new Date());

  const set = (s: ClaimSyncState) => {
    state = s;
    deps.onState(s);
    return s;
  };

  async function once(tripId: Id, reason: ClaimSyncReason): Promise<ClaimSyncState> {
    const sync = deps.provider();
    if (!sync) return set({ status: 'not_registered', tripId });
    const ctx = deps.context();
    if (!ctx) return set({ status: 'pending_retry', tripId, error: appError('unavailable', 'App services are not ready yet') });
    set({ status: 'syncing', tripId, reason });
    let next: ClaimSyncState;
    try {
      const r = await sync({ tripId }, ctx);
      next = r.ok
        ? { status: 'synced', tripId, result: r.value, at: now().toISOString() }
        : { status: 'pending_retry', tripId, error: { ...r.error, retryable: true } };
    } catch (e) {
      next = { status: 'pending_retry', tripId, error: appError('internal', (e as Error).message || 'Claim sync failed', { retryable: true }) };
    }
    set(next);
    await deps.onSettled?.();
    return next;
  }

  async function drain(tripId: Id, reason: ClaimSyncReason): Promise<ClaimSyncState> {
    let result = await once(tripId, reason);
    while (followUp) {
      const f = followUp;
      followUp = null;
      result = await once(f.tripId, f.reason);
    }
    return result;
  }

  return {
    get state() {
      return state;
    },
    run(tripId, reason) {
      if (running) {
        followUp = { tripId, reason };
        return running;
      }
      running = drain(tripId, reason).finally(() => {
        running = null;
      });
      return running;
    },
  };
}
