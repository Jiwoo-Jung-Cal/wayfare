// Overview (design r2-final §3 "Overview", Figma 60:116; exports dashboard/r2-overview-*.png).
// Presents stored facts only: the trip, bookings, policy deadlines and tiers, the recorded
// disruption, ReRoute's stored recovery options, recorded actions and TripWallet claims.
// Nothing here recalculates refunds or eligibility; unknown money stays "Unknown".
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  deadlineStatus,
  findInWindow,
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
import { tripFacts } from './tripFacts.ts';

export const CAT: Record<BookingKind, { color: string; icon: IconName; label: string }> = {
  flight: { color: 'var(--wf-color-cat-flight)', icon: 'plane', label: 'Flight' },
  hotel: { color: 'var(--wf-color-cat-stay)', icon: 'bed', label: 'Stay' },
  activity: { color: 'var(--wf-color-cat-activity)', icon: 'ticket', label: 'Activity' },
  transfer: { color: 'var(--wf-color-cat-ride)', icon: 'car', label: 'Ride' },
  other: { color: 'var(--wf-color-text-muted)', icon: 'ticket', label: 'Booking' },
};

/** Display names for airport codes shown on the pass (lookup only; codes come from the trip). */
const AIRPORT: Record<string, [string, string]> = {
  SFO: ['San Francisco', 'International'],
  JFK: ['New York', 'John F. Kennedy Intl.'],
};

/** A "Key: value" line from the booking's stored evidence document, if present. */
function docField(s: WorkspaceSnapshot, b: Booking, key: string): string | null {
  for (const id of b.evidenceDocumentIds) {
    const text = s.documents.find((d) => d.id === id)?.text ?? '';
    const m = new RegExp(`^${key}:\\s*(.+)$`, 'mi').exec(text);
    if (m) return m[1]!.trim();
  }
  return null;
}

const fmt = (at: Instant, tz: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(at));
const day = (at: Instant, tz: string) => fmt(at, tz, { weekday: 'short', month: 'short', day: 'numeric' });
const time = (at: Instant, tz: string) => fmt(at, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const isMoney = (m: MaybeMoney): m is Money => !isUnknown(m);

/** Money tile figure: whole amounts without cents ("$820"), otherwise two decimals. */
export function tileMoney(m: Money) {
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
  const fromName = AIRPORT[from] ?? [trip.origin.name, ''];
  const toName = AIRPORT[to] ?? [trip.destination.name, ''];
  const fare = docField(s, flight, 'Fare');
  const passenger = docField(s, flight, 'Passenger');
  const label = `Boarding pass for ${flight.provider} flight ${flightNo}${disrupted ? ', cancelled by the airline' : ''}`;
  return (
    <div className="wf-bp" tabIndex={0} aria-label={label}>
      <div className="wf-bp-main">
        <div className="wf-bp-band">
          <b>{flight.provider.toUpperCase()}</b>
          <span className="wf-label-mono">Boarding pass{fare ? ` · ${fare}` : ''}</span>
        </div>
        <div className="wf-bp-body">
          <div>
            <div className="wf-bp-code">{from}</div>
            <div className="wf-bp-city">
              {fromName[0]}
              {fromName[1] && (
                <>
                  <br />
                  {fromName[1]}
                </>
              )}
            </div>
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
            <div className="wf-bp-city">
              {toName[0]}
              {toName[1] && (
                <>
                  <br />
                  {toName[1]}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="wf-bp-grid">
          <Field k="Passenger" v={passenger ?? 'Not set'} muted={!passenger} />
          <Field k="Flight" v={flightNo} />
          <Field k="Date" v={fmt(flight.startsAt, tz, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/(\w+), (\w+) (\d+)/, '$1, $3 $2')} />
          <Field k="Departs" v={fmt(flight.startsAt, tz, { hour: 'numeric', minute: '2-digit' })} />
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
            <Field k="Date" v={fmt(flight.startsAt, tz, { day: 'numeric', month: 'short' }).replace(/(\w+) (\d+)/, '$2 $1')} />
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

const NOUN: Record<string, string> = { flight: 'flight', hotel: 'hotel', activity: 'activity', transfer: 'ride', other: 'booking' };
/** "Thursday 6:00 PM ET" */
const whenGeneric = (at: Instant, tz: string) =>
  fmt(at, tz, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'shortGeneric' }).replace(/ at /, ' ').replace(/,/, '');

export function OverviewHero({ s, tripId, now }: { s: WorkspaceSnapshot; tripId: string; now: Instant }) {
  useTick(30_000);
  const f = tripFacts(s, tripId, now);
  const bookings = f.bookings;
  if (bookings.length === 0) return null;
  const flight = bookings.find((b) => b.kind === 'flight');
  const disruption = s.disruptions.find((d) => d.tripId === tripId && d.status === 'active');
  const actions = s.actions.filter((a) => a.tripId === tripId && (!disruption || a.disruptionId === disruption.id));
  const cancels = actions.filter((a) => a.action === 'cancel').length;
  const approved = f.approved;
  const open = f.nextDeadline;
  const paid = sumMaybe(bookings.map((b) => b.paid), 'USD');
  const back = f.cancelTrip?.expectedCashRecovery ?? null;
  const lost = f.cancelTrip?.forecastCost ?? null;
  const d = f.disrupted;

  const steps: { title: string; body: string; done: boolean; now: boolean; to?: string; cta?: string }[] = disruption
    ? [
        {
          title: 'Read what happened',
          body: `${d?.provider ?? 'The provider'} cancelled your ${NOUN[d?.kind ?? 'other']}. You don’t need to call anyone.`,
          done: true,
          now: false,
        },
        {
          title: 'Choose: keep the trip or cancel it',
          body: approved
            ? cancels
              ? `You chose to cancel. We recorded ${cancels} cancellation${cancels === 1 ? '' : 's'}.`
              : 'You chose to keep the trip. We recorded the rebooking.'
            : 'Compare both options in ReRoute. It takes about a minute.',
          done: approved,
          now: !approved,
          to: `/trips/${tripId}/reroute`,
          cta: 'Choose',
        },
        {
          title: 'Get your money back',
          body: approved ? 'We’re tracking every refund in TripWallet.' : 'We’ll track each refund and tell you when it arrives.',
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
              By {whenGeneric(open.d.at, open.d.displayTimezone)}. After that, the {NOUN[open.booking.kind]} refunds less.
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
              <span className="wf-label-mono">{approved ? 'Coming back' : 'Back if you cancel'}</span>
              <div className="wf-big wf-num wf-gain">{back ? <Signed value={back} sign="+" /> : '—'}</div>
              <p className="wf-muted">{back ? 'Expected' : 'Nothing to compare yet'}</p>
            </div>
            <div>
              <span className="wf-label-mono">Can’t get back</span>
              <div className="wf-big wf-num wf-loss">{lost ? <Signed value={lost} sign="−" /> : '—'}</div>
              <p className="wf-muted">{lost ? (approved ? 'Lost to fees' : 'If you cancel now') : 'Nothing to compare yet'}</p>
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

/** Pass header right-hand label and value, as in the reference ("CHECK IN · Fri 3 PM"). */
function passMeta(b: Booking): [string, string] {
  const tz = b.localTimezone;
  const short = (at: Instant) => fmt(at, tz, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(',', '');
  if (b.kind === 'flight') return ['FLIGHT', /^[A-Z0-9]{2}\s?\d+/.exec(b.title)?.[0] ?? b.reference];
  if (b.kind === 'hotel') return ['CHECK IN', short(b.startsAt)];
  if (b.kind === 'transfer') return ['PICK UP', short(b.startsAt)];
  return ['STARTS', short(b.startsAt)];
}

function passFields(s: WorkspaceSnapshot, b: Booking): [string, ReactNode][] {
  const tz = b.localTimezone;
  const d = (at: Instant) => day(at, tz);
  const t = (at: Instant) => fmt(at, tz, { hour: 'numeric', minute: '2-digit' });
  const paid = isMoney(b.paid) ? <MoneyText value={b.paid} /> : 'Unknown';
  if (b.kind === 'flight') return [['Date', d(b.startsAt)], ['Departs', time(b.startsAt, tz)], ['Fare', docField(s, b, 'Fare') ?? 'Not set'], ['Booking', b.reference]];
  if (b.kind === 'hotel') return [['Check in', d(b.startsAt)], ['Check out', b.endsAt ? d(b.endsAt) : 'Not set'], ['Paid', paid], ['Booking', b.reference]];
  if (b.kind === 'transfer') return [['Date', d(b.startsAt)], ['Pick up', t(b.startsAt)], ['Paid', paid], ['Booking', b.reference]];
  return [['Date', d(b.startsAt)], ['Starts', t(b.startsAt)], ['Paid', paid], ['Booking', b.reference]];
}

function passHero(s: WorkspaceSnapshot, b: Booking): string {
  const trip = s.trips.find((t) => t.id === b.tripId);
  if (b.kind === 'flight' && trip) return `${trip.origin.code ?? trip.origin.name} → ${trip.destination.code ?? trip.destination.name}`;
  return b.title;
}

/** One-line refund note from the stored policy tiers and recorded state. */
function passNote(s: WorkspaceSnapshot, b: Booking, now: Instant): string {
  const disrupted = s.disruptions.some((d) => d.bookingId === b.id && d.status === 'active' && d.type === 'cancellation');
  const policy = s.policies.find((p) => p.id === b.policyId);
  if (disrupted) {
    const owed = refundTierNow(policy, now, 'provider_cancels')?.refund;
    return `Cancelled by the ${b.kind === 'flight' ? 'airline' : 'provider'}.${owed && isMoney(owed) ? ` +${tileMoney(owed)} refund owed.` : ''}`;
  }
  if (b.state === 'cancelled') return s.claims.some((c) => c.bookingId === b.id) ? 'Cancelled. Refund claim open.' : 'Cancelled.';
  if (!policy || policy.refundability === 'unknown') return 'Refund terms unknown · review the booking';
  const dl = policy.deadlines.filter((x) => deadlineStatus(now, x.at) === 'before_deadline').sort((a, c) => a.at.localeCompare(c.at))[0];
  const short = (at: Instant, tz: string) => fmt(at, tz, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(',', '').replace(/12 PM/, 'noon');
  if (dl) {
    const before = policy.refundTiers.find((x) => x.window.endsBefore === dl.at)?.refund;
    return before && isMoney(before) ? `Cancel before ${short(dl.at, dl.displayTimezone)}: +${tileMoney(before)} back.` : `Refund changes ${short(dl.at, dl.displayTimezone)}.`;
  }
  const nowTier = refundTierNow(policy, now, 'traveler_cancels') ?? refundTierNow(policy, now);
  if (nowTier && isMoney(nowTier.refund)) return nowTier.refund.amountMinor ? `Cancelling now: +${tileMoney(nowTier.refund)} back.` : 'No refund if you cancel now.';
  return '';
}

const KIND_ORDER: Record<string, number> = { flight: 0, hotel: 1, activity: 2, transfer: 3, other: 4 };

function Passes({ s, bookings, now }: { s: WorkspaceSnapshot; bookings: Booking[]; now: Instant }) {
  const order = [...bookings].sort((a, b) => KIND_ORDER[a.kind]! - KIND_ORDER[b.kind]! || a.startsAt.localeCompare(b.startsAt));
  const [openId, setOpenId] = useState<string | null>(order[0]?.id ?? null);
  return (
    <div>
      <h2 className="wf-sec-t">
        Your passes <span className="wf-label-mono">Tap one to open it</span>
      </h2>
      <div className="wf-passes">
        {order.map((b) => {
          const cat = CAT[b.kind] ?? CAT.other;
          const open = openId === b.id;
          const [rk, rv] = passMeta(b);
          const note = passNote(s, b, now);
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
                  <small>{rk}</small>
                  {rv}
                </span>
              </span>
              {open && (
                <span className="wf-pass-b">
                  <span className="wf-pass-hero">{passHero(s, b)}</span>
                  {passFields(s, b).map(([k, v]) => (
                    <span key={k}>
                      <small>{k.toUpperCase()}</small>
                      {v}
                    </span>
                  ))}
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
