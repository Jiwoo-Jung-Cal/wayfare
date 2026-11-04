// Trip Overview: the r2-final hero (src/app/Overview.tsx). Bookings and deadlines live in
// the Itinerary, claims in TripWallet. Before any booking, the planning state shows the
// selected plan. Presents stored results from the owning modules; no recalculation.

import { useEffect } from 'react';
import { Link } from 'react-router';
import type { Id, WorkspaceSnapshot } from '../core/index.ts';
import { Card, EmptyState, MoneyStat, StatusBadge } from '../ui/index.tsx';
import { useAppServices } from './AppServices.tsx';
import { ClaimSyncNotice } from './ClaimSyncNotice.tsx';
import { FEATURES, ROUTE_TABLE } from './featureRegistry.ts';
import { OverviewHero } from './Overview.tsx';

/** "Fri, Nov 20 – Mon, Nov 23" from local dates (no timezone shift). */
const tripDates = (start: string, end: string) => {
  const f = (d: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  return `${f(start)} – ${f(end)}`;
};

export function TripList({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  if (snapshot.trips.length === 0) {
    return <EmptyState title="No trips yet">Use “Load sample trip” in the demo controls to start the fictional San Francisco to New York scenario.</EmptyState>;
  }
  return (
    <Card title="Trips">
      <ul className="wf-list">
        {snapshot.trips.map((t) => (
          <li key={t.id}>
            <Link to={`/trips/${t.id}`}>{t.title}</Link>
            <span className="wf-muted">
              {t.startDate} to {t.endDate}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TripDashboard({ tripId }: { tripId: Id }) {
  const { load, clock, featureContext, refresh } = useAppServices();
  // Feature pages write through ctx.repo; re-read on arrival so the Overview shows their latest stored results.
  useEffect(() => {
    void refresh();
  }, [tripId, refresh]);
  if (load.status !== 'ready') return null;
  const s = load.snapshot;
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return <EmptyState title="Trip not found">This trip does not exist in your workspace.</EmptyState>;

  const plan = s.plans.find((p) => p.id === trip.selectedPlanId);
  const bookings = s.bookings.filter((b) => b.tripId === tripId);
  const now = clock.now();

  const booked = bookings.length > 0;
  return (
    <div className="wf-stack-lg">
      <header className="wf-page-header">
        <h1>{trip.title}</h1>
        <p>
          {trip.origin.name} to {trip.destination.name} · {tripDates(trip.startDate, trip.endDate)} · 1 traveler
        </p>
      </header>

      <OverviewHero s={s} tripId={tripId} now={now} />
      <ClaimSyncNotice tripId={tripId} />

      {/* Planning state (before any confirmed booking): not drawn in the design reference, so it keeps the plain cards. */}
      {!booked && (
        <div className="wf-columns">
          <Card
            title="Confirmed bookings"
            actions={
              <Link className="wf-button" data-variant="ghost" to={`/trips/${tripId}/import`}>
                Import a booking
              </Link>
            }
          >
            <span className="wf-muted">No confirmed bookings yet. A selected plan is not a booking; import confirmations to establish booked state.</span>
          </Card>
          <Card title="Selected plan" actions={<StatusBadge tone="accent">Plan, not a booking</StatusBadge>}>
            {plan ? (
              <>
                <strong>{plan.label}</strong>
                <MoneyStat label="Listed plan total (from Wayfinder)" value={plan.total} caption="Quotes for listed components only" />
              </>
            ) : (
              <span className="wf-muted">No plan selected yet.</span>
            )}
            <div>
              <Link className="wf-button" data-variant="ghost" to={`/trips/${tripId}/plan`}>
                Compare plans
              </Link>
            </div>
          </Card>
        </div>
      )}

      {ROUTE_TABLE.map(({ key }) => {
        const Panel = FEATURES[key]?.DashboardPanel;
        return Panel ? <Panel key={key} tripId={tripId} ctx={featureContext} /> : null;
      })}
    </div>
  );
}
