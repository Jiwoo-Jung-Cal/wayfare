// Plan (Wayfinder), design r2-final (Figma 61:196; reference design/exports/prototype/r2 "plan").
// Visual layer by Agent 1 under Jiwoo's design-implementation scope. Logic is Agent 2's and
// unchanged: createPlanGenerator / generatePlans (validation, unsupported inputs, ranking,
// budget fit, unknown price never free) and selectPlanningOption (idempotent selection).
// The composer is a scripted demo assistant (assistant.ts): it reads destination, travelers,
// budget and priority from the message with simple rules; no AI model is used. Chicago and Tokyo
// plans create their own workspace trip when chosen (catalog.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { appError, isUnknown, type AppError, type FeatureModule, type FeaturePageProps, type MaybeMoney, type PlanOption } from '../../core/index.ts';
import { ErrorState, Notice } from '../../ui/index.tsx';
import { Icon, LogoMark } from '../../ui/icons.tsx';
import { SAMPLE_SCOPE, createPlanGenerator, defaultPreferences, type ComparedPlan, type PlanningResult, type Preferences } from './handler.ts';
import { DESTINATIONS, destinationFor, destinationOfTrip, tripFor, type Destination } from './catalog.ts';
import { applyRequest, parsePlanRequest, replyTo } from './assistant.ts';
import { selectPlanningOption } from './selection.ts';
import { planArt, type ArtKey } from './planArt.ts';
import './wayfinder.css';
import photoMidtown from './photos/plan-midtown.jpg';
import photoBrooklyn from './photos/plan-brooklyn.jpg';
import photoFlex from './photos/plan-flex.jpg';

const CAT: Record<string, [string, string]> = {
  flight: ['Flight', 'var(--wf-color-cat-flight)'],
  hotel: ['Hotel', 'var(--wf-color-cat-stay)'],
  activity: ['Activity', 'var(--wf-color-cat-activity)'],
  transfer: ['Airport ride', 'var(--wf-color-cat-ride)'],
  other: ['Other', 'var(--wf-color-text-muted)'],
};
const LEVEL = { low: 0, medium: 1, high: 2 } as const;
const ART: Record<string, ArtKey> = {
  'plan-demo-nonstop': 'hotel', 'plan-demo-saver': 'brooklyn', 'plan-demo-flex': 'walk',
  'plan-chi-nonstop': 'flight', 'plan-chi-saver': 'hotel', 'plan-chi-flex': 'walk',
  'plan-tyo-nonstop': 'flight', 'plan-tyo-saver': 'brooklyn', 'plan-tyo-flex': 'hotel',
};
/** Stock photos for the New York plans, supplied by Jiwoo (prototype r2 photos/). Other trips keep the illustrations. */
const PHOTO: Record<string, [src: string, alt: string]> = {
  'plan-demo-nonstop': [photoMidtown, 'Midtown Manhattan'],
  'plan-demo-saver': [photoBrooklyn, 'Brooklyn'],
  'plan-demo-flex': [photoFlex, 'Lower Manhattan'],
};
const baseId = (id: string) => id.replace(/-x\d+$/, '').replace(/-free-time$/, '');
const m0 = (m: MaybeMoney | undefined | null) => {
  if (!m || isUnknown(m)) return '?';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, maximumFractionDigits: m.amountMinor % 100 === 0 ? 0 : 2 }).format(Math.abs(m.amountMinor) / 100);
};
const fmtD = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateLabel = (a: string, b: string) => {
  const x = fmtD(a), y = fmtD(b);
  return x.split(' ')[0] === y.split(' ')[0] ? `${x} – ${y.split(' ')[1]}` : `${x} – ${y}`;
};
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const Dots = ({ n, label }: { n: number; label: string }) => (
  <span className="wf-dots" aria-hidden="false">
    {[0, 1, 2].map((i) => <i key={i} data-on={i <= n || undefined} aria-hidden="true" />)}
    <span className="wf-visually-hidden">{label}</span>
  </span>
);

function Pop({ open, label, onClose, children, left }: { open: boolean; label: string; onClose: () => void; children: React.ReactNode; left: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Focus the first control once when the popover opens. (Running this on every render moved
  // focus back to the first field after each keystroke, so the destination couldn't be typed.)
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('button,input')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.wf-pop,.wf-chipb')) closeRef.current(); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!open) return null;
  return <div ref={ref} className="wf-pop" role="dialog" aria-label={label} style={{ left }}>{children}</div>;
}

export function WayfinderPage({ tripId, ctx }: FeaturePageProps) {
  const navigate = useNavigate();
  const home = destinationOfTrip(tripId) ?? DESTINATIONS.nyc;
  const [preferences, setPreferences] = useState<Preferences>(() => defaultPreferences({ workspaceId: 'pending', now: ctx.clock.now() }, home.key));
  const [thread, setThread] = useState<{ from: 'you' | 'wayfare'; text: string }[]>([]);
  const [addedTrip, setAddedTrip] = useState<{ id: string; title: string } | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [tripTitle, setTripTitle] = useState('your trip');
  const [booked, setBooked] = useState(false);
  const [saved, setSaved] = useState<PlanOption | null>(null);
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [replayed, setReplayed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [pop, setPop] = useState<null | 'trav' | 'date' | 'route'>(null);
  const [trav, setTrav] = useState({ a: 1, c: 0 });
  const [draftDates, setDraftDates] = useState({ from: '', to: '' });
  const [dateErr, setDateErr] = useState(false);
  const [budgetText, setBudgetText] = useState<string | null>(null);
  const busy = useRef(false);
  const retry = useRef<() => void>(() => {});
  const answerRef = useRef<HTMLDivElement>(null);
  const generator = useMemo(() => createPlanGenerator(), [tripId]);
  useEffect(() => {
    let active = true;
    setInitializing(true); setError(null);
    retry.current = () => setLoadAttempt((n) => n + 1);
    Promise.all([ctx.repo.getTrip(tripId), ctx.repo.listPlans(tripId), ctx.repo.snapshot()]).then(([trip, plans, snap]) => {
      if (!active) return;
      setInitializing(false);
      if (!trip.ok) { setError(trip.error); return; }
      if (!plans.ok) { setError(plans.error); return; }
      setWorkspaceId(trip.value.workspaceId);
      setTripTitle(trip.value.title);
      setBooked(snap.ok && snap.value.bookings.some((b) => b.tripId === tripId));
      const chosen = plans.value.find((p) => p.id === trip.value.selectedPlanId) ?? null;
      setSaved(chosen);
      // Re-open on the saved plan's group size and activity choice, so the saved card shows as chosen.
      const group = Number(/-x(\d+)$/.exec(chosen?.id ?? '')?.[1] ?? 1);
      if (chosen && (group > 1 || /-free-time(-x\d+)?$/.test(chosen.id))) {
        setTrav({ a: group, c: 0 });
        setPreferences((p) => ({ ...p, travelers: group, interest: /-free-time(-x\d+)?$/.test(chosen.id) ? 'free_time' : p.interest,
          budget: String(Math.max(Number(p.budget), Math.ceil((chosen.total as { amountMinor?: number }).amountMinor ?? 0) / 100)) }));
      }
    }).catch(() => { if (active) { setInitializing(false); setError(appError('unavailable', 'Could not load the saved trip')); } });
    return () => { active = false; generator.invalidate(); };
  }, [ctx.repo, tripId, generator, loadAttempt]);

  // Like the reference, the comparison for the trip's sample route is shown on arrival.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!workspaceId || autoRan.current) return;
    autoRan.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
  async function generate(next: Preferences = preferences) {
    if (!workspaceId) return;
    retry.current = () => { void generate(next); };
    setLoading(true); setError(null); setMessage('');
    const target = destinationFor(next.destination);
    const response = await generator.generate(next, { tripId: target?.tripId ?? tripId, workspaceId, now: ctx.clock.now() });
    if (!response) return;
    setLoading(false);
    if (response.ok) { setResult(response.value); setDirty(false); }
    else setError(response.error);
  }
  /** Changing what matters re-ranks at once through the same generator (stale results can't be chosen meanwhile). */
  function change(patch: Partial<Preferences>, regenerate = true) {
    generator.invalidate(); setLoading(false); setDirty(true); setError(null); setMessage('');
    const next = { ...preferences, ...patch };
    setPreferences(next);
    if (regenerate && result) void generate(next);
    return next;
  }
  async function select(plan: PlanOption) {
    if (busy.current) return;
    retry.current = () => { void select(plan); };
    busy.current = true; setSaving(plan.id); setError(null); setMessage('');
    try {
      // A plan for another destination (Chicago, Tokyo) belongs to its own trip: add it first.
      const target = destinationOfTrip(plan.tripId);
      let created: { id: string; title: string } | null = null;
      if (plan.tripId !== tripId && target) {
        const exists = await ctx.repo.getTrip(plan.tripId);
        if (!exists.ok) {
          const made = await ctx.repo.saveTrip(tripFor(target.key, { workspaceId: plan.workspaceId, now: ctx.clock.now() }), { expectedRevision: null });
          if (!made.ok) { setError(made.error); return; }
          created = { id: target.tripId, title: target.title };
        }
      }
      const response = await selectPlanningOption(ctx.repo, plan, ctx.clock.now());
      if (!response.ok) { setError(response.error); return; }
      setSaved({ ...response.value.plan, status: 'selected' });
      // Bookings may have changed since this page loaded (e.g. a demo reset): read them again
      // so a newly selected plan is never labelled booked when the trip has no bookings.
      const snap = await ctx.repo.snapshot();
      setBooked(snap.ok && snap.value.bookings.some((b) => b.tripId === plan.tripId));
      setReplayed(response.value.replayed);
      setAddedTrip(plan.tripId !== tripId && target ? { id: target.tripId, title: target.title } : null);
      setMessage(created ? `Added ${created.title} to your trips. Plan saved. No reservation was made.`
        : response.value.replayed ? 'This plan is already selected. No reservation was made.' : 'Plan saved. No reservation was made.');
      try { await ctx.refresh(); } catch { setError(appError('unavailable', 'Plan saved, but the dashboard could not refresh. Reload to see it.')); }
    } catch { setError(appError('unavailable', 'Could not select the plan. Your options are preserved.')); }
    finally { busy.current = false; setSaving(null); }
  }
  function ask(q: string) {
    const req = parsePlanRequest(q);
    const next = applyRequest(preferences, req);
    const current = destinationFor(preferences.destination) ?? home;
    setThread((t) => [...t, ...(q ? [{ from: 'you' as const, text: q }] : []), { from: 'wayfare' as const, text: replyTo(req, next, current) }]);
    setPrompt('');
    if (req.unknownPlace) return;
    if (req.travelers) setTrav({ a: req.travelers, c: 0 });
    if (req.budget) setBudgetText(null);
    setAddedTrip(null);
    generator.invalidate(); setDirty(false); setPreferences(next);
    void generate(next).then(() => answerRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  /** Route popover Done: a known city name picks that destination, its sample dates and budget. */
  function applyRoute() {
    const d = destinationFor(preferences.destination);
    const next = d ? { ...preferences, destination: d.name, ...(d.name !== (result?.preferences.destination ?? '') ? { startDate: d.startDate, endDate: d.endDate, budget: d.defaultBudget } : {}) } : preferences;
    setBudgetText(null); setAddedTrip(null);
    generator.invalidate(); setPreferences(next);
    void generate(next);
  }
  const fieldError = (key: keyof Preferences) => error?.issues?.find((entry) => entry.path === key)?.message
    ?? (error?.code === 'unsupported' && (key === 'destination' || key === 'origin') ? 'Use the supported SFO–New York route and November 20–23 dates.' : undefined);
  const travelers = trav.a + trav.c;
  const shownPreferences = result?.preferences ?? preferences;
  const nights = nightsBetween(shownPreferences.startDate, shownPreferences.endDate);
  const budgetNum = parseFloat(shownPreferences.budget);
  const shownDest: Destination = destinationFor(shownPreferences.destination) ?? home;

  const card = ({ plan, knownSubtotal, budgetStatus }: ComparedPlan, index: number, list: ComparedPlan[]) => {
    const isSaved = saved ? baseId(saved.id) === baseId(plan.id) && saved.id === plan.id : false;
    const isCurrent = isSaved && booked;
    const total = plan.total;
    const known = !isUnknown(knownSubtotal) ? knownSubtotal.amountMinor / 100 : 0;
    const left = !isUnknown(total) ? budgetNum - total.amountMinor / 100 : null;
    const stat = budgetStatus === 'within' ? <span className="wf-gain">{m0({ amountMinor: Math.round((left ?? 0) * 100), currency: 'USD' })} under budget</span>
      : budgetStatus === 'over' ? <span className="wf-loss">{m0({ amountMinor: Math.round(-(left ?? 0) * 100), currency: 'USD' })} over budget</span>
      : known > budgetNum ? <span className="wf-loss">{m0({ amountMinor: Math.round((known - budgetNum) * 100), currency: 'USD' })}+ over budget</span>
      : <span className="wf-muted">Can’t check budget yet</span>;
    const badge = index === 0 ? { tone: 'ok', icon: 'check' as const, text: { price: 'Best price', convenience: 'Most convenient', flexibility: 'Most flexible' }[result!.preferences.priority] }
      : isSaved ? { tone: 'info', icon: 'spark' as const, text: booked ? 'Your current trip' : 'Your selected plan' } : null;
    const block = budgetStatus === 'unknown' ? 'A price is still unknown. You can choose this once every part is quoted.' : budgetStatus === 'over' ? 'This is over your budget. Raise the budget or pick “Free time” to choose it.' : '';
    const disabled = dirty || loading || saving !== null || budgetStatus !== 'within';
    return <article key={plan.id} className="wf-pcard" data-selected={isSaved || undefined} aria-labelledby={`wf-pc-${plan.id}`} style={{ animationDelay: `${index * 70}ms` }}>
      <div className="wf-ph" role="img" aria-label={PHOTO[baseId(plan.id)] ? `Photo: ${PHOTO[baseId(plan.id)]![1]}` : `Illustration: ${plan.label}`}>
        {PHOTO[baseId(plan.id)] ? <img className="wf-photo" src={PHOTO[baseId(plan.id)]![0]} alt="" loading="lazy" />
          : <span dangerouslySetInnerHTML={{ __html: planArt(ART[baseId(plan.id)] ?? 'hotel') }} />}
        {badge && <span className="wf-tag wf-ph-badge" data-tone={badge.tone}><Icon name={badge.icon} />{badge.text}</span>}
      </div>
      <span className="wf-rank">OPTION {index + 1}{isCurrent ? ' · BOOKED' : ''}</span>
      <h3 className="wf-pc-t" id={`wf-pc-${plan.id}`}>{plan.label}</h3>
      <p className="wf-pc-s">{plan.summary}</p>
      <div className="wf-pc-tot">{isUnknown(total) ? <b>{m0(knownSubtotal)} + ?</b> : <b>{m0(total)}</b>}<span>{stat}</span></div>
      <div className="wf-cbar" role="img" aria-label={`Cost split: ${plan.lineItems.map((it) => `${CAT[it.kind]![0]} ${isUnknown(it.price) ? 'not quoted' : m0(it.price)}`).join(', ')}`}>
        {plan.lineItems.map((it) => <i key={it.id} data-unk={isUnknown(it.price) || undefined} style={{ flexGrow: isUnknown(it.price) ? 60 : it.price.amountMinor / 100, background: isUnknown(it.price) ? undefined : CAT[it.kind]![1] }} title={`${CAT[it.kind]![0]}: ${isUnknown(it.price) ? 'not quoted' : m0(it.price)}`} />)}
      </div>
      <div className="wf-rates"><span>Convenience<Dots n={LEVEL[plan.convenience]} label={plan.convenience} /></span><span>Flexibility<Dots n={LEVEL[plan.flexibility]} label={plan.flexibility} /></span></div>
      <details>
        <summary><Icon name="chev" />Where the money goes</summary>
        {plan.lineItems.map((it) => <div className="wf-li" key={it.id}><i style={{ background: CAT[it.kind]![1] }} /><span>{it.description}<small>{isUnknown(it.price) ? 'No quote received yet' : `Sample quote · ${it.provenance.source}`}</small></span><span className="wf-num">{isUnknown(it.price) ? 'Not quoted' : m0(it.price)}</span></div>)}
        <div className="wf-li wf-li-sum"><i /><span>{isUnknown(total) ? 'Known so far' : 'Total for the listed parts'}</span><span className="wf-num">{m0(knownSubtotal)}{isUnknown(total) ? ' + ?' : ''}</span></div>
        <ul className="wf-assume">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
      <div>
        {isCurrent ? <Link className="wf-button" data-size="sm" to={`/trips/${tripId}`}>View your trip</Link>
          : <button type="button" className="wf-button" data-size="sm" data-variant={isSaved ? 'secondary' : 'dark'} disabled={disabled} onClick={() => void select(plan)}>{saving === plan.id ? 'Saving plan…' : isSaved ? 'Selected plan' : 'Choose this plan'}</button>}
      </div>
      {!isCurrent && block && <p className="wf-why-no">{block}</p>}
      {isSaved && !isCurrent && <p className="wf-why-no">Saved to your trip. Nothing is booked or paid until you confirm.</p>}
      {list.length === 0 && null}
    </article>;
  };

  const rows = result ? (['flight', 'hotel', 'activity', 'transfer'] as const).filter((k) => result.options.some((o) => o.plan.lineItems.some((i) => i.kind === k))) : [];
  const cell = (o: ComparedPlan, k: string) => {
    const it = o.plan.lineItems.find((i) => i.kind === k);
    if (!it) return '—';
    if (isUnknown(it.price)) return <span className="wf-muted">Not quoted</span>;
    const min = Math.min(...result!.options.map((q) => q.plan.lineItems.find((i) => i.kind === k)).filter((i): i is NonNullable<typeof i> => !!i && !isUnknown(i.price)).map((i) => (i.price as { amountMinor: number }).amountMinor));
    return <span className={it.price.amountMinor === min ? 'wf-lo' : ''}>{m0(it.price)}</span>;
  };

  return <div className="wf-wayfinder">
    <div className="wf-plan-hero">
      <LogoMark className="wf-plan-wm" />
      <h1>Where to next?</h1>
      <p>Describe the trip you want. WayFare compares options, shows every cost, and books it for you.</p>
      <form className="wf-composer" onSubmit={(e) => { e.preventDefault(); ask(prompt.trim()); }}>
        <label htmlFor="wf-prompt" className="wf-visually-hidden">Describe your trip</label>
        <textarea id="wf-prompt" rows={2} placeholder="3 nights in New York from San Francisco, under $1,000, with a skyline walk" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(prompt.trim()); } }} />
        <div className="wf-cb">
          <button type="button" className="wf-ib" aria-label="Attach a booking confirmation" title="Attach a booking confirmation" onClick={() => void navigate(`/trips/${tripId}/import`)}><Icon name="clip" /></button>
          <button type="button" className="wf-chipb wf-chip-route" aria-haspopup="dialog" aria-expanded={pop === 'route'} aria-label={`Route: ${preferences.origin} → ${preferences.destination}`} title={`${preferences.origin} → ${preferences.destination}`} onClick={() => setPop(pop === 'route' ? null : 'route')}><Icon name="route" /><span>{preferences.origin} → {preferences.destination}</span></button>
          <button type="button" className="wf-chipb" aria-haspopup="dialog" aria-expanded={pop === 'trav'} onClick={() => setPop(pop === 'trav' ? null : 'trav')}><Icon name="user" /><span>{travelers} traveler{travelers > 1 ? 's' : ''}</span></button>
          <button type="button" className="wf-chipb" aria-haspopup="dialog" aria-expanded={pop === 'date'} onClick={() => { setDraftDates({ from: preferences.startDate, to: preferences.endDate }); setDateErr(false); setPop(pop === 'date' ? null : 'date'); }}><Icon name="cal" /><span>{dateLabel(preferences.startDate, preferences.endDate)}</span></button>
          <button type="submit" className="wf-send" aria-label="Plan it" disabled={!workspaceId || loading || initializing}><Icon name="send" /></button>
          <Pop open={pop === 'route'} label="Route" left={52} onClose={() => setPop(null)}>
            <h4>Where from and to?</h4>
            <div className="wf-dates">
              <label>Origin<input value={preferences.origin} aria-invalid={!!fieldError('origin')} onChange={(e) => change({ origin: e.target.value }, false)} /></label>
              <label>Destination<input value={preferences.destination} aria-invalid={!!fieldError('destination')} onChange={(e) => change({ destination: e.target.value }, false)} /></label>
            </div>
            <p className="wf-muted wf-pop-note">{SAMPLE_SCOPE}</p>
            <div className="wf-pf">
              <button type="button" className="wf-button" data-size="sm" onClick={() => { setBudgetText(null); change(defaultPreferences({ workspaceId: workspaceId ?? 'pending', now: ctx.clock.now() }, home.key), false); }}>Use supported sample</button>
              <button type="button" className="wf-button" data-variant="dark" data-size="sm" onClick={() => { setPop(null); applyRoute(); }}>Done</button>
            </div>
          </Pop>
          <Pop open={pop === 'trav'} label="Travelers" left={210} onClose={() => setPop(null)}>
            <h4>Who’s going?</h4>
            {(['a', 'c'] as const).map((k) => <div className="wf-stepper" key={k}>
              <div>{k === 'a' ? 'Adults' : 'Children'}<small>{k === 'a' ? 'Age 13 or older' : 'Ages 2–12'}</small></div>
              <div className="wf-ctr">
                <button type="button" aria-label={k === 'a' ? 'Fewer adults' : 'Fewer children'} disabled={k === 'a' ? trav.a <= 1 : trav.c <= 0} onClick={() => setTrav((t) => ({ ...t, [k]: t[k] - 1 }))}>−</button>
                <b className="wf-num">{trav[k]}</b>
                <button type="button" aria-label={k === 'a' ? 'More adults' : 'More children'} disabled={travelers >= 9} onClick={() => setTrav((t) => ({ ...t, [k]: t[k] + 1 }))}>+</button>
              </div>
            </div>)}
            <p className="wf-muted wf-pop-note">Group pricing: flights and tickets per person, one hotel room per two, one car per four.</p>
            <div className="wf-pf"><button type="button" className="wf-button" data-variant="dark" data-size="sm" onClick={() => { setPop(null); if (travelers !== preferences.travelers) change({ travelers }); }}>Done</button></div>
          </Pop>
          <Pop open={pop === 'date'} label="Dates" left={330} onClose={() => setPop(null)}>
            <h4>When are you going?</h4>
            <div className="wf-dates">
              <label>Leave<input type="date" value={draftDates.from} onChange={(e) => setDraftDates((d) => ({ ...d, from: e.target.value }))} /></label>
              <label>Return<input type="date" value={draftDates.to} onChange={(e) => setDraftDates((d) => ({ ...d, to: e.target.value }))} /></label>
            </div>
            {dateErr && <p className="wf-pop-err" role="alert">The return date must be after the leave date.</p>}
            <div className="wf-pf"><button type="button" className="wf-button" data-variant="dark" data-size="sm" onClick={() => {
              const bad = !draftDates.from || !draftDates.to || draftDates.to <= draftDates.from;
              setDateErr(bad);
              if (!bad) { setPop(null); change({ startDate: draftDates.from, endDate: draftDates.to }); }
            }}>Done</button></div>
          </Pop>
        </div>
      </form>
      {thread.length > 0 && <div className="wf-thread" aria-label="Conversation with WayFare" role="log">
        {thread.map((m, i) => <div key={i} className="wf-msg" data-from={m.from}>
          {m.from === 'wayfare' && <span className="wf-spark" aria-hidden="true"><Icon name="spark" /></span>}
          <p><span className="wf-visually-hidden">{m.from === 'you' ? 'You: ' : 'WayFare: '}</span>{m.text}</p>
        </div>)}
        <p className="wf-thread-note">Demo assistant: it reads your message with simple rules and answers from sample quotes. No AI model is used.</p>
      </div>}
      <div className="wf-examples">
        <div className="wf-eh">Or start from an example</div>
        <div className="wf-ex-grid">
          {([['compass', 'Plan a weekend away', 'Flights, a stay and one thing to do', 'A long weekend in New York, Nov 20–23, under $1,000'],
            ['shield', 'Keep it refundable', 'Only options you can cancel for free', 'Only fully refundable flights and hotels for New York, Nov 20–23'],
            ['search', 'Find a cheaper flight', 'Same dates, lower fare', 'Find a cheaper flight from San Francisco to New York on Nov 20']] as const).map(([icon, t, s, q]) => (
            <button key={t} type="button" className="wf-ex" onClick={() => { setPrompt(q); ask(q); }}><Icon name={icon} /><div><b>{t}</b><span>{s}</span></div></button>
          ))}
        </div>
      </div>
      {saved && <div className="wf-recent"><span>{tripTitle} · {booked ? 'booked from this plan' : 'plan selected, nothing booked yet'}</span><span>{saved.label}</span></div>}
    </div>

    <div className="wf-answer" ref={answerRef}>
      {error && <ErrorState error={error} onRetry={() => retry.current()} />}
      {message && <div role="status"><Notice tone={replayed ? 'info' : 'success'}>{message}{addedTrip && <> <Link to={`/trips/${addedTrip.id}`}>Open {addedTrip.title}</Link></>}</Notice></div>}
      {loading && !result && <><div className="wf-ah"><span className="wf-spark"><Icon name="spark" /></span><p className="wf-muted">Wayfinder is comparing flights, stays and activities…</p></div><div className="wf-plan-options">{[0, 1, 2].map((i) => <div key={i} className="wf-shimmer" />)}</div></>}
      {result && <section aria-label="Plan comparison">
        <div className="wf-ah"><span className="wf-spark"><Icon name="spark" /></span><div>
          <b>I found {result.options.length} plans for {result.preferences.destination}, {dateLabel(result.preferences.startDate, result.preferences.endDate)} · {result.preferences.travelers} traveler{result.preferences.travelers === 1 ? '' : 's'}.</b>
          <p className="wf-muted">Sample quotes for {nights} night{nights === 1 ? '' : 's'}, {result.preferences.travelers === 1 ? 'one traveler' : `${result.preferences.travelers} travelers (group pricing)`} and the listed parts only. Change what matters to you and Wayfinder re-ranks them.</p>
        </div></div>
        <div className="wf-wfbox">
          <div className="wf-wfk"><Icon name="compass" />Wayfinder<span className="wf-label-mono">Compare your options</span></div>
          <div><span className="wf-lbl" id="wf-bl">Budget</span>
            <label className="wf-money-in"><span>$</span><input aria-labelledby="wf-bl" aria-describedby={fieldError('budget') ? 'wf-budget-error' : undefined} inputMode="decimal" value={budgetText ?? preferences.budget} aria-invalid={!!fieldError('budget')} onChange={(e) => {
              const v = e.target.value; setBudgetText(v);
              change({ budget: v });
            }} /></label>
            {fieldError('budget') && <p className="wf-pop-err" id="wf-budget-error">{fieldError('budget')}</p>}
          </div>
          <div><span className="wf-lbl">What matters most</span><div className="wf-seg" role="group" aria-label="What matters most">
            {(['price', 'convenience', 'flexibility'] as const).map((k) => <button key={k} type="button" aria-pressed={preferences.priority === k} onClick={() => change({ priority: k })}>{k[0]!.toUpperCase() + k.slice(1)}</button>)}
          </div></div>
          <div><span className="wf-lbl">{shownDest.interest.when}</span><div className="wf-seg" role="group" aria-label={shownDest.interest.when}>
            {([['skyline', shownDest.interest.label], ['free_time', 'Free time']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={preferences.interest === k} onClick={() => change({ interest: k })}>{l}</button>)}
          </div></div>
          <p className="wf-why"><Icon name="info" />{result.preferences.priority === 'price' ? 'Ordered by listed cost. A plan with a missing price goes last.' : `Ordered by ${result.preferences.priority}, then by price. Budget checks stay the same.`}</p>
        </div>
        {dirty && <Notice tone="warning">Preferences changed. These are previous results; they update when the new comparison is ready.</Notice>}
        <div className="wf-plan-options">{result.options.map((o, i, l) => card(o, i, l))}</div>
        <div className="wf-cmp">
          <h3>Side by side</h3>
          <p>Every listed cost, in one place. The lowest price in each row is green. Return travel, meals and unlisted fees aren’t included.</p>
          <div className="wf-cmp-wrap"><table className="wf-cmp-t">
            <thead><tr><th scope="col">Cost</th>{result.options.map((o) => <th scope="col" key={o.plan.id}>{o.plan.label}</th>)}</tr></thead>
            <tbody>{rows.map((k) => <tr key={k}><td><i style={{ background: CAT[k]![1] }} />{CAT[k]![0]}</td>{result.options.map((o) => <td key={o.plan.id}>{cell(o, k)}</td>)}</tr>)}</tbody>
            <tfoot><tr><td>Total</td>{result.options.map((o) => <td key={o.plan.id}>{isUnknown(o.plan.total) ? `${m0(o.knownSubtotal)} + ?` : m0(o.plan.total)}</td>)}</tr></tfoot>
          </table></div>
        </div>
      </section>}
    </div>
  </div>;
}

export const feature: FeatureModule = { key: 'wayfinder', title: 'Wayfinder', path: 'plan', Page: WayfinderPage };
