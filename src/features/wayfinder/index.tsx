import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { appError, isUnknown, type AppError, type FeatureModule, type FeaturePageProps, type PlanOption } from '../../core/index.ts';
import { Button, CapabilityLabel, Card, ErrorState, InstantText, LoadingState, MoneyText, Notice, StatusBadge } from '../../ui/index.tsx';
import { SAMPLE_SCOPE, createPlanGenerator, defaultPreferences, type PlanningResult, type Preferences } from './handler.ts';
import { selectPlanningOption } from './selection.ts';

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
      setMessage(response.value.replayed ? 'This plan is already selected. No reservation was made.' : 'Plan saved. No reservation was made.');
      try { await ctx.refresh(); } catch { setError(appError('unavailable', 'Plan saved, but the dashboard could not refresh. Reload to see it.')); }
    } catch { setError(appError('unavailable', 'Could not select the plan. Your options are preserved.')); }
    finally { busy.current = false; setSaving(null); }
  }
  return <div className="wf-stack">
    <h1>Wayfinder</h1>
    <Notice>Functional preview · Jiwoo’s visual design approval is pending.</Notice>
    <CapabilityLabel status="sample">planning candidates</CapabilityLabel>
    <p>{SAMPLE_SCOPE} Providers and prices are fictional, not live availability.</p>
    <Notice>Totals cover the listed sample components. Return travel, meals, and separately itemized taxes or fees are not quoted. Selecting a plan does not buy or confirm bookings.</Notice>
    {initializing && <LoadingState label="Loading your saved plan…" />}
    {saved && <Card title="Saved selected plan"><strong>{saved.label}</strong><MoneyText value={saved.total} />
      <StatusBadge>Planned · no reservation made</StatusBadge><PlanDetails plan={saved} />
      <Link to={`/trips/${tripId}/import`}>Import confirmed bookings</Link>
    </Card>}
    <Card title="Trip preferences"><form className="wf-stack" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
      <fieldset disabled={saving !== null || initializing} className="wf-stack"><legend>One traveler · USD</legend>
        <div className="wf-grid">
          <label className="wf-stack">Origin<input className="wf-input" value={preferences.origin} onChange={(e) => change('origin', e.target.value)} /></label>
          <label className="wf-stack">Destination<input className="wf-input" value={preferences.destination} onChange={(e) => change('destination', e.target.value)} /></label>
          <label className="wf-stack">Start date<input className="wf-input" type="date" value={preferences.startDate} onChange={(e) => change('startDate', e.target.value)} /></label>
          <label className="wf-stack">End date<input className="wf-input" type="date" value={preferences.endDate} onChange={(e) => change('endDate', e.target.value)} /></label>
          <label className="wf-stack">Budget for listed components (USD)<input className="wf-input" inputMode="decimal" value={preferences.budget} onChange={(e) => change('budget', e.target.value)} /></label>
          <label className="wf-stack">Interest<select className="wf-input" value={preferences.interest} onChange={(e) => change('interest', e.target.value as Preferences['interest'])}><option value="skyline">Skyline walk</option><option value="free_time">Free time · omit paid activity</option></select></label>
          <label className="wf-stack">Prioritize<select className="wf-input" value={preferences.priority} onChange={(e) => change('priority', e.target.value as Preferences['priority'])}><option value="price">Price</option><option value="convenience">Convenience</option><option value="flexibility">Flexibility</option></select></label>
        </div>
        <div className="wf-row"><Button type="submit" variant="primary" disabled={!workspaceId || loading}>{result ? 'Regenerate options' : 'Generate options'}</Button>
          <Button onClick={() => { generator.invalidate(); setPreferences(defaultPreferences({ workspaceId: workspaceId ?? 'pending', now: ctx.clock.now() })); setDirty(true); setLoading(false); setError(null); }}>Use supported sample</Button></div>
      </fieldset>
    </form></Card>
    {loading && <LoadingState label="Comparing sample candidates; previous results remain below…" />}
    {error && <ErrorState error={error} onRetry={() => retry.current()} />}
    {message && <p role="status">{message}</p>}
    {dirty && result && <Notice>Preferences changed. These are previous results; regenerate before selecting.</Notice>}
    {result && <section aria-label="Plan comparison" className="wf-stack">
      <h2>Compare proposed plans</h2><p>{result.options[0]?.explanation}</p>
      <p>Results: {result.preferences.origin} → {result.preferences.destination}, {result.preferences.startDate}–{result.preferences.endDate}; {result.preferences.interest === 'skyline' ? 'skyline walk' : 'free time'}.</p>
      <div className="wf-grid">{result.options.map(({ plan, knownSubtotal, budgetStatus }, index) => <Card as="article" key={plan.id} title={`${index + 1}. ${plan.label}`}>
        <CapabilityLabel status="sample" /><p>{plan.summary}</p><p>Listed total: <MoneyText value={plan.total} /></p>
        {isUnknown(plan.total) && <p>Known subtotal: <MoneyText value={knownSubtotal} /> plus an unknown price.</p>}
        <StatusBadge tone={budgetStatus === 'within' ? 'positive' : 'warning'}>{budgetStatus === 'within' ? 'Within component budget' : budgetStatus === 'over' ? 'Over component budget' : 'Budget fit unknown'}</StatusBadge>
        <p>Convenience: {plan.convenience} · Flexibility: {plan.flexibility}</p><PlanDetails plan={plan} />
        <Button variant="primary" disabled={dirty || loading || saving !== null || budgetStatus !== 'within'} onClick={() => void select(plan)}>{saving === plan.id ? 'Saving plan…' : saved?.id === plan.id ? 'Selected plan' : 'Select plan'}</Button>
        {budgetStatus !== 'within' && <p className="wf-muted">{budgetStatus === 'over' ? 'Raise the budget or change interests before selecting.' : 'Choose a fully priced option; an unknown price is not free.'}</p>}
      </Card>)}</div>
    </section>}
  </div>;
}

export const feature: FeatureModule = { key: 'wayfinder', title: 'Wayfinder', path: 'plan', Page: WayfinderPage };
