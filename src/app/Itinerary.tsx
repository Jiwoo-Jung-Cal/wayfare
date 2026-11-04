// Itinerary (design r2-final §3 "Itinerary", Figma 67:294; export dashboard/r2-itinerary-desktop.png).
// One month calendar with bookings and red refund deadlines merged, and a whole-trip list
// grouped by day. Presents stored bookings, policy deadlines and tiers only; it does not
// recalculate refunds. Unknown money stays "Unknown". Google Calendar sync is a demo state;
// the per-booking "Add to Google Calendar" link is Google's public template link (no sign-in).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  deadlineStatus,
  findInWindow,
  isUnknown,
  msUntil,
  type Booking,
  type BookingKind,
  type Instant,
  type MaybeMoney,
  type PolicyDeadline,
  type PolicyEvidence,
  type WorkspaceSnapshot,
} from '../core/index.ts';
import { EmptyState, MoneyText, StatusBadge, type Tone } from '../ui/index.tsx';
import { GoogleG, Icon } from '../ui/icons.tsx';
import { useAppServices } from './AppServices.tsx';
import { useAccount } from './account.tsx';
import { useToast } from './toasts.tsx';
import { CAT, tileMoney } from './Overview.tsx';

type Filter = 'flight' | 'hotel' | 'activity' | 'transfer';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'flight', label: 'Flights' },
  { key: 'hotel', label: 'Stays' },
  { key: 'activity', label: 'Activities' },
  { key: 'transfer', label: 'Rides' },
];
const shown = (kind: BookingKind, cats: Record<Filter, boolean>) => (kind === 'other' ? true : cats[kind]);

const fmt = (at: Instant, tz: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(at));
/** Local calendar day "YYYY-MM-DD" of an instant in a timezone. */
const dayKey = (at: Instant, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const shortTime = (at: Instant, tz: string) => fmt(at, tz, { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p');
const fullTime = (at: Instant, tz: string) => fmt(at, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const when = (at: Instant, tz: string) => fmt(at, tz, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const dayTitle = (key: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const moneyShort = (m: MaybeMoney | undefined, sign = '') => (!m ? 'Unknown' : isUnknown(m) ? 'Unknown' : m.amountMinor === 0 ? tileMoney(m) : `${sign}${tileMoney(m)}`);

interface DeadlineItem {
  d: PolicyDeadline;
  policy: PolicyEvidence;
  booking: Booking;
}

const inactive = (b: Booking) => b.state === 'cancelled' || b.state === 'replaced';

/** Refund the reviewed policy states just before / at-or-after a deadline (display only). */
function tierAround(policy: PolicyEvidence, at: string) {
  return {
    before: policy.refundTiers.find((t) => t.window.endsBefore === at)?.refund,
    after: policy.refundTiers.find((t) => t.window.startsAtOrAfter === at)?.refund,
  };
}

function leftText(now: Instant, at: Instant) {
  const ms = msUntil(now, at);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m left`;
}

/** Google Calendar's public event template link (no sign-in, nothing sent until the user saves it there). */
export function googleCalendarLink(b: Booking, tripTitle: string, deadlines: DeadlineItem[]) {
  const basic = (at: Instant) => at.replace(/[-:]/g, '').replace(/\.\d+/, '');
  let dates: string;
  if (b.kind === 'hotel' && b.endsAt) {
    dates = `${dayKey(b.startsAt, b.localTimezone).replace(/-/g, '')}/${dayKey(b.endsAt, b.localTimezone).replace(/-/g, '')}`;
  } else {
    const end = b.endsAt ?? new Date(Date.parse(b.startsAt) + 3_600_000).toISOString().replace('.000', '');
    dates = `${basic(b.startsAt)}/${basic(end)}`;
  }
  const dl = deadlines.filter((x) => x.booking.id === b.id).map((x) => `Refund deadline: ${x.d.sourceWording}.`);
  const details = [`${tripTitle} on WayFare. Booking: ${b.provider} · ${b.reference}.`, ...dl].join(' ');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: b.title, dates, details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function bookingTag(b: Booking, s: WorkspaceSnapshot): { tone: Tone; text: string } {
  if (b.state === 'cancelled') return { tone: 'neutral', text: 'Cancelled' };
  if (b.state === 'replaced') return { tone: 'neutral', text: 'Replaced' };
  const cancelledByProvider = s.disruptions.some((d) => d.bookingId === b.id && d.status === 'active' && d.type === 'cancellation');
  if (cancelledByProvider) return { tone: 'danger', text: 'Cancelled' };
  if (b.state === 'disrupted') return { tone: 'danger', text: 'Disrupted' };
  const dependsOnDisrupted = b.dependsOn.some((id) => {
    const dep = s.bookings.find((x) => x.id === id);
    return dep !== undefined && (dep.state === 'disrupted' || struck(dep, s));
  });
  if (dependsOnDisrupted) return { tone: 'warning', text: 'At risk' };
  if (b.state === 'changed') return { tone: 'info', text: 'Changed' };
  return { tone: 'positive', text: 'Booked' };
}

const struck = (b: Booking, s: WorkspaceSnapshot) =>
  inactive(b) || s.disruptions.some((d) => d.bookingId === b.id && d.status === 'active' && d.type === 'cancellation');

function DeadlineLine({ x, now, s }: { x: DeadlineItem; now: Instant; s: WorkspaceSnapshot }) {
  const tz = x.d.displayTimezone;
  const { before, after } = tierAround(x.policy, x.d.at);
  const drop = before || after ? ` · ${moneyShort(before, '+')} → ${moneyShort(after, '+')}` : '';
  if (inactive(x.booking) || struck(x.booking, s)) {
    return (
      <span className="wf-dlx" data-done="true">
        <Icon name="clock" />
        Refund deadline {when(x.d.at, tz)} · not needed, already cancelled
      </span>
    );
  }
  const open = deadlineStatus(now, x.d.at) === 'before_deadline';
  return (
    <span className="wf-dlx" data-done={open ? undefined : 'true'}>
      <Icon name="clock" />
      Refund deadline {when(x.d.at, tz)}
      {drop} · {open ? leftText(now, x.d.at) : 'passed'}
    </span>
  );
}

function NoDeadlineLine({ b, s, now }: { b: Booking; s: WorkspaceSnapshot; now: Instant }) {
  const policy = s.policies.find((p) => p.id === b.policyId);
  if (!policy) return <span className="wf-dlx" data-tone="muted">Refund terms unknown · no policy on file</span>;
  const providerCancelled = s.disruptions.some((d) => d.bookingId === b.id && d.status === 'active' && d.type === 'cancellation');
  const owed = providerCancelled ? findInWindow(policy.refundTiers.filter((t) => t.condition === 'provider_cancels'), now)?.refund : undefined;
  if (owed) {
    return (
      <span className="wf-dlx" data-tone="ok">
        <Icon name="check" />
        No deadline · {b.kind === 'flight' ? 'the airline' : 'the provider'} owes you {moneyShort(owed, '+')}
      </span>
    );
  }
  return <span className="wf-dlx" data-tone="muted">No refund deadline in the policy</span>;
}

function CalendarButton() {
  const { calendarOn, openAuth } = useAccount();
  const toast = useToast();
  const label = calendarOn ? 'Synced with Google Calendar (demo)' : 'Connect Google Calendar';
  return (
    <button
      type="button"
      className="wf-gsign"
      data-on={calendarOn || undefined}
      aria-haspopup={calendarOn ? undefined : 'dialog'}
      aria-label={label}
      title={label}
      onClick={() =>
        calendarOn ? toast('Already synced (demo)', 'In the real app, changes to this trip update in Google Calendar automatically.', 'gain') : openAuth('cal')
      }
    >
      <GoogleG />
      <span>{label}</span>
    </button>
  );
}

function DetailsDrawer({ b, s, tripTitle, deadlines, now, onClose }: { b: Booking; s: WorkspaceSnapshot; tripTitle: string; deadlines: DeadlineItem[]; now: Instant; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const tz = b.localTimezone;
  const policy = s.policies.find((p) => p.id === b.policyId);
  const mine = deadlines.filter((x) => x.booking.id === b.id);
  const disrupted = s.disruptions.some((d) => d.bookingId === b.id && d.status === 'active');
  const tag = bookingTag(b, s);
  return (
    <dialog ref={ref} className="wf-drawer" aria-labelledby="wf-drawer-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="wf-drawer-h">
        <h2 id="wf-drawer-title">{b.title}</h2>
        <button type="button" className="wf-ib" aria-label="Close" onClick={() => ref.current?.close()}>
          <Icon name="x" />
        </button>
      </div>
      <div className="wf-drawer-b">
        <StatusBadge tone={tag.tone}>{tag.text}</StatusBadge>
        <dl className="wf-facts">
          <div>
            <dt>Provider</dt>
            <dd>{b.provider}</dd>
          </div>
          <div>
            <dt>Booking</dt>
            <dd className="wf-mono">{b.reference}</dd>
          </div>
          <div>
            <dt>{b.kind === 'hotel' ? 'Check in' : 'Starts'}</dt>
            <dd>
              {fmt(b.startsAt, tz, { weekday: 'short', month: 'short', day: 'numeric' })} · {fullTime(b.startsAt, tz)}
            </dd>
          </div>
          {b.endsAt && (
            <div>
              <dt>{b.kind === 'hotel' ? 'Check out' : 'Ends'}</dt>
              <dd>
                {fmt(b.endsAt, tz, { weekday: 'short', month: 'short', day: 'numeric' })} · {fullTime(b.endsAt, tz)}
              </dd>
            </div>
          )}
          <div>
            <dt>You paid</dt>
            <dd>
              <MoneyText value={b.paid} />
            </dd>
          </div>
          <div>
            <dt>Refund rule</dt>
            <dd>{policy ? policy.refundability.replace(/_/g, ' ') : 'Unknown, no policy on file'}</dd>
          </div>
        </dl>
        {mine.length > 0 ? (
          mine.map((x) => (
            <div key={x.d.id} className="wf-stack" style={{ gap: 4 }}>
              <DeadlineLine x={x} now={now} s={s} />
              <small className="wf-muted">From the policy: “{x.d.sourceWording}”</small>
            </div>
          ))
        ) : (
          <NoDeadlineLine b={b} s={s} now={now} />
        )}
        <a className="wf-gcl" href={googleCalendarLink(b, tripTitle, deadlines)} target="_blank" rel="noopener noreferrer">
          Add to Google Calendar <Icon name="ext" />
        </a>
      </div>
      <div className="wf-drawer-f">
        <button type="button" className="wf-button" onClick={() => ref.current?.close()}>
          Close
        </button>
        {disrupted && (
          <Link className="wf-button" data-variant="dark" to={`/trips/${b.tripId}/reroute`}>
            See options
          </Link>
        )}
      </div>
    </dialog>
  );
}

export function Itinerary({ tripId }: { tripId: string }) {
  const { load, clock, refresh } = useAppServices();
  const [cats, setCats] = useState<Record<Filter, boolean>>({ flight: true, hotel: true, activity: true, transfer: true });
  const [showDl, setShowDl] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void refresh();
  }, [tripId, refresh]);
  useEffect(() => {
    if (!sel) return;
    const el = listRef.current?.querySelector('[data-hl="true"]');
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }, [sel]);
  if (load.status !== 'ready') return null;
  const s = load.snapshot;
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return <EmptyState title="Trip not found">This trip does not exist in your workspace.</EmptyState>;
  const now = clock.now();
  const tz = trip.displayTimezone;
  const bookings = s.bookings.filter((b) => b.tripId === tripId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const deadlines: DeadlineItem[] = s.policies
    .filter((p) => p.tripId === tripId)
    .flatMap((p) => {
      const booking = bookings.find((b) => b.id === p.bookingId);
      return booking ? p.deadlines.map((d) => ({ d, policy: p, booking })) : [];
    })
    .sort((a, b) => a.d.at.localeCompare(b.d.at));

  const header = (
    <header className="wf-page-header">
      <h1>Itinerary</h1>
      <p>Your bookings and their refund deadlines in one calendar. Deadlines are in red. Choose what to show, and tap a day to jump to it in the list below.</p>
    </header>
  );
  if (bookings.length === 0) {
    return (
      <div className="wf-stack-lg">
        {header}
        <EmptyState title="No bookings yet">
          <span>
            A selected plan is not a booking. <Link to={`/trips/${tripId}/import`}>Import a booking</Link> to see it here with its refund deadlines.
          </span>
        </EmptyState>
      </div>
    );
  }

  // Month grid for the trip's start month, in the trip's display timezone.
  const [y, mo] = trip.startDate.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const startDow = first.getUTCDay();
  const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const key = (d: number) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = dayKey(now, tz);

  const visible = bookings.filter((b) => shown(b.kind, cats));
  const spans = visible.filter((b) => b.kind === 'hotel' && b.endsAt);
  const singles = visible.filter((b) => !(b.kind === 'hotel' && b.endsAt));
  const visibleDl = showDl ? deadlines.filter((x) => shown(x.booking.kind, cats)) : [];
  const startKey = (b: Booking) => dayKey(b.startsAt, tz);
  const covers = (b: Booking, k: string) => (b.endsAt ? k >= startKey(b) && k <= dayKey(b.endsAt, tz) : k === startKey(b));
  const onSel = (b: Booking) => sel !== null && (covers(b, sel) || visibleDl.some((x) => x.booking.id === b.id && dayKey(x.d.at, tz) === sel));

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dn = i - startDow + 1;
    if (dn < 1 || dn > daysInMonth) {
      cells.push(<div key={i} className="wf-cell" data-out="true" aria-hidden="true" />);
      continue;
    }
    const k = key(dn);
    const dls = visibleDl.filter((x) => dayKey(x.d.at, tz) === k);
    const col = i % 7;
    cells.push(
      <button
        key={i}
        type="button"
        className="wf-cell"
        data-today={k === today || undefined}
        data-hasdl={dls.length > 0 || undefined}
        aria-pressed={sel === k}
        aria-label={`${dayTitle(k)}${dls.length ? ', refund deadline' : ''}`}
        onClick={() => setSel(sel === k ? null : k)}
      >
        <span className="wf-dn">{dn}</span>
        {spans
          .filter((b) => covers(b, k))
          .map((b) => {
            const s0 = k === startKey(b) || col === 0;
            const e0 = k === dayKey(b.endsAt!, tz) || col === 6;
            return (
              <span key={b.id} className="wf-span" data-s={s0 || undefined} data-e={e0 || undefined} data-x={struck(b, s) || undefined} style={{ background: CAT[b.kind].color }}>
                {s0 ? b.title : ' '}
              </span>
            );
          })}
        {dls.map((x) => {
          const done = inactive(x.booking) || struck(x.booking, s) || deadlineStatus(now, x.d.at) === 'deadline_passed';
          return (
            <span key={x.d.id} className="wf-ev" data-dl="true" data-done={done || undefined} title={x.d.label}>
              <Icon name="clock" />
              <b>{shortTime(x.d.at, x.d.displayTimezone)}</b>
              <span>{x.d.label}</span>
            </span>
          );
        })}
        {singles
          .filter((b) => startKey(b) === k)
          .map((b) => (
            <span key={b.id} className="wf-ev" data-x={struck(b, s) || undefined}>
              <i style={{ background: CAT[b.kind].color }} />
              <b>{shortTime(b.startsAt, b.localTimezone)}</b>
              <span>{b.title}</span>
            </span>
          ))}
      </button>,
    );
  }

  const listDays = [...new Set(visible.map(startKey))].sort();
  const openBooking = openId ? bookings.find((b) => b.id === openId) : undefined;

  return (
    <div className="wf-stack-lg wf-itin">
      {header}
      <div className="wf-calbar">
        <div className="wf-cal-l">
          <span className="wf-legend">
            <span>
              <i className="wf-lg-ev" />
              Booking
            </span>
            <span>
              <i className="wf-lg-dl" />
              Refund deadline
            </span>
          </span>
          <CalendarButton />
        </div>
        <div className="wf-filters" role="group" aria-label="Show categories">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="wf-fchip" aria-pressed={cats[f.key]} onClick={() => setCats({ ...cats, [f.key]: !cats[f.key] })}>
              <i style={{ background: CAT[f.key].color }} />
              {f.label}
            </button>
          ))}
          <button type="button" className="wf-fchip" data-dl="true" aria-pressed={showDl} onClick={() => setShowDl(!showDl)}>
            <i />
            Deadlines
          </button>
        </div>
      </div>

      <section className="wf-cal" aria-label={`${monthName} calendar`}>
        <div className="wf-cal-h">
          <h2>{monthName}</h2>
          <span className="wf-mono wf-muted">Bookings and deadlines · {fmt(now, tz, { timeZoneName: 'short' }).split(' ').pop()}</span>
        </div>
        <div className="wf-dow" aria-hidden="true">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="wf-weeks">{cells}</div>
      </section>

      <section aria-labelledby="wf-whole-trip" ref={listRef}>
        <h2 id="wf-whole-trip" className="wf-lh">
          Whole trip
        </h2>
        {listDays.length === 0 ? (
          <p className="wf-muted">Nothing here for the categories you picked.</p>
        ) : (
          listDays.map((k) => (
            <div key={k} className="wf-day">
              <h3 className="wf-dayh" data-on={k === sel || undefined}>
                {dayTitle(k)}
              </h3>
              <ul className="wf-rows">
                {visible
                  .filter((b) => startKey(b) === k)
                  .map((b) => {
                    const tag = bookingTag(b, s);
                    const mine = deadlines.filter((x) => x.booking.id === b.id);
                    return (
                      <li key={b.id}>
                        <button type="button" className="wf-row-b" data-hl={onSel(b) || undefined} data-x={struck(b, s) || undefined} aria-haspopup="dialog" onClick={() => setOpenId(b.id)}>
                          <span className="wf-tm">{fullTime(b.startsAt, b.localTimezone)}</span>
                          <span className="wf-cat" style={{ color: CAT[b.kind].color }}>
                            <Icon name={CAT[b.kind].icon} label={CAT[b.kind].label} />
                          </span>
                          <span className="wf-row-main">
                            <span className="wf-row-t">{b.title}</span>
                            <span className="wf-row-m">
                              {b.provider} · <span className="wf-mono">{b.reference}</span>
                            </span>
                            {showDl && (mine.length ? mine.map((x) => <DeadlineLine key={x.d.id} x={x} now={now} s={s} />) : <NoDeadlineLine b={b} s={s} now={now} />)}
                          </span>
                          <span className="wf-row-r">
                            <span className="wf-num">
                              <MoneyText value={b.paid} />
                            </span>
                            <StatusBadge tone={tag.tone}>{tag.text}</StatusBadge>
                          </span>
                          <Icon name="chev" className="wf-icon wf-row-chev" />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))
        )}
      </section>
      {openBooking && <DetailsDrawer b={openBooking} s={s} tripTitle={trip.title} deadlines={deadlines} now={now} onClose={() => setOpenId(null)} />}
    </div>
  );
}
