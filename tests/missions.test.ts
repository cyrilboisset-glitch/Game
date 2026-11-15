import { describe, it, expect } from 'vitest';
import { makeOffers, neutralSpots, repMult, type GenCtx, type Spot } from '../src/missions/generator';
import { Missions } from '../src/missions/missions';

const S = (n: string, x: number, z: number): Spot => ({ nom: n, x, z });
const ctx = (day = 1, rep = 0): GenCtx => ({ day, seed: 5, rep, at: { x: 0, z: 0 }, commerces: [S('Boulangerie', 100, 50), S('Super', 900, 400), S('Fleuriste', 1400, -300), S('Pharmacie', -600, 700)], bureaux: [S('Banque', 200, 300), S('Agence', 1300, 900), S('Mairie', -500, -400)], neutres: [S('Entrepôt A1', 300, 600), S('Hangar B2', 1800, 900), S('Dépôt C3', -900, 1200)], nodes: Array.from({ length: 30 }, (_, i) => ({ x: Math.cos(i) * 900, z: Math.sin(i * 1.7) * 900 })) });
describe('Génération des offres', () => {
  it('est déterministe par jour et varie d\'un jour à l\'autre', () => { expect(JSON.stringify(makeOffers(ctx(3)))).toBe(JSON.stringify(makeOffers(ctx(3)))); expect(JSON.stringify(makeOffers(ctx(3)))).not.toBe(JSON.stringify(makeOffers(ctx(4)))); });
  it('propose des types variés avec étapes valides et paie positive', () => { const o = makeOffers(ctx(2)); expect(new Set(o.map(x => x.kind)).size).toBeGreaterThanOrEqual(4); for (const x of o.filter(y => y.kind !== 'taxi')) { expect(x.stages.length).toBeGreaterThanOrEqual(2); expect(x.pay).toBeGreaterThan(0); expect(x.limit).toBeGreaterThan(30); } });
  it('la réputation augmente la paie', () => { const a = makeOffers(ctx(2, 0)).find(x => x.kind === 'livraison')!, b = makeOffers(ctx(2, 100)).find(x => x.kind === 'livraison')!; expect(b.pay).toBeGreaterThan(a.pay); expect(repMult(100)).toBe(1.5); });
  it('les colis ne passent que par des lieux fictifs neutres', () => { const col = makeOffers(ctx(2)).find(x => x.kind === 'colis')!; expect(col.risky).toBe(true); for (const s of col.stages) expect(ctx().neutres.some(n => n.x === s.x && n.z === s.z)).toBe(true); });
  it('les lieux neutres excluent les abords des écoles et les sites bâtis', () => { const spots = neutralSpots([{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 600, z: 0 }], (x) => x === 100, [{ x: 20, z: 10 }]); expect(spots.length).toBe(1); expect(spots[0].x).toBe(600); });
});
describe('Progression d\'une mission', () => {
  const offer = () => makeOffers(ctx(2)).find(x => x.kind === 'livraison')!;
  it('prise puis dépôt = paie et réputation', () => { const m = new Missions(), o = offer(); m.accept(o); const [a, b] = o.stages; expect(m.update(1, { x: a.x, z: a.z, speed: 0, inCar: false, stars: 0 })?.type).toBe('prise'); const e = m.update(1, { x: b.x, z: b.z, speed: 0, inCar: false, stars: 0 }); expect(e?.type).toBe('fini'); expect(m.rep).toBeGreaterThan(0); expect(m.active).toBeNull(); });
  it('ne valide pas une étape trop vite ou trop loin', () => { const m = new Missions(), o = offer(); m.accept(o); expect(m.update(1, { x: o.stages[0].x + 100, z: o.stages[0].z, speed: 0, inCar: false, stars: 0 })).toBeNull(); expect(m.update(1, { x: o.stages[0].x, z: o.stages[0].z, speed: 20, inCar: true, stars: 0 })).toBeNull(); });
  it('échoue si le délai est dépassé', () => { const m = new Missions(), o = offer(); m.accept(o); const e = m.update(o.limit! + 1, { x: 9999, z: 9999, speed: 0, inCar: false, stars: 0 }); expect(e?.type).toBe('echec'); });
  it('la prime d\'un colis est réduite de moitié sous recherche', () => { const m = new Missions(), o = makeOffers(ctx(2)).find(x => x.kind === 'colis')!; m.accept(o); m.update(1, { x: o.stages[0].x, z: o.stages[0].z, speed: 0, inCar: true, stars: 0 }); const e = m.update(1, { x: o.stages[1].x, z: o.stages[1].z, speed: 0, inCar: true, stars: 3 }); expect(e?.type === 'fini' && e.pay).toBe(Math.round(o.pay * 0.5)); });
  it('une course exige d\'être en voiture et enchaîne les points', () => { const m = new Missions(), o = makeOffers(ctx(2)).find(x => x.kind === 'course')!; m.accept(o); expect(m.update(1, { x: o.stages[0].x, z: o.stages[0].z, speed: 5, inCar: false, stars: 0 })).toBeNull(); expect(m.update(1, { x: o.stages[0].x, z: o.stages[0].z, speed: 20, inCar: true, stars: 0 })?.type).toBe('point'); });
});
