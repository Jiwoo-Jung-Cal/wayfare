import { describe, expect, it } from 'vitest';
import { DEMO_IDS, ok, SAMPLE_RAW_EXTRACTIONS, type Result } from '../src/core/index.ts';
import type { ModelAdapter } from './ai/modelAdapter.ts';
import { runSmoke, SMOKE_CASES } from './liveSmoke.ts';

const D = DEMO_IDS.documents;
const raws = [D.flightConfirmation, D.hotelConfirmation, D.activityConfirmation, D.transferConfirmation].map((id) => SAMPLE_RAW_EXTRACTIONS[id]);

const fakeAdapter = (mutate?: (raw: never, i: number) => unknown): ModelAdapter => {
  let i = 0;
  return {
    model: 'fake-model',
    async generateStructured() {
      const raw = structuredClone(raws[i]) as never;
      const data = mutate ? mutate(raw, i) : raw;
      i++;
      return ok({ data: data as never, model: 'fake-model', usage: { inputTokens: 1, outputTokens: 1 } });
    },
  };
};

describe('live-AI smoke check (no network)', () => {
  it('a model that returns the reviewed facts passes with no review items', async () => {
    const rows = await runSmoke(fakeAdapter(), SMOKE_CASES);
    expect(rows.map((r) => [r.name, r.ok, r.model, r.differences])).toEqual(SMOKE_CASES.map((c) => [c.name, true, 'fake-model', []]));
  });

  it('differences from the reviewed facts are reported for review, not hidden', async () => {
    const rows = await runSmoke(fakeAdapter((raw: { booking: { paid_amount: { value: string } }; policy: { deadlines: unknown[] } }, i) => {
      if (i === 1) { raw.booking.paid_amount.value = '440.00'; raw.policy.deadlines = []; }
      return raw;
    }));
    const hotel = rows.find((r) => r.name.startsWith('hotel'))!;
    expect(hotel.ok).toBe(true);
    expect(hotel.differences.join('\n')).toMatch(/booking\.paid: live .*44000.*reviewed .*45000/);
    expect(hotel.differences.join('\n')).toMatch(/policy\.deadlines: live none/);
  });

  it('provider errors are failures with the shared error code', async () => {
    const failing: ModelAdapter = {
      model: 'fake-model',
      async generateStructured(req): Promise<Result<never>> {
        return { ok: false, error: { code: 'not_configured', message: 'The server AI credentials were rejected', retryable: false, requestId: req.requestId } };
      },
    };
    const rows = await runSmoke(failing, SMOKE_CASES.slice(0, 1));
    expect(rows[0]).toMatchObject({ ok: false, code: 'not_configured' });
  });
});
