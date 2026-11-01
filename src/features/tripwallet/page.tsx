import { useEffect, useRef, useState } from 'react';
import {
  appError, parseMajorUnits, formatMaybeMoney, sampleDocuments, DEMO_TIMES,
  type FeaturePageProps, type WorkspaceSnapshot, type AppError, type Result,
} from '../../core/index.ts';
import { Button, Card, ErrorState, EmptyState, LoadingState, Notice, MoneyText, StatusBadge, CapabilityLabel } from '../../ui/index.tsx';
import { allocateReceipt, claimState, confirmClaim, followUpDraft, matchCandidates, walletSummary } from './ledger.ts';
import { importReviewedEvidence, type EvidenceReview } from './evidence.ts';

export function TripWalletPage({ tripId, ctx }: FeaturePageProps) {
  const [data, setData] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<EvidenceReview['kind']>('receipt');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [reference, setReference] = useState('');
  const [merchant, setMerchant] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [at, setAt] = useState('');
  const [claimId, setClaimId] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    setData(null);
    ctx.repo.snapshot().then(r => { if (active) { if (r.ok) setData(r.value); else setError(r.error); } })
      .catch(() => { if (active) setError(appError('unavailable', 'Could not load wallet')); });
    return () => { active = false; };
  }, [ctx, tripId, reload]);
  async function run(fn: () => Promise<Result<unknown>>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setMessage('');
    try {
      const result = await fn();
      if (!result.ok) setError(result.error);
      else { setMessage('Saved. Evidence and allocations are retained.'); await ctx.refresh(); }
      setReload(n => n + 1);
    } catch { setError(appError('unavailable', 'Wallet operation interrupted. Reload before retrying.')); }
    finally { lock.current = false; setBusy(false); }
  }
  function sample(n: 0 | 1 | 2) {
    setMerchant('HARBOR LINE HOTEL MIDTOWN'); setBookingReference('HLH-48213'); setCurrency('USD');
    if (n === 0) {
      setKind('refund_confirmation'); setText(sampleDocuments.HOTEL_REFUND_CONFIRMATION);
      setAmount('400'); setReference('HLH-48213'); setAt(DEMO_TIMES.hotelRefundDue);
    } else {
      setKind('receipt'); setText(n === 1 ? sampleDocuments.HOTEL_RECEIPT_1 : sampleDocuments.HOTEL_RECEIPT_2);
      setAmount(n === 1 ? '250' : '150'); setReference(n === 1 ? 'HLH-RF-0001' : 'HLH-RF-0002');
      setAt(n === 1 ? DEMO_TIMES.hotelReceipt1At : DEMO_TIMES.hotelReceipt2At);
    }
  }
  if (!data) return error ? <ErrorState error={error} onRetry={() => { setError(null); setReload(n => n + 1); }} /> : <LoadingState label="Loading TripWallet…" />;
  const claims = data.claims.filter(c => c.tripId === tripId);
  const bookings = data.bookings.filter(b => b.tripId === tripId);
  const receipts = data.receipts.filter(r => r.tripId === tripId);
  const assets = data.assets.filter(a => a.tripId === null || a.tripId === tripId);
  const summary = walletSummary(claims, assets, ctx.clock.now());
  return <div className="wf-stack">
    <h1>TripWallet</h1>
    <Notice>Functional preview — Jiwoo’s visual approval is pending. Provider actions remain labeled on each claim. Review entered fields against the original evidence; live wallet AI extraction is not connected.</Notice>
    {error && <ErrorState error={error} />}
    {message && <p role="status">{message}</p>}
    <Card title="Cash recovery">
      <p>Expected, provider-confirmed and received are stages of the same recovery. Do not add them together.</p>
      {summary.cash.map(row => <dl key={row.currency}>
        <dt>Expected ({row.currency})</dt><dd><MoneyText value={row.expected} /></dd>
        <dt>Provider-confirmed</dt><dd><MoneyText value={row.providerConfirmed} /></dd>
        <dt>Received</dt><dd><MoneyText value={row.received} /></dd>
        <dt>Outstanding (confirmed if known, otherwise expected)</dt><dd><MoneyText value={row.outstanding} /></dd>
      </dl>)}
      {summary.unknownCurrencyClaimIds.length > 0 && <Notice tone="warning">Some claims have unknown currency/amount and are excluded from currency totals.</Notice>}
      {!claims.length && <EmptyState title="No refund claims yet">Approve successful actions in ReRoute; claims sync automatically.</EmptyState>}
      <Button onClick={() => { const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'wallet-summary.json'; a.click(); URL.revokeObjectURL(url); }}>Download wallet summary</Button>
    </Card>
    <Card title="Import and review evidence">
      <CapabilityLabel status="simulated">Fictional sample inputs</CapabilityLabel>
      <div className="wf-row"><Button onClick={() => sample(0)}>Load sample refund confirmation</Button><Button onClick={() => sample(1)}>Load sample $250 receipt</Button><Button onClick={() => sample(2)}>Load sample $150 receipt</Button></div>
      <label>Evidence type<select className="wf-input" value={kind} onChange={e => setKind(e.target.value as EvidenceReview['kind'])}><option value="receipt">Receipt</option><option value="refund_confirmation">Refund confirmation</option></select></label>
      <label>Original evidence text<textarea className="wf-input" value={text} onChange={e => setText(e.target.value)} /></label>
      <label>Reviewed amount<input className="wf-input" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Currency<input className="wf-input" value={currency} onChange={e => setCurrency(e.target.value)} /></label>
      <label>Transaction or confirmation reference<input className="wf-input" value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label>Merchant<input className="wf-input" value={merchant} onChange={e => setMerchant(e.target.value)} /></label>
      <label>Booking reference<input className="wf-input" value={bookingReference} onChange={e => setBookingReference(e.target.value)} /></label>
      <label>{kind === 'receipt' ? 'Posted date (UTC ISO)' : 'Sourced due date (UTC ISO; empty if unknown)'}<input className="wf-input" value={at} onChange={e => setAt(e.target.value)} placeholder="2026-11-25T23:00:00Z" /></label>
      {kind === 'refund_confirmation' && <label>Claim to confirm<select className="wf-input" value={claimId} onChange={e => setClaimId(e.target.value)}><option value="">Select claim</option>{claims.map(c => <option key={c.id} value={c.id}>{bookings.find(b => b.id === c.bookingId)?.reference} — {c.id}</option>)}</select></label>}
      <Button disabled={busy} onClick={() => run(async () => {
        if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: appError('validation_failed', 'Enter a three-letter currency code') };
        const money = parseMajorUnits(amount, currency);
        if (!money) return { ok: false, error: appError('validation_failed', 'Invalid amount') };
        const claim = claims.find(c => c.id === claimId);
        if (kind === 'refund_confirmation' && (!claim || bookings.find(b => b.id === claim.bookingId)?.reference.trim().toUpperCase() !== bookingReference.trim().toUpperCase())) return { ok: false, error: appError('validation_failed', 'Select the claim with the matching booking reference') };
        const imported = await importReviewedEvidence({ kind, text, amount: money, reference, merchant, bookingReference, at: at || null }, tripId, ctx);
        if (!imported.ok || kind === 'receipt') return imported;
        return confirmClaim({ tripId, claimId, documentId: imported.value.document.id, amount: money, dueAt: at || null }, ctx);
      })}>Confirm reviewed evidence</Button>
    </Card>
    <Card title="Receipt matching">
      {receipts.map(r => {
        const allocated = claims.find(c => c.allocations.some(a => a.receiptId === r.id));
        const candidates = matchCandidates(r, claims, bookings, ctx.clock.now());
        return <div className="wf-stack" key={r.id}>
          <strong>{r.reference}: <MoneyText value={r.amount} /></strong><span>{r.merchant} · {r.receivedAt}</span>
          {allocated ? <p>Matched to {allocated.id}</p> : <>
            <p>{candidates.length === 1 ? 'One matching proposal — review before allocating.' : candidates.length > 1 ? 'Ambiguous — review the claim and original evidence.' : 'No confident match — review booking, currency, timing and amount.'}</p>
            <label>Claim for receipt {r.reference}<select className="wf-input" value={choices[r.id] ?? ''} onChange={e => setChoices(v => ({ ...v, [r.id]: e.target.value }))}><option value="">Select reviewed claim</option>{claims.map(c => <option value={c.id} key={c.id}>{bookings.find(b => b.id === c.bookingId)?.reference} — {c.id}</option>)}</select></label>
            <Button disabled={busy || !choices[r.id]} onClick={() => run(() => allocateReceipt({ tripId, receiptId: r.id, claimId: choices[r.id]! }, ctx))}>Match receipt {r.reference}</Button>
          </>}
        </div>;
      })}
    </Card>
    {claims.map(c => {
      const booking = bookings.find(b => b.id === c.bookingId);
      const s = claimState(c, ctx.clock.now());
      const action = data.actions.find(a => a.id === c.actionRecordId);
      return <Card title={booking?.provider ?? c.id} key={c.id}>
        <StatusBadge>{s.status.replaceAll('_', ' ')}</StatusBadge>{s.overdue && <StatusBadge tone="warning">Overdue</StatusBadge>}
        {action && <CapabilityLabel status={action.capability}>{action.result.detail}</CapabilityLabel>}
        <p>Expected <MoneyText value={c.expected} /> · Provider-confirmed <MoneyText value={c.providerConfirmed} /> · Received {s.received ? formatMaybeMoney(s.received) : 'Unknown currency'} · Outstanding <MoneyText value={s.outstanding} /></p>
        {s.discrepancy && <Notice tone="warning">Provider promise differs from the original expectation. Evidence retained for review.</Notice>}
        <p>{c.due ? `Due ${c.due.at}; source: ${c.due.provenance.source}` : 'Due date unknown'}</p>
        <details><summary>Action, evidence and allocation history</summary><p>Booking {booking?.reference} · Action {c.actionRecordId} · Component {c.recoveryComponentId}</p>
          <pre>{JSON.stringify(action, null, 2)}</pre>
          {c.allocations.map(a => <p key={a.id}>{receipts.find(r => r.id === a.receiptId)?.reference ?? a.receiptId}: <MoneyText value={a.amount} /> · {a.allocatedAt}</p>)}
          {data.documents.filter(d => d.id === c.confirmationDocumentId || booking?.evidenceDocumentIds.includes(d.id) || receipts.some(r => r.sourceDocumentId === d.id && c.allocations.some(a => a.receiptId === r.id))).map(d => <details key={d.id}><summary>{d.title}</summary><pre>{d.text}</pre></details>)}
        </details>
        {booking && <Button onClick={() => setDraft(followUpDraft(c, booking, ctx.clock.now()))}>Prepare follow-up draft for {booking.reference}</Button>}
      </Card>;
    })}
    {draft && <Card title="Review follow-up draft"><Notice>Review before copying. Nothing is sent automatically.</Notice><label>Editable follow-up draft<textarea className="wf-input" rows={14} value={draft} onChange={e => setDraft(e.target.value)} /></label><Button onClick={() => navigator.clipboard.writeText(draft).then(() => setMessage('Draft copied.')).catch(() => setMessage('Select and copy the draft text.'))}>Copy follow-up draft</Button></Card>}
    <Card title="Vouchers and points — separate from cash">
      {assets.map(a => <div key={a.id}><h3>{a.issuer}</h3><p>{a.value.unit === 'money' ? formatMaybeMoney(a.value.amount) : `${typeof a.value.quantity === 'number' ? a.value.quantity.toLocaleString() : 'Unknown'} points (${a.value.program})`}</p><p>{a.status} · {a.expiresAt ? `${Date.parse(a.expiresAt) <= Date.parse(ctx.clock.now()) ? 'Expired' : 'Expires'} ${a.expiresAt}` : 'Expiry unknown'}</p><p>{a.restrictions.join('; ') || 'Restrictions unknown'}</p><p>Reference/evidence: {a.sourceDocumentId ?? 'Unknown'}. Reservations/redemptions not implemented.</p></div>)}
    </Card>
  </div>;
}
