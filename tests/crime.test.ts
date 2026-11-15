import { describe, it, expect } from 'vitest';
import { gatherWitnesses, describe as desc, merge, recognizability, sightRange, reportDelay } from '../src/crime/perception';
import { findTarget, isBehind, hitDamage, WEAPONS } from '../src/crime/combat';
import { NpcControl } from '../src/crime/npcControl';
import { Collision } from '../src/world/collision';

const wall = new Collision([{ l: 0, h: 0, n: '', p: [[10, -50], [12, -50], [12, 50], [10, 50], [10, -50]] }]);
const blocked = (a: number, b: number, c: number, d: number) => wall.blocked(a, b, c, d);
describe('Perception', () => {
  it('un mur coupe la ligne de vue', () => { expect(wall.blocked(0, 0, 20, 0)).toBe(true); expect(wall.blocked(0, 0, 5, 5)).toBe(false); });
  it('voit de près, entend sans voir derrière un mur, ignore les mineurs et les lointains', () => {
    const w = gatherWitnesses(0, 0, [{ id: 1, x: 5, z: 0, minor: false }, { id: 2, x: 20, z: 0, minor: false }, { id: 3, x: 3, z: 0, minor: true }, { id: 4, x: 0, z: 200, minor: false }], 35, 25, blocked);
    expect(w.map(x => x.id)).toEqual([1, 2]); expect(w[0].seen).toBe(true); expect(w[1].seen).toBe(false);
  });
  it('la nuit, accroupi ou caché, on est vu de moins loin', () => { expect(sightRange(true, false, false)).toBeLessThan(sightRange(false, false, false)); expect(sightRange(false, true, false)).toBeLessThan(sightRange(false, false, false)); expect(sightRange(false, false, true)).toBeLessThan(15); });
  it('le signalement dépend de ce qui a été vu', () => { const near = desc({ id: 1, dist: 8, seen: true }, 'bleu', null, false); expect(near).toEqual({ outfit: 'bleu', vehicle: null, face: true }); expect(desc({ id: 1, dist: 8, seen: true }, 'bleu', null, true).face).toBe(false); expect(desc({ id: 1, dist: 30, seen: false }, 'bleu', 'citadine', false)).toEqual({ outfit: null, vehicle: null, face: false }); expect(desc({ id: 1, dist: 30, seen: true }, 'bleu', 'citadine', false).vehicle).toBe('citadine'); });
  it('changer de tenue et de voiture rend moins reconnaissable', () => {
    const profile = merge({ outfit: null, vehicle: null, face: false }, { outfit: 'bleu', vehicle: 'citadine rouge', face: true });
    const same = recognizability({ stars: 2, profile, outfit: 'bleu', vehicle: null, hooded: false, hidden: false, crouch: false });
    const changed = recognizability({ stars: 2, profile, outfit: 'vert', vehicle: null, hooded: true, hidden: false, crouch: false });
    expect(changed).toBeLessThan(same * 0.5); expect(recognizability({ stars: 2, profile, outfit: 'bleu', vehicle: null, hooded: false, hidden: true, crouch: true })).toBeLessThan(0.1);
    expect(recognizability({ stars: 5, profile, outfit: 'vert', vehicle: null, hooded: true, hidden: false, crouch: false })).toBe(1);
  });
  it('un témoin qui a vu appelle plus vite', () => { expect(reportDelay(0, true)).toBeLessThan(reportDelay(0, false)); });
});
describe('Bagarre', () => {
  const list = [{ id: 1, x: 0, z: 1.2, h: 0, minor: false }, { id: 2, x: 0, z: 0.8, h: 0, minor: true }, { id: 3, x: 1.2, z: 0, h: 0, minor: false }];
  it('cible l\'adulte devant soi, jamais un mineur', () => { expect(findTarget(0, 0, 0, list, 1.5)?.id).toBe(1); expect(findTarget(0, 0, 0, [list[1]], 1.5)).toBeNull(); expect(findTarget(0, 0, Math.PI, list, 1.5)).toBeNull(); });
  it('assomme net par surprise dans le dos avec un objet, pas aux poings', () => { expect(isBehind(0, -1, { x: 0, z: 0, h: 0 })).toBe(true); expect(isBehind(0, 1, { x: 0, z: 0, h: 0 })).toBe(false); expect(hitDamage('batte', true, true, 0.5).ko).toBe(true); expect(hitDamage('poings', true, true, 0.5).ko).toBe(false); expect(hitDamage('poings', true, true, 0.5).dmg).toBeGreaterThan(hitDamage('poings', false, false, 0.5).dmg); });
  it('les armes font plus mal que les poings', () => { expect(WEAPONS.batte.dmg[0]).toBeGreaterThan(WEAPONS.poings.dmg[1]); });
});
describe('Habitants pris à partie', () => {
  it('KO quand les points de vie tombent à 0, puis se relève et fuit (devient témoin)', () => { const c = new NpcControl(); expect(c.hit(1, 0, 0, 0, 999, 5, false)).toBe('ko'); let woke: number[] = []; for (let i = 0; i < 60 * 70; i++) woke = woke.concat(c.update(1 / 60, 0, 0).woke); expect(woke).toContain(1); });
  it('fuit face à une arme, s\'éloigne du joueur', () => { const c = new NpcControl(); expect(c.hit(2, 1, 0, 0, 10, 3, true)).toBe('fuite'); for (let i = 0; i < 120; i++) c.update(1 / 60, 0, 0); expect(Math.hypot(c.get(2)!.x, c.get(2)!.z)).toBeGreaterThan(5); });
  it('certains se défendent et frappent le joueur', () => { const c = new NpcControl(); expect(c.hit(3, 3, 0, 0, 10, 2, false)).toBe('combat'); let dmg = 0; for (let i = 0; i < 60 * 5; i++) dmg += c.update(1 / 60, 0, 0).dmgToPlayer; expect(dmg).toBeGreaterThan(10); });
});
