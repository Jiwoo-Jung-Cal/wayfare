// Ask WayFare (design r2-final §2, export foundation/r2-ask-wayfare-panel.png).
// A demo assistant: scripted replies written from this trip's stored data, as in the
// reference page. No model is called; the panel says so. A real assistant must go
// through Agent 1's server-side model adapter and stay labelled until verified.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { isUnknown, type Instant, type MaybeMoney, type WorkspaceSnapshot } from '../core/index.ts';
import { Icon } from '../ui/icons.tsx';
import { useAppServices } from './AppServices.tsx';
import { tripFacts, wholeMoney } from './tripFacts.ts';

type Msg = { who: 'ai' | 'me'; body: ReactNode; acts?: [string, string][] };

const SUGG = ['Summarize my trip', 'How much will I get back?', 'What’s my next deadline?', 'How do I cancel?', 'Plan a different trip'];
const NOUN: Record<string, string> = { flight: 'flight', hotel: 'hotel', activity: 'skyline walk', transfer: 'airport ride', other: 'booking' };

const G = ({ m }: { m: MaybeMoney | undefined | null }) => <b className="wf-gain">{m && !isUnknown(m) ? `+${wholeMoney(m)}` : 'an unknown amount'}</b>;
const L = ({ m }: { m: MaybeMoney | undefined | null }) => <b className="wf-loss">{m && !isUnknown(m) ? `−${wholeMoney(m)}` : 'an unknown amount'}</b>;
const when = (at: Instant, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(at));
const hoursLeft = (now: Instant, at: Instant) => Math.max(0, Math.floor((Date.parse(at) - Date.parse(now)) / 3_600_000));

export function reply(q: string, s: WorkspaceSnapshot, tripId: string, now: Instant): Omit<Msg, 'who'> {
  const trip = s.trips.find((t) => t.id === tripId);
  const f = tripFacts(s, tripId, now);
  const base = `/trips/${tripId}`;
  const x = q.toLowerCase();
  const name = trip?.title ?? 'your trip';
  const ct = f.cancelTrip;
  const providerOwed = f.disrupted ? f.perBooking.find((p) => p.booking.id === f.disrupted!.id)?.cash : undefined;
  const nx = f.nextDeadline;

  if (!trip) return { body: 'There’s no trip in this workspace yet. Open the demo controls at the bottom of the page and load the sample trip.' };
  if (/summar|overview|status/.test(x)) {
    if (!f.disrupted) return { body: <>Here’s {name} in short: {f.bookings.length} bookings from {trip.origin.name} to {trip.destination.name}. Nothing needs your attention right now.</>, acts: [['Open the itinerary', `${base}/itinerary`]] };
    return {
      body: (
        <>
          Here’s {name} in short. {f.disrupted.provider} cancelled {f.disrupted.title}, so you’re owed <G m={providerOwed} /> no matter what.{' '}
          {f.approved ? (
            <>You cancelled the rest, and your refunds are being tracked in TripWallet.</>
          ) : (
            <>
              If you cancel the rest now, you get <G m={ct?.expectedCashRecovery} /> back and lose <L m={ct?.forecastCost} />.{' '}
              {nx ? <>You have {hoursLeft(now, nx.d.at)} hours before the {NOUN[nx.booking.kind]} refund drops.</> : <>All refund deadlines have passed.</>}
            </>
          )}
        </>
      ),
      acts: [f.approved ? ['Open TripWallet', `${base}/wallet`] : ['See my options', `${base}/reroute`]],
    };
  }
  if (/refund|money|back|how much/.test(x)) {
    if (!ct) return { body: 'Nothing needs refunding: there’s no active disruption on this trip.', acts: [['Open TripWallet', `${base}/wallet`]] };
    if (f.approved) return {
      body: <>You cancelled the trip, so <G m={ct.expectedCashRecovery} /> is coming back and <L m={ct.forecastCost} /> was lost to fees. TripWallet tracks each refund until it arrives.</>,
      acts: [['Open TripWallet', `${base}/wallet`]],
    };
    return {
      body: (
        <>
          If you cancel now:{' '}
          {f.perBooking.map((p, i) => (
            <span key={p.booking.id}>
              {i ? ', ' : ''}
              {NOUN[p.booking.kind]} <G m={p.cash} />
            </span>
          ))}
          . That’s <G m={ct.expectedCashRecovery} /> back and <L m={ct.forecastCost} /> you can’t recover.
        </>
      ),
      acts: [['See the chart', `${base}/reroute`]],
    };
  }
  if (/deadline|when|time|hurry/.test(x)) {
    if (f.approved) return { body: 'You already cancelled, so refund deadlines no longer apply. TripWallet tracks each refund until it arrives.', acts: [['Open TripWallet', `${base}/wallet`]] };
    if (!f.bookings.length) return { body: `Nothing is booked on ${name} yet, so there are no refund deadlines. A plan you choose isn’t a booking.`, acts: [['Compare plans', `${base}/plan`]] };
    if (!nx) return { body: `There are no upcoming refund deadlines on ${name}.` };
    const drop = nx.before && nx.after && !isUnknown(nx.before) && !isUnknown(nx.after) ? { ...nx.before, amountMinor: nx.before.amountMinor - nx.after.amountMinor } : undefined;
    return {
      body: (
        <>
          Your next deadline is {when(nx.d.at, nx.d.displayTimezone)} for the {NOUN[nx.booking.kind]}. After that you lose <L m={drop} />.
        </>
      ),
      acts: [['Open the calendar', `${base}/itinerary`]],
    };
  }
  if (/cancel/.test(x))
    return f.approved
      ? { body: 'Your trip is already cancelled and each refund is being tracked.', acts: [['Open TripWallet', `${base}/wallet`]] }
      : { body: 'Go to ReRoute, choose “Cancel the whole trip”, then press “Review and confirm”. You’ll see every amount before anything happens.', acts: [['Go to ReRoute', `${base}/reroute`]] };
  if (/plan|book|new trip|another|different/.test(x)) return { body: 'Tell me where and when in Plan, and I’ll compare flights, stays and activities with every cost shown.', acts: [['Open Plan', `${base}/plan`]] };
  const hotel = f.perBooking.find((p) => p.booking.kind === 'hotel');
  if (/hotel/.test(x) && hotel)
    return { body: <>You’re booked at {hotel.booking.title} (paid {wholeMoney(hotel.booking.paid)}). Cancelling now gets <G m={hotel.cash} /> back.</>, acts: [['Open the itinerary', `${base}/itinerary`]] };
  const flight = f.perBooking.find((p) => p.booking.kind === 'flight');
  if (/flight|plane|airline/.test(x) && flight) {
    const q2 = f.continueTrip?.extraCashNeeded;
    return {
      body: (
        <>
          {flight.booking.provider} {f.disrupted?.id === flight.booking.id ? 'cancelled' : 'operates'} {flight.booking.title}. If you cancel, you get <G m={flight.cash} /> back.
          {q2 && !isUnknown(q2) && <> A replacement flight is a sample <L m={q2} />.</>}
        </>
      ),
      acts: [['See options', `${base}/reroute`]],
    };
  }
  if (/voucher|point|credit/.test(x)) {
    const assets = s.assets.filter((a) => a.tripId === null || a.tripId === tripId);
    if (!assets.length) return { body: 'You don’t have any vouchers or points on this trip.' };
    return {
      body: (
        <>
          You have{' '}
          {assets.map((a, i) => (
            <span key={a.id}>
              {i ? ' and ' : ''}
              <b>
                {a.value.unit === 'money' ? `${wholeMoney(a.value.amount)} ${a.issuer} voucher` : `${isUnknown(a.value.quantity) ? 'unknown' : a.value.quantity.toLocaleString('en-US')} ${a.issuer} points`}
              </b>
            </span>
          ))}
          . Neither is cash.
        </>
      ),
      acts: [['Open TripWallet', `${base}/wallet`]],
    };
  }
  return { body: <>I can help with {name}: refunds, deadlines, cancelling, or planning something new. Try one of the suggestions below.</> };
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AskWayFare({ tripId }: { tripId: string | null }) {
  const { load, clock } = useAppServices();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [typing, setTyping] = useState(false);
  const [convo, setConvo] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const pill = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const trip = load.status === 'ready' && tripId ? load.snapshot.trips.find((t) => t.id === tripId) : undefined;

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [convo, typing]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  });

  const openPanel = () => {
    if (!convo.length)
      setConvo([{ who: 'ai', body: `Hi! I’m WayFare. I know ${trip ? `your ${trip.title}` : 'your trips'}, so ask me for a summary, what you’ll get back, or what to do next.` }]);
    setOpen(true);
    setTimeout(() => input.current?.focus(), 0);
  };
  function close() {
    setOpen(false);
    setTimeout(() => pill.current?.focus(), 0);
  }
  const ask = (q: string) => {
    if (!q.trim()) return;
    setConvo((c) => [...c, { who: 'me', body: q }]);
    setTyping(true);
    setTimeout(
      () => {
        setTyping(false);
        const r =
          load.status === 'ready' && tripId
            ? reply(q, load.snapshot, tripId, clock.now())
            : { body: 'There’s no trip in this workspace yet. Open the demo controls at the bottom of the page and load the sample trip.' };
        setConvo((c) => [...c, { who: 'ai', ...r }]);
      },
      reduceMotion() ? 0 : 700,
    );
  };

  if (!open)
    return (
      <button ref={pill} type="button" className="wf-agent-pill" onClick={openPanel}>
        <Icon name="spark" />
        Ask WayFare
      </button>
    );
  return (
    <section className="wf-agent" data-full={full || undefined} aria-label="WayFare assistant">
      <div className="wf-ag-h">
        <Icon name="spark" />
        <b>Ask WayFare</b>
        <button type="button" className="wf-ib" aria-label={full ? 'Shrink conversation' : 'Expand to full conversation'} onClick={() => setFull(!full)}>
          <Icon name="expand" />
        </button>
        <button type="button" className="wf-ib" aria-label="Minimize" onClick={close}>
          <Icon name="minus" />
        </button>
      </div>
      <div className="wf-ag-m" ref={box} aria-live="polite">
        <span className="wf-ag-day">Today</span>
        {convo.map((m, i) => (
          <div key={i} className="wf-msg" data-who={m.who}>
            {m.body}
            {m.acts && m.acts.length > 0 && (
              <div className="wf-msg-acts">
                {m.acts.map(([l, to]) => (
                  <Link
                    key={l}
                    to={to}
                    onClick={(e) => {
                      e.preventDefault();
                      setFull(false);
                      void navigate(to);
                    }}
                  >
                    {l}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="wf-msg wf-typing" data-who="ai" aria-label="WayFare is typing">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div className="wf-sugg">
        {SUGG.map((sg) => (
          <button key={sg} type="button" onClick={() => ask(sg)}>
            {sg}
          </button>
        ))}
      </div>
      <form
        className="wf-ag-in"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
          setText('');
        }}
      >
        <label htmlFor="wf-agq" className="wf-visually-hidden">
          Message
        </label>
        <input id="wf-agq" ref={input} placeholder="Type your message…" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="Send">
          <Icon name="send" />
        </button>
      </form>
      <p className="wf-ag-note">Demo replies, written from this trip’s data. No AI model is used.</p>
    </section>
  );
}
