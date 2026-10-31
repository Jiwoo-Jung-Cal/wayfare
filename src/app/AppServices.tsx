// Application services: one repository, one active clock, shared snapshot
// refresh and the ReRoute -> TripWallet claim-sync orchestration.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  appError,
  createClock,
  createLocalRepository,
  getOrCreateLocalWorkspaceId,
  type AppError,
  type ClaimSyncResult,
  type Clock,
  type FeatureContext,
  type Id,
  type WorkspaceRepository,
  type WorkspaceSnapshot,
} from '../core/index.ts';
import { FEATURES } from './featureRegistry.ts';

export type ClaimSyncState =
  | { status: 'idle' }
  | { status: 'syncing'; tripId: Id }
  | { status: 'synced'; tripId: Id; result: ClaimSyncResult; at: string }
  | { status: 'pending_retry'; tripId: Id; error: AppError }
  | { status: 'not_registered'; tripId: Id };

export type LoadState = { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'ready'; snapshot: WorkspaceSnapshot };

type AppServices = {
  repo: WorkspaceRepository;
  load: LoadState;
  clock: Clock;
  refresh(): Promise<void>;
  claimSync: ClaimSyncState;
  runClaimSync(tripId: Id): Promise<void>;
  featureContext: FeatureContext;
};

const Ctx = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppServices outside AppServicesProvider');
  return v;
}

function defaultRepository(): WorkspaceRepository {
  const storage = window.localStorage;
  return createLocalRepository({ storage, workspaceId: getOrCreateLocalWorkspaceId(storage) });
}

export function AppServicesProvider({ children, repo: injected }: { children: ReactNode; repo?: WorkspaceRepository }) {
  const repo = useMemo(() => injected ?? defaultRepository(), [injected]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [claimSync, setClaimSync] = useState<ClaimSyncState>({ status: 'idle' });
  const syncing = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const r = await repo.snapshot();
      setLoad(r.ok ? { status: 'ready', snapshot: r.value } : { status: 'error', error: r.error });
    } catch (e) {
      setLoad({ status: 'error', error: appError('internal', (e as Error).message) });
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clockState = load.status === 'ready' ? load.snapshot.clock : null;
  const clock = useMemo<Clock>(() => createClock(clockState ?? { mode: 'real' }), [clockState]);

  // Late-bound so featureContext and runClaimSync can reference each other.
  const ctxRef = useRef<FeatureContext | null>(null);

  const runClaimSync = useCallback(
    async (tripId: Id) => {
      const wallet = FEATURES.tripwallet;
      if (!wallet?.syncClaimsFromActions) {
        setClaimSync({ status: 'not_registered', tripId });
        return;
      }
      if (syncing.current || !ctxRef.current) return;
      syncing.current = true;
      setClaimSync({ status: 'syncing', tripId });
      try {
        const r = await wallet.syncClaimsFromActions({ tripId }, ctxRef.current);
        setClaimSync(
          r.ok
            ? { status: 'synced', tripId, result: r.value, at: new Date().toISOString() }
            : { status: 'pending_retry', tripId, error: r.error },
        );
      } catch (e) {
        setClaimSync({ status: 'pending_retry', tripId, error: appError('internal', (e as Error).message, { retryable: true }) });
      } finally {
        syncing.current = false;
        await refresh();
      }
    },
    [refresh],
  );

  const featureContext = useMemo<FeatureContext>(
    () => ({
      repo,
      clock,
      refresh,
      // Action success is already durable when this is called; claim-sync status is tracked separately.
      notifyActionRecorded: async ({ tripId }) => {
        await refresh();
        await runClaimSync(tripId);
      },
    }),
    [repo, clock, refresh, runClaimSync],
  );
  ctxRef.current = featureContext;

  const value = useMemo(
    () => ({ repo, load, clock, refresh, claimSync, runClaimSync, featureContext }),
    [repo, load, clock, refresh, claimSync, runClaimSync, featureContext],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
