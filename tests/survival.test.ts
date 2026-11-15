import { describe, it, expect } from 'vitest';
import { Needs } from '../src/survival/needs';
import { Heat } from '../src/survival/heat';
import { Clock } from '../src/core/clock';
import { Collision } from '../src/world/collision';

describe('Besoins', () => {
  it('la faim et la soif baissent avec le temps', () => { const n = new Needs(); n.tick(5); expect(n.s.faim).toBeLessThan(80); expect(n.s.soif).toBeLessThan(n.s.faim); });
  it('dormir restaure l\'énergie', () => { const n = new Needs({ energie: 20 }); n.tick(6, true); expect(n.s.energie).toBeGreaterThan(80); });
  it('la santé baisse si un besoin est critique', () => { const n = new Needs({ faim: 0 }); n.tick(2); expect(n.s.sante).toBeLessThan(100); });
  it('se soulager remet la vessie à 0', () => { const n = new Needs({ vessie: 90 }); n.relieve(); expect(n.s.vessie).toBe(0); });
  it('mort quand la santé tombe à 0', () => { const n = new Needs({ faim: 0, soif: 0, sante: 5 }); n.tick(1); expect(n.dead).toBe(true); });
});
describe('Recherche', () => {
  it('monte puis décroît plus vite quand on est discret', () => { const a = new Heat(), b = new Heat(); a.add(60); b.add(60); a.tick(2, false); b.tick(2, true); expect(b.value).toBeLessThan(a.value); expect(a.stars).toBeGreaterThan(0); });
});
describe('Horloge', () => {
  it('20 min réelles = 24 h', () => { const c = new Clock(0); c.tick(20 * 60); expect(c.day).toBe(2); expect(c.hour).toBeCloseTo(0, 5); });
});
describe('Collisions', () => {
  const sq = { l: 0, h: 0, n: '', p: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]] as [number, number][] };
  it('repousse un cercle hors d\'un mur', () => { const c = new Collision([sq]); const p = { x: 11, z: 5 }; const r = c.resolve(p, 2); expect(r.depth).toBeGreaterThan(0); expect(p.x).toBeGreaterThanOrEqual(11.99); });
  it('ne fait rien loin des murs', () => { const c = new Collision([sq]); const p = { x: 50, z: 50 }; expect(c.resolve(p, 2).depth).toBe(0); });
});
