import { describe, it, expect } from 'vitest';
import { nextLevel, AutoQuality, levelParams } from '../src/core/quality';

describe('Qualité automatique', () => {
  it('baisse après 3 s sous 24 FPS, jamais en dessous de « bas »', () => { expect(nextLevel('eleve', 18, 3, 0, 99)).toBe('moyen'); expect(nextLevel('moyen', 18, 3, 0, 99)).toBe('bas'); expect(nextLevel('bas', 10, 9, 0, 99)).toBe('bas'); expect(nextLevel('eleve', 18, 2, 0, 99)).toBe('eleve'); });
  it('monte seulement si stable (FPS élevés 10 s, 25 s depuis le dernier changement)', () => { expect(nextLevel('bas', 60, 0, 10, 30)).toBe('moyen'); expect(nextLevel('bas', 60, 0, 10, 10)).toBe('bas'); expect(nextLevel('bas', 60, 0, 5, 30)).toBe('bas'); expect(nextLevel('eleve', 60, 0, 20, 99)).toBe('eleve'); });
  it('les niveaux sont ordonnés (plus de détail = plus de charge)', () => { const [b, m, e] = (['bas', 'moyen', 'eleve'] as const).map(levelParams); expect(b.view).toBeLessThan(m.view); expect(m.view).toBeLessThan(e.view); expect(b.pedMax).toBeLessThan(e.pedMax); expect(b.shadows).toBe(false); expect(e.shadowSize).toBeGreaterThan(m.shadowSize); });
  it('la boucle de mesure descend en dessous de 24 FPS puis se stabilise', () => { const q = new AutoQuality('eleve'); let ch: string[] = []; for (let i = 0; i < 40 * 60; i++) { const r = q.update(1 / 15); if (r) ch.push(r); } expect(ch).toEqual(['moyen', 'bas']); });
  it('le mode manuel ne change rien', () => { const q = new AutoQuality('eleve'); q.auto = false; for (let i = 0; i < 600; i++) expect(q.update(1 / 10)).toBeNull(); });
});
