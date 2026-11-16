import { describe, it, expect } from 'vitest';
import { seasonOf, weatherAt, blockWx } from '../src/world/weather';

describe('météo et saisons', () => {
  it('saisons de 7 jours, la partie commence en automne', () => { expect(seasonOf(1)).toBe('automne'); expect(seasonOf(8)).toBe('hiver'); expect(seasonOf(15)).toBe('printemps'); expect(seasonOf(22)).toBe('été'); expect(seasonOf(29)).toBe('automne'); });
  it('déterministe, continu entre tranches, pas de neige hors de l\'hiver, brouillard seulement le matin', () => {
    expect(JSON.stringify(weatherAt(3, 13.2))).toBe(JSON.stringify(weatherAt(3, 13.2)));
    for (let d = 1; d <= 28; d++) for (let h = 0; h < 24; h += 0.5) { const w = weatherAt(d, h); if (seasonOf(d) !== 'hiver' && !(seasonOf(d + 1) === 'hiver' && h >= 22.5)) expect(w.snow).toBe(0); if (h < 4.5 || h > 10.5) expect(w.fog).toBe(0); expect(w.rain).toBeGreaterThanOrEqual(0); }
    const a = weatherAt(2, 5.99), b = weatherAt(2, 6.0); expect(Math.abs(a.rain - b.rain)).toBeLessThan(0.05);
  });
  it('l\'automne est plus pluvieux que l\'été', () => { let au = 0, et = 0; for (let d = 1; d < 400; d++) { const s = seasonOf(d); for (let b = 0; b < 4; b++) { const w = blockWx(d, b); if (s === 'automne' && w.rain > 0) au++; if (s === 'été' && w.rain > 0) et++; } } expect(au).toBeGreaterThan(et * 1.8); });
});
