import { describe, it, expect } from 'vitest';
import { circleVsBox, PropColliders } from '../src/world/solids';

describe('Collisions cercle ↔ véhicule (rectangle orienté)', () => {
  it('repousse un piéton qui touche le flanc', () => { const h = circleVsBox(1.1, 0, 0.4, 0, 0, 0, 2.2, 0.9); expect(h).not.toBeNull(); expect(1.1 + h!.x).toBeCloseTo(1.3, 3); });
  it('ignore un piéton à distance', () => { expect(circleVsBox(3, 0, 0.4, 0, 0, 0, 2.2, 0.9)).toBeNull(); });
  it('respecte l\'orientation du véhicule', () => { expect(circleVsBox(0, 2.5, 0.4, 0, 0, 0, 2.2, 0.9)).not.toBeNull(); expect(circleVsBox(0, 2.5, 0.4, 0, 0, Math.PI / 2, 2.2, 0.9)).toBeNull(); });
  it('éjecte un piéton placé au centre par le côté le plus court', () => { const h = circleVsBox(0.1, 0, 0.4, 0, 0, 0, 2.2, 0.9)!; expect(Math.abs(h.x)).toBeGreaterThan(1); expect(Math.abs(h.z)).toBeLessThan(1e-6); });
  it('après poussée, plus aucun chevauchement', () => { for (let i = 0; i < 200; i++) { const px = (Math.random() - 0.5) * 6, pz = (Math.random() - 0.5) * 6, h = Math.random() * 6; const r = circleVsBox(px, pz, 0.4, 0, 0, h, 2.2, 0.9); if (!r) continue; expect(circleVsBox(px + r.x * 1.001, pz + r.z * 1.001, 0.4, 0, 0, h, 2.2, 0.9)).toBeNull(); } });
});
describe('Mobilier et végétation', () => {
  it('un tronc et une haie bloquent', () => { const pc = new PropColliders(); pc.set('0,0', { c: [10, 10, 0.3], s: [20, 0, 20, 30, 0.4] }); const a = { x: 10.3, z: 10 }; expect(pc.resolve(a, 0.4).depth).toBeGreaterThan(0); expect(Math.hypot(a.x - 10, a.z - 10)).toBeCloseTo(0.7, 3); const b = { x: 20.2, z: 15 }; pc.resolve(b, 0.4); expect(Math.abs(b.x - 20)).toBeGreaterThanOrEqual(0.8 - 1e-6); });
  it('un chunk déchargé ne bloque plus', () => { const pc = new PropColliders(); pc.set('0,0', { c: [10, 10, 0.3], s: [] }); pc.remove('0,0'); expect(pc.resolve({ x: 10.1, z: 10 }, 0.4).depth).toBe(0); });
});
