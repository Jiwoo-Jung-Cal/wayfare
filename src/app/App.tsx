// App shell: navigation, route boundaries, shared loading/error handling.
// Hash routing keeps deep links working on static hosts and embedded previews
// (e.g. a Figma Code Layer) without server rewrites.

import { Component, type ReactNode } from 'react';
import { createHashRouter, Navigate, NavLink, Outlet, RouterProvider, useParams } from 'react-router';
import { appError, DEMO_TRIP_ID, type AppError } from '../core/index.ts';
import { CapabilityLabel, EmptyState, ErrorState, LoadingState } from '../ui/index.tsx';
import { AppServicesProvider, useAppServices } from './AppServices.tsx';
import { DemoControls } from './DemoControls.tsx';
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

function Layout() {
  const { load, repo, refresh } = useAppServices();
  const tripId = load.status === 'ready' ? (load.snapshot.trips[0]?.id ?? null) : null;
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
          <CapabilityLabel status={repo.capabilities.mode === 'sample' ? 'sample' : 'live'}>
            {repo.capabilities.mode === 'sample' ? 'provider actions simulated' : 'connected'}
          </CapabilityLabel>
        </div>
      </header>
      <main id="wf-content" className="wf-main">
        {load.status === 'loading' && <LoadingState label="Loading your workspace…" />}
        {load.status === 'error' && <ErrorState error={load.error} title="Could not load your workspace" onRetry={() => void refresh()} />}
        {load.status === 'ready' && (
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        )}
      </main>
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
  const { load, featureContext } = useAppServices();
  const entry = ROUTE_TABLE.find((r) => r.path === path)!;
  const feature = FEATURES[entry.key];
  if (load.status === 'ready' && !load.snapshot.trips.some((t) => t.id === tripId)) {
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
  return <Page tripId={tripId} ctx={featureContext} />;
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
