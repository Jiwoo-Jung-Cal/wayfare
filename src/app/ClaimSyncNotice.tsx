// Shows the ReRoute -> TripWallet handoff state in words. Action success and
// claim-sync success are reported separately: a recorded action stays recorded
// even when claim sync is pending.

import type { Id } from '../core/index.ts';
import { Button, Notice } from '../ui/index.tsx';
import { useAppServices } from './AppServices.tsx';

export function ClaimSyncNotice({ tripId }: { tripId: Id }) {
  const { claimSync, runClaimSync } = useAppServices();
  if (claimSync.status === 'idle' || claimSync.tripId !== tripId) return null;
  switch (claimSync.status) {
    case 'syncing':
      return (
        <div role="status" aria-live="polite" className="wf-muted">
          Syncing refund claims from recorded actions…
        </div>
      );
    case 'pending_retry':
      return (
        <Notice tone="warning">
          <div className="wf-stack">
            <span>
              <strong>Claim sync pending.</strong> Recovery actions are saved, but refund claims were not updated: {claimSync.error.message}
            </span>
            <div>
              <Button onClick={() => void runClaimSync(tripId, 'retry')}>Retry claim sync</Button>
            </div>
          </div>
        </Notice>
      );
    case 'not_registered':
      return <Notice tone="warning">Claim sync is pending: the TripWallet module is not connected yet. Any recorded recovery actions are kept.</Notice>;
    case 'synced':
      return (
        <div role="status" aria-live="polite" className="wf-muted">
          Refund claims up to date ({claimSync.result.created} created, {claimSync.result.existing} already tracked).
        </div>
      );
  }
}
