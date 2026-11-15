import { describe, it, expect } from 'vitest';
import { unitsForStars, blocksForStars, witnessFactor, fineFor, cooldownRate, arrestStep, ARREST_TIME } from '../src/police/rules';
import { Police } from '../src/police/police';
import { RoadGraph } from '../src/roads/graph';
import { VehicleWorld } from '../src/vehicles/world';
import { Traffic } from '../src/vehicles/traffic';
import { Collision } from '../src/world/collision';
import type { Road } from '../src/world/data';

const roads: Road[] = []; for (let i = 0; i <= 10; i++) { roads.push({ t: 'residential', n: 'H' + i, o: 0, p: Array.from({ length: 21 }, (_, k) => [k * 50, i * 100] as [number, number]) }); roads.push({ t: 'residential', n: 'V' + i, o: 0, p: Array.from({ length: 21 }, (_, k) => [i * 100, k * 50] as [number, number]) }); }
describe('Règles de la gendarmerie', () => {
  it('plus d\'étoiles = plus d\'unités et de barrages', () => { for (let s = 1; s <= 5; s++) expect(unitsForStars(s)).toBeGreaterThan(unitsForStars(s - 1)); expect(blocksForStars(2)).toBe(0); expect(blocksForStars(3)).toBe(1); expect(blocksForStars(5)).toBe(3); });
  it('un délit vu par la gendarmerie compte en entier, sans témoin à 25 %', () => { expect(witnessFactor(40, null)).toBe(1); expect(witnessFactor(null, 10)).toBe(0.6); expect(witnessFactor(null, null)).toBe(0.25); expect(witnessFactor(200, 80)).toBe(0.25); });
  it('l\'amende ne dépasse jamais l\'argent du joueur', () => { expect(fineFor(30, 3)).toBe(30); expect(fineFor(1000, 1)).toBe(180); expect(fineFor(1000, 5)).toBe(500); expect(fineFor(-5, 2)).toBe(0); });
  it('la recherche ne refroidit qu\'après 20 s sans être vu', () => { expect(cooldownRate(5)).toBe(0); expect(cooldownRate(25)).toBeGreaterThan(0); });
  it('l\'arrestation exige d\'être quasi immobile près d\'une unité', () => { let t = 0; for (let i = 0; i < 100; i++) t = arrestStep(t, 0.5, 4, 0.05); expect(t).toBeGreaterThanOrEqual(ARREST_TIME - 0.01); let u = 1; for (let i = 0; i < 30; i++) u = arrestStep(u, 12, 4, 0.05); expect(u).toBe(0); expect(arrestStep(1, 0, 30, 0.1)).toBeLessThan(1); });
});
describe('Poursuite', () => {
  const setup = () => { const g = new RoadGraph(roads), w = new VehicleWorld(), tr = new Traffic(g, w, 0, 0, 3); const p = new Police(g, w, tr, new Collision([])); return { g, w, tr, p }; };
  it('lance des unités qui se rapprochent du joueur et finissent par l\'arrêter', () => {
    const { p, w } = setup(); const heat = { value: 70 }; const px = 500, pz = 500; let d0 = 0, arrested = false, minD = 1e9;
    for (let i = 0; i < 30 * 120 && !arrested; i++) { const out = p.update(1 / 30, { px, pz, pspeed: 0, heading: 0, inCar: false, stars: 4, }, heat); if (i === 60) d0 = Math.min(...p.units.map(u => Math.hypot(u.v.x - px, u.v.z - pz))); if (p.units.length) minD = Math.min(minD, Math.min(...p.units.map(u => Math.hypot(u.v.x - px, u.v.z - pz)))); arrested = out.arrested; }
    expect(p.units.length).toBeGreaterThan(0); expect(minD).toBeLessThan(d0); expect(arrested).toBe(true); expect(w.list.some(v => v.kind === 'poursuite')).toBe(true);
  });
  it('pose des barrages à partir de 3 étoiles seulement', () => { const a = setup(); for (let i = 0; i < 30 * 10; i++) a.p.update(1 / 30, { px: 500, pz: 500, pspeed: 20, heading: 0.5, inCar: true, stars: 2 }, { value: 50 }); expect(a.p.blocks.length).toBe(0); const b = setup(); for (let i = 0; i < 30 * 10; i++) b.p.update(1 / 30, { px: 500, pz: 500, pspeed: 20, heading: 0.5, inCar: true, stars: 3 }, { value: 70 }); expect(b.p.blocks.length).toBe(2); });
  it('la recherche redescend quand le joueur n\'est plus vu, et les unités se retirent', () => { const { p } = setup(); const heat = { value: 25 }; for (let i = 0; i < 30 * 30; i++) p.update(1 / 30, { px: 0, pz: 0, pspeed: 20, heading: 0, inCar: true, stars: 0 }, heat); expect(p.units.length).toBe(0);
    const h2 = { value: 30 }; p.unseen = 30; for (let i = 0; i < 30 * 5; i++) p.update(1 / 30, { px: 0, pz: 0, pspeed: 20, heading: 0, inCar: true, stars: 2 }, h2); expect(h2.value).toBeLessThan(30); });
});
