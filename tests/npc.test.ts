import { describe, it, expect } from 'vitest';
import { generatePopulation, JOBS, type Place } from '../src/npc/identity';
import { dayPlan } from '../src/npc/schedule';

const P = (n: string, x: number, z: number, kind: Place['kind'] = 'commerce'): Place => ({ x, z, nom: n, kind });
const homes = Array.from({ length: 30 }, (_, i) => P('Maison ' + i, i * 20, 5, 'maison'));
const pop = () => generatePopulation({ homes, poiByType: t => t.some(x => ['bakery', 'school', 'supermarket'].includes(x)) ? [P('Lieu', 100, 100, 'travail')] : [], park: [P('Parc', 50, 50, 'parc')], shops: [P('Super', 80, 0)], restos: [P('Resto', 90, 0, 'resto')], addressOf: () => '1 rue Test', count: 400, seed: 7 });

describe('Population', () => {
  const npcs = pop();
  it('est déterministe', () => { expect(JSON.stringify(pop().slice(0, 20))).toBe(JSON.stringify(npcs.slice(0, 20))); });
  it('génère le nombre demandé avec des identités complètes', () => { expect(npcs.length).toBe(400); for (const n of npcs.slice(0, 50)) { expect(n.prenom && n.nom && n.adresse && n.metierLabel).toBeTruthy(); expect(n.home).toBeDefined(); } });
  it('les élèves sont mineurs, les autres adultes', () => { for (const n of npcs) expect(n.minor).toBe(n.age < 18); expect(npcs.some(n => n.metier === 'eleve')).toBe(true); expect(npcs.filter(n => n.metier !== 'eleve').every(n => !n.minor)).toBe(true); });
  it('les métiers sans lieu disponible retombent sur « hors commune »', () => { expect(npcs.every(n => !['pharmacien', 'banquier'].includes(n.metier))).toBe(true); });
  it('couvre plusieurs métiers', () => { expect(new Set(npcs.map(n => n.metier)).size).toBeGreaterThan(5); expect(JOBS.length).toBeGreaterThan(10); });
});
describe('Emplois du temps', () => {
  const npcs = pop();
  it('couvrent toute la journée sans trou ni chevauchement', () => { for (const n of npcs.slice(0, 120)) for (const dow of [0, 2, 5, 6]) { const s = dayPlan(n, dow, 3 + dow); expect(s[0].t0).toBe(0); expect(s[s.length - 1].t1).toBe(24); for (let i = 1; i < s.length; i++) expect(Math.abs(s[i].t0 - s[i - 1].t1)).toBeLessThan(1e-6); } });
  it('est déterministe pour un jour donné et varie d\'un jour à l\'autre', () => { const n = npcs[3]; expect(JSON.stringify(dayPlan(n, 1, 5))).toBe(JSON.stringify(dayPlan(n, 1, 5))); expect(JSON.stringify(dayPlan(n, 1, 5))).not.toBe(JSON.stringify(dayPlan(n, 1, 6))); });
  it('les élèves vont à l\'école en semaine seulement', () => { const e = npcs.find(n => n.metier === 'eleve')!; expect(dayPlan(e, 0, 1).some(s => s.act === 'ecole')).toBe(true); expect(dayPlan(e, 6, 1).some(s => s.act === 'ecole')).toBe(false); });
  it('le week-end diffère de la semaine', () => { const n = npcs.find(x => x.metier === 'vendeur' || x.metier === 'ouvrier')!; expect(dayPlan(n, 6, 1).some(s => s.act === 'travail' || s.act === 'hors_carte')).toBe(false); expect(dayPlan(n, 1, 2).some(s => s.act === 'travail' || s.act === 'hors_carte')).toBe(true); });
  it('les élèves ne vont qu\'à l\'école, chez eux ou au parc (jamais au restaurant)', () => { for (const e of npcs.filter(n => n.metier === 'eleve').slice(0, 30)) for (const dow of [0, 2, 5]) for (const s of dayPlan(e, dow, 4)) expect(['sommeil', 'maison', 'ecole', 'dejeuner', 'courses', 'loisir']).toContain(s.act); });
});

import { SKIN_TINTS, makeLook, pickOrigin } from '../src/npc/appearance';
import { rng } from '../src/interiors/generator';
describe('Diversité', () => {
  const big = generatePopulation({ homes: Array.from({ length: 1700 }, (_, i) => P('M' + i, i, 5, 'maison')), poiByType: () => [P('L', 1, 1, 'travail')], park: [P('Parc', 50, 50, 'parc')], shops: [P('S', 8, 0)], restos: [P('R', 9, 0, 'resto')], addressOf: () => 'x', count: 4000, seed: 11 });
  it('génère 4000 habitants', () => { expect(big.length).toBe(4000); });
  it('couvre toutes les carnations, plusieurs origines et les deux genres', () => { expect(new Set(big.map(n => n.look.skin)).size).toBe(SKIN_TINTS.length); expect(new Set(big.map(n => n.look.origin)).size).toBeGreaterThanOrEqual(5); expect(big.filter(n => n.genre === 'F').length).toBeGreaterThan(1500); });
  it('couvre les âges : enfants, adultes, personnes âgées', () => { expect(big.some(n => n.age < 12)).toBe(true); expect(big.filter(n => n.age >= 70).length).toBeGreaterThan(100); expect(big.filter(n => n.age < 18).length).toBeGreaterThan(400); });
  it('les enfants sont plus petits, les personnes âgées voûtées', () => { const kids = big.filter(n => n.age < 10), adults = big.filter(n => n.age >= 25 && n.age < 60); const avg = (a: typeof big) => a.reduce((s, n) => s + n.look.height, 0) / a.length; expect(avg(kids)).toBeLessThan(avg(adults) - 0.4); expect(big.filter(n => n.age >= 75).every(n => n.look.stoop > 0.1)).toBe(true); });
  it('couvre des corpulences très différentes', () => { const w = big.map(n => n.look.width); expect(Math.min(...w)).toBeLessThan(0.92); expect(Math.max(...w)).toBeGreaterThan(1.25); });
  it('les membres d\'un même foyer partagent leur nom de famille et leur adresse', () => { const byHome = new Map<string, Set<string>>(); for (const n of big) { const k = n.home.nom; const s = byHome.get(k) ?? new Set(); s.add(n.nom); byHome.set(k, s); } expect([...byHome.values()].every(s => s.size === 1)).toBe(true); });
  it('les mineurs ne sont jamais au restaurant', () => { for (const n of big.filter(x => x.minor).slice(0, 200)) for (const s of dayPlan(n, 1, 2)) expect(s.place.kind).not.toBe('resto'); });
  it('une origine tirée au hasard est valide', () => { const r = rng(1); for (let i = 0; i < 50; i++) expect(makeLook(r, pickOrigin(r), 'F', 30).height).toBeGreaterThan(1.5); });
});
