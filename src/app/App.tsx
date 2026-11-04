// App shell: navigation, route boundaries, shared loading/error handling.
// Hash routing keeps deep links working on static hosts and embedded previews
// (e.g. a Figma Code Layer) without server rewrites.

import { Component, useEffect, type ReactNode } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation, useParams } from 'react-router';
import { appError, DEMO_TRIP_ID, forgetGuestSession, formatInstant, type AppError } from '../core/index.ts';
import { Button, EmptyState, ErrorState, LoadingState } from '../ui/index.tsx';
import { AppServicesProvider, CONNECTED_API_URL, useAppServices } from './AppServices.tsx';
import { DemoControls } from './DemoControls.tsx';
import { BottomTabs, TopBar, type ShellAlert } from './TopBar.tsx';
import { AccountProvider } from './account.tsx';
import { AskWayFare } from './AskWayFare.tsx';
import { SampleTrip } from './SampleTrip.tsx';
import { ToastProvider } from './toasts.tsx';
import { tripFacts, wholeMoney } from './tripFacts.ts';
import { ClaimSyncNotice } from './ClaimSyncNotice.tsx';
import { TripDashboard, TripList } from './Dashboard.tsx';
import { FEATURES, ROUTE_TABLE } from './featureRegistry.ts';
import { Itinerary } from './Itinerary.tsx';
import { BoardingPass } from './Overview.tsx';

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: AppError | null }> {
  state = { error: null as AppError | null };
  static getDerivedStateFromError(e: Error) {
    return { error: appError('internal', e.message || 'Unexpected UI error', { retryable: true }) };
  }
  render() {
    if (this.state.error) {
      return <ErrorState error={this.state.error} title="This screen failed to render" onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

const fmtWhen = (at: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(at));
const NOUN: Record<string, string> = { flight: 'flight', hotel: 'hotel', activity: 'activity', transfer: 'ride', other: 'booking' };

function Layout() {
  const { load, repo, extraction, refresh, clock } = useAppServices();
  const { pathname } = useLocation();
  const trips = load.status === 'ready' ? load.snapshot.trips : [];
  const tripId = trips[0]?.id ?? null;
  const sampleKey = /^\/samples\/(\w+)/.exec(pathname)?.[1] ?? null;
  const now = clock.now();
  const facts = load.status === 'ready' && tripId ? tripFacts(load.snapshot, tripId, now) : null;
  const trip = trips[0];
  const alerts: ShellAlert[] = [];
  if (facts?.disrupted) {
    const d = facts.disrupted;
    const flightNo = /^[A-Z0-9]{2}\s?\d+/.exec(d.title)?.[0];
    if (facts.approved && facts.cancelTrip)
      alerts.push({ tone: 'gain', title: 'Refunds started', detail: `${wholeMoney(facts.cancelTrip.expectedCashRecovery)} expected back.`, to: `/trips/${tripId}/wallet` });
    alerts.push({
      tone: 'loss',
      title: d.kind === 'flight' && flightNo ? `Flight ${flightNo} cancelled` : `${d.title} cancelled`,
      detail: `${d.provider} cancelled your ${new Intl.DateTimeFormat('en-US', { timeZone: d.localTimezone, weekday: 'long' }).format(new Date(d.startsAt))} ${NOUN[d.kind]}.`,
      to: `/trips/${tripId}/reroute`,
    });
    const nx = facts.nextDeadline;
    if (nx && !facts.approved)
      alerts.push({
        tone: 'amber',
        title: `Decide by ${fmtWhen(nx.d.at, nx.d.displayTimezone)}`,
        detail: `After that, the ${NOUN[nx.booking.kind]} refunds ${wholeMoney(nx.after)} instead of ${wholeMoney(nx.before)}.`,
        to: `/trips/${tripId}/reroute`,
      });
  }
  const status = !facts?.disrupted ? (facts?.bookings.length ? 'Booked' : 'Planning') : facts.approved ? 'Refunds in progress' : 'Needs attention';
  const deadlineCount = load.status === 'ready' ? load.snapshot.policies.filter((p) => p.tripId === tripId).reduce((n, p) => n + p.deadlines.length, 0) : 0;
  const sample = repo.capabilities.mode === 'sample';
  return (
    <AccountProvider tripTitle={trip?.title ?? 'your trip'} bookingCount={facts?.bookings.length ?? 0} deadlineCount={deadlineCount}>
      <div className="wf-shell" data-sample-trip={sampleKey ? 'true' : undefined}>
        <a href="#wf-content" className="wf-visually-hidden">
          Skip to content
        </a>
        <TopBar trips={trips} tripId={tripId} alerts={alerts} status={status} sampleKey={sampleKey} />
        <main id="wf-content" className="wf-main">
          {load.status === 'loading' && <LoadingState label="Loading your workspace…" />}
          {load.status === 'error' && (
            <div className="wf-stack">
              <ErrorState error={load.error} title="Could not load your workspace" onRetry={() => void refresh()} />
              {load.error.code === 'unauthorized' && CONNECTED_API_URL && (
                <div>
                  <Button
                    onClick={() => {
                      forgetGuestSession(CONNECTED_API_URL!, window.localStorage);
                      window.location.reload();
                    }}
                  >
                    Start a new guest session
                  </Button>
                </div>
              )}
            </div>
          )}
          {load.status === 'ready' && (
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          )}
          <footer className="wf-footer" title={`${repo.capabilities.description} ${extraction.description}`}>
            <p>
              WayFare demo · {sample ? 'sample trip with fictional providers, saved in this browser' : 'server workspace with fictional providers'} · every provider action
              is simulated · AI extraction is {extraction.capability === 'live' ? 'live' : 'simulated'} ·{' '}
              <span aria-label="Current app time">
                {clock.mode === 'sample' ? 'demo clock' : 'real-time clock'} {formatInstant(now, 'America/New_York')}
              </span>
            </p>
            <DemoControls />
          </footer>
        </main>
        <BottomTabs tripId={tripId} />
        <AskWayFare tripId={tripId} />
      </div>
    </AccountProvider>
  );
}

function Home() {
  const { load } = useAppServices();
  if (load.status !== 'ready') return null;
  const trip = load.snapshot.trips.find((t) => t.id === DEMO_TRIP_ID) ?? load.snapshot.trips[0];
  // The design has no separate home: the trip's Overview is the start page.
  if (trip) return <Navigate to={`/trips/${trip.id}`} replace />;
  return (
    <div className="wf-stack-lg">
      <BoardingPass />
      <TripList snapshot={load.snapshot} />
    </div>
  );
}

function TripHome() {
  const { tripId = '' } = useParams();
  return <TripDashboard tripId={tripId} />;
}

function ItineraryRoute() {
  const { tripId = '' } = useParams();
  return <Itinerary tripId={tripId} />;
}

function FeatureRoute({ path }: { path: (typeof ROUTE_TABLE)[number]['path'] }) {
  const { tripId = '' } = useParams();
  const { load, featureContext, runClaimSync } = useAppServices();
  const entry = ROUTE_TABLE.find((r) => r.path === path)!;
  const feature = FEATURES[entry.key];
  const tripExists = load.status === 'ready' && load.snapshot.trips.some((t) => t.id === tripId);
  // Wallet load re-runs TripWallet's idempotent claim sync, so an interrupted handoff recovers (also after reload).
  useEffect(() => {
    if (path === 'wallet' && tripExists) void runClaimSync(tripId, 'wallet_load');
  }, [path, tripId, tripExists, runClaimSync]);
  if (load.status === 'ready' && !tripExists) {
    return <EmptyState title="Trip not found">This trip does not exist in your workspace.</EmptyState>;
  }
  if (!feature) {
    return (
      <EmptyState title={`${entry.title} is not connected yet`}>
        <span>
          Owner: {entry.owner}. The shell registers it automatically once <span className="wf-mono">src/features/{entry.key}/index.ts</span> exports{' '}
          <span className="wf-mono">feature</span>.
        </span>
      </EmptyState>
    );
  }
  const Page = feature.Page;
  return (
    <div className="wf-stack">
      {(path === 'wallet' || path === 'reroute') && <ClaimSyncNotice tripId={tripId} />}
      <Page tripId={tripId} ctx={featureContext} />
    </div>
  );
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'trips/:tripId', element: <TripHome /> },
      { path: 'trips/:tripId/itinerary', element: <ItineraryRoute /> },
      { path: 'samples/:key', element: <SampleTrip /> },
      ...ROUTE_TABLE.map((r) => ({ path: `trips/:tripId/${r.path}`, element: <FeatureRoute path={r.path} /> })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <ToastProvider>
      <AppServicesProvider>
        <RouterProvider router={router} />
      </AppServicesProvider>
    </ToastProvider>
  );
}
