import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { appError, isUnknown, type AppError, type FeatureModule, type FeaturePageProps, type PlanOption } from '../../core/index.ts';
import { Button, Card, ErrorState, InstantText, KeyValue, LoadingState, MoneyStat, MoneyText, Notice, StatusBadge } from '../../ui/index.tsx';
import { SAMPLE_SCOPE, budgetForDisplay, createPlanGenerator, defaultPreferences, type PlanningResult, type Preferences } from './handler.ts';
import { selectPlanningOption } from './selection.ts';
import './wayfinder.css';

function PlanDetails({ plan }: { plan: PlanOption }) {
  return <details><summary>Itinerary and cost sources</summary><div className="wf-stack">
    {plan.lineItems.map((item) => <div key={item.id}>
      <strong>{item.description}</strong> — <MoneyText value={item.price} />
      {isUnknown(item.price) && <p>{item.price.reason}</p>}
      <p className="wf-muted">{item.provenance.kind}: {item.provenance.source} · recorded <InstantText value={item.provenance.recordedAt} />
        {item.expiresAt && <> · expires <InstantText value={item.expiresAt} /></>}</p>
    </div>)}
    <ul>{plan.assumptions.map((text) => <li key={text}>{text}</li>)}</ul>
  </div></details>;
}

function PlanCosts({ plan }: { plan: PlanOption }) {
  return <Card title={`${plan.label} — itemized`} actions={<StatusBadge tone="simulated">Sample quotes</StatusBadge>}>
    <div>{plan.lineItems.map((item) => <KeyValue key={item.id} label={item.description} value={<MoneyText value={item.price} />} />)}</div>
    <KeyValue label="Listed total" value={<MoneyText value={plan.total} />} emphasis="total" />
    <PlanDetails plan={plan} />
  </Card>;
}

export function WayfinderPage({ tripId, ctx }: FeaturePageProps) {
  const [preferences, setPreferences] = useState<Preferences>(() => defaultPreferences({ workspaceId: 'pending', now: ctx.clock.now() }));
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
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
  const busy = useRef(false);
  const retry = useRef<() => void>(() => {});
  const generator = useMemo(() => createPlanGenerator(), [tripId]);
  useEffect(() => {
    let active = true;
    setInitializing(true); setError(null);
    retry.current = () => setLoadAttempt((n) => n + 1);
    Promise.all([ctx.repo.getTrip(tripId), ctx.repo.listPlans(tripId)]).then(([trip, plans]) => {
      if (!active) return;
      setInitializing(false);
      if (!trip.ok) { setError(trip.error); return; }
      if (!plans.ok) { setError(plans.error); return; }
      setWorkspaceId(trip.value.workspaceId);
      setSaved(plans.value.find((p) => p.id === trip.value.selectedPlanId) ?? null);
    }).catch(() => { if (active) { setInitializing(false); setError(appError('unavailable', 'Could not load the saved trip')); } });
    return () => { active = false; generator.invalidate(); };
  }, [ctx.repo, tripId, generator, loadAttempt]);

  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    generator.invalidate(); setLoading(false); setDirty(true); setError(null); setMessage('');
    setPreferences((p) => ({ ...p, [key]: value }));
  }
  async function generate() {
    if (!workspaceId) return;
    retry.current = () => { void generate(); };
    setLoading(true); setError(null); setMessage('');
    const response = await generator.generate(preferences, { tripId, workspaceId, now: ctx.clock.now() });
    if (!response) return;
    setLoading(false);
    if (response.ok) { setResult(response.value); setDirty(false); }
    else setError(response.error);
  }
  async function select(plan: PlanOption) {
    if (busy.current) return;
    retry.current = () => { void select(plan); };
    busy.current = true; setSaving(plan.id); setError(null); setMessage('');
    try {
      const response = await selectPlanningOption(ctx.repo, plan, ctx.clock.now());
      if (!response.ok) { setError(response.error); return; }
      setSaved({ ...response.value.plan, status: 'selected' });
      setReplayed(response.value.replayed);
      setMessage(response.value.replayed ? 'This plan is already selected. No reservation was made.' : 'Plan saved. No reservation was made.');
      try { await ctx.refresh(); } catch { setError(appError('unavailable', 'Plan saved, but the dashboard could not refresh. Reload to see it.')); }
    } catch { setError(appError('unavailable', 'Could not select the plan. Your options are preserved.')); }
    finally { busy.current = false; setSaving(null); }
  }
  function fieldError(key: keyof Preferences) {
    return error?.issues?.find((entry) => entry.path === key)?.message
      ?? (error?.code === 'unsupported' && key === 'destination' ? 'Use the supported SFO–New York route and November 20–23 dates.' : undefined);
  }
  function fieldProps(key: keyof Preferences) {
    const descriptions = [fieldError(key) && `wf-plan-${key}-error`, ['budget', 'interest', 'priority'].includes(key) && `wf-plan-${key}-help`].filter(Boolean).join(' ');
    return { 'aria-labelledby': `wf-plan-${key}-label`, 'aria-invalid': !!fieldError(key), 'aria-describedby': descriptions || undefined };
  }
  const issue = (key: keyof Preferences) => fieldError(key) && <span className="wf-plan-field-error" id={`wf-plan-${key}-error`}>{fieldError(key)}</span>;
  return <div className="wf-stack-lg wf-wayfinder">
    <header className="wf-page-header"><h1>Wayfinder</h1>
      <p>Compare proposed plans for San Francisco → New York, November 20–23, 2026. Selecting a plan does not buy or confirm anything.</p>
    </header>
    {initializing && <LoadingState label="Loading your saved plan…" />}
    {saved && <Card title="Saved selected plan" actions={<StatusBadge tone="accent" wrap>Selected · no reservation made</StatusBadge>}><strong>{saved.label}</strong>
      <MoneyStat label="Listed total" value={saved.total} caption="Planned components; no confirmed booking" />
      <PlanDetails plan={saved} />
      <Link to={`/trips/${tripId}/import`}>Import confirmed bookings</Link>
    </Card>}
    <Card title="Trip preferences" actions={<StatusBadge>One traveler · USD</StatusBadge>}><form className="wf-stack" noValidate onSubmit={(e) => { e.preventDefault(); void generate(); }}>
      <fieldset disabled={saving !== null || initializing} className="wf-stack-lg"><legend className="wf-visually-hidden">Trip preferences for one traveler in USD</legend>
        <div className="wf-plan-route-fields">
          <label className="wf-stack"><span id="wf-plan-origin-label">Origin</span><input {...fieldProps('origin')} className="wf-input" value={preferences.origin} onChange={(e) => change('origin', e.target.value)} />{issue('origin')}</label>
          <label className="wf-stack"><span id="wf-plan-destination-label">Destination</span><input {...fieldProps('destination')} className="wf-input" value={preferences.destination} onChange={(e) => change('destination', e.target.value)} />{issue('destination')}</label>
          <label className="wf-stack"><span id="wf-plan-startDate-label">Start date</span><input {...fieldProps('startDate')} className="wf-input" type="date" value={preferences.startDate} onChange={(e) => change('startDate', e.target.value)} />{issue('startDate')}</label>
          <label className="wf-stack"><span id="wf-plan-endDate-label">End date</span><input {...fieldProps('endDate')} className="wf-input" type="date" value={preferences.endDate} onChange={(e) => change('endDate', e.target.value)} />{issue('endDate')}</label>
        </div>
        <div className="wf-plan-choice-fields">
          <label className="wf-stack"><span id="wf-plan-budget-label">Budget for listed components (USD)</span><input {...fieldProps('budget')} className="wf-input" inputMode="decimal" value={preferences.budget} onChange={(e) => change('budget', e.target.value)} />{issue('budget')}<span className="wf-muted" id="wf-plan-budget-help">Excludes return travel, meals, taxes/fees not itemized</span></label>
          <label className="wf-stack"><span id="wf-plan-interest-label">Interest</span><select {...fieldProps('interest')} className="wf-input" value={preferences.interest} onChange={(e) => change('interest', e.target.value as Preferences['interest'])}><option value="skyline">Skyline walk</option><option value="free_time">Free time · omit paid activity</option></select><span className="wf-muted" id="wf-plan-interest-help">Free time omits the $80 sample activity</span></label>
          <label className="wf-stack"><span id="wf-plan-priority-label">Prioritize</span><select {...fieldProps('priority')} className="wf-input" value={preferences.priority} onChange={(e) => change('priority', e.target.value as Preferences['priority'])}><option value="price">Price</option><option value="convenience">Convenience</option><option value="flexibility">Flexibility</option></select><span className="wf-muted" id="wf-plan-priority-help">Price · Convenience · Flexibility</span></label>
        </div>
        <div className="wf-row"><Button type="submit" variant="primary" disabled={!workspaceId || loading}>{result ? 'Regenerate options' : 'Generate options'}</Button>
          <Button variant="ghost" onClick={() => { generator.invalidate(); setPreferences(defaultPreferences({ workspaceId: workspaceId ?? 'pending', now: ctx.clock.now() })); setDirty(true); setLoading(false); setError(null); setMessage(''); }}>Use supported sample</Button></div>
      </fieldset>
    </form></Card>
    <Notice tone="simulated"><strong>Sample planning candidates</strong><p>{SAMPLE_SCOPE}</p>
      Providers and prices are fictional, not live availability. Totals cover the listed components; return travel, meals, and separately itemized taxes or fees are not quoted.
    </Notice>
    {loading && <LoadingState label="Comparing sample candidates; previous results remain below…" />}
    {error && <ErrorState error={error} onRetry={() => retry.current()} />}
    {message && <div role="status"><Notice tone={replayed ? 'info' : 'success'}>{message}</Notice></div>}
    {dirty && result && <Notice tone="warning">Preferences changed. These are previous results; regenerate before selecting.</Notice>}
    {result && <section aria-label="Plan comparison" className="wf-stack">
      <h2>Compare proposed plans</h2><p>Ordered by {result.preferences.priority} · budget <MoneyText value={budgetForDisplay(result.preferences.budget)} /> for listed components</p><p className="wf-muted">{result.options[0]?.explanation}</p>
      <p>Results: {result.preferences.origin} → {result.preferences.destination}, {result.preferences.startDate}–{result.preferences.endDate}; {result.preferences.interest === 'skyline' ? 'skyline walk' : 'free time'}.</p>
      <div className="wf-plan-options">{result.options.map(({ plan, knownSubtotal, budgetStatus }, index) => <article className="wf-card wf-stack wf-plan-card" key={plan.id} data-selected={saved?.id === plan.id || undefined}>
        <div className="wf-plan-card-title"><h3>{`${index + 1}. ${plan.label}`}</h3><StatusBadge tone="simulated" wrap>Sample quote</StatusBadge></div><p className="wf-muted">{plan.summary}</p>
        <MoneyStat label="Listed total" value={plan.total} size="hero" tone={isUnknown(plan.total) ? 'muted' : 'default'} caption={isUnknown(plan.total) ? <>Known subtotal: <MoneyText value={knownSubtotal} /> plus an unknown price.</> : 'Covers listed components only'} />
        {saved?.id === plan.id && <StatusBadge tone="accent" wrap>Selected · no reservation made</StatusBadge>}
        <div><StatusBadge tone={budgetStatus === 'within' ? 'positive' : 'warning'} wrap>{budgetStatus === 'within' ? 'Within component budget' : budgetStatus === 'over' ? 'Over component budget' : 'Budget fit unknown'}</StatusBadge></div>
        <p className="wf-muted">Convenience: {plan.convenience} · Flexibility: {plan.flexibility}</p>
        <Button variant={saved?.id === plan.id ? 'secondary' : 'primary'} disabled={dirty || loading || saving !== null || budgetStatus !== 'within'} onClick={() => void select(plan)}>{saving === plan.id ? 'Saving plan…' : saved?.id === plan.id ? 'Selected plan' : 'Select plan'}</Button>
        {budgetStatus !== 'within' && <p className="wf-muted">{budgetStatus === 'over' ? 'Raise the budget or change interests before selecting.' : 'Choose a fully priced option; an unknown price is not free.'}</p>}
      </article>)}</div>
      <div className="wf-plan-breakdowns" aria-label="Itemized plan costs">{result.options.map(({ plan }) => <PlanCosts key={plan.id} plan={plan} />)}</div>
    </section>}
  </div>;
}

export const feature: FeatureModule = { key: 'wayfinder', title: 'Wayfinder', path: 'plan', Page: WayfinderPage };
