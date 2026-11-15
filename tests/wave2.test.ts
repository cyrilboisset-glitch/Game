import { describe, it, expect } from 'vitest';
import { kgOf, fits, loadFactor, fencePrice, rollLoot, summary, BAG_MAX } from '../src/crime/loot';
import { occupancy, listenReport, nextEmpty, streetCue } from '../src/crime/homes';
import { aimShot, policeVolley } from '../src/crime/firearms';
import type { Npc } from '../src/npc/identity';
import type { NpcState } from '../src/npc/sim';

const npc = (id: number, minor = false) => ({ id, minor, prenom: 'A', nom: 'B' } as unknown as Npc);
const st = (id: number, kind: NpcState['kind'], act: NpcState['act'] = 'maison'): NpcState => ({ id, x: 0, z: 0, h: 0, kind, act, speed: 0, place: { x: 0, z: 0, nom: 'Domicile', kind: kind === 'dedans' ? 'maison' : 'travail' }, detail: '' });

describe('butin', () => {
  it('poids, sac plein, ralentissement', () => {
    expect(kgOf(['tele', 'bijoux'])).toBeCloseTo(14.3);
    expect(fits(['tele'], 'outillage')).toBe(false);
    expect(fits(['tele'], 'bijoux')).toBe(true);
    expect(fits([], 'tele', BAG_MAX)).toBe(true);
    expect(loadFactor(3)).toBe(1); expect(loadFactor(20)).toBeLessThan(0.6);
  });
  it('receleur : environ un tiers, refuse au-delà de 2 étoiles', () => {
    expect(fencePrice(['bijoux'], 0)).toBe(Math.round(320 * 0.36));
    expect(fencePrice(['bijoux'], 2)!).toBeLessThan(fencePrice(['bijoux'], 0)!);
    expect(fencePrice(['bijoux'], 3)).toBeNull();
  });
  it('tables de fouille et résumé', () => {
    expect(rollLoot('logement', 'arm', () => 0)).toBe('bijoux');
    expect(rollLoot('logement', 'frigo', () => 0)).toBeNull();
    expect(rollLoot('ecole', 'x', () => 0)).toBeNull();
    expect(summary(['bijoux', 'bijoux', 'tele'])).toBe('2 × Bijoux, Télévision');
  });
});

describe('repérage des logements', () => {
  it('occupants, enfants, sommeil', () => {
    const a = npc(1), b = npc(2), k = npc(3, true);
    const o = occupancy([a, b, k], n => (n.id === 2 ? st(2, 'marche') : st(n.id, 'dedans', 'sommeil')));
    expect(o.adults.map(n => n.id)).toEqual([1]); expect(o.minors.length).toBe(1); expect(o.asleep).toBe(true);
    expect(listenReport(o)).toContain('enfants');
    const empty = occupancy([a], () => st(1, 'marche')); expect(listenReport(empty)).toContain('personne'); expect(streetCue(empty, 23)).toBe('tout est éteint');
    expect(streetCue(occupancy([a], () => st(1, 'dedans', 'maison')), 22)).toBe('lumière allumée');
  });
  it('prochaine absence de tout le foyer', () => {
    const a = npc(1), b = npc(2);
    // a part de 8 h à 17 h, b de 9 h à 16 h → maison vide de 9 h à 16 h
    const at = (n: Npc, _d: number, h: number) => { const out = n.id === 1 ? h >= 8 && h < 17 : h >= 9 && h < 16; return st(n.id, out ? 'marche' : 'dedans'); };
    const f = nextEmpty([a, b], at, 1, 6)!; expect(f.from).toBeCloseTo(9, 1); expect(f.to).toBeCloseTo(16, 1); expect(f.text).toContain('9 h 00');
    expect(nextEmpty([a, b], () => st(1, 'dedans'), 1, 6)).toBeNull();
  });
});

describe('armes à feu', () => {
  const clear = () => false;
  it('vise la personne la plus proche dans le cône, avec ligne de vue', () => {
    const r = aimShot(0, 0, 0, [{ id: 1, x: 0, z: 10, minor: false }, { id: 2, x: 0, z: 20, minor: false }, { id: 3, x: 8, z: 3, minor: false }], clear);
    expect(r.target?.id).toBe(1);
    expect(aimShot(0, 0, 0, [{ id: 1, x: 0, z: 10, minor: false }], () => true).target).toBeNull();
  });
  it('ne tire jamais si un enfant est dans la ligne de mire', () => {
    const r = aimShot(0, 0, 0, [{ id: 1, x: 0, z: 15, minor: false }, { id: 2, x: 0.8, z: 8, minor: true }], clear);
    expect(r.child).toBe(true); expect(r.target).toBeNull();
    expect(aimShot(0, 0, 0, [{ id: 2, x: 0, z: 5, minor: true }], clear).target).toBeNull();
    expect(aimShot(0, 0, 0, [{ id: 1, x: 0, z: 10, minor: false }, { id: 2, x: 15, z: -3, minor: true }], clear).target?.id).toBe(1);
  });
  it('la gendarmerie ne tire qu\'à 3 étoiles sur un joueur armé et vu', () => {
    expect(policeVolley(10, true, true, 2, 0, 0.5)).toBe(0);
    expect(policeVolley(10, true, false, 5, 0, 0.5)).toBe(0);
    expect(policeVolley(10, false, true, 5, 0, 0.5)).toBe(0);
    expect(policeVolley(10, true, true, 3, 0, 0.5)).toBeGreaterThan(0);
  });
});
