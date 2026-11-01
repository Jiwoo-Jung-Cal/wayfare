// App shell: navigation, route boundaries, shared loading/error handling.
// Hash routing keeps deep links working on static hosts and embedded previews
// (e.g. a Figma Code Layer) without server rewrites.

import { Component, useEffect, type ReactNode } from 'react';
import { createHashRouter, Navigate, NavLink, Outlet, RouterProvider, useParams } from 'react-router';
import { appError, DEMO_TRIP_ID, forgetGuestSession, formatInstant, type AppError } from '../core/index.ts';
import { Button, CapabilityLabel, EmptyState, ErrorState, LoadingState, StatusBadge } from '../ui/index.tsx';
import { AppServicesProvider, CONNECTED_API_URL, useAppServices } from './AppServices.tsx';
import { DemoControls } from './DemoControls.tsx';
import { ClaimSyncNotice } from './ClaimSyncNotice.tsx';
import { TripDashboard, TripList } from './Dashboard.tsx';
import { FEATURES, ROUTE_TABLE } from './featureRegistry.ts';

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

const MOBILE_LABEL: Record<string, string> = { plan: 'Plan', import: 'Import', reroute: 'ReRoute', wallet: 'Wallet' };

function Layout() {
  const { load, repo, extraction, refresh, clock } = useAppServices();
  const tripId = load.status === 'ready' ? (load.snapshot.trips[0]?.id ?? null) : null;
  const now = clock.now();
  return (
    <div className="wf-shell">
      <a href="#wf-content" className="wf-visually-hidden">
        Skip to content
      </a>
      <header className="wf-header">
        <div className="wf-header-inner">
          <NavLink to="/" className="wf-brand">
            WayFare
          </NavLink>
          <nav className="wf-nav" aria-label="Main">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            {tripId &&
              ROUTE_TABLE.map((r) => (
                <NavLink key={r.path} to={`/trips/${tripId}/${r.path}`}>
                  {r.title}
                </NavLink>
              ))}
          </nav>
          <span className="wf-capabilities" title={`${repo.capabilities.description} ${extraction.description}`}>
            <CapabilityLabel status={repo.capabilities.mode === 'sample' ? 'sample' : 'live'}>
              {repo.capabilities.mode === 'sample' ? 'saved in this browser' : 'server workspace'}
            </CapabilityLabel>
            <span className="wf-hide-narrow">
              <CapabilityLabel status={extraction.capability === 'live' ? 'live' : 'simulated'}>AI extraction</CapabilityLabel>
            </span>
            <span className="wf-hide-narrow">
              <CapabilityLabel status="simulated">provider actions</CapabilityLabel>
            </span>
          </span>
        </div>
      </header>
      <div className="wf-clockbar">
        <div className="wf-clockbar-inner">
          <StatusBadge tone="simulated">{clock.mode === 'sample' ? 'Demo clock' : 'Real-time clock'}</StatusBadge>
          <span className="wf-clockbar-time" aria-label="Current app time">
            {formatInstant(now, 'America/New_York')} · {now}
          </span>
          <span>{repo.capabilities.mode === 'sample' ? 'Sample mode · fictional providers · actions are simulated' : 'Connected mode · fictional providers · actions are simulated'}</span>
        </div>
      </div>
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
      </main>
      <nav className="wf-tabbar" aria-label="Sections">
        <NavLink to="/" end>
          Trip
        </NavLink>
        {tripId &&
          ROUTE_TABLE.map((r) => (
            <NavLink key={r.path} to={`/trips/${tripId}/${r.path}`}>
              {MOBILE_LABEL[r.path]}
            </NavLink>
          ))}
      </nav>
      <DemoControls />
    </div>
  );
}

function Home() {
  const { load } = useAppServices();
  if (load.status !== 'ready') return null;
  const trip = load.snapshot.trips.find((t) => t.id === DEMO_TRIP_ID) ?? load.snapshot.trips[0];
  return (
    <div className="wf-stack">
      {trip ? <TripDashboard tripId={trip.id} /> : null}
      <TripList snapshot={load.snapshot} />
    </div>
  );
}

function TripHome() {
  const { tripId = '' } = useParams();
  return <TripDashboard tripId={tripId} />;
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
      ...ROUTE_TABLE.map((r) => ({ path: `trips/:tripId/${r.path}`, element: <FeatureRoute path={r.path} /> })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <AppServicesProvider>
      <RouterProvider router={router} />
    </AppServicesProvider>
  );
}
