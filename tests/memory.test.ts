import { describe, it, expect } from 'vitest';
import { Memory, cellOf } from '../src/crime/memory';

describe('mémoire du voisinage', () => {
  it('une maison cambriolée fait poser une alarme le lendemain', () => { const m = new Memory(); m.burgled('12/0', 3); expect(m.alarmed('12/0', 3)).toBe(false); expect(m.alarmed('12/0', 4)).toBe(true); expect(m.alarmed('13/0', 9)).toBe(false); });
  it('le commerçant braqué reconnaît un visage découvert pendant 10 jours, pas sous la capuche', () => {
    const m = new Memory(); m.saw('shop1', 2, 'sweat bleu');
    expect(m.recognizes('shop1', 4, false, 'sweat bleu', 0.5)).toBe(true); expect(m.recognizes('shop1', 4, true, 'sweat bleu', 0)).toBe(false);
    expect(m.recognizes('shop1', 4, false, 'sweat rouge', 0.8)).toBe(false); expect(m.recognizes('shop1', 13, false, 'sweat bleu', 0)).toBe(false);
  });
  it('les délits rendent un quartier méfiant, et la méfiance retombe', () => {
    const m = new Memory(); for (let i = 0; i < 4; i++) m.crimeAt(100, 100, 30); expect(m.suspicion(120, 90)).toBeCloseTo(1); expect(m.suspicion(900, 900)).toBe(0); expect(cellOf(100, 100)).toBe(cellOf(120, 90));
    m.tick(24); expect(m.suspicion(100, 100)).toBeCloseTo(0.5); m.tick(24 * 10); expect(m.suspicion(100, 100)).toBe(0);
  });
});
