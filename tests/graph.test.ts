import { describe, it, expect } from 'vitest';
import { RoadGraph, polyLength, pointAlong } from '../src/roads/graph';
import type { Road } from '../src/world/data';

const roads: Road[] = [
  { t: 'residential', n: 'A', o: 0, p: [[0, 0], [100, 0], [200, 0]] }, { t: 'residential', n: 'B', o: 0, p: [[100, 0], [100, 100]] },
  { t: 'residential', n: 'C', o: 0, p: [[100, 100], [200, 100], [200, 0]] }, { t: 'residential', n: 'iso', o: 0, p: [[500, 500], [600, 500]] }, { t: 'motorway', n: 'M', o: 0, p: [[0, 50], [200, 50]] },
];
describe('Graphe routier', () => {
  const g = new RoadGraph(roads);
  it('trouve le plus court chemin', () => { const a = g.nearest(0, 0), b = g.nearest(200, 100); const p = g.path(a, b)!; expect(p).not.toBeNull(); expect(polyLength(g.polyline(p, false))).toBeCloseTo(300, 0); });
  it('retourne null entre composantes non connectées', () => { expect(g.path(g.nearest(0, 0), g.nearest(600, 500))).toBeNull(); });
  it('ignore les autoroutes', () => { expect(g.nearest(100, 50, 10)).toBe(-1); });
  it('décale le trottoir à droite du sens de marche', () => { const p = g.polyline([g.nearest(0, 0), g.nearest(100, 0)]); expect(Math.abs(p[0][1])).toBeGreaterThan(2); const q = g.polyline([g.nearest(100, 0), g.nearest(0, 0)]); expect(Math.sign(p[0][1])).toBe(-Math.sign(q[0][1])); });
  it('interpole le long d\'une polyligne', () => { const pl: [number, number][] = [[0, 0], [10, 0], [10, 10]]; expect(pointAlong(pl, 15)).toMatchObject({ x: 10, z: 5 }); });
});
