import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { appError, formatInstant, type AppError, type FeaturePageProps } from '../../core/index.ts';
import { Button, Card, EmptyState, ErrorState, KeyValue, LoadingState, MoneyText, Notice, StatusBadge } from '../../ui/index.tsx';
import { loadComparison, triggerDemoDisruption, type Comparison } from './model.ts';
import './reroute.css';

export function ReRoutePage({ tripId, ctx }: FeaturePageProps) {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
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
    {!loading && data && <>
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
          <p className="wf-muted">Comparison only. Approval controls are the next milestone; no booking actions have been submitted.</p>
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
      <Notice>Expected refunds are not receipts. Vouchers and points remain separate from cash.</Notice>
    </>}
  </div>;
}
