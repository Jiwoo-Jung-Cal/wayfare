// Overview (design r2-final §3 "Overview", Figma 60:116; exports dashboard/r2-overview-*.png).
// Presents stored facts only: the trip, bookings, policy deadlines and tiers, the recorded
// disruption, ReRoute's stored recovery options, recorded actions and TripWallet claims.
// Nothing here recalculates refunds or eligibility; unknown money stays "Unknown".
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  deadlineStatus,
  findInWindow,
  isBefore,
  isUnknown,
  msUntil,
  sumMaybe,
  type Booking,
  type BookingKind,
  type Instant,
  type MaybeMoney,
  type Money,
  type PolicyEvidence,
  type WorkspaceSnapshot,
} from '../core/index.ts';
import { Icon, type IconName } from '../ui/icons.tsx';
import { MoneyText } from '../ui/index.tsx';

const CAT: Record<BookingKind, { color: string; icon: IconName; label: string }> = {
  flight: { color: 'var(--wf-color-cat-flight)', icon: 'plane', label: 'Flight' },
  hotel: { color: 'var(--wf-color-cat-stay)', icon: 'bed', label: 'Stay' },
  activity: { color: 'var(--wf-color-cat-activity)', icon: 'ticket', label: 'Activity' },
  transfer: { color: 'var(--wf-color-cat-ride)', icon: 'car', label: 'Ride' },
  other: { color: 'var(--wf-color-text-muted)', icon: 'ticket', label: 'Booking' },
};

const fmt = (at: Instant, tz: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(at));
const day = (at: Instant, tz: string) => fmt(at, tz, { weekday: 'short', month: 'short', day: 'numeric' });
const time = (at: Instant, tz: string) => fmt(at, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const isMoney = (m: MaybeMoney): m is Money => !isUnknown(m);

/** Money tile figure: whole amounts without cents ("$820"), otherwise two decimals. */
function tileMoney(m: Money) {
  const whole = m.amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(m.amountMinor / 100);
}

function Signed({ value, sign }: { value: MaybeMoney; sign: '+' | '−' }) {
  if (!isMoney(value)) return <>Unknown</>;
  return (
    <>
      {sign}
      {tileMoney(value)}
    </>
  );
}

/** Windowed mode (r2-final §2): decorative motion that needs room is off when not maximised or < 1200 px. */
function useWindowed() {
  useEffect(() => {
    const check = () => {
      const notMax = window.outerWidth > 0 && screen.availWidth > 0 && window.outerWidth < screen.availWidth - 24;
      document.documentElement.classList.toggle('wf-windowed', notMax || window.innerWidth < 1200);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
}

function refundTierNow(policy: PolicyEvidence | undefined, now: Instant, condition?: string) {
  if (!policy) return undefined;
  const tiers = condition ? policy.refundTiers.filter((t) => t.condition === condition) : policy.refundTiers;
  return findInWindow(tiers, now);
}

function BoardingPass({ s, flight, now }: { s: WorkspaceSnapshot; flight: Booking; now: Instant }) {
  useWindowed();
  const trip = s.trips.find((t) => t.id === flight.tripId)!;
  const tz = flight.localTimezone;
  const disrupted = s.disruptions.some((d) => d.bookingId === flight.id && d.status === 'active' && d.type === 'cancellation');
  const policy = s.policies.find((p) => p.id === flight.policyId);
  const owed = disrupted ? refundTierNow(policy, now, 'provider_cancels')?.refund : undefined;
  const flightNo = /^[A-Z0-9]{2}\s?\d+/.exec(flight.title)?.[0] ?? flight.title;
  const from = trip.origin.code ?? trip.origin.name;
  const to = trip.destination.code ?? trip.destination.name;
  const label = `Boarding pass for ${flight.provider} flight ${flightNo}${disrupted ? ', cancelled by the airline' : ''}`;
  return (
    <div className="wf-bp" tabIndex={0} aria-label={label}>
      <div className="wf-bp-main">
        <div className="wf-bp-band">
          <b>{flight.provider.toUpperCase()}</b>
          <span className="wf-label-mono">Boarding pass</span>
        </div>
        <div className="wf-bp-body">
          <div>
            <div className="wf-bp-code">{from}</div>
            <div className="wf-bp-city">{trip.origin.name}</div>
          </div>
          <div className="wf-bp-path">
            {disrupted && (
              <span className="wf-bp-stamp">
                CANCELLED<span className="wf-bp-by"> BY AIRLINE</span>
              </span>
            )}
            <span className="wf-bp-fly" aria-hidden="true">
              <Icon name="plane" />
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="wf-bp-code">{to}</div>
            <div className="wf-bp-city">{trip.destination.name}</div>
          </div>
        </div>
        <div className="wf-bp-grid">
          <Field k="Passenger" v="1 traveler" />
          <Field k="Flight" v={flightNo} />
          <Field k="Date" v={day(flight.startsAt, tz)} />
          <Field k="Departs" v={time(flight.startsAt, tz)} />
          <Field k="Gate" v="Not set" muted />
          <Field k="Seat" v="Not set" muted />
        </div>
      </div>
      <span className="wf-bp-hit" aria-hidden="true" />
      <div className="wf-bp-stub">
        <div className="wf-bp-band">
          <b>{flightNo}</b>
          <span className="wf-label-mono">{flight.reference}</span>
        </div>
        <div className="wf-bp-stub-b">
          <div className="wf-bp-row2">
            <Field k="From" v={from} />
            <Field k="To" v={to} />
          </div>
          <div className="wf-bp-row2">
            <Field k="Date" v={fmt(flight.startsAt, tz, { day: 'numeric', month: 'short' })} />
            <Field k="Refund" v={owed ? <span className="wf-gain"><Signed value={owed} sign="+" /></span> : '—'} />
          </div>
          <div className="wf-bp-barcode" aria-hidden="true" />
          <span className="wf-label-mono wf-bp-tear-hint">Hover to tear off the stub</span>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v, muted }: { k: string; v: ReactNode; muted?: boolean }) {
  return (
    <div className="wf-bp-f">
      <div className="wf-bp-k">{k.toUpperCase()}</div>
      <div className={`wf-bp-v${muted ? ' wf-bp-na' : ''}`}>{v}</div>
    </div>
  );
}

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export function OverviewHero({ s, tripId, now }: { s: WorkspaceSnapshot; tripId: string; now: Instant }) {
  useTick(30_000);
  const bookings = s.bookings.filter((b) => b.tripId === tripId);
  if (bookings.length === 0) return null;
  const flight = bookings.find((b) => b.kind === 'flight');
  const disruption = s.disruptions.find((d) => d.tripId === tripId && d.status === 'active');
  const actions = s.actions.filter((a) => a.tripId === tripId);
  const claims = s.claims.filter((c) => c.tripId === tripId);
  const approved = actions.length > 0;
  const cancelOption = s.recoveryOptions.find((o) => o.tripId === tripId && o.kind === 'cancel_trip');
  const optionFresh = cancelOption && (cancelOption.validUntil === null || isBefore(now, cancelOption.validUntil));

  // Decide within: the earliest still-open deadline on a booking that is not cancelled yet.
  const open = s.policies
    .filter((p) => p.tripId === tripId)
    .flatMap((p) => p.deadlines.map((d) => ({ d, p, booking: bookings.find((b) => b.id === p.bookingId) })))
    .filter(({ d, booking }) => booking && booking.state !== 'cancelled' && booking.state !== 'replaced' && deadlineStatus(now, d.at) === 'before_deadline')
    .sort((a, b) => a.d.at.localeCompare(b.d.at))[0];

  const paid = sumMaybe(bookings.map((b) => b.paid), 'USD');
  const back: MaybeMoney | null = approved
    ? sumMaybe(claims.map((c) => c.expected), 'USD')
    : optionFresh
      ? cancelOption!.expectedCashRecovery
      : null;
  const lost: MaybeMoney | null = !approved && optionFresh ? cancelOption!.forecastCost : null;

  const steps: { title: string; body: string; done: boolean; now: boolean; to?: string; cta?: string }[] = disruption
    ? [
        { title: 'Read what happened', body: `${disruption.description}${disruption.capability === 'simulated' ? ' (simulated)' : ''}`, done: true, now: false },
        {
          title: 'Choose: keep the trip or cancel it',
          body: approved ? `You chose an option. ${actions.length} simulated action${actions.length === 1 ? '' : 's'} recorded.` : 'Compare both options in ReRoute.',
          done: approved,
          now: !approved,
          to: `/trips/${tripId}/reroute`,
          cta: 'Choose',
        },
        {
          title: 'Get your money back',
          body: approved ? 'TripWallet tracks every refund claim.' : 'Each refund is tracked once you choose.',
          done: false,
          now: approved,
          to: `/trips/${tripId}/wallet`,
          cta: 'Open',
        },
      ]
    : [];

  return (
    <section className="wf-ov" aria-label="Trip overview">
      {flight && <BoardingPass s={s} flight={flight} now={now} />}

      {disruption && open && !approved && (
        <div className="wf-ov-cta">
          <div>
            <span className="wf-label-mono wf-loss">
              <Icon name="clock" className="wf-icon wf-icon-sm" /> Decide within
            </span>
            <div className="wf-big wf-num wf-loss">
              {Math.floor(msUntil(now, open.d.at) / 3_600_000)}h {String(Math.floor((msUntil(now, open.d.at) % 3_600_000) / 60_000)).padStart(2, '0')}m
            </div>
            <p className="wf-muted">
              By {fmt(open.d.at, open.d.displayTimezone, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}. After that, {open.booking!.provider} refunds less.
            </p>
          </div>
          <Link className="wf-button" data-variant="dark" to={`/trips/${tripId}/reroute`}>
            See what to do <Icon name="arrow" />
          </Link>
        </div>
      )}

      <div className="wf-ov-cols">
        <div>
          {steps.length > 0 && (
            <>
              <h2 className="wf-sec-t">What to do next</h2>
              <ol className="wf-steps">
                {steps.map((st, i) => (
                  <li key={st.title} className={st.done ? 'wf-step-done' : st.now ? 'wf-step-now' : ''}>
                    <span className="wf-step-n" aria-hidden="true">{st.done ? <Icon name="check" /> : i + 1}</span>
                    <div>
                      <h3>{st.title}</h3>
                      <p>{st.body}</p>
                    </div>
                    {st.now && st.to && (
                      <Link className="wf-button" data-variant="dark" data-size="sm" to={st.to}>
                        {st.cta}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="wf-money-tiles">
            <div>
              <span className="wf-label-mono">{approved ? 'Expected back' : 'Back if you cancel'}</span>
              <div className="wf-big wf-num wf-gain">{back ? <Signed value={back} sign="+" /> : '—'}</div>
              <p className="wf-muted">{back ? 'Expected' : <Link to={`/trips/${tripId}/reroute`}>Compare in ReRoute</Link>}</p>
            </div>
            <div>
              <span className="wf-label-mono">Can’t get back</span>
              <div className="wf-big wf-num wf-loss">{lost ? <Signed value={lost} sign="−" /> : '—'}</div>
              <p className="wf-muted">{lost ? 'If you cancel now' : approved ? 'See TripWallet' : 'Compare in ReRoute'}</p>
            </div>
            <div>
              <span className="wf-label-mono">You paid</span>
              <div className="wf-big wf-num">{isMoney(paid) ? tileMoney(paid) : 'Unknown'}</div>
              <p className="wf-muted">For {bookings.length} booking{bookings.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
        <Passes s={s} bookings={bookings} now={now} />
      </div>
    </section>
  );
}

function Passes({ s, bookings, now }: { s: WorkspaceSnapshot; bookings: Booking[]; now: Instant }) {
  const [openId, setOpenId] = useState<string | null>(bookings[0]?.id ?? null);
  const order = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div>
      <h2 className="wf-sec-t">
        Your passes <span className="wf-label-mono">Tap one to open it</span>
      </h2>
      <div className="wf-passes">
        {order.map((b) => {
          const cat = CAT[b.kind] ?? CAT.other;
          const open = openId === b.id;
          const policy = s.policies.find((p) => p.id === b.policyId);
          const tier = refundTierNow(policy, now, b.kind === 'flight' ? 'provider_cancels' : undefined);
          const claim = s.claims.find((c) => c.bookingId === b.id);
          const note =
            b.state === 'cancelled'
              ? claim
                ? 'Cancelled. Refund claim open in TripWallet.'
                : 'Cancelled.'
              : tier && isMoney(tier.refund)
                ? `${tier.label}`
                : policy?.refundability === 'unknown'
                  ? 'Refund terms unknown · review in Import'
                  : '';
          return (
            <button
              key={b.id}
              type="button"
              className={`wf-pass${open ? ' wf-pass-open' : ''}`}
              style={{ background: cat.color }}
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : b.id)}
            >
              <span className="wf-pass-h">
                <Icon name={cat.icon} />
                <b>{b.provider}</b>
                <span className="wf-pass-r">
                  <small>{cat.label.toUpperCase()}</small>
                  {day(b.startsAt, b.localTimezone)}
                </span>
              </span>
              {open && (
                <span className="wf-pass-b">
                  <span className="wf-pass-hero">{b.title}</span>
                  <span>
                    <small>STARTS</small>
                    {time(b.startsAt, b.localTimezone)}
                  </span>
                  <span>
                    <small>BOOKING</small>
                    {b.reference}
                  </span>
                  <span>
                    <small>PAID</small>
                    {isMoney(b.paid) ? <MoneyText value={b.paid} /> : 'Unknown'}
                  </span>
                  <span>
                    <small>STATUS</small>
                    {b.state.charAt(0).toUpperCase() + b.state.slice(1)}
                  </span>
                  {note && <span className="wf-pass-note">{note}</span>}
                  <span className="wf-pass-bc" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
