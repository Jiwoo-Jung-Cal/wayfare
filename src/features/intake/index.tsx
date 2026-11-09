import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BOOKING_KINDS, DEMO_DOCUMENT_SOURCES, DEMO_IDS, MAX_EXTRACTION_INPUT_CHARS, appError, formatInstant, isUnknown, isValidTimeZone,
  type AppError, type Booking, type BookingExtraction, type BookingKind, type ExtractedField, type FeatureModule, type FeaturePageProps,
  type RecoveryMethod,
} from '../../core/index.ts';
import { Button, CapabilityLabel, Card, EmptyState, ErrorState, LoadingState, MoneyText, Notice } from '../../ui/index.tsx';
import { Icon, type IconName } from '../../ui/icons.tsx';
import { createIntakeExtractor, instantToLocalInput, localInputToInstant, reviewDraft, saveReviewedIntake, validateReview, type ReviewDraft } from './review.ts';
import './intake.css';

const SAMPLE_IDS = [DEMO_IDS.documents.flightConfirmation, DEMO_IDS.documents.hotelConfirmation,
  DEMO_IDS.documents.activityConfirmation, DEMO_IDS.documents.transferConfirmation,
  DEMO_IDS.documents.unknownPolicy, DEMO_IDS.documents.lateDeadlineHotel, DEMO_IDS.documents.malformed];

const KIND_LABEL: Record<BookingKind, string> = { flight: 'Flight', hotel: 'Stay', activity: 'Activity', transfer: 'Ride', other: 'Other' };
const KIND_ICON: Record<BookingKind, IconName> = { flight: 'plane', hotel: 'bed', activity: 'ticket', transfer: 'car', other: 'doc' };
const REFUNDABILITY: Record<string, [string, 'ok' | 'warn' | 'bad' | 'mute']> = {
  refundable: ['Refundable', 'ok'], partially_refundable: ['Partly refundable', 'warn'], non_refundable: ['Non-refundable', 'bad'], unknown: ['Terms unknown', 'mute'],
};
const METHOD: Record<RecoveryMethod, string> = {
  original_payment: 'to your original payment', travel_credit: 'as travel credit', voucher: 'as a voucher', points: 'as points', none: 'no refund', unknown: 'refund method not stated',
};
type ExtractedTier = BookingExtraction['policy']['refundTiers'][number];
const CONDITION: Record<ExtractedTier['condition'], string | null> = { any: null, traveler_cancels: 'if you cancel', provider_cancels: 'if the provider cancels' };
/** Common zones first; the extracted zone is added when it isn't listed. */
const ZONES = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
function zoneLabel(tz: string) {
  if (tz === 'UTC') return 'UTC';
  let generic = '';
  try { generic = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? ''; } catch { /* unknown zone */ }
  const city = tz.split('/').pop()!.replace(/_/g, ' ');
  return generic ? `${city} · ${generic}` : city;
}

function Tag({ tone, icon, children }: { tone: 'ok' | 'warn' | 'bad' | 'mute' | 'info'; icon: IconName; children: ReactNode }) {
  return <span className="wf-tag" data-tone={tone}><Icon name={icon} />{children}</span>;
}

/** What the document said for one field: confidence in words, then the source excerpt. */
function Evidence({ field }: { field: ExtractedField<unknown> }) {
  if (field.status !== 'found') return <p className="wf-intake-src wf-intake-src-missing">Not found in the document. {field.reason}</p>;
  const high = field.confidence === 'high';
  return <div className="wf-intake-src">
    <span className="wf-intake-conf" data-tone={high ? 'ok' : 'warn'}><Icon name={high ? 'check' : 'alert'} />{field.confidence.charAt(0).toUpperCase() + field.confidence.slice(1)} confidence</span>
    {!high && <span className="wf-intake-check">Check this</span>}
    <q>{field.excerpt}</q>
  </div>;
}

function ReviewField({ name, label, hint, issue, field, wide, children }: {
  name: string; label: string; hint?: string; issue?: string; field?: ExtractedField<unknown>; wide?: boolean; children: ReactNode;
}) {
  return <div className={`wf-intake-field${wide ? ' wf-intake-field-wide' : ''}`}>
    <label htmlFor={`wf-review-${name}`}>{label}{hint && <span className="wf-intake-hint"> · {hint}</span>}</label>
    {children}
    {issue && <span id={`wf-review-${name}-error`} className="wf-intake-field-error"><Icon name="alert" />{issue}</span>}
    {field && <div id={`wf-review-${name}-evidence`}><Evidence field={field} /></div>}
  </div>;
}

function windowText(tier: ExtractedTier, tz: string) {
  const at = (i: string) => formatInstant(i, tz).replace(/, \d{4},/, ',');
  const { startsAtOrAfter: from, endsBefore: until } = tier.window;
  if (from && until) return `From ${at(from)} until ${at(until)}`;
  if (until) return `Before ${at(until)}`;
  if (from) return `From ${at(from)}`;
  return 'Any time';
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
  const [replayed, setReplayed] = useState(false);
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
      setReplayed(response.value.replayed);
      setBookings((current) => [...current.filter((x) => x.id !== b.id), b]);
      setMessage(response.value.replayed ? `Already imported: ${b.provider} ${b.reference}. No duplicate was created; existing reviewed facts were kept.`
        : `Saved reviewed booking: ${b.provider} ${b.reference}. ${response.value.policy?.reviewState === 'needs_review' ? 'Policy still needs review.' : ''}`);
      try { await ctx.refresh(); } catch { setError(appError('unavailable', 'Booking saved, but shared trip refresh failed. Reload to see it.')); }
    } catch { setError(appError('unavailable', 'Save failed. Your pasted text and review edits are preserved.')); }
    finally { busy.current = false; setSaving(false); }
  }
  const validation = draft ? validateReview(draft) : null;
  function fieldIssue(key: string) {
    const path = key === 'amount' ? 'paid' : key;
    const local = validation && !validation.ok ? validation.error.issues?.find((entry) => entry.path === path)?.message : undefined;
    return local ?? error?.issues?.find((entry) => entry.path === path || entry.path === `booking.${path}`)?.message;
  }
  function fieldProps(key: string, evidence = true) {
    const descriptions = [fieldIssue(key) && `wf-review-${key}-error`, evidence && `wf-review-${key}-evidence`].filter(Boolean).join(' ');
    return { id: `wf-review-${key}`, 'aria-invalid': !!fieldIssue(key), 'aria-describedby': descriptions || undefined };
  }
  // Times are stored as UTC instants but reviewed as local wall times in the booking's time zone.
  const zone = draft && isValidTimeZone(draft.localTimezone) ? draft.localTimezone : 'UTC';
  function editTime(key: 'startsAt' | 'endsAt', wall: string) { edit(key, localInputToInstant(wall, zone)); }
  function editZone(next: string) {
    setDraft((d) => {
      if (!d) return d;
      const to = isValidTimeZone(next) ? next : 'UTC';
      // Keep the wall times the confirmation states; only the zone they're in changes.
      const move = (i: string) => (i ? localInputToInstant(instantToLocalInput(i, zone), to) || i : i);
      return { ...d, localTimezone: next, startsAt: move(d.startsAt), endsAt: move(d.endsAt) };
    });
    setError(null); setMessage('');
  }

  const pasteError = !extraction && error && ['not_configured', 'validation_failed', 'provider_error', 'timeout', 'rate_limited'].includes(error.code);
  const confirmationInput = <form className={`wf-intake-compose${extraction ? ' wf-intake-compose-compact' : ''}`} aria-label="Booking confirmation" onSubmit={(e) => { e.preventDefault(); void extract(); }}>
    <fieldset disabled={saving}>
      <legend className="wf-visually-hidden">Paste a confirmation or use a sample</legend>
      <div className="wf-intake-compose-head">
        <span className="wf-intake-compose-title"><Icon name="doc" />Booking confirmation</span>
        <span className="wf-intake-count wf-num">{text.length.toLocaleString('en-US')} / {MAX_EXTRACTION_INPUT_CHARS.toLocaleString('en-US')}</span>
      </div>
      <label className="wf-visually-hidden" htmlFor="wf-intake-text">Paste booking confirmation</label>
      <textarea id="wf-intake-text" rows={extraction ? 4 : 9} maxLength={MAX_EXTRACTION_INPUT_CHARS} value={text} aria-invalid={!!pasteError} aria-describedby="wf-intake-text-help"
        placeholder="Paste a confirmation email or receipt here. WayFare reads the provider, dates, price and refund rules." onChange={(e) => changeText(e.target.value)} />
      <div className="wf-intake-compose-bar">
        <label className="wf-chipb wf-intake-sample"><span className="wf-visually-hidden">Sample document</span><Icon name="clip" />
          <select value={sample} onChange={(e) => setSample(e.target.value)}>
            {SAMPLE_IDS.map((id) => <option key={id} value={id}>{DEMO_DOCUMENT_SOURCES[id]!.title}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={() => changeText(DEMO_DOCUMENT_SOURCES[sample]!.text)}>Use sample document</Button>
        <span className="wf-intake-bar-gap" />
        <Button type="submit" variant="primary" aria-busy={loading} disabled={loading || text.trim().length < 20}>{loading ? 'Reading booking…' : 'Extract booking'}</Button>
      </div>
    </fieldset>
    <p id="wf-intake-text-help" className="wf-intake-help">{ctx.extraction.capability === 'live'
      ? 'Nothing is saved until you review it. Instructions inside pasted text are ignored.'
      : 'In this demo only the sample confirmations can be read; other text needs live AI on the server. Nothing is saved until you review it.'}</p>
  </form>;

  const policy = extraction?.policy;
  const [refundLabel, refundTone] = REFUNDABILITY[draft?.policyUncertain ? 'unknown' : policy?.refundability ?? 'unknown'] ?? REFUNDABILITY.unknown!;
  const saveHelp = validation?.ok ? 'Ready to save.' : draft?.confirmed ? 'Fix the highlighted details to save.' : 'Check the details, then confirm above to save.';

  return <div className="wf-stack-lg wf-intake">
    <header className="wf-page-header wf-intake-header">
      <Link className="wf-intake-back" to={`/trips/${tripId}/plan`}><Icon name="arrow" className="wf-icon wf-intake-back-icon" />Plan</Link>
      <h1>Import bookings</h1>
      <p>Add a booking you made somewhere else. WayFare reads the confirmation, you check every detail, and nothing is saved until you confirm.</p>
    </header>
    {extraction && confirmationInput}
    <div className="wf-intake-layout">
      <div className="wf-intake-capability">
        <div className="wf-intake-mode" data-capability={ctx.extraction.capability}>
          <Icon name={ctx.extraction.capability === 'unavailable' ? 'alert' : 'spark'} />
          <div>
            <strong>{ctx.extraction.capability === 'unavailable' ? 'Reading is unavailable' : ctx.extraction.capability === 'live' ? 'Read by WayFare AI' : 'Sample mode'}</strong>
            <p>{ctx.extraction.description.replace(/^Sample mode:\s*/i, '').replace(/^./, (c) => c.toUpperCase())}</p>
            {ctx.extraction.capability !== 'unavailable' && <CapabilityLabel status={ctx.extraction.capability}>extraction service</CapabilityLabel>}
          </div>
        </div>
      </div>
      <div className="wf-stack-lg wf-intake-main">
        {!extraction && confirmationInput}
        {loading && <LoadingState label="Reading the confirmation. Nothing has been saved." />}
        {error && <ErrorState error={error} onRetry={() => retry.current()} />}
        {message && <div role="status"><Notice tone={replayed ? 'info' : 'success'}>{message}</Notice></div>}
        {extraction && draft && <Card title="Review before saving" actions={<CapabilityLabel status={extraction.capability}>this extraction</CapabilityLabel>}>
          <p className="wf-intake-lead">Here’s what WayFare found. Fix anything that’s wrong; the original document stays attached.</p>
          <p className="wf-intake-req">Request {extraction.requestId}{extraction.model && ` · ${extraction.model}`}</p>
          {extraction.warnings.map((warning) => <Notice key={warning} tone="warning">{warning}</Notice>)}
          <form className="wf-stack" noValidate onSubmit={(e) => { e.preventDefault(); if (validation?.ok) void save(); }}>
            <fieldset disabled={saving} className="wf-stack-lg">
              <legend className="wf-visually-hidden">Booking details you can edit</legend>
              <div className="wf-intake-review-fields">
                <ReviewField name="kind" label="Booking type" issue={fieldIssue('kind')} field={extraction.booking.kind}>
                  <select {...fieldProps('kind')} className="wf-input" value={draft.kind} onChange={(e) => edit('kind', e.target.value as ReviewDraft['kind'])}>
                    <option value="">Choose a type</option>{BOOKING_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </ReviewField>
                <ReviewField name="provider" label="Provider" issue={fieldIssue('provider')} field={extraction.booking.provider}>
                  <input {...fieldProps('provider')} className="wf-input" value={draft.provider} onChange={(e) => edit('provider', e.target.value)} />
                </ReviewField>
                <ReviewField name="reference" label="Booking reference" issue={fieldIssue('reference')} field={extraction.booking.reference}>
                  <input {...fieldProps('reference')} className="wf-input" value={draft.reference} onChange={(e) => edit('reference', e.target.value)} />
                </ReviewField>
                <ReviewField name="title" label="Booking title" hint="optional" issue={fieldIssue('title')} field={extraction.booking.title}>
                  <input {...fieldProps('title')} className="wf-input" value={draft.title} onChange={(e) => edit('title', e.target.value)} />
                </ReviewField>
                <ReviewField name="startsAt" label="Starts" hint="local time" issue={fieldIssue('startsAt')} field={extraction.booking.startsAt}>
                  <input {...fieldProps('startsAt')} type="datetime-local" className="wf-input" value={instantToLocalInput(draft.startsAt, zone)} onChange={(e) => editTime('startsAt', e.target.value)} />
                </ReviewField>
                <ReviewField name="endsAt" label="Ends" hint="local time, optional" issue={fieldIssue('endsAt')} field={extraction.booking.endsAt}>
                  <input {...fieldProps('endsAt')} type="datetime-local" className="wf-input" value={instantToLocalInput(draft.endsAt, zone)} onChange={(e) => editTime('endsAt', e.target.value)} />
                </ReviewField>
                <ReviewField name="localTimezone" label="Time zone" issue={fieldIssue('localTimezone')} field={extraction.booking.localTimezone}>
                  <select {...fieldProps('localTimezone')} className="wf-input" value={draft.localTimezone} onChange={(e) => editZone(e.target.value)}>
                    <option value="">Choose a time zone</option>
                    {[...new Set([...(draft.localTimezone && isValidTimeZone(draft.localTimezone) ? [draft.localTimezone] : []), ...ZONES])].map((tz) => <option key={tz} value={tz}>{zoneLabel(tz)}</option>)}
                  </select>
                </ReviewField>
                <ReviewField name="amount" label="Amount paid" hint="leave blank if unknown" issue={fieldIssue('amount')} field={extraction.booking.paid}>
                  <div className="wf-intake-money"><span aria-hidden="true">$</span>
                    <input {...fieldProps('amount')} className="wf-input wf-num" inputMode="decimal" placeholder="Unknown" value={draft.amount} onChange={(e) => edit('amount', e.target.value)} />
                  </div>
                </ReviewField>
                <ReviewField name="currency" label="Currency" hint="this trip uses USD" issue={fieldIssue('currency')}>
                  <input {...fieldProps('currency', false)} className="wf-input" value={draft.currency} onChange={(e) => edit('currency', e.target.value.toUpperCase())} />
                </ReviewField>
              </div>

              <section className="wf-intake-policy" aria-label="Refund policy">
                <div className="wf-intake-policy-head">
                  <h3>Refund policy</h3>
                  <Tag tone={refundTone} icon={refundTone === 'ok' ? 'check' : refundTone === 'mute' ? 'minus' : 'alert'}>{refundLabel}</Tag>
                </div>
                <p className="wf-intake-muted">These are the provider’s terms, not money you’ve been paid.</p>
                {policy && !draft.policyUncertain && <>
                  {policy.refundTiers.length > 0 && <ul className="wf-intake-tiers">
                    {policy.refundTiers.map((tier, i) => <li key={i}>
                      <div className="wf-intake-tier-main">
                        <span className="wf-intake-tier-title">{tier.label}</span>
                        <span className="wf-intake-muted">{[windowText(tier, zone), CONDITION[tier.condition], isUnknown(tier.refund) || tier.refund.amountMinor ? METHOD[tier.method] : null].filter(Boolean).join(' · ')}</span>
                        <q className="wf-intake-quote">{tier.excerpt}</q>
                      </div>
                      <span className={`wf-intake-tier-amt wf-num${!isUnknown(tier.refund) && tier.refund.amountMinor > 0 ? ' wf-gain' : ''}`}>{!isUnknown(tier.refund) && tier.refund.amountMinor > 0 && '+'}<MoneyText value={tier.refund} /></span>
                    </li>)}
                  </ul>}
                  {policy.deadlines.map((deadline, i) => <div className="wf-intake-deadline" key={i}>
                    <Icon name="clock" />
                    <div><strong>{deadline.label}</strong>
                      <span>{formatInstant(deadline.at, deadline.displayTimezone)}</span>
                      <q className="wf-intake-quote">{deadline.excerpt}</q>
                    </div>
                  </div>)}
                  {policy.unknownFields.map((field, i) => <Notice tone="warning" key={i}>{field.reason}</Notice>)}
                  {!policy.refundTiers.length && <Notice tone="warning">No usable refund rules were extracted. Missing terms do not mean a full refund or a nonrefundable booking.</Notice>}
                </>}
                {draft.policyUncertain && <p className="wf-intake-muted">The terms will be saved as unknown and the original document kept for review.</p>}
                <label className="wf-intake-checkbox"><input type="checkbox" checked={draft.policyUncertain} onChange={(e) => edit('policyUncertain', e.target.checked)} />
                  <span>Policy terms are uncertain or incorrect · save them as unknown and keep the source for review</span></label>
              </section>

              {validation && !validation.ok && validation.error.issues?.some((entry) => entry.path !== 'confirmed') && <Notice tone="warning">Some details need fixing before you can save. Unknown prices and policy terms stay unknown.</Notice>}
              <div className="wf-intake-confirm">
                <label className="wf-intake-checkbox"><input type="checkbox" checked={draft.confirmed} onChange={(e) => edit('confirmed', e.target.checked)} />
                  <span>I reviewed the facts and confirm this document records a confirmed booking{extraction.capability !== 'live' ? ' (sample documents stay simulated)' : ''}.</span></label>
                <div className="wf-row wf-intake-actions">
                  <Button type="submit" variant="primary" aria-describedby="wf-review-save-help" aria-busy={saving} disabled={saving || !validation?.ok}>{saving ? 'Saving…' : 'Save reviewed booking'}</Button>
                  <Button variant="ghost" onClick={() => changeText(text)}>Start over</Button>
                  <span className="wf-intake-muted" id="wf-review-save-help">{saveHelp}</span>
                </div>
              </div>
            </fieldset>
          </form>
        </Card>}
      </div>
      <aside className="wf-stack-lg wf-intake-context" aria-label="Import context">
        {extraction && <Card title="Original document" actions={<span className="wf-label-mono">Kept as sent</span>}><pre className="wf-intake-doc">{text}</pre></Card>}
        <Card title="Saved bookings in this trip">
          {!loaded && <LoadingState label="Loading saved bookings…" />}
          {loaded && !bookings.length && <EmptyState title="No confirmed bookings have been imported." />}
          {bookings.length > 0 && <ul className="wf-intake-saved">
            {bookings.map((booking) => <li key={booking.id}>
              <span className="wf-intake-saved-ico" data-kind={booking.kind}><Icon name={KIND_ICON[booking.kind]} /></span>
              <span className="wf-intake-saved-main"><strong>{booking.provider}</strong><span className="wf-intake-muted">{KIND_LABEL[booking.kind]} · {booking.reference}{booking.state !== 'confirmed' ? ` · ${booking.state.charAt(0).toUpperCase() + booking.state.slice(1)}` : ''}</span></span>
              <span className="wf-num wf-intake-saved-amt"><MoneyText value={booking.paid} /></span>
            </li>)}
          </ul>}
          <Link className="wf-intake-link" to={`/trips/${tripId}`}>Back to trip overview<Icon name="arrow" /></Link>
        </Card>
      </aside>
    </div>
  </div>;
}

export const feature: FeatureModule = { key: 'intake', title: 'Import bookings', path: 'import', Page: IntakePage };
