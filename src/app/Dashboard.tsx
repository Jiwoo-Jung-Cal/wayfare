// Trip dashboard. Presents stored results from the owning modules; it does not
// recalculate plan totals, recovery options or outstanding balances.

import { Link } from 'react-router';
import { deadlineStatus, type Id, type WorkspaceSnapshot } from '../core/index.ts';
import { Card, EmptyState, InstantText, MoneyText, Notice, StatusBadge, type Tone } from '../ui/index.tsx';
import { useAppServices } from './AppServices.tsx';
import { FEATURES, ROUTE_TABLE } from './featureRegistry.ts';

const BOOKING_TONE: Record<string, Tone> = { confirmed: 'positive', disrupted: 'danger', cancelled: 'neutral', replaced: 'neutral', changed: 'info' };
const label = (s: string) => s.replace(/_/g, ' ');

export function TripList({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  if (snapshot.trips.length === 0) {
    return <EmptyState title="No trips yet">Use “Load sample trip” in the demo controls to start the fictional San Francisco to New York scenario.</EmptyState>;
  }
  return (
    <Card title="Trips">
      <ul className="wf-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {snapshot.trips.map((t) => (
          <li key={t.id}>
            <Link to={`/trips/${t.id}`}>{t.title}</Link>{' '}
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
  const { load, clock, claimSync, runClaimSync, featureContext } = useAppServices();
  if (load.status !== 'ready') return null;
  const s = load.snapshot;
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return <EmptyState title="Trip not found">This trip does not exist in your workspace.</EmptyState>;

  const plan = s.plans.find((p) => p.id === trip.selectedPlanId);
  const bookings = s.bookings.filter((b) => b.tripId === tripId);
  const policies = s.policies.filter((p) => p.tripId === tripId);
  const now = clock.now();
  const deadlines = policies
    .flatMap((p) => p.deadlines.map((d) => ({ ...d, booking: bookings.find((b) => b.id === p.bookingId) })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const disruptions = s.disruptions.filter((d) => d.tripId === tripId);
  const actions = s.actions.filter((a) => a.tripId === tripId);
  const claims = s.claims.filter((c) => c.tripId === tripId);
  const unknownPolicies = policies.filter((p) => p.refundability === 'unknown' || p.reviewState !== 'reviewed');

  return (
    <div className="wf-stack">
      <div>
        <h1>{trip.title}</h1>
        <p className="wf-muted">
          {trip.origin.name} to {trip.destination.name} · {trip.startDate} to {trip.endDate} · times shown in {trip.displayTimezone}
        </p>
      </div>

      {disruptions.some((d) => d.status === 'active') && (
        <Notice tone="danger">
          <strong>Disruption: </strong>
          {disruptions.find((d) => d.status === 'active')!.description} <Link to={`/trips/${tripId}/reroute`}>Open ReRoute</Link>
        </Notice>
      )}
      {claimSync.status === 'pending_retry' && claimSync.tripId === tripId && (
        <Notice tone="warning">
          Recovery actions are saved, but claim sync to TripWallet failed: {claimSync.error.message}{' '}
          <button className="wf-button" onClick={() => void runClaimSync(tripId)}>Retry claim sync</button>
        </Notice>
      )}
      {claimSync.status === 'not_registered' && claimSync.tripId === tripId && (
        <Notice tone="warning">Recovery actions are saved. Claim sync is pending: the TripWallet module is not registered yet.</Notice>
      )}

      <div className="wf-grid">
        <Card title="Selected plan">
          {plan ? (
            <>
              <strong>{plan.label}</strong>
              <span>
                Plan total (from Wayfinder): <MoneyText value={plan.total} />
              </span>
            </>
          ) : (
            <span className="wf-muted">No plan selected yet.</span>
          )}
          <Link to={`/trips/${tripId}/plan`}>Compare plans</Link>
        </Card>

        <Card title="Upcoming deadlines">
          {deadlines.length === 0 ? (
            <span className="wf-muted">No deadlines from reviewed policies yet.</span>
          ) : (
            <ul className="wf-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {deadlines.map((d) => {
                const status = deadlineStatus(now, d.at);
                return (
                  <li key={d.id}>
                    <div className="wf-row">
                      <StatusBadge tone={status === 'before_deadline' ? 'warning' : 'neutral'}>{status === 'before_deadline' ? 'Open' : 'Passed'}</StatusBadge>
                      <strong>{d.label}</strong>
                    </div>
                    <span className="wf-muted">
                      <InstantText value={d.at} timeZone={d.displayTimezone} /> · source: “{d.sourceWording}”
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recovery and refunds">
          <span>
            {actions.length} recorded recovery action{actions.length === 1 ? '' : 's'} · {claims.length} refund claim{claims.length === 1 ? '' : 's'}
          </span>
          {claims.map((c) => (
            <div key={c.id} className="wf-row">
              <StatusBadge tone={c.status === 'received' ? 'positive' : 'warning'}>{label(c.status)}</StatusBadge>
              <span>
                {bookings.find((b) => b.id === c.bookingId)?.title ?? c.bookingId}: outstanding <MoneyText value={c.outstanding} />
              </span>
            </div>
          ))}
          <Link to={`/trips/${tripId}/wallet`}>Open TripWallet</Link>
        </Card>
      </div>

      <Card title="Bookings" actions={<Link to={`/trips/${tripId}/import`}>Import a booking</Link>}>
        {unknownPolicies.length > 0 && <Notice tone="warning">{unknownPolicies.length} booking policy record(s) need review or have unknown terms.</Notice>}
        {bookings.length === 0 ? (
          <span className="wf-muted">No confirmed bookings yet. A selected plan is not a booking; import confirmations to establish booked state.</span>
        ) : (
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead>
                <tr>
                  <th scope="col">Booking</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="wf-num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.title}
                      <div className="wf-muted">{b.provider}</div>
                    </td>
                    <td className="wf-mono">{b.reference}</td>
                    <td>
                      <InstantText value={b.startsAt} timeZone={b.localTimezone} />
                    </td>
                    <td>
                      <StatusBadge tone={BOOKING_TONE[b.state]}>{label(b.state)}</StatusBadge>
                    </td>
                    <td className="wf-num">
                      <MoneyText value={b.paid} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {ROUTE_TABLE.map(({ key }) => {
        const Panel = FEATURES[key]?.DashboardPanel;
        return Panel ? <Panel key={key} tripId={tripId} ctx={featureContext} /> : null;
      })}
    </div>
  );
}
