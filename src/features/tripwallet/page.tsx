// TripWallet page, design r2-final (Figma 68:579; reference design/exports/prototype/r2 "wallet").
// Visual layer by Agent 1 under Jiwoo's design-implementation scope. Logic is Agent 5's and
// unchanged: walletSummary / claimState / confirmClaim / matchCandidates / allocateReceipt /
// followUpDraft (ledger.ts) and importReviewedEvidence (evidence.ts). Expected, confirmed and
// received are stages of one recovery and are never added together.
import { useEffect, useRef, useState } from 'react';
import {
  appError, parseMajorUnits, formatMaybeMoney, sampleDocuments, DEMO_TIMES, isUnknown, unknownValue,
  type FeaturePageProps, type WorkspaceSnapshot, type AppError, type Result, type MaybeMoney, type Booking, type RefundClaim, type WalletAsset,
} from '../../core/index.ts';
import { ErrorState, LoadingState, Notice, MoneyText, CapabilityLabel } from '../../ui/index.tsx';
import { Icon, type IconName } from '../../ui/icons.tsx';
import { allocateReceipt, claimState, confirmClaim, followUpDraft, matchCandidates, walletSummary } from './ledger.ts';
import { importReviewedEvidence, type EvidenceReview } from './evidence.ts';
import './tripwallet.css';

type Group = 'flight' | 'hotel' | 'activity' | 'transfer' | 'credit';
const GROUPS: [Group, string, IconName][] = [['flight', 'Flights', 'plane'], ['hotel', 'Stays', 'bed'], ['activity', 'Activities', 'ticket'], ['transfer', 'Rides', 'car'], ['credit', 'Credits & points', 'gift']];
const CO: Record<string, { color: string; icon: IconName }> = {
  flight: { color: 'var(--wf-color-cat-flight)', icon: 'plane' },
  hotel: { color: 'var(--wf-color-cat-stay)', icon: 'bed' },
  activity: { color: 'var(--wf-color-cat-activity)', icon: 'ticket' },
  transfer: { color: 'var(--wf-color-cat-ride)', icon: 'car' },
  other: { color: 'var(--wf-color-text-muted)', icon: 'receipt' },
};
const NAME: Record<string, string> = { flight: 'Flight', hotel: 'Hotel', activity: 'Activity', transfer: 'Airport ride', other: 'Booking' };
const fmtMoney = (m: MaybeMoney | null | undefined) => (m ? formatMaybeMoney(m) : 'Unknown');
const whole = (m: MaybeMoney | null | undefined) => {
  if (!m || isUnknown(m)) return 'Unknown';
  const w = m.amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, minimumFractionDigits: w ? 0 : 2, maximumFractionDigits: w ? 0 : 2 }).format(Math.abs(m.amountMinor) / 100);
};

/** Copy to the clipboard, falling back to selecting the text. */
function copy(text: string, onDone: (msg: string) => void) {
  try {
    void navigator.clipboard.writeText(text).then(() => onDone(`Copied ${text.length > 30 ? 'message' : text}.`), () => onDone('Copying isn’t allowed here; select the text instead.'));
  } catch { onDone('Copying isn’t allowed here; select the text instead.'); }
}

function ReminderDrawer({ provider, text, onClose, onCopied }: { provider: string; text: string; onClose: () => void; onCopied: (m: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(text);
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []);
  return <dialog ref={ref} className="wf-drawer" aria-labelledby="wf-rem-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
    <div className="wf-drawer-h"><h2 id="wf-rem-title">Reminder to {provider}</h2><button type="button" className="wf-ib" aria-label="Close" onClick={() => ref.current?.close()}><Icon name="x" /></button></div>
    <div className="wf-drawer-b">
      <p className="wf-muted">We wrote this from your booking and the company’s refund rule. Change anything you like, then send it yourself. Nothing is sent automatically.</p>
      <label className="wf-visually-hidden" htmlFor="wf-rem-text">Editable follow-up draft</label>
      <textarea id="wf-rem-text" className="wf-wal-draft" aria-label="Editable follow-up draft" value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
    <div className="wf-drawer-f">
      <button type="button" className="wf-button" onClick={() => ref.current?.close()}>Done</button>
      <button type="button" className="wf-button" data-variant="dark" onClick={() => copy(value, onCopied)}><Icon name="copy" />Copy message</button>
    </div>
  </dialog>;
}

export function TripWalletPage({ tripId, ctx }: FeaturePageProps) {
  const [data, setData] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<{ provider: string; text: string } | null>(null);
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
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'all' | 'cash' | 'credit'>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    let active = true;
    // Keep showing the current data while re-reading after a save (no loading flash, panels stay open).
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
  const now = ctx.clock.now();
  const claims = data.claims.filter(c => c.tripId === tripId);
  const bookings = data.bookings.filter(b => b.tripId === tripId);
  const receipts = data.receipts.filter(r => r.tripId === tripId);
  const assets = data.assets.filter(a => a.tripId === null || a.tripId === tripId);
  const summary = walletSummary(claims, assets, now);
  const cash = summary.cash[0];
  const currencyCode = cash?.currency ?? 'USD';
  // Lost to fees: what each claimed booking cost minus its expected cash refund (both stored facts).
  const lostParts = claims.map(c => { const b = bookings.find(x => x.id === c.bookingId); return b && !isUnknown(b.paid) && !isUnknown(c.expected) && b.paid.currency === c.expected.currency ? b.paid.amountMinor - c.expected.amountMinor : null; });
  const lost: MaybeMoney = lostParts.some(v => v === null) ? unknownValue('Some amounts unknown') : { amountMinor: lostParts.reduce<number>((a, v) => a + (v ?? 0), 0), currency: currencyCode };
  const zero: MaybeMoney = { amountMinor: 0, currency: currencyCode };
  const bookingFor = (c: RefundClaim) => bookings.find(b => b.id === c.bookingId);
  const assetCo = (a: WalletAsset) => bookings.find(b => b.provider.split(' ')[0] === a.issuer.split(' ')[0])?.kind ?? 'other';

  const claimRow = (c: RefundClaim, b: Booking | undefined) => {
    const s = claimState(c, now);
    const key = `claim-${c.id}`;
    const open = openKey === key;
    const base = isUnknown(c.providerConfirmed) ? c.expected : c.providerConfirmed;
    const pct = !isUnknown(base) && base.amountMinor > 0 && s.received ? Math.round((s.received.amountMinor / base.amountMinor) * 100) : 0;
    const lane = s.status === 'received' ? `Received ${fmtMoney(s.received)}`
      : s.status === 'partially_received' ? `Received ${fmtMoney(s.received)} · ${fmtMoney(s.outstanding)} outstanding`
      : s.status === 'provider_confirmed' ? 'Company confirmed · not received yet'
      : s.status === 'needs_review' ? 'Needs review · the amounts don’t match'
      : 'Expected · not received yet';
    const action = data.actions.find(a => a.id === c.actionRecordId);
    const lostHere = b && !isUnknown(b.paid) && !isUnknown(c.expected) ? b.paid.amountMinor - c.expected.amountMinor : 0;
    const co = CO[b?.kind ?? 'other']!;
    return <div className="wf-wal-item" data-open={open || undefined} key={key}>
      <button type="button" className="wf-wal-head" aria-expanded={open} onClick={() => setOpenKey(open ? null : key)}>
        <span className="wf-wal-co" style={{ background: co.color }} title={b?.provider}><Icon name={co.icon} /></span>
        <span className="wf-wal-nm">{b ? `${NAME[b.kind]} refund` : 'Refund'}</span>
        <span className="wf-wal-val wf-num wf-gain">+<MoneyText value={c.expected} /></span>
        <span className="wf-wal-sub">{b?.provider} · {b?.state === 'cancelled' ? 'Cancelled' : 'Claim'} · {b?.reference}</span>
        <span className="wf-wal-lane"><small>{lane}</small><small className="wf-num">{pct}%</small><span className="wf-wal-bar"><i style={{ width: `${Math.max(2, pct)}%`, background: 'var(--wf-color-positive)' }} /></span></span>
      </button>
      {s.overdue && <Notice tone="warning">Overdue: the promised refund date has passed.</Notice>}
      {open && <div className="wf-wal-more">
        <div className="wf-wal-tri"><div data-d="true">Claim started</div><div data-d={!isUnknown(c.providerConfirmed) || pct > 0 || undefined} data-c={isUnknown(c.providerConfirmed) && pct === 0 || undefined}>Company confirms</div><div data-d={s.status === 'received' || undefined} data-c={(!isUnknown(c.providerConfirmed) || pct > 0) && s.status !== 'received' || undefined}>Money arrives</div></div>
        {c.allocations.map(a => <p key={a.id} className="wf-wal-evb">Matched to a +{fmtMoney(a.amount)} deposit ({receipts.find(r => r.id === a.receiptId)?.reference ?? a.receiptId}) from {receipts.find(r => r.id === a.receiptId)?.merchant ?? b?.provider}.</p>)}
        {s.discrepancy && <Notice tone="warning">The company’s promise differs from the original expectation. Evidence retained for review.</Notice>}
        <p className="wf-muted">
          {action?.expectedRecovery[0] ? `Expected from the refund rule: ${fmtMoney(c.expected)}.` : ''} {c.due ? `Due ${new Date(c.due.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (source: ${c.due.provenance.source}).` : 'Due date unknown.'}
          {lostHere > 0 && <> You lose <span className="wf-loss">−{whole({ amountMinor: lostHere, currency: currencyCode })}</span> on this booking.</>}
        </p>
        {action && <CapabilityLabel status={action.capability}>{action.result.detail}</CapabilityLabel>}
        <div className="wf-row">
          {b && s.status !== 'received' && <button type="button" className="wf-button" data-variant="dark" data-size="sm" onClick={() => setDraft({ provider: b.provider, text: followUpDraft(c, b, now) })}>Write a reminder</button>}
          {b && <button type="button" className="wf-button" data-size="sm" onClick={() => copy(b.reference, setMessage)}><Icon name="copy" />Copy {b.reference}</button>}
        </div>
        <details><summary>Action, evidence and allocation history</summary><p>Booking {b?.reference} · Action {c.actionRecordId} · Component {c.recoveryComponentId}</p>
          <pre>{JSON.stringify(action, null, 2)}</pre>
          {c.allocations.map(a => <p key={a.id}>{receipts.find(r => r.id === a.receiptId)?.reference ?? a.receiptId}: <MoneyText value={a.amount} /> · {a.allocatedAt}</p>)}
          {data.documents.filter(d => d.id === c.confirmationDocumentId || b?.evidenceDocumentIds.includes(d.id) || receipts.some(r => r.sourceDocumentId === d.id && c.allocations.some(a => a.receiptId === r.id))).map(d => <details key={d.id}><summary>{d.title}</summary><pre>{d.text}</pre></details>)}
        </details>
      </div>}
    </div>;
  };

  const assetRow = (a: WalletAsset) => {
    const key = `asset-${a.id}`;
    const open = openKey === key;
    const co = CO[assetCo(a)]!;
    const days = a.expiresAt ? Math.max(0, Math.round((Date.parse(a.expiresAt) - Date.parse(now)) / 86_400_000)) : null;
    const name = a.value.unit === 'points' ? a.value.program : `${a.issuer} ${a.kind === 'travel_credit' ? 'credit' : 'voucher'}`;
    const value = a.value.unit === 'money' ? fmtMoney(a.value.amount) : `${typeof a.value.quantity === 'number' ? a.value.quantity.toLocaleString('en-US') : 'Unknown'} pts`;
    return <div className="wf-wal-item" data-open={open || undefined} key={key}>
      <button type="button" className="wf-wal-head" aria-expanded={open} onClick={() => setOpenKey(open ? null : key)}>
        <span className="wf-wal-co" style={{ background: co.color }} title={a.issuer}><Icon name={co.icon} /></span>
        <span className="wf-wal-nm">{name}</span>
        <span className="wf-wal-val wf-num wf-lav">{value}</span>
        <span className="wf-wal-sub">{a.issuer === name ? a.restrictions[0] ?? 'Restrictions unknown' : `${a.issuer} · ${a.restrictions[0] ?? 'Restrictions unknown'}`}</span>
        <span className="wf-wal-lane">
          <small>{a.expiresAt ? `${days === 0 ? 'Expired' : 'Expires'} ${new Date(a.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}` : 'Expiry unknown'}</small>
          <small className="wf-num">{days !== null ? `${Math.round(days / 30.4)} months left` : ''}</small>
          <span className="wf-wal-bar"><i style={{ width: `${days !== null ? Math.min(100, (days / 730) * 100) : 0}%`, background: 'var(--wf-color-lav, #5e4dbf)' }} /></span>
        </span>
      </button>
      {open && <div className="wf-wal-more">
        <p className="wf-muted">{a.restrictions.join('; ') || 'Restrictions unknown'}. It’s kept separate from your cash refunds. Status: {a.status}. Reservations and redemptions are not implemented.</p>
        <p className="wf-muted">Evidence: {data.documents.find(d => d.id === a.sourceDocumentId)?.title ?? a.sourceDocumentId ?? 'Unknown'}.</p>
      </div>}
    </div>;
  };

  const claimsByGroup = (g: Group) => claims.filter(c => (bookingFor(c)?.kind ?? 'other') === g || (g === 'activity' && bookingFor(c)?.kind === 'other'));
  const showCash = tab !== 'credit';
  const showCredit = tab !== 'cash';
  const empty = (showCash ? claims.length : 0) + (showCredit ? assets.length : 0) === 0;
  const pending = receipts.filter(r => !claims.some(c => c.allocations.some(a => a.receiptId === r.id)));

  return <div className="wf-tripwallet">
    <header className="wf-rr-vh"><h1>TripWallet</h1><p>Money you’re owed, money that arrived, and credits you still have, grouped by type.</p></header>
    {error && <ErrorState error={error} />}
    {message && <p role="status" className="wf-muted">{message}</p>}
    <div className="wf-wal-top">
      <div><span className="wf-label-mono">Coming back</span><div className="wf-big wf-num wf-gain">+{whole(cash?.expected ?? zero)}</div><p className="wf-muted">Expected</p></div>
      <div><span className="wf-label-mono">Received</span><div className="wf-big wf-num wf-gain">+{whole(cash?.received ?? zero)}</div><p className="wf-muted">In your account</p></div>
      <div><span className="wf-label-mono">Lost to fees</span><div className="wf-big wf-num wf-loss">−{whole(lost)}</div><p className="wf-muted">Can’t be recovered</p></div>
    </div>
    {summary.unknownCurrencyClaimIds.length > 0 && <Notice tone="warning">Some claims have unknown currency or amount and are left out of these totals.</Notice>}

    <div className="wf-wal-seg" role="tablist" aria-label="Show">
      {([['all', 'All'], ['cash', 'Refunds'], ['credit', 'Credits & points']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {pending.map(r => {
      const candidates = matchCandidates(r, claims, bookings, now);
      const only = candidates.length === 1 ? candidates[0]! : null;
      const ob = only ? bookingFor(only) : undefined;
      return <div className="wf-wal-review" key={r.id}>
        <b>{only && !dismissed[r.id] ? `Is this your ${ob ? NAME[ob.kind]!.toLowerCase() : ''} refund?` : `Which refund is deposit ${r.reference}?`}</b>
        <p className="wf-muted">A <span className="wf-num wf-gain">+{fmtMoney(r.amount)}</span> deposit from {r.merchant}{only && ob && !dismissed[r.id] ? ` matches booking ${ob.reference}.` : candidates.length > 1 ? ' could match more than one claim. Pick the right one.' : '. No confident match: check the booking, currency, timing and amount.'}</p>
        {only && !dismissed[r.id] && <div className="wf-row"><button type="button" className="wf-button" data-size="sm" onClick={() => setDismissed(d => ({ ...d, [r.id]: true }))}>No</button><button type="button" className="wf-button" data-variant="dark" data-size="sm" disabled={busy} onClick={() => run(() => allocateReceipt({ tripId, receiptId: r.id, claimId: only.id }, ctx))}>Yes, that’s it</button></div>}
        <div className="wf-row wf-wal-pick">
          <label>Claim for receipt {r.reference}<select className="wf-input" value={choices[r.id] ?? ''} onChange={e => setChoices(v => ({ ...v, [r.id]: e.target.value }))}><option value="">Select reviewed claim</option>{claims.map(c => <option value={c.id} key={c.id}>{bookingFor(c)?.reference} — {c.id}</option>)}</select></label>
          <button type="button" className="wf-button" data-size="sm" disabled={busy || !choices[r.id]} onClick={() => run(() => allocateReceipt({ tripId, receiptId: r.id, claimId: choices[r.id]! }, ctx))}>Match receipt {r.reference}</button>
        </div>
      </div>;
    })}

    {empty ? <p className="wf-wal-empty">{tab === 'cash' ? 'No refunds yet. Once you choose an option in ReRoute, each refund shows up here, grouped by flights, stays, activities and rides.' : 'Nothing here yet.'}</p>
      : GROUPS.map(([g, label, icon]) => {
        const rows = g === 'credit' ? (showCredit ? assets.map(assetRow) : []) : (showCash ? claimsByGroup(g).map(c => claimRow(c, bookingFor(c))) : []);
        return rows.length ? <section key={g} aria-label={label}><h2 className="wf-wal-grp"><Icon name={icon} />{label}</h2><div className="wf-wal-list">{rows}</div></section> : null;
      })}

    <details className="wf-wal-add" open={addOpen} onToggle={(e) => setAddOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Add a refund confirmation or receipt</summary>
      <div className="wf-stack">
        <CapabilityLabel status="simulated">Fictional sample inputs</CapabilityLabel>
        <div className="wf-row"><button type="button" className="wf-button" data-size="sm" onClick={() => sample(0)}>Load sample refund confirmation</button><button type="button" className="wf-button" data-size="sm" onClick={() => sample(1)}>Load sample $250 receipt</button><button type="button" className="wf-button" data-size="sm" onClick={() => sample(2)}>Load sample $150 receipt</button></div>
        <div className="wf-wal-form">
          <label>Evidence type<select className="wf-input" value={kind} onChange={e => setKind(e.target.value as EvidenceReview['kind'])}><option value="receipt">Receipt</option><option value="refund_confirmation">Refund confirmation</option></select></label>
          <label className="wf-wal-wide">Original evidence text<textarea className="wf-input" value={text} onChange={e => setText(e.target.value)} /></label>
          <label>Reviewed amount<input className="wf-input" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label>Currency<input className="wf-input" value={currency} onChange={e => setCurrency(e.target.value)} /></label>
          <label>Transaction or confirmation reference<input className="wf-input" value={reference} onChange={e => setReference(e.target.value)} /></label>
          <label>Merchant<input className="wf-input" value={merchant} onChange={e => setMerchant(e.target.value)} /></label>
          <label>Booking reference<input className="wf-input" value={bookingReference} onChange={e => setBookingReference(e.target.value)} /></label>
          <label>{kind === 'receipt' ? 'Posted date (UTC ISO)' : 'Sourced due date (UTC ISO; empty if unknown)'}<input className="wf-input" value={at} onChange={e => setAt(e.target.value)} placeholder="2026-11-25T23:00:00Z" /></label>
          {kind === 'refund_confirmation' && <label>Claim to confirm<select className="wf-input" value={claimId} onChange={e => setClaimId(e.target.value)}><option value="">Select claim</option>{claims.map(c => <option key={c.id} value={c.id}>{bookingFor(c)?.reference} — {c.id}</option>)}</select></label>}
        </div>
        <div><button type="button" className="wf-button" data-variant="dark" disabled={busy} onClick={() => run(async () => {
          if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: appError('validation_failed', 'Enter a three-letter currency code') };
          const money = parseMajorUnits(amount, currency);
          if (!money) return { ok: false, error: appError('validation_failed', 'Invalid amount') };
          const claim = claims.find(c => c.id === claimId);
          if (kind === 'refund_confirmation' && (!claim || bookings.find(b => b.id === claim.bookingId)?.reference.trim().toUpperCase() !== bookingReference.trim().toUpperCase())) return { ok: false, error: appError('validation_failed', 'Select the claim with the matching booking reference') };
          const imported = await importReviewedEvidence({ kind, text, amount: money, reference, merchant, bookingReference, at: at || null }, tripId, ctx);
          if (!imported.ok || kind === 'receipt') return imported;
          return confirmClaim({ tripId, claimId, documentId: imported.value.document.id, amount: money, dueAt: at || null }, ctx);
        })}>Confirm reviewed evidence</button></div>
        <p className="wf-muted">Review entered fields against the original evidence. Live wallet AI extraction is not connected.</p>
      </div>
    </details>
    <p><button type="button" className="wf-linkbtn wf-muted" onClick={() => { const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'wallet-summary.json'; a.click(); URL.revokeObjectURL(url); }}>Download wallet summary</button></p>
    {draft && <ReminderDrawer provider={draft.provider} text={draft.text} onClose={() => setDraft(null)} onCopied={setMessage} />}
  </div>;
}
