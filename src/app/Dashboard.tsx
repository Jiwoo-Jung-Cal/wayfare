// Trip dashboard — layout from design draft r1 (Figma 02 — Dashboard, frames 9:2 / 9:181 / 9:428).
// Presents stored results from the owning modules; it does not recalculate plan
// totals, recovery options or refund balances. The only arithmetic here is the
// sum of what confirmed bookings say was paid.

import { Link } from 'react-router';
import {
  deadlineStatus,
  isUnknown,
  msUntil,
  sumMaybe,
  type Id,
  type MaybeMoney,
  type PolicyEvidence,
  type WalletAsset,
  type WorkspaceSnapshot,
} from '../core/index.ts';
import { Card, EmptyState, InstantText, KeyValue, MoneyStat, MoneyText, Notice, StatusBadge, type Tone } from '../ui/index.tsx';
import { useAppServices } from './AppServices.tsx';
import { ClaimSyncNotice } from './ClaimSyncNotice.tsx';
import { FEATURES, ROUTE_TABLE } from './featureRegistry.ts';

const BOOKING_TONE: Record<string, Tone> = { confirmed: 'positive', disrupted: 'danger', cancelled: 'neutral', replaced: 'neutral', changed: 'info' };
const CLAIM_TONE: Record<string, Tone> = { expected: 'info', provider_confirmed: 'accent', partially_received: 'warning', received: 'positive', overdue: 'danger', needs_review: 'warning', closed_unrecovered: 'neutral' };
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const CLOSING_SOON_MS = 36 * 3_600_000;

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

/** Refund amount a reviewed policy states before / at-or-after a deadline instant (display only). */
function tierAround(policy: PolicyEvidence | undefined, at: string): { before?: MaybeMoney; after?: MaybeMoney } {
  if (!policy) return {};
  return {
    before: policy.refundTiers.find((t) => t.window.endsBefore === at)?.refund,
    after: policy.refundTiers.find((t) => t.window.startsAtOrAfter === at)?.refund,
  };
}

function assetValue(a: WalletAsset) {
  return a.value.unit === 'money' ? (
    <MoneyText value={a.value.amount} />
  ) : isUnknown(a.value.quantity) ? (
    'Unknown points'
  ) : (
    `${a.value.quantity.toLocaleString('en-US')} points`
  );
}

export function TripDashboard({ tripId }: { tripId: Id }) {
  const { load, clock, featureContext } = useAppServices();
  if (load.status !== 'ready') return null;
  const s = load.snapshot;
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return <EmptyState title="Trip not found">This trip does not exist in your workspace.</EmptyState>;

  const plan = s.plans.find((p) => p.id === trip.selectedPlanId);
  const bookings = s.bookings.filter((b) => b.tripId === tripId);
  const policies = s.policies.filter((p) => p.tripId === tripId);
  const now = clock.now();
  const deadlines = policies
    .flatMap((p) => p.deadlines.map((d) => ({ ...d, policy: p })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const disruption = s.disruptions.find((d) => d.tripId === tripId && d.status === 'active');
  const actions = s.actions.filter((a) => a.tripId === tripId);
  const claims = s.claims.filter((c) => c.tripId === tripId);
  const assets = s.assets.filter((a) => a.tripId === null || a.tripId === tripId);
  const unknownPolicies = policies.filter((p) => p.refundability === 'unknown' || p.reviewState !== 'reviewed');
  const knownPaid = bookings.map((b) => b.paid).find((p) => !isUnknown(p));
  const totalPaid = bookings.length ? sumMaybe(bookings.map((b) => b.paid), knownPaid && !isUnknown(knownPaid) ? knownPaid.currency : 'USD') : null;
  const bookingTitle = (id: Id) => bookings.find((b) => b.id === id)?.title ?? id;

  return (
    <div className="wf-stack-lg">
      <header className="wf-page-header">
        <h1>{trip.title}</h1>
        <p>
          {trip.startDate} to {trip.endDate} · {trip.origin.name} to {trip.destination.name} · times shown in {trip.displayTimezone}
        </p>
      </header>

      {disruption && (
        <Notice tone="danger">
          <div className="wf-row" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>Disruption: </strong>
              {disruption.description}
              {disruption.capability === 'simulated' && ' (simulated)'}
            </span>
            <Link className="wf-button" data-variant="primary" to={`/trips/${tripId}/reroute`}>
              Open ReRoute
            </Link>
          </div>
        </Notice>
      )}
      <ClaimSyncNotice tripId={tripId} />

      {claims.length > 0 && (
        <Card title="Refund claims" actions={<StatusBadge tone="info">From TripWallet · cash only</StatusBadge>}>
          <ul className="wf-list">
            {claims.map((c) => (
              <li key={c.id}>
                <span className="wf-list-main">
                  <strong>{bookingTitle(c.bookingId)}</strong>
                  <span className="wf-muted">
                    One claim · expected <MoneyText value={c.expected} />
                  </span>
                </span>
                <span>
                  Outstanding <MoneyText value={c.outstanding} />
                </span>
                <StatusBadge tone={CLAIM_TONE[c.status] ?? 'neutral'}>{label(c.status)}</StatusBadge>
              </li>
            ))}
          </ul>
          <div>
            <Link className="wf-button" to={`/trips/${tripId}/wallet`}>
              Open TripWallet
            </Link>
          </div>
        </Card>
      )}

      <div className="wf-columns">
        <div className="wf-stack-lg">
          <Card
            title="Confirmed bookings"
            actions={
              <Link className="wf-button" data-variant="ghost" to={`/trips/${tripId}/import`}>
                Import a booking
              </Link>
            }
          >
            {unknownPolicies.length > 0 && <Notice tone="warning">{unknownPolicies.length} booking policy record(s) need review or have unknown terms.</Notice>}
            {bookings.length === 0 ? (
              <span className="wf-muted">No confirmed bookings yet. A selected plan is not a booking; import confirmations to establish booked state.</span>
            ) : (
              <>
                <div className="wf-table-wrap">
                  <table className="wf-table">
                    <thead>
                      <tr>
                        <th scope="col">Booking</th>
                        <th scope="col" className="wf-hide-narrow">
                          Starts
                        </th>
                        <th scope="col">Status</th>
                        <th scope="col" className="wf-num">
                          Paid
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.title}</strong>
                            <div className="wf-muted">
                              {b.provider} · <span className="wf-mono">{b.reference}</span>
                            </div>
                            <div className="wf-muted wf-show-narrow">
                              <InstantText value={b.startsAt} timeZone={b.localTimezone} />
                            </div>
                          </td>
                          <td className="wf-hide-narrow">
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
                {totalPaid && <KeyValue emphasis="total" label="Total paid for confirmed bookings" value={<MoneyText value={totalPaid} />} />}
              </>
            )}
          </Card>

          <Card title="Upcoming deadlines" actions={<StatusBadge tone="accent">Uses the {clock.mode === 'sample' ? 'demo' : 'real-time'} clock</StatusBadge>}>
            {deadlines.length === 0 ? (
              <span className="wf-muted">No deadlines from reviewed policies yet.</span>
            ) : (
              <ul className="wf-list">
                {deadlines.map((d) => {
                  const open = deadlineStatus(now, d.at) === 'before_deadline';
                  const left = msUntil(now, d.at);
                  const soon = open && left < CLOSING_SOON_MS;
                  const hours = Math.floor(left / 3_600_000);
                  const { before, after } = tierAround(d.policy, d.at);
                  return (
                    <li key={d.id}>
                      <StatusBadge tone={!open ? 'neutral' : soon ? 'warning' : 'positive'}>
                        {!open ? 'Passed' : soon ? `Open · closes in ${hours < 1 ? '<1' : hours} h` : 'Open'}
                      </StatusBadge>
                      <span className="wf-list-main">
                        <strong>{d.label}</strong>
                        <span className="wf-muted">
                          <InstantText value={d.at} timeZone={d.displayTimezone} /> · <span className="wf-mono">{d.at}</span>
                        </span>
                        <span className="wf-muted">Source: “{d.sourceWording}”</span>
                      </span>
                      {(before || after) && (
                        <span className="wf-stack" style={{ gap: 0, textAlign: 'right' }}>
                          {before && (
                            <strong>
                              Before: <MoneyText value={before} />
                            </strong>
                          )}
                          {after && (
                            <span className="wf-muted">
                              At or after: <MoneyText value={after} />
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="wf-stack-lg">
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

          <Card title="Money summary" actions={<StatusBadge>Trip-wide</StatusBadge>}>
            <MoneyStat
              label="Paid for confirmed bookings"
              value={totalPaid ?? 'None yet'}
              tone={totalPaid ? 'default' : 'muted'}
              caption={`Cash already paid · ${bookings.length} booking${bookings.length === 1 ? '' : 's'}`}
            />
            <MoneyStat
              label="Refund claims"
              value={claims.length ? `${claims.length} open` : 'None yet'}
              tone="muted"
              caption={
                claims.length
                  ? `From ${actions.length} recorded action${actions.length === 1 ? '' : 's'} · amounts in TripWallet`
                  : 'Created after you approve a recovery action in ReRoute'
              }
            />
          </Card>

          {assets.length > 0 && (
            <Card title="Credits and points" actions={<StatusBadge>Not cash</StatusBadge>}>
              <ul className="wf-list">
                {assets.map((a) => (
                  <li key={a.id}>
                    <span className="wf-list-main">
                      <strong>{a.issuer}</strong>
                      <span>{assetValue(a)}</span>
                      <span className="wf-muted">{a.restrictions.join(' · ')}</span>
                      {a.expiresAt && (
                        <span className="wf-muted">
                          Expires <InstantText value={a.expiresAt} timeZone={trip.displayTimezone} />
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="wf-muted">Never added to cash refunds.</span>
            </Card>
          )}
        </div>
      </div>

      {ROUTE_TABLE.map(({ key }) => {
        const Panel = FEATURES[key]?.DashboardPanel;
        return Panel ? <Panel key={key} tripId={tripId} ctx={featureContext} /> : null;
      })}
    </div>
  );
}
