import { describe, expect, it } from 'vitest';
import { DEMO_TIMES } from '../../core/index.ts';
import { applyRequest, parsePlanRequest, replyTo } from './assistant.ts';
import { DESTINATIONS, destinationFor } from './catalog.ts';
import { defaultPreferences } from './handler.ts';

const ctx = { workspaceId: 'ws-a', now: DEMO_TIMES.clockStart };

describe('Plan demo assistant', () => {
  it('reads destination, group size, budget and priority from a request', () => {
    const r = parsePlanRequest('A weekend in Chicago for 2 people under $1,200, nonstop please');
    expect(r.destination?.key).toBe('chi');
    expect(r).toMatchObject({ travelers: 2, budget: '1200', priority: 'convenience', unknownPlace: null });
    expect(parsePlanRequest('Tokyo in spring, family of four, budget 6k, refundable').destination?.key).toBe('tyo');
    expect(parsePlanRequest('Tokyo in spring, family of four, budget 6k, refundable')).toMatchObject({ travelers: 4, budget: '6000', priority: 'flexibility' });
    expect(parsePlanRequest('3 nights in New York from San Francisco, under $1,000').destination?.key).toBe('nyc');
  });

  it('does not mistake ordinary words for a city, and names an unsupported place', () => {
    expect(destinationFor('a trip with my children')).toBeNull();
    const paris = parsePlanRequest('Take us to Paris for 3 people');
    expect(paris).toMatchObject({ destination: null, unknownPlace: 'Paris', travelers: 3 });
    expect(replyTo(paris, defaultPreferences(ctx), DESTINATIONS.nyc)).toMatch(/don’t have sample trips for Paris/);
  });

  it('moves the preferences to the destination’s sample dates and says a new trip will be added', () => {
    const req = parsePlanRequest('Plan a weekend in Chicago for 2');
    const next = applyRequest(defaultPreferences(ctx), req);
    expect(next).toMatchObject({ destination: 'Chicago', startDate: '2026-12-11', endDate: '2026-12-13', travelers: 2, budget: '1600' });
    const reply = replyTo(req, next, DESTINATIONS.nyc);
    expect(reply).toContain('Here are 3 plans for Chicago, Dec 11 – Dec 13, for 2 travelers, with a $1,600 budget');
    expect(reply).toContain('I’ll add Chicago Weekend to your trips');
  });
});

describe('PlanAssistant interface', () => {
  it('the scripted assistant answers asynchronously, labels itself, and honours an abort', async () => {
    const { scriptedAssistant } = await import('./assistant.ts');
    const a = scriptedAssistant(0);
    expect(a.capability).toBe('scripted');
    expect(a.label).toContain('No AI model is used');
    const r = await a.respond({ text: 'Chicago for 2', preferences: defaultPreferences(ctx), current: DESTINATIONS.nyc });
    expect(r.ok && r.value.request.destination?.key).toBe('chi');
    expect(r.ok && r.value.reply).toContain('Chicago Weekend');
    const abort = new AbortController(); abort.abort();
    expect((await a.respond({ text: 'Tokyo', preferences: defaultPreferences(ctx), current: DESTINATIONS.nyc }, abort.signal)).ok).toBe(false);
  });
});
