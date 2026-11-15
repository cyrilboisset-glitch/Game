import { describe, it, expect } from 'vitest';
import { RoadGraph } from '../src/roads/graph';
import { Traffic } from '../src/vehicles/traffic';
import { VehicleWorld } from '../src/vehicles/world';
import { SPECS } from '../src/vehicles/specs';
import { Collision } from '../src/world/collision';
import type { Road } from '../src/world/data';

// quadrillage 6×6 de rues résidentielles (100 m) + une rue à sens unique
const roads: Road[] = []; for (let i = 0; i <= 5; i++) { roads.push({ t: 'residential', n: 'H' + i, o: 0, p: Array.from({ length: 11 }, (_, k) => [k * 50, i * 100] as [number, number]) }); roads.push({ t: 'residential', n: 'V' + i, o: 0, p: Array.from({ length: 11 }, (_, k) => [i * 100, k * 50] as [number, number]) }); }
const oneway: Road[] = [{ t: 'residential', n: 'S', o: 0, p: [[0, 0], [100, 0]] }, { t: 'residential', n: 'U', o: 1, p: [[100, 0], [100, 100]] }, { t: 'residential', n: 'R', o: 0, p: [[100, 100], [0, 100]] }, { t: 'residential', n: 'L', o: 0, p: [[0, 100], [0, 0]] }];

describe('Véhicules : caractéristiques', () => {
  it('le véhicule de départ est le plus faible, la gendarmerie la plus rapide', () => { expect(SPECS.depart.maxSpeed).toBeLessThan(SPECS.citadine.maxSpeed); expect(SPECS.gendarmerie_berline.maxSpeed).toBeGreaterThan(SPECS.berline.maxSpeed); expect(SPECS.gendarmerie_berline.accel).toBeGreaterThan(SPECS.berline.accel); });
  it('l\'utilitaire est lourd et lent, la citadine agile', () => { expect(SPECS.utilitaire.mass).toBeGreaterThan(SPECS.berline.mass); expect(SPECS.utilitaire.accel).toBeLessThan(SPECS.citadine.accel); expect(SPECS.citadine.steer).toBeGreaterThan(SPECS.berline.steer); });
  it('les véhicules de gendarmerie sont marqués comme tels', () => { expect(SPECS.gendarmerie_fourgon.police).toBe(true); expect(SPECS.depart.police).toBeUndefined(); });
});
describe('Circulation', () => {
  it('respecte les sens uniques (pas de chemin à contresens)', () => { const g = new RoadGraph(oneway); const a = g.nearest(100, 100, 5, true), b = g.nearest(100, 0, 5, true); const p = g.path(a, b, true)!; expect(p).not.toBeNull(); expect(p.length).toBeGreaterThan(3); /* il faut contourner : 100,100 → 0,100 → 0,0 → 100,0 */ const walk = g.path(g.nearest(100, 100, 5), g.nearest(100, 0, 5), false)!; expect(walk.length).toBe(2); /* un piéton peut remonter la rue */ });
  it('ne fait jamais rouler deux voitures l\'une dans l\'autre et reste sur le réseau', () => {
    const g = new RoadGraph(roads), w = new VehicleWorld(), t = new Traffic(g, w, 14, 0, 3); let minGap = 1e9, offRoad = 0, moving = 0;
    for (let i = 0; i < 30 * 150; i++) {
      t.update(1 / 30, 250, 250, []);
      if (i % 15 === 0) for (const a of t.cars) { for (const b of t.cars) if (a !== b) { const d = Math.hypot(a.v.x - b.v.x, a.v.z - b.v.z); const al = Math.sin(a.v.h) * Math.sin(b.v.h) + Math.cos(a.v.h) * Math.cos(b.v.h); if (al > 0.7) minGap = Math.min(minGap, d); }
        const dRoad = Math.min(Math.abs(a.v.x % 100), 100 - Math.abs(a.v.x % 100), Math.abs(a.v.z % 100), 100 - Math.abs(a.v.z % 100)); if (dRoad > 4) offRoad++; if (a.v.speed > 1) moving++; }
    }
    expect(t.stats.spawns).toBeGreaterThan(10); expect(minGap).toBeGreaterThan(2.5); expect(offRoad).toBe(0); expect(moving).toBeGreaterThan(50);
  });
  it('les voitures s\'arrêtent derrière un obstacle (le joueur) sur leur voie', () => {
    const g = new RoadGraph([{ t: 'residential', n: 'A', o: 0, p: Array.from({ length: 41 }, (_, i) => [i * 50, 0] as [number, number]) }]), w = new VehicleWorld(), t = new Traffic(g, w, 3, 0, 9);
    const obs = [{ x: 1000, z: 1.7, h: Math.PI / 2, speed: 0, L: 4 }]; let reached = 0;
    for (let i = 0; i < 30 * 200; i++) { t.update(1 / 30, 1000, 0, obs); for (const c of t.cars) if (Math.sin(c.v.h) > 0.5 && c.v.x < 1000 && c.v.x > 995) reached++; }
    expect(t.stats.spawns).toBeGreaterThan(0); expect(reached).toBe(0);
  });
});
describe('Véhicules stationnés', () => {
  it('ne chevauchent pas les murs ni entre eux', () => {
    const w = new VehicleWorld(); const coll = new Collision([{ l: 0, h: 0, n: '', p: [[-20, 8], [20, 8], [20, 30], [-20, 30], [-20, 8]] }]);
    w.populateParked([{ t: 'residential', n: 'A', o: 0, p: [[-200, 0], [200, 0]] }], coll, { x: 0, z: 0 }, 300, 30, 4);
    expect(w.list.length).toBeGreaterThan(5); for (const a of w.list) { const q = { x: a.x, z: a.z }; expect(coll.resolve(q, 1.4).depth).toBe(0); for (const b of w.list) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(5); }
  });
});
