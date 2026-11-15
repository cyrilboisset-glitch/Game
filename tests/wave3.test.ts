import { describe, it, expect } from 'vitest';
import { FireSim, type Fuel } from '../src/crime/fire';
import { Enquete } from '../src/crime/enquete';
import { fencePrice } from '../src/crime/loot';

const car = (k: string, x: number): Fuel => ({ key: k, kind: 'voiture', x, z: 0, pts: [[x, 1, 0]] });

describe('incendie', () => {
  it('monte en puissance, se propage aux voisins, puis s\'éteint', () => {
    const f = new FireSim(); f.ignite(car('a', 0));
    const fuels = [car('b', 4), car('c', 30)]; let born = 0;
    for (let t = 0; t < 200; t++) born += f.step(1, (n, r) => fuels.filter(q => Math.hypot(q.x - n.x, q.z - n.z) < r), () => 0).born.length;
    expect(born).toBe(1); expect(f.done('b')).toBe(true); expect(f.done('c')).toBe(false);
    expect(f.active.length).toBe(0); expect(f.nodes.every(n => n.burnt)).toBe(true);
  });
  it('l\'eau des pompiers éteint le foyer ; chaleur dangereuse de près seulement', () => {
    const f = new FireSim(); f.ignite(car('a', 0), 1);
    expect(f.heatAt(0.5, 0)).toBeGreaterThan(5); expect(f.heatAt(5, 0)).toBe(0);
    for (let t = 0; t < 30 && f.active.length; t++) f.water(0, 0, 14, 0.15, 1);
    expect(f.active.length).toBe(0);
  });
  it('un foyer déjà brûlé ne repart pas', () => { const f = new FireSim(); f.ignite(car('a', 0)); expect(f.ignite(car('a', 0))).toBeNull(); });
});

describe('enquête et prison', () => {
  it('preuves, piste du véhicule, mandat ou classement à l\'échéance', () => {
    const e = new Enquete(); const d = e.open('braquage', 1, 10, 2.5, { vehicule: 'berline grise', tenue: 'sweat bleu' });
    expect(d.preuves).toBeCloseTo(62.5); expect(e.sentence(0)).toBe(8);
    e.burnCar('berline grise'); expect(d.preuves).toBeCloseTo(32.5); expect(d.vehicule).toBeNull();
    e.changeOutfit(); expect(d.preuves).toBeCloseTo(24.5);
    const r = e.tick(60, 3, 12); expect(r.classes.length).toBe(1); expect(e.open_.length).toBe(0);
    const d2 = e.open('enlevement', 4, 1, 3, { vehicule: 'citadine rouge', tenue: null }); const r2 = e.tick(60, 6, 12);
    expect(d2.mandat).toBe(true); expect(r2.mandat.length).toBe(1); expect(e.mandat).toBe(true); expect(e.sentence(0)).toBe(20);
    e.closeAll(); expect(e.mandat).toBe(false); expect(e.sentence(2)).toBe(0);
  });
  it('les gants réduisent les traces ; flagrant délit à 3 étoiles', () => {
    const a = new Enquete(); a.gants = true; expect(a.open('holdup', 1, 0, 1, { vehicule: null, tenue: null }).preuves).toBeCloseTo(15);
    expect(new Enquete().sentence(3)).toBe(1); expect(new Enquete().sentence(4)).toBe(3);
  });
  it('le receleur ne rachète pas les sacs de billets', () => { expect(fencePrice(['billets'], 0)).toBe(0); });
});
