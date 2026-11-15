import { describe, it, expect } from 'vitest';
import { NpcSim, dowOf } from '../src/npc/sim';
import { RoadGraph } from '../src/roads/graph';
import { generatePopulation, type Place } from '../src/npc/identity';

const P = (n: string, x: number, z: number, kind: Place['kind'] = 'commerce'): Place => ({ x, z, nom: n, kind });
const graph = new RoadGraph([{ t: 'residential', n: 'R', o: 0, p: [[0, 0], [400, 0], [800, 0], [1200, 0]] }]);
const npcs = generatePopulation({ homes: [P('Dom', 5, 8, 'maison'), P('Dom2', 405, 8, 'maison')], poiByType: () => [P('Boutique', 1100, 8, 'travail')], park: [P('Parc', 600, 8, 'parc')], shops: [P('Super', 800, 8)], restos: [P('Resto', 810, 8, 'resto')], addressOf: () => 'x', count: 60, seed: 3 });
const sim = new NpcSim(npcs, graph);
describe('Simulation des habitants', () => {
  it('dort à la maison à 3 h', () => { for (const n of npcs.slice(0, 20)) { const s = sim.stateAt(n, 4, 3, false); expect(['dedans', 'absent']).toContain(s.kind); expect(Math.hypot(s.x - n.home.x, s.z - n.home.z)).toBeLessThan(1); } });
  it('un travailleur sur place est au travail en milieu de matinée en semaine', () => { const n = npcs.find(x => ['vendeur', 'coiffeur', 'enseignant'].includes(x.metier))!; const day = [1, 2, 3, 4, 5].find(d => dowOf(d) < 5)!; const s = sim.stateAt(n, day, 10.5, false); expect(s.act).toBe('travail'); expect(s.kind).toBe('dedans'); });
  it('se déplace entre deux lieux de façon continue (pas de téléportation)', () => {
    const n = npcs.find(x => ['vendeur', 'coiffeur', 'enseignant'].includes(x.metier))!; const day = [1, 2, 3, 4, 5].find(d => dowOf(d) < 5)!; let prev = sim.stateAt(n, day, 6, true), maxJump = 0, walked = 0;
    for (let h = 6; h < 10; h += 1 / 120) { const s = sim.stateAt(n, day, h, true); if (s.kind === 'marche' || s.kind === 'conduit') walked++; maxJump = Math.max(maxJump, Math.hypot(s.x - prev.x, s.z - prev.z)); prev = s; }
    expect(walked).toBeGreaterThan(0); expect(maxJump).toBeLessThan(120);   // 30 s de jeu en voiture ≈ 255 m max → seuil large pour les sauts de segment
  });
  it('produit un journal lisible', () => { const n = npcs[0]; const j = sim.journal(n, 4, 20); expect(j.length).toBeGreaterThan(1); expect(j[0]).toMatch(/\d+ h \d\d :/); });
  it('est déterministe', () => { const n = npcs[2]; expect(JSON.stringify(sim.stateAt(n, 5, 12.3, true))).toBe(JSON.stringify(new NpcSim(npcs, graph).stateAt(n, 5, 12.3, true))); });
});
