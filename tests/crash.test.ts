import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { dent, toLocal } from '../src/vehicles/damage';
import { NpcControl, FALL, RISE } from '../src/crime/npcControl';

describe('dégâts des véhicules', () => {
  it('la tôle s\'enfonce seulement autour du point de choc, vers l\'intérieur', () => {
    const g = new THREE.BoxGeometry(1.8, 1.2, 4.4, 6, 4, 12).translate(0, 0.6, 0); const before = (g.getAttribute('position').array as Float32Array).slice();
    dent([g], 0, 2.2, 0.25, 1, 0.9, 2.2); const a = g.getAttribute('position').array as Float32Array; let frontMoved = 0, rearMoved = 0, outward = 0;
    for (let i = 0; i < a.length; i += 3) { const dz = a[i + 2] - before[i + 2]; if (before[i + 2] > 1.5 && Math.abs(dz) > 1e-4) frontMoved++; if (before[i + 2] < -1.5 && Math.abs(dz) > 1e-6) rearMoved++; if (dz > 1e-6) outward++; }
    expect(frontMoved).toBeGreaterThan(5); expect(rearMoved).toBe(0); expect(outward).toBe(0);
  });
  it('point du monde → repère du véhicule, projeté sur la carrosserie', () => {
    const f = toLocal(0, 10, 0, 0, 0, 0.9, 2.2); expect(f.lz).toBeCloseTo(2.2); expect(Math.abs(f.lx)).toBeLessThan(1e-9);
    const h = Math.PI / 2; const r = toLocal(10, 0, 0, 0, h, 0.9, 2.2); expect(r.lz).toBeCloseTo(2.2);   // cap 90° : l'avant regarde +X
  });
});

describe('chute et relevé des habitants', () => {
  it('projeté par la voiture, tombe progressivement, se relève puis s\'enfuit', () => {
    const c = new NpcControl(); c.ko(1, 0, 0, 0, 2, 0, 6); const e = c.get(1)!;
    expect(c.fallOf(e)).toBe(0); c.update(FALL / 2, 99, 99); expect(c.fallOf(e)).toBeCloseTo(0.5, 1); for (let i = 0; i < 20; i++) c.update(0.05, 99, 99);
    expect(c.fallOf(e)).toBe(1); expect(e.z).toBeGreaterThan(1.2);
    while (e.mode === 'ko') c.update(0.05, 99, 99); c.update(0.1, 99, 99); expect(e.mode).toBe('fuite'); expect(e.speed).toBe(0); const f = c.fallOf(e); expect(f).toBeGreaterThan(0); expect(f).toBeLessThan(1);
    for (let i = 0; i < Math.ceil(RISE / 0.05) + 2; i++) c.update(0.05, 99, 99); expect(c.fallOf(e)).toBe(0); expect(e.speed).toBeGreaterThan(0);
  });
  it('un coup fait reculer (sursaut) ; un adversaire qui frappe arme son bras', () => {
    const c = new NpcControl(); c.hit(2, 0, 0, 0, 10, 3, false); expect(c.get(2)!.flinch).toBeGreaterThan(c.t);
    c.update(0.1, 0.5, 0); c.update(0.9, 0.5, 0); expect(c.get(2)!.swing ?? 0).toBeGreaterThan(0);
  });
});
