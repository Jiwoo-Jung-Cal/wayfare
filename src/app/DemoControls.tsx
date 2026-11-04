// Demo controls. Every control performs a real repository/feature operation;
// none of them edit display labels directly. Reset affects only this workspace.

import { useState } from 'react';
import {
  DEMO_CLOCK_START,
  DEMO_IDS,
  DEMO_TIMES,
  addDuration,
  demoBookingImports,
  demoDisruption,
  demoDocument,
  formatInstant,
  type AppError,
  type DemoSeedStage,
  type Instant,
  type Result,
} from '../core/index.ts';
import { Button, ErrorState, StatusBadge } from '../ui/index.tsx';
import { openReferenceScenario, useAppServices } from './AppServices.tsx';
import { FEATURES } from './featureRegistry.ts';

const PANEL_KEY = 'wayfare:v1:demo-controls';
const initiallyOpen = () => {
  try {
    return window.localStorage.getItem(PANEL_KEY) === 'open';
  } catch {
    return false;
  }
};

export function DemoControls() {
  const { repo, load, clock, refresh, featureContext } = useAppServices();
  const [openPanel, setOpenPanel] = useState(initiallyOpen);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (load.status !== 'ready') return null;
  const snapshot = load.snapshot;
  const hasTrip = snapshot.trips.some((t) => t.id === DEMO_IDS.trip);
  const hasBookings = snapshot.bookings.some((b) => b.tripId === DEMO_IDS.trip);

  async function run(label: string, op: () => Promise<Result<string>>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const r = await op();
      if (r.ok) setMessage(r.value);
      else setError(r.error);
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const reset = (stage: DemoSeedStage) =>
    run(`reset-${stage}`, async () => {
      const r = await repo.resetDemo(stage);
      return r.ok ? { ok: true, value: `This workspace was reset to "${stage}". Other visitors are unaffected.` } : r;
    });

  const loadBookings = () =>
    run('bookings', async () => {
      const ctx = { workspaceId: snapshot.workspace.id, now: clock.now() };
      let created = 0;
      for (const imp of demoBookingImports(ctx)) {
        const document = await demoDocument(ctx, imp.documentId);
        const r = await repo.saveReviewedBooking({ idempotencyKey: `intake:${document.contentHash}`, document, booking: imp.booking, policy: imp.policy });
        if (!r.ok) return r;
        if (!r.value.replayed) created++;
      }
      return { ok: true, value: created ? `Saved ${created} reviewed sample bookings.` : 'Sample bookings were already imported; nothing duplicated.' };
    });

  const triggerDisruption = () =>
    run('disruption', async () => {
      const reroute = FEATURES.reroute;
      if (reroute?.triggerDemoDisruption) {
        const r = await reroute.triggerDemoDisruption({ tripId: DEMO_IDS.trip }, featureContext);
        return r.ok ? { ok: true, value: `ReRoute recorded disruption ${r.value.disruptionId}.` } : r;
      }
      // ReRoute not registered yet: record the disruption fact only (no booking changes).
      const ctx = { workspaceId: snapshot.workspace.id, now: clock.now() };
      const doc = await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.disruptionNotice));
      if (!doc.ok) return doc;
      const r = await repo.recordDisruption(demoDisruption(ctx));
      if (!r.ok) return r;
      return {
        ok: true,
        value: r.value.created
          ? 'Simulated flight cancellation recorded. ReRoute module is not registered yet, so no recovery options were computed.'
          : 'This disruption was already recorded.',
      };
    });

  const setSampleClock = (current: Instant) =>
    run('clock', async () => {
      const r = await repo.setClock({ mode: 'sample', current });
      return r.ok ? { ok: true, value: `Demo clock set to ${current}.` } : r;
    });

  const useRealClock = () =>
    run('clock', async () => {
      const r = await repo.setClock({ mode: 'real' });
      return r.ok ? { ok: true, value: 'Using real time. Sample deadlines in Nov 2026 compare against today.' } : r;
    });

  const now = clock.now();
  const disabled = busy !== null;

  return (
    <details
      className="wf-demo-panel"
      open={openPanel}
      onToggle={(e) => {
        const v = (e.currentTarget as HTMLDetailsElement).open;
        setOpenPanel(v);
        try {
          window.localStorage.setItem(PANEL_KEY, v ? 'open' : 'closed');
        } catch {
          /* storage blocked: the panel still works for this page */
        }
      }}
    >
      <summary>Demo controls</summary>
      <section className="wf-stack" aria-labelledby="wf-demo-heading">
        <div className="wf-row" style={{ justifyContent: 'space-between' }}>
          <h2 id="wf-demo-heading" className="wf-visually-hidden">
            Demo controls
          </h2>
          <span className="wf-row">
            <StatusBadge tone="info">{clock.mode === 'sample' ? 'Demo clock' : 'Real-time clock'}</StatusBadge>
            <span className="wf-mono" aria-label="Active clock">
              {now} ({formatInstant(now, 'America/New_York')})
            </span>
          </span>
        </div>

        <div className="wf-row" role="group" aria-label="Sample data">
          <Button disabled={disabled} onClick={() => run('reference', () => openReferenceScenario(repo, featureContext))}>Show the reference scenario</Button>
          <Button disabled={disabled} onClick={() => reset('planning')}>Load sample trip</Button>
          <Button disabled={disabled || !hasTrip} onClick={loadBookings}>Import sample bookings</Button>
          <Button disabled={disabled || !hasBookings} onClick={triggerDisruption}>Trigger flight cancellation</Button>
        </div>

        <div className="wf-row" role="group" aria-label="Demo clock">
          <Button disabled={disabled || clock.mode !== 'sample'} onClick={() => setSampleClock(addDuration(now, { hours: 1 }))}>+1 hour</Button>
          <Button disabled={disabled || clock.mode !== 'sample'} onClick={() => setSampleClock(addDuration(now, { days: 1 }))}>+1 day</Button>
          <Button disabled={disabled} onClick={() => setSampleClock(addDuration(DEMO_TIMES.hotelDeadline, { seconds: -1 }))}>1 s before hotel deadline</Button>
          <Button disabled={disabled} onClick={() => setSampleClock(DEMO_TIMES.hotelDeadline)}>At hotel deadline</Button>
          <Button disabled={disabled} onClick={() => setSampleClock(DEMO_CLOCK_START)}>Reset clock</Button>
          <Button disabled={disabled || clock.mode === 'real'} onClick={useRealClock}>Use real time</Button>
        </div>

        <div className="wf-row" role="group" aria-label="Reset">
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => {
              if (window.confirm('Reset this demo workspace to the fully booked sample state? Only your workspace is affected.')) void reset('booked');
            }}
          >
            Reset to booked sample
          </Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => {
              if (window.confirm('Clear this demo workspace? Only your workspace is affected.')) void reset('empty');
            }}
          >
            Clear workspace
          </Button>
          <span className="wf-muted">Workspace <span className="wf-mono">{snapshot.workspace.id}</span></span>
        </div>

        <div aria-live="polite">
          {busy && <span className="wf-muted">Working…</span>}
          {message && <span>{message}</span>}
        </div>
        {error && <ErrorState error={error} title="Demo control failed" />}
      </section>
    </details>
  );
}
