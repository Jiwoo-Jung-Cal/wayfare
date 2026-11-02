import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { appError, formatInstant, type AppError, type FeaturePageProps, type RecoveryOption } from '../../core/index.ts';
import { Button, Card, EmptyState, ErrorState, KeyValue, LoadingState, MoneyText, Notice, StatusBadge } from '../../ui/index.tsx';
import { loadComparison, triggerDemoDisruption, type Comparison } from './model.ts';
import { approveRecovery, prepareApproval, type ApprovalPreview, type ApprovalResult } from './actions.ts';
import './reroute.css';

export function ReRoutePage({ tripId, ctx }: FeaturePageProps) {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ApprovalPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const [resultKind, setResultKind] = useState<RecoveryOption['kind']>('cancel_trip');
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
  return <div className="wf-stack wf-reroute">
    <h1>ReRoute</h1>
    <p className="wf-muted">Compare recovery choices using reviewed policies and the active clock.</p>
    {loading && <LoadingState label="Calculating recovery options…" />}
    {!loading && error && (error.code === 'precondition_failed'
      ? <EmptyState title="No supported disruption to compare"><p>Import the flight booking, then trigger the simulated cancellation.</p><Button onClick={() => void trigger()}>Simulate flight cancellation</Button><Link to={`../import`}>Import bookings</Link></EmptyState>
      : <ErrorState error={error} onRetry={() => setAttempt(n => n + 1)} />)}
    {data && <>
      <Card title={data.disruption.description}>
        <StatusBadge tone="simulated">Simulated disruption</StatusBadge>
        <p>Detected {formatInstant(data.disruption.detectedAt)} · Active clock {ctx.clock.now()}</p>
        <details><summary>Disruption evidence</summary><blockquote>{data.snapshot.documents.find(d => d.id === data.disruption.sourceDocumentId)?.text ?? 'Source unavailable'}</blockquote></details>
      </Card>
      <section className="wf-stack wf-reroute-bookings" aria-label="Affected bookings">
        <h2>Affected bookings</h2>
        {data.impacts.map(i => <Card key={i.booking.id} title={i.booking.title}>
          <StatusBadge tone={i.affected ? 'warning' : 'neutral'}>{i.booking.id === data.disruption.bookingId ? 'Disrupted' : i.booking.state} · {i.affected ? 'May be affected' : 'Unaffected'}</StatusBadge>
          <p>{i.reason}</p><KeyValue label="Originally paid" value={<MoneyText value={i.booking.paid} />} />
          <details><summary>Inspect policy and dependency evidence</summary><p>Booking {i.booking.id} · dependencies: {i.booking.dependsOn.join(', ') || 'None'}</p>
            {data.snapshot.policies.filter(p => p.id === i.booking.policyId).map(p => <div key={p.id}><p>{p.reviewState} · {p.id}</p>{p.excerpts.map(e => <blockquote key={e.id}>{e.text}</blockquote>)}</div>)}
          </details>
        </Card>)}
      </section>
      <section className="wf-reroute-options" aria-label="Recovery comparison">
        {data.options.map(o => <Card key={o.id} title={o.label} as="article">
          <StatusBadge tone={o.constraints.length ? 'warning' : 'simulated'}>{o.constraints.length ? 'Review needed' : 'Simulated recovery'}</StatusBadge>
          {o.bookingActions.filter(a => a.action !== 'keep').map(a => <KeyValue key={a.bookingId} label={`${data.impacts.find(i => i.booking.id === a.bookingId)?.booking.title} · ${a.action}`} value={<MoneyText value={a.expectedRecovery} />} />)}
          <KeyValue label="Extra cash needed now" value={<MoneyText value={o.extraCashNeeded} />} />
          <KeyValue label="Expected cash refunds" value={<MoneyText value={o.expectedCashRecovery} />} />
          <KeyValue label="Cash paid before refunds arrive" value={<MoneyText value={o.cashPaidBeforeRefunds} />} emphasis="muted" />
          <KeyValue label={o.kind === 'continue' ? 'Forecast trip cost after expected refund' : 'Unrecovered original cost'} value={<MoneyText value={o.forecastCost} />} emphasis="total" />
          {o.noncashEffects.map(n => <p className="wf-muted" key={n.assetId}>{n.description}</p>)}
          {o.constraints.length > 0 && <Notice tone="warning"><ul>{o.constraints.map(c => <li key={c}>{c}</li>)}</ul><Link to="../import">Review policy in intake</Link></Notice>}
          <details><summary>Assumptions, sources and validity</summary><ul>{o.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>Computed {o.computedAt} · Valid until {o.validUntil ?? 'source changes'}</p><p>Evidence: {o.evidenceDocumentIds.join(', ')}</p></details>
          <Button variant={o.kind === 'cancel_trip' ? 'danger' : 'secondary'} disabled={busy || o.constraints.length > 0 || o.bookingActions.filter(a => a.action !== 'keep').every(a => data.snapshot.actions.some(saved => saved.bookingId === a.bookingId && saved.disruptionId === o.disruptionId && saved.action === a.action && saved.result.status === 'simulated'))} onClick={() => void review(o.kind)}>{o.kind === 'cancel_trip' ? 'Review cancel-trip actions' : 'Choose continue'}</Button>
        </Card>)}
      </section>
      <Card title="CancelClock">
        <p>Deadlines use the active clock. At exactly a cutoff, the later refund tier applies.</p>
        {data.deadlines.map(d => <div className="wf-reroute-deadline wf-stack" key={`${d.booking.id}-${d.at}`}>
          <div className="wf-row"><strong>{d.booking.title}</strong><StatusBadge tone={d.status === 'Passed' || d.status === 'Unknown' ? 'warning' : 'neutral'}>{d.status}</StatusBadge></div>
          <p>{d.label}</p>{d.at && <p>{formatInstant(d.at, d.timezone)} · <span className="wf-mono">{d.at}</span>{d.status !== 'Passed' && ` · ${Math.max(0, Math.ceil((Date.parse(d.at) - Date.parse(ctx.clock.now())) / 3600_000))} hours left`}</p>}
          <p className="wf-muted">Source: {d.source}</p><KeyValue label="Before cutoff (cash)" value={<MoneyText value={d.before} />} /><KeyValue label="At or after cutoff (cash)" value={<MoneyText value={d.after} />} />
        </div>)}
      </Card>
      <Card title="Recorded actions">
        <p>Durable simulated outcomes; these are not provider confirmations or refund receipts.</p>
        {data.snapshot.actions.filter(a => a.tripId === tripId).map(a => <div key={a.id} className="wf-stack"><strong>{data.impacts.find(i => i.booking.id === a.bookingId)?.booking.title} · {a.action}</strong><StatusBadge tone="simulated">{a.result.status} · action recorded</StatusBadge><p>{a.result.detail}</p>{a.expectedRecovery.map(c => <KeyValue key={c.id} label={c.kind} value={c.value.unit === 'money' ? <MoneyText value={c.value.amount} /> : 'Points'} />)}</div>)}
        {!data.snapshot.actions.some(a => a.tripId === tripId) && <p>No actions recorded.</p>}
        <Link to="../wallet">Open TripWallet</Link>
      </Card>
      {result && <Card title={result.outcomes.some(o => o.status === 'failed' || o.status === 'stale') ? 'Some actions are not recorded' : 'Simulated actions recorded'}>
        <div role="status">{result.outcomes.filter(o => o.status === 'recorded' || o.status === 'already_recorded').length} recorded; {result.outcomes.filter(o => o.status === 'failed' || o.status === 'stale').length} unfinished.</div>
        {result.outcomes.map(o => <div key={o.bookingId}><strong>{o.bookingId}: {o.status.replaceAll('_', ' ')}</strong>{o.error && <ErrorState error={o.error} />}{o.notificationPending && <Notice tone="warning">Action preserved. Claim notification pending; open TripWallet to retry synchronization.</Notice>}</div>)}
        {result.outcomes.some(o => o.status === 'failed' || o.status === 'stale') && <Button disabled={busy} onClick={() => void review(resultKind)}>Review unfinished actions for retry</Button>}
        <p>Claim synchronization is separate. Check the shell notice and TripWallet for actual claim status.</p>
      </Card>}
      <Notice>Expected refunds are not receipts. Vouchers and points remain separate from cash.</Notice>
    </>}
    {preview && <dialog ref={dialog} className="wf-reroute-dialog" aria-labelledby="reroute-approval-title" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="wf-stack">
        <h2 id="reroute-approval-title">Approve {preview.option.bookingActions.filter(a => a.action !== 'keep' && !preview.comparison.snapshot.actions.some(saved => saved.bookingId === a.bookingId && saved.disruptionId === preview.option.disruptionId && saved.action === a.action && saved.result.status === 'simulated')).length} {preview.option.kind === 'cancel_trip' ? 'cancel-trip' : 'replacement'} actions?</h2>
        <Notice tone="simulated">These actions are simulated. Approval does not prove a real cancellation, purchase, or refund.</Notice>
        {staleMessage && <Notice tone="warning">The preview changed or expired. Review the updated consequences and confirm again. Previously recorded actions are preserved.</Notice>}
        {error && <ErrorState error={error} />}
        {preview.option.bookingActions.filter(a => a.action !== 'keep').map(a => <KeyValue key={a.bookingId} label={`${preview.comparison.impacts.find(i => i.booking.id === a.bookingId)?.booking.title} · ${a.action}`} value={<MoneyText value={a.expectedRecovery} />} />)}
        <KeyValue label="Extra cash needed (simulated)" value={<MoneyText value={preview.option.extraCashNeeded} />} />
        <KeyValue label="Expected cash refunds, including recorded outcomes" value={<MoneyText value={preview.option.expectedCashRecovery} />} emphasis="total" />
        <KeyValue label="Forecast cost / unrecovered cost" value={<MoneyText value={preview.option.forecastCost} />} />
        {preview.option.noncashEffects.map(n => <p key={n.assetId}>{n.description}</p>)}
        {preview.option.constraints.length > 0 && <Notice tone="warning">{preview.option.constraints.join(' ')}</Notice>}
        <label className="wf-row"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />I understand these are simulated actions</label>
        <div className="wf-row"><Button disabled={busy} onClick={close}>Cancel</Button><Button variant="danger" disabled={busy || !acknowledged || preview.option.constraints.length > 0} onClick={() => void approve()}>{busy ? 'Recording actions…' : 'Approve actions'}</Button></div>
      </div>
    </dialog>}
  </div>;
}
