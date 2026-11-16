import { describe, it, expect } from 'vitest';
import { messageFor, Inbox } from '../src/crime/messages';

describe('messages du milieu', () => {
  it('environ un message toutes les trois heures, déterministe, un seul par heure', () => {
    let n = 0; for (let d = 1; d <= 10; d++) for (let h = 0; h < 24; h++) if (messageFor(d, h, 0, 0)) n++;
    expect(n).toBeGreaterThan(50); expect(n).toBeLessThan(110);
    expect(JSON.stringify(messageFor(3, 14, 0, 0))).toBe(JSON.stringify(messageFor(3, 14.7, 0, 0)));
    const ib = new Inbox(); let got = 0; for (let h = 0; h < 48; h += 0.25) if (ib.tick(1 + Math.floor(h / 24), h % 24, 0, 0)) got++; expect(got).toBe(ib.list.length); expect(ib.unread).toBe(got);
  });
  it('alertes quand on est recherché ; gros tuyau quand on a de la réputation', () => {
    const al = Array.from({ length: 200 }, (_, i) => messageFor(1 + (i >> 3), i % 24, 0, 3)).filter(Boolean); expect(al.some(m => m!.kind === 'alerte')).toBe(true);
    const tip = Array.from({ length: 400 }, (_, i) => messageFor(1 + (i >> 4), i % 24, 40, 0)).find(m => m?.kind === 'tuyau'); expect(tip?.data.target).toBe('fourgon');
  });
});
