// Live-AI smoke check: `npm run smoke:live-ai` (server only; never part of the public Pages build).
//
// With server credentials configured, it sends each canonical sample confirmation through the
// real ModelAdapter and the production extraction path (extractBooking), then compares the live
// result with the reviewed sample facts. Differences are reported as review items, not hidden:
// the editable review step exists precisely so a person corrects them before saving.
// Without credentials it prints exactly what is missing and exits with status 2.
// Document text is sent to the provider; output never prints it, only field comparisons.

import { DEMO_DOCUMENT_SOURCES, DEMO_IDS, sampleExtractBooking, toInstant, type BookingExtraction, type ExtractedField } from '../src/core/index.ts';
import { createAnthropicAdapter, type Logger, type ModelAdapter } from './ai/modelAdapter.ts';
import { loadConfig } from './config.ts';
import { extractBooking } from './extraction.ts';

export type SmokeCase = { name: string; text: string };
export type SmokeRow = { name: string; ok: boolean; model?: string | null; code?: string; differences: string[] };

const D = DEMO_IDS.documents;
export const SMOKE_CASES: SmokeCase[] = [
  { name: 'flight BLA7Q2', text: DEMO_DOCUMENT_SOURCES[D.flightConfirmation]!.text },
  { name: 'hotel HLH-48213', text: DEMO_DOCUMENT_SOURCES[D.hotelConfirmation]!.text },
  { name: 'activity SKW-90551', text: DEMO_DOCUMENT_SOURCES[D.activityConfirmation]!.text },
  { name: 'transfer MLT-3307', text: DEMO_DOCUMENT_SOURCES[D.transferConfirmation]!.text },
];

const show = <T>(f: ExtractedField<T>) => (f.status === 'found' ? JSON.stringify(f.value) : 'unknown');

/** Field-level differences between a live extraction and the reviewed sample facts. */
export function compareExtraction(live: BookingExtraction, expected: BookingExtraction): string[] {
  const out: string[] = [];
  for (const key of ['kind', 'reference', 'paid', 'startsAt', 'localTimezone'] as const) {
    const a = show(live.booking[key] as ExtractedField<unknown>);
    const b = show(expected.booking[key] as ExtractedField<unknown>);
    if (a !== b) out.push(`booking.${key}: live ${a}, reviewed ${b}`);
  }
  if (live.policy.refundability !== expected.policy.refundability) out.push(`policy.refundability: live ${live.policy.refundability}, reviewed ${expected.policy.refundability}`);
  const at = (x: BookingExtraction) => x.policy.deadlines.map((d) => d.at).sort().join(',') || 'none';
  if (at(live) !== at(expected)) out.push(`policy.deadlines: live ${at(live)}, reviewed ${at(expected)}`);
  if (live.capability !== 'live') out.push(`capability: ${live.capability} (expected live)`);
  return out;
}

export async function runSmoke(adapter: ModelAdapter, cases: SmokeCase[] = SMOKE_CASES, now = () => toInstant(new Date())): Promise<SmokeRow[]> {
  const rows: SmokeRow[] = [];
  for (const [i, c] of cases.entries()) {
    const requestId = `smoke-${Date.now()}-${i}`;
    const live = await extractBooking({ tripId: DEMO_IDS.trip, text: c.text }, requestId, { adapter, now });
    if (!live.ok) {
      rows.push({ name: c.name, ok: false, code: live.error.code, differences: [live.error.message] });
      continue;
    }
    const expected = await sampleExtractBooking(c.text, { requestId, now: now() });
    rows.push({ name: c.name, ok: true, model: live.value.model, differences: expected.ok ? compareExtraction(live.value, expected.value) : ['no reviewed sample to compare'] });
  }
  return rows;
}

async function main() {
  const config = loadConfig();
  if (config.ai.provider !== 'anthropic') {
    console.error(`Live AI is not configured: ${config.ai.reason}.`);
    console.error('Set ANTHROPIC_API_KEY (or WAYFARE_ANTHROPIC_API_KEY) in the server environment, keep WAYFARE_AI_PROVIDER unset or "anthropic", then re-run.');
    console.error(`Optional: WAYFARE_AI_MODEL (default claude-opus-5-5), WAYFARE_AI_EFFORT, WAYFARE_AI_TIMEOUT_MS. Never put the key in VITE_* variables or the Pages build.`);
    process.exit(2);
  }
  const quiet: Logger = () => {};
  const rows = await runSmoke(createAnthropicAdapter(config.ai, quiet));
  for (const r of rows) {
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.model ? ` · model ${r.model}` : ''}${r.code ? ` · ${r.code}` : ''}`);
    for (const d of r.differences) console.log(`     ${r.ok ? 'review:' : 'error:'} ${d}`);
  }
  const failed = rows.filter((r) => !r.ok).length;
  console.log(failed ? `${failed} of ${rows.length} live extractions failed.` : `All ${rows.length} live extractions succeeded; ${rows.reduce((n, r) => n + r.differences.length, 0)} field(s) need review.`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
