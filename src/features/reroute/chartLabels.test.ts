// Deadline labels must not cross any dotted deadline line or another label (Jiwoo, Nov 7).
import { describe, expect, it } from 'vitest';
import { placeMarks } from './page.tsx';

const CHAR = 6.4;
function overlaps(placed: ReturnType<typeof placeMarks>) {
  const box = (p: (typeof placed)[number]) => {
    const w = p.text.length * CHAR;
    return p.anchor === 'start' ? { l: p.textX, r: p.textX + w, y: p.y } : { l: p.textX - w, r: p.textX, y: p.y };
  };
  const problems: string[] = [];
  for (const p of placed) {
    const b = box(p);
    for (const q of placed) if (q.lineX > b.l - 2 && q.lineX < b.r + 2) problems.push(`${p.text} crosses line of ${q.text}`);
    for (const q of placed) {
      if (q === p) continue;
      const c = box(q);
      if (Math.abs(b.y - c.y) < 14 && b.l < c.r && c.l < b.r) problems.push(`${p.text} overlaps ${q.text}`);
    }
  }
  return problems;
}

describe('ReRoute chart deadline labels', () => {
  it('keeps the sample labels (hotel, ride, walk) clear of every dotted line and of each other', () => {
    // Positions from the sample chart: hotel 30 h, ride 43 h and walk 48 h after the demo clock.
    const X = (h: number) => 56 + (h / 72) * 564;
    const placed = placeMarks([
      { key: 'h', x: X(30), y: 112, text: 'Hotel −$200' },
      { key: 'r', x: X(43), y: 120, text: 'Ride −$40' },
      { key: 'w', x: X(48), y: 132, text: 'Walk −$60' },
    ], 56, 620);
    expect(overlaps(placed)).toEqual([]);
    expect(placed.map((p) => p.text)).toEqual(['Hotel −$200', 'Ride −$40', 'Walk −$60']);
  });

  it('moves a label to the left of its line near the right edge of the chart', () => {
    const placed = placeMarks([{ key: 'a', x: 600, y: 100, text: 'Hotel −$200' }], 56, 620);
    expect(placed[0]!.anchor).toBe('end');
    expect(overlaps(placed)).toEqual([]);
  });
});
