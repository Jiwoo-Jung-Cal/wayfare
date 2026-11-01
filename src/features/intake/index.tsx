import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  BOOKING_KINDS, DEMO_DOCUMENT_SOURCES, DEMO_IDS, MAX_EXTRACTION_INPUT_CHARS, appError,
  type AppError, type Booking, type BookingExtraction, type ExtractedField, type FeatureModule, type FeaturePageProps,
} from '../../core/index.ts';
import { Button, CapabilityLabel, Card, ErrorState, InstantText, LoadingState, MoneyText, Notice, StatusBadge } from '../../ui/index.tsx';
import { createIntakeExtractor, reviewDraft, saveReviewedIntake, type ReviewDraft } from './review.ts';

const SAMPLE_IDS = [DEMO_IDS.documents.flightConfirmation, DEMO_IDS.documents.hotelConfirmation,
  DEMO_IDS.documents.activityConfirmation, DEMO_IDS.documents.transferConfirmation,
  DEMO_IDS.documents.unknownPolicy, DEMO_IDS.documents.lateDeadlineHotel, DEMO_IDS.documents.malformed];

function Evidence({ field }: { field: ExtractedField<unknown> }) {
  return field.status === 'found' ? <div className="wf-muted">Source ({field.confidence} confidence): <q>{field.excerpt}</q></div>
    : <div className="wf-muted">Unknown: {field.reason}</div>;
}

export function IntakePage({ tripId, ctx }: FeaturePageProps) {
  const [text, setText] = useState('');
  const [sample, setSample] = useState<string>(DEMO_IDS.documents.hotelConfirmation);
  const [extraction, setExtraction] = useState<BookingExtraction | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const busy = useRef(false);
  const retry = useRef<() => void>(() => {});
  const extractor = useMemo(() => createIntakeExtractor(ctx.extraction), [ctx.extraction, tripId]);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    retry.current = () => setLoadAttempt((n) => n + 1);
    ctx.repo.listBookings(tripId).then((r) => { if (active) { setLoaded(true); if (r.ok) setBookings(r.value); else setError(r.error); } })
      .catch(() => { if (active) { setLoaded(true); setError(appError('unavailable', 'Could not load saved bookings')); } });
    return () => { active = false; extractor.invalidate(); };
  }, [ctx.repo, tripId, extractor, loadAttempt]);

  function changeText(next: string) {
    extractor.invalidate(); setText(next); setLoading(false); setExtraction(null); setDraft(null); setError(null); setMessage('');
  }
  async function extract() {
    retry.current = () => { void extract(); };
    setLoading(true); setError(null); setMessage(''); setExtraction(null); setDraft(null);
    const response = await extractor.extract(tripId, text);
    if (!response) return;
    setLoading(false);
    if (response.ok) { setExtraction(response.value); setDraft(reviewDraft(response.value)); }
    else setError(response.error);
  }
  function edit<K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) {
    setDraft((d) => d ? { ...d, [key]: value } : d); setError(null); setMessage('');
  }
  async function save() {
    if (!draft || !extraction || busy.current) return;
    retry.current = () => { void save(); };
    busy.current = true; setSaving(true); setError(null); setMessage('');
    try {
      const response = await saveReviewedIntake({ extraction, sourceText: text, draft, tripId }, ctx);
      if (!response.ok) { setError(response.error); return; }
      const b = response.value.booking;
      setBookings((current) => [...current.filter((x) => x.id !== b.id), b]);
      setMessage(response.value.replayed ? `Already imported: ${b.provider} ${b.reference}. No duplicate was created; existing reviewed facts were kept.`
        : `Saved reviewed booking: ${b.provider} ${b.reference}. ${response.value.policy?.reviewState === 'needs_review' ? 'Policy still needs review.' : ''}`);
      try { await ctx.refresh(); } catch { setError(appError('unavailable', 'Booking saved, but shared trip refresh failed. Reload to see it.')); }
    } catch { setError(appError('unavailable', 'Save failed. Your pasted text and review edits are preserved.')); }
    finally { busy.current = false; setSaving(false); }
  }
  return <div className="wf-stack">
    <h1>Import bookings</h1><Notice>Functional preview · Jiwoo’s visual design approval is pending.</Notice>
    <p>Paste a confirmation, inspect its facts and evidence, then explicitly save it to this trip. A selected plan is not a confirmation.</p>
    <p>{ctx.extraction.description}</p>
    {ctx.extraction.capability !== 'unavailable' && <CapabilityLabel status={ctx.extraction.capability}>extraction service</CapabilityLabel>}
    <Card title="Confirmation text"><form className="wf-stack" onSubmit={(e) => { e.preventDefault(); void extract(); }}>
      <fieldset disabled={saving} className="wf-stack"><legend>Pasted text or an explicitly selected sample</legend>
        <label className="wf-stack">Sample document<select className="wf-input" value={sample} onChange={(e) => setSample(e.target.value)}>
          {SAMPLE_IDS.map((id) => <option key={id} value={id}>{DEMO_DOCUMENT_SOURCES[id]!.title}</option>)}
        </select></label>
        <div><Button onClick={() => changeText(DEMO_DOCUMENT_SOURCES[sample]!.text)}>Use sample document</Button></div>
        <label className="wf-stack">Paste booking confirmation<textarea className="wf-input" rows={12} maxLength={MAX_EXTRACTION_INPUT_CHARS} value={text} onChange={(e) => changeText(e.target.value)} /></label>
        <p className="wf-muted">{text.length}/{MAX_EXTRACTION_INPUT_CHARS} characters. In sample mode only the listed documents can be extracted; other text requires configured server AI.</p>
        <div><Button type="submit" variant="primary" disabled={loading || text.trim().length < 20}>Extract booking</Button></div>
      </fieldset>
    </form></Card>
    {loading && <LoadingState label="Extracting booking facts; nothing has been saved…" />}
    {error && <ErrorState error={error} onRetry={() => retry.current()} />}
    {message && <p role="status">{message}</p>}
    {extraction && draft && <Card title="Review before saving">
      <CapabilityLabel status={extraction.capability}>this extraction</CapabilityLabel>
      <p className="wf-muted">Request {extraction.requestId}{extraction.model && ` · ${extraction.model}`}</p>
      {extraction.warnings.map((warning) => <Notice key={warning} tone="warning">{warning}</Notice>)}
      <form className="wf-stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <fieldset disabled={saving} className="wf-stack"><legend>Booking facts · editable</legend>
          <div className="wf-grid">
            <label className="wf-stack">Booking type<select className="wf-input" value={draft.kind} onChange={(e) => edit('kind', e.target.value as ReviewDraft['kind'])}><option value="">Unknown · choose a type</option>{BOOKING_KINDS.map((k) => <option key={k}>{k}</option>)}</select><Evidence field={extraction.booking.kind} /></label>
            {(['provider', 'reference', 'title', 'startsAt', 'endsAt', 'localTimezone'] as const).map((key) => <label className="wf-stack" key={key}>
              {{ provider: 'Provider', reference: 'Booking reference', title: 'Booking title', startsAt: 'Start (UTC ISO instant)', endsAt: 'End (UTC ISO instant, optional)', localTimezone: 'Display timezone (IANA)' }[key]}
              <input className="wf-input" value={draft[key]} onChange={(e) => edit(key, e.target.value)} /><Evidence field={extraction.booking[key]} />
            </label>)}
            <label className="wf-stack">Paid amount (blank means unknown)<input className="wf-input" inputMode="decimal" value={draft.amount} onChange={(e) => edit('amount', e.target.value)} /><Evidence field={extraction.booking.paid} /></label>
            <label className="wf-stack">Currency (USD trip)<input className="wf-input" value={draft.currency} onChange={(e) => edit('currency', e.target.value)} /></label>
          </div>
          <p className="wf-muted">Source excerpts show the original extraction. Edited values are your corrections; the original document is retained.</p>
          <section className="wf-stack" aria-label="Policy evidence"><h3>Policy facts and source evidence</h3>
            <p>Refundability: {draft.policyUncertain ? 'unknown · reviewer disputed extraction' : extraction.policy.refundability}. These are policy terms, not an expected refund or received money.</p>
            {extraction.policy.refundTiers.map((tier, i) => <div key={i}><strong>{tier.label}</strong><p>Policy amount: <MoneyText value={tier.refund} /> · method: {tier.method} · condition: {tier.condition}</p>
              <p>Window: {tier.window.startsAtOrAfter ?? 'no stated start'} (inclusive) to {tier.window.endsBefore ?? 'no stated end'} (exclusive).</p><blockquote>{tier.excerpt}</blockquote></div>)}
            {extraction.policy.deadlines.map((deadline, i) => <div key={i}><strong>{deadline.label}</strong><p><InstantText value={deadline.at} timeZone={deadline.displayTimezone} /> · {deadline.displayTimezone}</p><blockquote>{deadline.excerpt}</blockquote></div>)}
            {extraction.policy.unknownFields.map((field, i) => <Notice tone="warning" key={i}>{field.field}: {field.reason}</Notice>)}
            {!extraction.policy.refundTiers.length && <Notice tone="warning">No usable refund rules were extracted. Missing terms do not mean a full refund or a nonrefundable booking.</Notice>}
            <label><input type="checkbox" checked={draft.policyUncertain} onChange={(e) => edit('policyUncertain', e.target.checked)} /> Policy terms are uncertain or incorrect · save them as unknown and preserve the source for review</label>
          </section>
          <label><input type="checkbox" checked={draft.confirmed} onChange={(e) => edit('confirmed', e.target.checked)} /> I reviewed the facts and confirm this document records a confirmed booking (sample documents remain simulated).</label>
          <div><Button type="submit" variant="primary">{saving ? 'Saving reviewed booking…' : 'Save reviewed booking'}</Button></div>
        </fieldset>
      </form>
    </Card>}
    <Card title="Saved bookings in this trip">
      {!loaded && <LoadingState label="Loading saved bookings…" />}
      {loaded && !bookings.length && <p>No confirmed bookings have been imported.</p>}
      {bookings.map((booking) => <div key={booking.id}><strong>{booking.provider} · {booking.reference}</strong> — <MoneyText value={booking.paid} />
        <p><StatusBadge>{booking.state}</StatusBadge> {booking.provenance.source}</p>
      </div>)}
      <Link to={`/trips/${tripId}`}>Return to trip dashboard</Link>
    </Card>
  </div>;
}

export const feature: FeatureModule = { key: 'intake', title: 'Import bookings', path: 'import', Page: IntakePage };
