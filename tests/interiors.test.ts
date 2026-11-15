import { describe, it, expect } from 'vitest';
import { generate, collide, kindFor, rng, type Kind } from '../src/interiors/generator';

const KINDS: Kind[] = ['logement', 'supermarche', 'commerce', 'restaurant', 'bar', 'pharmacie', 'banque', 'coiffeur', 'ecole', 'bureau', 'atelier'];
describe('Intérieurs', () => {
  it('est déterministe pour une même graine', () => { expect(JSON.stringify(generate('logement', 12, 9, 42))).toBe(JSON.stringify(generate('logement', 12, 9, 42))); });
  it('varie selon la graine', () => { expect(JSON.stringify(generate('supermarche', 20, 14, 1))).not.toBe(JSON.stringify(generate('supermarche', 20, 14, 2))); });
  for (const k of KINDS) {
    it(`${k} : porte dégagée, apparition libre, dimensions bornées`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const l = generate(k, 6 + (seed % 20), 6 + (seed % 12), seed);
        expect(l.W).toBeLessThanOrEqual(28); expect(l.D).toBeLessThanOrEqual(18);
        const p = { x: l.spawn.x, z: l.spawn.z }; collide(l, p, 0.35); expect(Math.hypot(p.x - l.spawn.x, p.z - l.spawn.z)).toBeLessThan(0.01);
        for (const b of l.boxes) if (b.tag !== 'mur') expect(b.x + b.w / 2 > l.W / 2 - 1.6 && b.x - b.w / 2 < l.W / 2 + 1.6 && b.z + b.d / 2 > l.D - 3.2).toBe(false);
        expect(l.spots.some(s => s.kind === 'sortie')).toBe(true);
      }
    });
  }
  it('le logement contient lit, toilettes, robinet et frigo', () => { const l = generate('logement', 14, 10, 7); const k = l.spots.map(s => s.kind); for (const e of ['dormir', 'toilettes', 'robinet', 'fouiller']) expect(k).toContain(e); });
  it('l\'école est protégée', () => { expect(generate('ecole', 14, 10, 3).protected).toBe(true); });
  it('le type dépend du sous-type OSM', () => { const r = rng(1); expect(kindFor('bakery', 100, r)).toBe('commerce'); expect(kindFor('school', 100, r)).toBe('ecole'); expect(kindFor(undefined, 100, r)).toMatch(/logement|bureau/); });
  it('les murs bloquent un cercle', () => { const l = generate('logement', 12, 9, 1); const p = { x: 0.1, z: 3 }; collide(l, p, 0.4); expect(p.x).toBeGreaterThanOrEqual(0.4 - 1e-6); });
});
