// The Plan composer's demo assistant (Jiwoo, Nov 7). It reads a trip request with simple rules
// (no AI model), turns it into Wayfinder preferences and writes a short reply from the sample
// catalogue. A live model would replace this behind the server; the browser never holds a key.
import { DESTINATIONS, destinationFor, type Destination } from './catalog.ts';
import type { Preferences } from './handler.ts';

export type PlanRequest = {
  destination: Destination | null;
  /** A place the user named that the sample catalogue doesn't cover. */
  unknownPlace: string | null;
  travelers?: number;
  budget?: string;
  priority?: Preferences['priority'];
  interest?: Preferences['interest'];
};

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const num = (s: string) => WORD_NUM[s.toLowerCase()] ?? Number(s);

export function parsePlanRequest(text: string): PlanRequest {
  const t = text.trim();
  const lower = t.toLowerCase();
  const out: PlanRequest = { destination: destinationFor(lower), unknownPlace: null };

  const party = /\b(\d|one|two|three|four|five|six|seven|eight|nine)\s+(?:people|persons|travell?ers|adults|guests|friends|of us)\b/i.exec(t)
    ?? /\bfamily of\s+(\d|three|four|five|six|seven|eight|nine)\b/i.exec(t)
    ?? /\bfor\s+(\d|two|three|four|five|six|seven|eight|nine)\b(?!\s*(?:nights?|days?|\$|dollars))/i.exec(t);
  if (party) out.travelers = Math.min(9, Math.max(1, num(party[1]!)));
  else if (/\b(couple|the two of us|my partner and i|with my (?:partner|wife|husband|girlfriend|boyfriend))\b/.test(lower)) out.travelers = 2;
  else if (/\b(just me|solo|by myself|alone)\b/.test(lower)) out.travelers = 1;

  const money = /(?:under|below|less than|up to|max(?:imum)?|budget(?: of| is)?|within)\s*\$?\s*(\d[\d,]*)(\s*k)?/i.exec(t) ?? /\$\s*(\d[\d,]*)(\s*k)?/.exec(t);
  if (money) out.budget = String(Number(money[1]!.replace(/,/g, '')) * (money[2] ? 1000 : 1));

  if (/refundable|flexib|cancel for free|free cancellation/.test(lower)) out.priority = 'flexibility';
  else if (/nonstop|non-stop|direct|convenien|fastest|quickest/.test(lower)) out.priority = 'convenience';
  else if (/cheap|cheapest|lowest|best price|save money|budget/.test(lower)) out.priority = 'price';

  if (/free time|no tours?|no activit|relax|nothing booked/.test(lower)) out.interest = 'free_time';
  else if (/tour|walk|boat|activity|sightseeing/.test(lower)) out.interest = 'skyline';

  if (!out.destination) {
    const place = /\b(?:to|in|visit(?:ing)?|around)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/u.exec(t);
    if (place && !/^(San Francisco|SFO)$/i.test(place[1]!)) out.unknownPlace = place[1]!;
  }
  return out;
}

const fmtDay = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Apply a request to the current preferences: a known destination brings its own sample dates. */
export function applyRequest(prefs: Preferences, req: PlanRequest): Preferences {
  const d = req.destination;
  return {
    ...prefs,
    // A new destination brings its sample dates and a default budget scaled to the group.
    ...(d ? { destination: d.name, startDate: d.startDate, endDate: d.endDate,
      budget: d.name === prefs.destination ? prefs.budget : String(Number(d.defaultBudget) * (req.travelers ?? prefs.travelers)) } : {}),
    ...(req.travelers ? { travelers: req.travelers } : {}),
    ...(req.budget ? { budget: req.budget } : {}),
    ...(req.priority ? { priority: req.priority } : {}),
    ...(req.interest ? { interest: req.interest } : {}),
  };
}

export function replyTo(req: PlanRequest, prefs: Preferences, current: Destination): string {
  if (req.unknownPlace) {
    const names = Object.values(DESTINATIONS).map((d) => d.name);
    return `I don’t have sample trips for ${req.unknownPlace} yet. In this demo I can plan ${names.slice(0, -1).join(', ')} or ${names.at(-1)} from San Francisco.`;
  }
  const d = req.destination ?? current;
  const who = prefs.travelers === 1 ? 'one traveler' : `${prefs.travelers} travelers`;
  const focus = prefs.priority === 'flexibility' ? 'most flexible first' : prefs.priority === 'convenience' ? 'most convenient first' : 'cheapest first';
  const parts = [`Here are 3 plans for ${d.name}, ${fmtDay(d.startDate)} – ${fmtDay(d.endDate)}, for ${who}, with a $${Number(prefs.budget).toLocaleString('en-US')} budget, ${focus}.`];
  if (prefs.travelers > 1) parts.push('I priced it for the group: flights and tickets per person, one room per two, one car per four.');
  if (d.key !== current.key) parts.push(`Choose one and I’ll add ${d.title} to your trips. Nothing is booked or paid.`);
  else parts.push('Choose one to save it to your trip. Nothing is booked or paid.');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// The assistant behind the Plan composer. The page only talks to this interface, so a live model
// (called through the server's ModelAdapter, never from the browser) can replace the scripted
// rules without UI changes: the page already shows a typing indicator while a reply is pending,
// a retry on failure, and labels the reply with the assistant's capability.

export type AssistantTurn = { request: PlanRequest; reply: string };
export type AssistantResult = { ok: true; value: AssistantTurn } | { ok: false; error: { message: string; retryable: boolean } };
export interface PlanAssistant {
  capability: 'scripted' | 'live';
  /** Shown under the conversation. */
  label: string;
  respond(input: { text: string; preferences: Preferences; current: Destination }, signal?: AbortSignal): Promise<AssistantResult>;
}

/** The demo assistant: the rules above, with a short "thinking" pause so the reply reads naturally. */
export function scriptedAssistant(thinkMs = 1500): PlanAssistant {
  return {
    capability: 'scripted',
    label: 'Demo assistant: it reads your message with simple rules and answers from sample quotes. No AI model is used.',
    async respond({ text, preferences, current }, signal) {
      if (thinkMs > 0) await new Promise((r) => setTimeout(r, thinkMs));
      if (signal?.aborted) return { ok: false, error: { message: 'Cancelled', retryable: true } };
      const request = parsePlanRequest(text);
      return { ok: true, value: { request, reply: replyTo(request, applyRequest(preferences, request), current) } };
    },
  };
}
