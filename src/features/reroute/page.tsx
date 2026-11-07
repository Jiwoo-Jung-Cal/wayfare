// ReRoute page, design r2-final (Figma 68:403; reference design/exports/prototype/r2 "reroute").
// Visual layer by Agent 1 under Jiwoo's design-implementation scope; logic is unchanged:
// loadComparison / prepareApproval / approveRecovery (atomic preconditions, stale preview,
// partial failure and retry) are Agent 4's. The chart evaluates ReRoute's own
// computeComparison at each deadline; nothing here recalculates refunds.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { appError, isUnknown, type AppError, type FeaturePageProps, type Instant, type MaybeMoney, type RecoveryOption } from '../../core/index.ts';
import { Button, EmptyState, ErrorState, LoadingState, MoneyText, Notice } from '../../ui/index.tsx';
import { Icon } from '../../ui/icons.tsx';
import { computeComparison, loadComparison, triggerDemoDisruption, type Comparison } from './model.ts';
import { approveRecovery, prepareApproval, type ApprovalPreview, type ApprovalResult } from './actions.ts';
import './reroute.css';

const whole = (m: MaybeMoney | undefined) => {
  if (!m || isUnknown(m)) return 'Unknown';
  const w = m.amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, minimumFractionDigits: w ? 0 : 2, maximumFractionDigits: w ? 0 : 2 }).format(Math.abs(m.amountMinor) / 100);
};
const minor = (m: MaybeMoney | undefined) => (m && !isUnknown(m) ? m.amountMinor : null);
const fmt = (at: Instant, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(new Date(at));
const recordedFor = (data: Comparison, o: RecoveryOption) =>
  o.bookingActions
    .filter((a) => a.action !== 'keep')
    .every((a) => data.snapshot.actions.some((s) => s.bookingId === a.bookingId && s.disruptionId === o.disruptionId && s.action === a.action && s.result.status === 'simulated'));

function lineLabel(data: Comparison, bookingId: string) {
  const b = data.impacts.find((i) => i.booking.id === bookingId)!.booking;
  if (b.kind === 'flight') return b.id === data.disruption.bookingId ? 'Flight (airline cancelled)' : 'Flight';
  if (b.kind === 'hotel') return 'Hotel';
  if (b.kind === 'transfer') return 'Airport ride';
  return b.title.replace(/^Lower Manhattan /, '');
}

/**
 * Deadline labels sit beside their dotted line, never across it or across a neighbour's line or
 * label: right of the line when there is room, otherwise left, otherwise one row lower.
 */
type MarkIn = { key: string; x: number; y: number; text: string };
export function placeMarks(marks: MarkIn[], minX: number, maxX: number) {
  const GAP = 6, ROW = 16, CHAR = 6.4; // 600 11px Figtree is about 6.4 px per character
  const lines = marks.map((m) => m.x);
  const boxes: { l: number; r: number; y: number }[] = [];
  const clear = (l: number, r: number, y: number) =>
    l >= minX - 50 && r <= maxX + 14
    && lines.every((x) => x < l - 2 || x > r + 2)
    && boxes.every((b) => Math.abs(b.y - y) >= 14 || b.r + 4 < l || r + 4 < b.l);
  return marks.map((m) => {
    const w = m.text.length * CHAR;
    for (let row = 0; row < 4; row++) {
      const y = m.y + row * ROW;
      const right = { l: m.x + GAP, r: m.x + GAP + w };
      const left = { l: m.x - GAP - w, r: m.x - GAP };
      for (const [side, b] of [['start', right], ['end', left]] as const) {
        if (clear(b.l, b.r, y)) {
          boxes.push({ ...b, y });
          return { ...m, lineX: m.x, textX: side === 'start' ? b.l : b.r, y, anchor: side };
        }
      }
    }
    boxes.push({ l: m.x + GAP, r: m.x + GAP + w, y: m.y });
    return { ...m, lineX: m.x, textX: m.x + GAP, y: m.y, anchor: 'start' as const };
  });
}

/** Money back if you cancel at time t, from ReRoute's comparison (piecewise constant between deadlines). */
export function MoneyChart({ data, now, tz }: { data: Comparison; now: Instant; tz: string }) {
  const H = 72;
  const X0 = 56, X1 = 620, Y0 = 24, Y1 = 206;
  const series = useMemo(() => {
    const t0 = Date.parse(now);
    // Recorded recoveries survive later cutoffs. Do not label their historical
    // policy deadlines as future losses on the preserved comparison line.
    const settled = new Set(data.snapshot.actions.filter(a => a.tripId === data.tripId
      && a.disruptionId === data.disruption.id && (a.action === 'cancel' || a.action === 'replace')
      && (a.result.status === 'simulated' || a.result.status === 'provider_confirmed')).map(a => a.bookingId));
    const marks = data.deadlines
      .filter(d => !settled.has(d.booking.id))
      .filter((d) => d.at && Date.parse(d.at) > t0 && Date.parse(d.at) <= t0 + H * 3_600_000)
      .map((d) => ({ d, h: (Date.parse(d.at!) - t0) / 3_600_000 }));
    const at = (h: number) => {
      const r = computeComparison(data.snapshot, data.tripId, new Date(t0 + h * 3_600_000).toISOString().replace('.000', '') as Instant);
      return r.ok ? minor(r.value.options.find((o) => o.kind === 'cancel_trip')?.expectedCashRecovery) : null;
    };
    const points = [{ h: 0, v: at(0) }, ...marks.map((m) => ({ h: m.h, v: at(m.h) }))];
    return { marks, points };
  }, [data, now]);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const paid = minor(data.options.find((o) => o.kind === 'cancel_trip')?.cashPaidBeforeRefunds) ?? 0;
  const top = Math.max(paid, 1);
  const X = (h: number) => X0 + (h / H) * (X1 - X0);
  const Y = (v: number) => Y1 - (v / top) * (Y1 - Y0);
  if (series.points.some((p) => p.v === null)) return <p className="wf-muted">The amount over time is unknown until every policy is reviewed.</p>;
  const pts = series.points as { h: number; v: number }[];
  let path = `M${X(0)} ${Y(pts[0]!.v)}`;
  for (const p of pts.slice(1)) path += ` H${X(p.h).toFixed(1)} V${Y(p.v).toFixed(1)}`;
  path += ` H${X(H)}`;
  const valueAt = (h: number) => [...pts].reverse().find((p) => p.h <= h)!.v;
  const hover = hoveredHour === null ? null : { h: hoveredHour, v: valueAt(hoveredHour) };
  const ticks = [0, Math.round(top / 3 / 10000) * 100, Math.round((2 * top) / 3 / 10000) * 100, top / 100];
  const cur = data.options.find(o => o.kind === 'cancel_trip')!.expectedCashRecovery;
  const currency = isUnknown(cur) ? 'USD' : cur.currency;
  const m0 = (v: number) => whole({ amountMinor: v, currency });
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * 640;
    const h = Math.max(0, Math.min(H, ((sx - X0) / (X1 - X0)) * H));
    setHoveredHour(h);
  };
  return (
    <div className="wf-rr-chart">
      <svg viewBox="0 0 640 250" role="img" aria-label={`Money back over the next 72 hours: ${pts.map((p) => `${p.h === 0 ? 'now' : fmt(new Date(Date.parse(now) + p.h * 3_600_000).toISOString(), tz, { weekday: 'short', hour: 'numeric' })} ${m0(p.v)}`).join(', ')}`}>
        <defs>
          <linearGradient id="wf-rr-ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--wf-color-positive)', stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: 'var(--wf-color-positive)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <g className="wf-rr-axis">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={X0} x2={X1} y1={Y(v * 100)} y2={Y(v * 100)} />
              <text x={X0 - 8} y={Y(v * 100) + 4} textAnchor="end">
                {m0(v * 100)}
              </text>
            </g>
          ))}
          {[0, 24, 48, 72].map((h) => (
            <text key={h} x={X(h)} y={Y1 + 22} textAnchor={h === 0 ? 'start' : h === 72 ? 'end' : 'middle'}>
              {h === 0 ? 'Now' : fmt(new Date(Date.parse(now) + h * 3_600_000).toISOString(), tz, { weekday: 'short', hour: 'numeric' })}
            </text>
          ))}
        </g>
        <text x={X1} y={Y(top) - 8} textAnchor="end" className="wf-rr-paid">
          You paid {m0(paid)}
        </text>
        <path d={`${path} V${Y(0)} H${X(0)}Z`} fill="url(#wf-rr-ga)" />
        <path d={path} fill="none" className="wf-rr-line" strokeWidth="2.5" strokeLinejoin="round" />
        {placeMarks(series.marks.map((m) => {
          const drop = (minor(m.d.before) ?? 0) - (minor(m.d.after) ?? 0);
          const name = m.d.booking.kind === 'hotel' ? 'Hotel' : m.d.booking.kind === 'transfer' ? 'Ride' : m.d.booking.kind === 'activity' ? 'Walk' : 'Flight';
          return { key: `${m.d.booking.id}-${m.d.at}`, x: X(m.h), y: Y(valueAt(m.h + 0.001)) + 18, text: `${name} −${m0(drop)}` };
        }), X0, X1).map((l) => (
          <g key={l.key}>
            <line x1={l.lineX} x2={l.lineX} y1={Y(top) + 4} y2={Y1} className="wf-rr-dl" strokeDasharray="3 4" />
            <text x={l.textX} y={l.y} textAnchor={l.anchor} className="wf-rr-mark">{l.text}</text>
          </g>
        ))}
        {hover && (
          <g>
            <line x1={X(hover.h)} x2={X(hover.h)} y1={Y(top)} y2={Y1} className="wf-rr-cross" />
            <circle cx={X(hover.h)} cy={Y(hover.v)} r="5" className="wf-rr-dot" strokeWidth="2" />
          </g>
        )}
        <circle cx={X(0)} cy={Y(pts[0]!.v)} r="5" className="wf-rr-dot" strokeWidth="2" />
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHoveredHour(null)} />
      </svg>
      {hover && (
        <div className="wf-rr-tip" style={{
          left: `${(X(hover.h) / 640) * 100}%`, top: `${(Y(hover.v) / 250) * 100}%`,
          // Move the anchor through the tooltip as it moves through the chart.
          // With max-width:100%, both edges stay within the chart at any width.
          transform: `translate(-${(X(hover.h) / 640) * 100}%, -125%)`,
        }}>
          {hover.h < 0.5 ? 'Now' : fmt(new Date(Date.parse(now) + hover.h * 3_600_000).toISOString(), tz, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · <b>+{m0(hover.v)}</b> back · −{m0(paid - hover.v)} lost
        </div>
      )}
    </div>
  );
}

export function ReRoutePage({ tripId, ctx }: FeaturePageProps) {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ApprovalPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const [resultKind, setResultKind] = useState<RecoveryOption['kind']>('cancel_trip');
  const [choice, setChoice] = useState<RecoveryOption['kind']>('cancel_trip');
  const [busy, setBusy] = useState(false);
  const [staleMessage, setStaleMessage] = useState(false);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { if (preview && !dialog.current?.open) dialog.current?.showModal(); }, [preview]);
  const review = async (kind: RecoveryOption['kind']) => {
    opener.current = document.activeElement as HTMLElement;
    setBusy(true); setError(null); setAcknowledged(false); setStaleMessage(false);
    try {
      const r = await prepareApproval(tripId, kind, ctx);
      if (r.ok) { setPreview(r.value); setData(r.value.comparison); } else setError(r.error);
    } catch (e) { setError(appError('unavailable', String(e))); }
    finally { setBusy(false); }
  };
  const close = () => { if (inFlight.current) return; dialog.current?.close(); setPreview(null); setAcknowledged(false); opener.current?.focus(); };
  const approve = async () => {
    if (!preview || !acknowledged || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const r = await approveRecovery(preview, ctx);
      if (!r.ok) setError(r.error);
      else {
        setResult(r.value); setResultKind(preview.option.kind);
        if (r.value.stale) {
          const refreshed = await prepareApproval(tripId, preview.option.kind, ctx);
          if (refreshed.ok) { setPreview(refreshed.value); setData(refreshed.value.comparison); }
          else setError(refreshed.error);
          setStaleMessage(true); setAcknowledged(false);
        } else { dialog.current?.close(); setPreview(null); setAcknowledged(false); opener.current?.focus(); }
      }
      await ctx.refresh(); setAttempt(n => n + 1);
    } catch (e) { setError(appError('unavailable', String(e))); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadComparison(tripId, ctx).then(r => {
      if (!active) return;
      setData(r.ok ? r.value : null); setError(r.ok ? null : r.error); setLoading(false);
    }).catch(e => { if (active) { setError(appError('internal', String(e))); setLoading(false); } });
    return () => { active = false; };
  }, [tripId, ctx, attempt]);
  const trigger = async () => {
    setLoading(true);
    const r = await triggerDemoDisruption({ tripId }, ctx);
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    await ctx.refresh(); setAttempt(n => n + 1);
  };

  const now = ctx.clock.now();
  const cancel = data?.options.find((o) => o.kind === 'cancel_trip');
  const keep = data?.options.find((o) => o.kind === 'continue');
  const root = data?.impacts.find((i) => i.booking.id === data.disruption.bookingId)?.booking;
  const rootCash = cancel?.bookingActions.find((a) => a.bookingId === root?.id)?.expectedRecovery;
  const tripActions = data?.snapshot.actions.filter((a) => a.tripId === tripId && a.disruptionId === data.disruption.id) ?? [];
  const cancelDone = !!(data && cancel && recordedFor(data, cancel));
  const keepDone = !!(data && keep && recordedFor(data, keep) && keep.bookingActions.some((a) => a.action !== 'keep'));
  const done = cancelDone || keepDone;
  const selected = done ? (cancelDone ? 'cancel_trip' : 'continue') : choice;
  const nextDl = data?.deadlines.find((d) => d.at && Date.parse(d.at) > Date.parse(now) && (d.booking.state !== 'cancelled' && d.booking.state !== 'replaced'));
  const hoursLeft = nextDl?.at ? Math.floor((Date.parse(nextDl.at) - Date.parse(now)) / 3_600_000) : null;
  const unfinished = result?.outcomes.filter((o) => o.status === 'failed' || o.status === 'stale') ?? [];
  const recordedCount = (result?.outcomes.filter((o) => o.status === 'recorded' || o.status === 'already_recorded').length) ?? 0;
  const tz = root?.localTimezone ?? 'America/New_York';
  const chosen = selected === 'cancel_trip' ? cancel : keep;
  const replacement = keep && data ? data.snapshot.quotes.find((q) => q.id === keep.bookingActions.find((a) => a.action === 'replace')?.replacementQuoteId) : undefined;
  const remaining = preview ? preview.option.bookingActions.filter((a) => a.action !== 'keep' && !preview.comparison.snapshot.actions.some((s) => s.bookingId === a.bookingId && s.disruptionId === preview.option.disruptionId && s.action === a.action && s.result.status === 'simulated')).length : 0;
  const onChoiceKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (done || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 'cancel_trip' : e.key === 'End' ? 'continue'
      : selected === 'cancel_trip' ? 'continue' : 'cancel_trip';
    setChoice(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-choice="${next}"]`)?.focus();
  };
  const total = preview ? preview.option.bookingActions.filter((a) => a.action !== 'keep').length : 0;

  return <div className="wf-reroute">
    <header className="wf-rr-vh">
      <h1>What should you do?</h1>
      <p>{data ? `Your ${root?.kind === 'flight' ? 'flight' : 'booking'} is cancelled, so you have two choices. Nothing happens until you confirm.` : 'Compare recovery choices using reviewed policies and the active clock.'}</p>
    </header>
    {loading && <LoadingState label="Calculating recovery options…" />}
    {!loading && error && !preview && (error.code === 'precondition_failed'
      ? <EmptyState title="No supported disruption to compare"><p>Import the flight booking, then trigger the simulated cancellation.</p><Button onClick={() => void trigger()}>Simulate flight cancellation</Button><Link relative="path" to="../import">Import bookings</Link></EmptyState>
      : <ErrorState error={error} onRetry={() => setAttempt(n => n + 1)} />)}
    {data && cancel && keep && root && <>
      <div className="wf-rr-what">
        <Icon name="alert" />
        <div>
          <b>{root.provider} cancelled {root.kind === 'flight' ? `flight ${/^[A-Z0-9]{2}\s?\d+/.exec(root.title)?.[0] ?? root.title}` : root.title}</b>
          <p>
            It was due to leave {data.snapshot.trips.find((t) => t.id === tripId)?.origin.name ?? 'on time'} on {fmt(root.startsAt, root.localTimezone, { weekday: 'long' })} at {fmt(root.startsAt, root.localTimezone, { hour: 'numeric', minute: '2-digit' })}.{' '}
            {minor(rootCash) ? <>The {root.kind === 'flight' ? 'airline' : 'provider'} owes you the full <span className="wf-gain">+{whole(rootCash)}</span> either way.</> : null}
            {data.disruption.capability === 'simulated' && <span className="wf-tag-inline">Simulated</span>}
          </p>
        </div>
      </div>

      <div className="wf-reroute-options" role="radiogroup" aria-label="Your options" onKeyDown={onChoiceKeyDown}>
        <button type="button" role="radio" data-choice="cancel_trip" tabIndex={selected === 'cancel_trip' ? 0 : -1} className="wf-rr-opt" aria-checked={selected === 'cancel_trip'} disabled={done && selected !== 'cancel_trip'} onClick={() => !done && setChoice('cancel_trip')}>
          <span className="wf-rr-rad" aria-hidden="true" />
          <h3>Cancel the whole trip</h3>
          <div><span className="wf-big wf-num wf-gain">+{whole(cancel.expectedCashRecovery)}</span> <span className="wf-muted">back to you</span><span className="wf-exp">Expected</span></div>
          <ul>
            <li><Icon name="check" /><span>You lose <b className="wf-loss">−{whole(cancel.forecastCost)}</b> in fees you can’t get back</span></li>
            <li><Icon name="check" /><span>{cancelDone ? 'Cancellation recorded; refunds are tracked in TripWallet' : hoursLeft !== null ? `Do it in the next ${hoursLeft} hours to get the most back` : 'The refund deadlines have passed, so you get a little less'}</span></li>
          </ul>
          {cancel.constraints.length > 0 && <span className="wf-rr-warn">Review needed: {cancel.constraints[0]}</span>}
        </button>
        <button type="button" role="radio" data-choice="continue" tabIndex={selected === 'continue' ? 0 : -1} className="wf-rr-opt" aria-checked={selected === 'continue'} disabled={done && selected !== 'continue'} onClick={() => !done && setChoice('continue')}>
          <span className="wf-rr-rad" aria-hidden="true" />
          <h3>Keep the trip</h3>
          <div><span className="wf-big wf-num wf-loss">−{whole(keep.extraCashNeeded)}</span> <span className="wf-muted">for a new {root.kind === 'flight' ? 'flight' : 'booking'}</span></div>
          <ul>
            <li><Icon name="check" /><span>You still get <b className="wf-gain">+{whole(rootCash)}</b> back for the cancelled {root.kind === 'flight' ? 'flight' : 'booking'}</span></li>
            <li><Icon name="check" /><span>{replacement ? `${replacement.description.replace(/,.*$/, '')} instead (sample price). Hotel and plans stay.` : 'Replacement quote unavailable.'}</span></li>
          </ul>
          {keep.constraints.length > 0 && <span className="wf-rr-warn">Review needed: {keep.constraints[0]}</span>}
        </button>
      </div>

      {chosen && chosen.constraints.length > 0 && <Notice tone="warning">
        <p>{chosen.constraints.join(' ')}</p>
        <Link relative="path" to="../import">Review policy in intake</Link>
      </Notice>}

      <div className="wf-rr-chart-card">
        <div>
          <h3>How much comes back if you cancel later</h3>
          <p className="wf-muted">Each step down is a refund deadline for an unrecorded action. Recorded refunds stay unchanged. Hover or drag along the line to see any moment.</p>
          <MoneyChart data={data} now={now} tz="America/New_York" />
        </div>
        <div>
          <span className="wf-label-mono">{cancelDone ? 'Recorded refunds' : 'If you cancel now'}</span>
          <div className="wf-rr-kv wf-num">
            {cancel.bookingActions.filter((a) => a.action !== 'keep').map((a) => (
              <div key={a.bookingId}><span>{lineLabel(data, a.bookingId)}</span><span className={minor(a.expectedRecovery) ? 'wf-gain' : ''}>{minor(a.expectedRecovery) ? '+' : ''}<MoneyText value={a.expectedRecovery} /></span></div>
            ))}
            <div className="wf-rr-tot"><span>Back to you</span><span className="wf-gain">+<MoneyText value={cancel.expectedCashRecovery} /></span></div>
            <div><span>Can’t be recovered</span><span className="wf-loss">−<MoneyText value={cancel.forecastCost} /></span></div>
          </div>
          {(() => {
            const assets = data.snapshot.assets.filter((a) => (a.tripId === null || a.tripId === tripId) && a.status === 'available');
            if (!assets.length) return null;
            const names = assets.map((a) => (a.value.unit === 'money' ? `${whole(a.value.amount)} ${a.issuer} ${a.kind === 'points' ? 'credit' : 'voucher'}` : `${isUnknown(a.value.quantity) ? 'unknown' : a.value.quantity.toLocaleString('en-US')} ${a.issuer.replace(/ Rewards$/, '')} points`));
            return <p className="wf-muted wf-rr-note">Your {names.join(' and ')} stay as they are. They aren’t cash, so they’re not counted.</p>;
          })()}
        </div>
      </div>

      {unfinished.length > 0 && result && <div className="wf-rr-result" role="alert">
        <h2>Some actions are not recorded</h2>
        <div role="status">{recordedCount} recorded; {unfinished.length} unfinished.</div>
        {result.outcomes.filter((o) => o.error).map((o) => <ErrorState key={o.bookingId} error={o.error!} />)}
        <Button disabled={busy} onClick={() => void review(resultKind)}>Review unfinished actions for retry</Button>
      </div>}
      {result?.outcomes.some((o) => o.notificationPending) && <Notice tone="warning">Action preserved. Claim notification pending; open TripWallet to retry synchronization.</Notice>}

      <div className="wf-rr-foot">
        <span className="wf-muted" role="status">
          {done ? `${tripActions.length} ${cancelDone ? 'cancellation' : 'action'}${tripActions.length === 1 ? '' : 's'} recorded.` : 'You’ll review everything before anything is cancelled.'}
        </span>
        {done && <Link className="wf-button" relative="path" to="../wallet">Open TripWallet</Link>}
        <button type="button" className="wf-button" data-variant="dark" disabled={busy || done || !chosen || chosen.constraints.length > 0} onClick={() => void review(selected)}>
          {done ? (cancelDone ? 'Trip cancelled' : 'Trip kept') : selected === 'continue' ? 'Keep the trip' : 'Review and confirm'}
        </button>
      </div>

      <details className="wf-rr-details">
        <summary>Details and sources</summary>
        <div className="wf-stack">
          <h3>What happened</h3>
          <p>{data.disruption.description} · detected {fmt(data.disruption.detectedAt, tz, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>
          <blockquote>{data.snapshot.documents.find((d) => d.id === data.disruption.sourceDocumentId)?.text ?? 'Source unavailable'}</blockquote>
          <h3>Bookings</h3>
          <ul>{data.impacts.map((i) => <li key={i.booking.id}><b>{i.booking.title}</b> · {i.affected ? 'may be affected' : 'unaffected'} · {i.reason}</li>)}</ul>
          <h3>Refund deadlines</h3>
          <p>Policy amounts below describe new cancellations. Previously recorded refunds stay unchanged.</p>
          <ul>{data.deadlines.map((d) => <li key={`${d.booking.id}-${d.at}`}><b>{d.booking.title}</b> · {d.label}{d.at ? ` · ${fmt(d.at, d.timezone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : ''} · {d.status} · before <MoneyText value={d.before} />, at or after <MoneyText value={d.after} /> · Source: {d.source}</li>)}</ul>
          <h3>Assumptions</h3>
          <ul>{(chosen ?? cancel).assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          <p className="wf-muted">Computed {cancel.computedAt} · valid until {cancel.validUntil ?? 'source changes'} · expected refunds are forecasts, not receipts.</p>
        </div>
      </details>
    </>}

    {preview && <dialog ref={dialog} className="wf-reroute-dialog" aria-labelledby="reroute-approval-title" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="wf-stack">
        <h2 id="reroute-approval-title">{preview.option.kind === 'cancel_trip' ? 'Cancel the trip?' : 'Keep the trip?'}</h2>
        <p className="wf-muted">
          {preview.option.kind === 'cancel_trip'
            ? `We’ll record ${remaining} cancellation${remaining === 1 ? '' : 's'} and start tracking your refunds. In this demo nothing is sent to a real company.`
            : 'We’ll record the replacement and keep your other bookings. In this demo nothing is sent to a real company.'}
          {remaining < total && ` ${total - remaining} already recorded; ${remaining} left to record.`}
        </p>
        {staleMessage && <Notice tone="warning">The preview changed or expired. Review the updated consequences and confirm again. Previously recorded actions are preserved.</Notice>}
        {error && <ErrorState error={error} />}
        <div className="wf-rr-kv wf-num">
          {preview.option.bookingActions.filter((a) => a.action !== 'keep').map((a) => (
            <div key={a.bookingId}><span>{preview.comparison.impacts.find((i) => i.booking.id === a.bookingId)?.booking.title}{a.action === 'replace' ? ' · replace' : ''}</span><span className={minor(a.expectedRecovery) ? 'wf-gain' : ''}>{minor(a.expectedRecovery) ? '+' : ''}<MoneyText value={a.expectedRecovery} /></span></div>
          ))}
          {preview.option.kind === 'continue' && <div><span>New flight (sample price)</span><span className="wf-loss">−<MoneyText value={preview.option.extraCashNeeded} /></span></div>}
          <div className="wf-rr-tot"><span>Back to you</span><span className="wf-gain">+<MoneyText value={preview.option.expectedCashRecovery} /></span></div>
          <div><span>{preview.option.kind === 'cancel_trip' ? 'Lost to fees' : 'Trip cost after refunds'}</span><span className="wf-loss">{preview.option.kind === 'cancel_trip' ? '−' : ''}<MoneyText value={preview.option.forecastCost} /></span></div>
        </div>
        {preview.option.noncashEffects.map(n => <p className="wf-muted" key={n.assetId}>{n.description}</p>)}
        {preview.option.constraints.length > 0 && <Notice tone="warning">{preview.option.constraints.join(' ')}</Notice>}
        <label className="wf-row wf-rr-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />I understand these are simulated actions</label>
        <div className="wf-row wf-rr-rb">
          <button type="button" className="wf-button" disabled={busy} onClick={close}>Go back</button>
          <button type="button" className="wf-button" data-variant="dark" disabled={busy || !acknowledged || preview.option.constraints.length > 0} onClick={() => void approve()}>
            {busy ? 'Recording actions…' : preview.option.kind === 'cancel_trip' ? 'Cancel the trip' : 'Keep the trip'}
          </button>
        </div>
      </div>
    </dialog>}
  </div>;
}
