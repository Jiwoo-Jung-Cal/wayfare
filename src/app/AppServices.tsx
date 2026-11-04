// Application services: one repository, one active clock, one extraction
// service, shared snapshot refresh and the ReRoute -> TripWallet claim-sync
// orchestration.
//
// Mode selection:
//   VITE_WAYFARE_API_URL set  -> connected mode (server workspace + guest session).
//   otherwise                 -> sample mode (browser storage, simulated extraction).
// A connected-mode startup failure is shown as an error. Switching to sample
// mode is an explicit user choice, never automatic.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  appError,
  createClock,
  createHttpExtractionService,
  createHttpWalletEvidenceService,
  createHttpRepository,
  createLocalRepository,
  createSampleExtractionService,
  createUnavailableWalletEvidenceService,
  fetchHealth,
  getOrCreateGuestSession,
  getOrCreateLocalWorkspaceId,
  type AppError,
  type Clock,
  type ExtractionService,
  type WalletEvidenceService,
  type FeatureContext,
  type Id,
  type Instant,
  type Result,
  type WorkspaceRepository,
  type WorkspaceSnapshot,
} from '../core/index.ts';
import { Button, ErrorState, LoadingState } from '../ui/index.tsx';
import { FEATURES } from './featureRegistry.ts';
import { createClaimSyncOrchestrator, type ClaimSyncReason, type ClaimSyncState } from './claimSync.ts';

export type { ClaimSyncState } from './claimSync.ts';

export type LoadState = { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'ready'; snapshot: WorkspaceSnapshot };

type AppServices = {
  repo: WorkspaceRepository;
  extraction: ExtractionService;
  load: LoadState;
  clock: Clock;
  refresh(): Promise<void>;
  claimSync: ClaimSyncState;
  runClaimSync(tripId: Id, reason: ClaimSyncReason): Promise<void>;
  featureContext: FeatureContext;
};

const Ctx = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppServices outside AppServicesProvider');
  return v;
}

const MODE_OVERRIDE_KEY = 'wayfare:v1:mode-override';
const API_URL = (import.meta.env.VITE_WAYFARE_API_URL as string | undefined)?.replace(/\/+$/, '') || null;

type Backend = {
  repo: WorkspaceRepository;
  extraction: (now: () => Instant) => ExtractionService;
  walletEvidence?: WalletEvidenceService;
  /** Sample mode only: a brand-new browser workspace opens like the design reference (booked + simulated cancellation). */
  firstVisit?: boolean;
  /** No workspace existed in this browser before this page load (it was just created, already booked). */
  brandNew?: boolean;
};
type BootState = { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'ready'; backend: Backend };

/** Test/QA override for a new workspace's seed: "planning" starts before any booking (the old default). */
const FIRST_STAGE_KEY = 'wayfare:v1:first-stage';
const REFERENCE_SEEDED_KEY = 'wayfare:v1:reference-seeded';

/** The design reference's starting point: booked sample trip plus the simulated airline cancellation. */
export async function openReferenceScenario(repo: WorkspaceRepository, ctx: FeatureContext): Promise<Result<string>> {
  const reset = await repo.resetDemo('booked');
  if (!reset.ok) return reset;
  const trip = reset.value.trips[0];
  const trigger = FEATURES.reroute?.triggerDemoDisruption;
  if (!trip || !trigger) return { ok: true, value: 'Booked sample loaded.' };
  const r = await trigger({ tripId: trip.id }, ctx);
  return r.ok ? { ok: true, value: 'Reference scenario loaded: NY Trip booked, flight BL 214 cancelled by the airline (simulated).' } : r;
}

// Created once per page: React StrictMode runs effects twice in development, and a second
// call would already see the new workspace id and lose the first-visit flag.
let sampleBackendOnce: Backend | null = null;
function sampleBackend(): Backend {
  sampleBackendOnce ??= createSampleBackend();
  return sampleBackendOnce;
}

function createSampleBackend(): Backend {
  const storage = window.localStorage;
  // Opens like the design reference once per browser: a brand-new workspace, or one left
  // untouched (no bookings, no actions) from before the reference scenario became the default.
  const firstVisit = storage.getItem(FIRST_STAGE_KEY) !== 'planning' && storage.getItem(REFERENCE_SEEDED_KEY) !== '1';
  const brandNew = !storage.getItem('wayfare:v1:active-workspace');
  const initialStage = storage.getItem(FIRST_STAGE_KEY) === 'planning' ? 'planning' : 'booked';
  return {
    firstVisit,
    brandNew,
    repo: createLocalRepository({ storage, workspaceId: getOrCreateLocalWorkspaceId(storage), initialStage }),
    extraction: (now) => createSampleExtractionService(now),
    walletEvidence: createUnavailableWalletEvidenceService(),
  };
}

async function connectedBackend(baseUrl: string): Promise<{ ok: true; backend: Backend } | { ok: false; error: AppError }> {
  const health = await fetchHealth(baseUrl);
  if (!health.ok) return health;
  const session = await getOrCreateGuestSession(baseUrl, window.localStorage);
  if (!session.ok) return session;
  const opts = { baseUrl, token: session.value.token };
  return {
    ok: true,
    backend: {
      repo: createHttpRepository(opts),
      extraction: () => createHttpExtractionService({ ...opts, aiConfigured: health.value.ai.configured }),
      walletEvidence: createHttpWalletEvidenceService({ ...opts, handlerRegistered: health.value.walletEvidence?.handlerRegistered ?? false }),
    },
  };
}

export function AppServicesProvider({ children, backend: injected }: { children: ReactNode; backend?: Backend }) {
  const [boot, setBoot] = useState<BootState>(injected ? { status: 'ready', backend: injected } : { status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const sampleOverride = typeof window !== 'undefined' && window.localStorage.getItem(MODE_OVERRIDE_KEY) === 'sample';

  useEffect(() => {
    if (injected) return;
    if (!API_URL || sampleOverride) {
      setBoot({ status: 'ready', backend: sampleBackend() });
      return;
    }
    let cancelled = false;
    setBoot({ status: 'loading' });
    void connectedBackend(API_URL).then((r) => {
      if (!cancelled) setBoot(r.ok ? { status: 'ready', backend: r.backend } : { status: 'error', error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [injected, sampleOverride, attempt]);

  if (boot.status === 'loading') return <LoadingState label="Connecting to WayFare…" />;
  if (boot.status === 'error') {
    return (
      <div className="wf-main wf-stack">
        <ErrorState error={boot.error} title="Could not connect to the WayFare server" onRetry={() => setAttempt((n) => n + 1)} />
        <div>
          <Button
            onClick={() => {
              window.localStorage.setItem(MODE_OVERRIDE_KEY, 'sample');
              window.location.reload();
            }}
          >
            Use offline sample mode instead
          </Button>
        </div>
      </div>
    );
  }
  return <ServicesInner backend={boot.backend}>{children}</ServicesInner>;
}

function ServicesInner({ children, backend }: { children: ReactNode; backend: Backend }) {
  const repo = backend.repo;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [claimSync, setClaimSync] = useState<ClaimSyncState>({ status: 'idle' });

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
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const extraction = useMemo(() => backend.extraction(() => clockRef.current.now()), [backend]);
  const walletEvidence = useMemo(() => backend.walletEvidence ?? createUnavailableWalletEvidenceService(), [backend]);

  // Late-bound so the orchestrator always sees the current feature context.
  const ctxRef = useRef<FeatureContext | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const orchestrator = useMemo(
    () =>
      createClaimSyncOrchestrator({
        provider: () => FEATURES.tripwallet?.syncClaimsFromActions,
        context: () => ctxRef.current,
        onState: setClaimSync,
        onSettled: () => refreshRef.current(),
      }),
    [],
  );

  const runClaimSync = useCallback(
    async (tripId: Id, reason: ClaimSyncReason) => {
      await orchestrator.run(tripId, reason);
    },
    [orchestrator],
  );

  const featureContext = useMemo<FeatureContext>(
    () => ({
      repo,
      clock,
      extraction,
      walletEvidence,
      refresh,
      // Action success is already durable when this is called; claim-sync status is tracked separately.
      notifyActionRecorded: async ({ tripId }) => {
        await refresh();
        await runClaimSync(tripId, 'action_recorded');
      },
    }),
    [repo, clock, extraction, walletEvidence, refresh, runClaimSync],
  );
  ctxRef.current = featureContext;

  // Once per browser, an empty or untouched workspace opens on the reference scenario
  // (booked + the simulated cancellation, recorded through ReRoute's own demo trigger).
  // A workspace with any booking or recorded action is left exactly as it is.
  const seeded = useRef(false);
  useEffect(() => {
    if (!backend.firstVisit || seeded.current || load.status !== 'ready') return;
    seeded.current = true;
    try {
      window.localStorage.setItem(REFERENCE_SEEDED_KEY, '1');
    } catch {
      /* storage blocked: seeding may repeat next visit, which is harmless for an untouched workspace */
    }
    const s = load.snapshot;
    if (s.actions.length || s.disruptions.length) return;
    const trip = s.trips[0];
    if (backend.brandNew && trip && FEATURES.reroute?.triggerDemoDisruption) {
      // New workspace: already seeded booked; add the simulated cancellation.
      void FEATURES.reroute.triggerDemoDisruption({ tripId: trip.id }, featureContext).then(() => refresh());
    } else if (!backend.brandNew && !s.bookings.length) {
      // Untouched workspace from an earlier visit: open the reference scenario.
      void openReferenceScenario(repo, featureContext).then(() => refresh());
    }
  }, [backend.firstVisit, backend.brandNew, load, repo, featureContext, refresh]);

  const value = useMemo(
    () => ({ repo, extraction, load, clock, refresh, claimSync, runClaimSync, featureContext }),
    [repo, extraction, load, clock, refresh, claimSync, runClaimSync, featureContext],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Leave the explicit sample-mode override (used by the header when a server is configured). */
export function clearModeOverride(): void {
  window.localStorage.removeItem(MODE_OVERRIDE_KEY);
}
export const CONNECTED_API_URL = API_URL;
