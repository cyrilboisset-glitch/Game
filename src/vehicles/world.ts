import * as THREE from 'three';
import { vehicleGeometry, bodyMaterial, lightMaterial } from './models';
import { SPECS, CIVIL_TYPES, PAINTS, type VehicleType } from './specs';
import type { Collision } from '../world/collision';
import type { Road } from '../world/data';
import { ROAD_W } from '../world/roads';
import { rng } from '../interiors/generator';

export interface WVehicle { id: number; type: VehicleType; paint: number; hp: number; x: number; z: number; h: number; speed: number; kind: 'gare' | 'trafic' | 'patrouille'; mine: boolean; upgrade: number; stun: number; }

/** Véhicules du monde : stationnés (garés le long des rues), circulation, patrouilles. Les rendus sont instanciés par type. */
export class VehicleWorld {
  list: WVehicle[] = []; private nextId = 1;
  add(v: Omit<WVehicle, 'id'>) { const w = { ...v, id: this.nextId++ }; this.list.push(w); return w; }
  remove(v: WVehicle) { const i = this.list.indexOf(v); if (i >= 0) this.list.splice(i, 1); }
  near(x: number, z: number, r: number) { return this.list.filter(v => Math.abs(v.x - x) < r && Math.abs(v.z - z) < r && Math.hypot(v.x - x, v.z - z) < r); }
  /** Garage le long des rues : voitures de tout type civil, en épi-parallèle sur le bas-côté, loin des murs. */
  populateParked(roads: Road[], coll: Collision, center: { x: number; z: number }, radius: number, count: number, seed = 99) {
    const r = rng(seed); const urban = roads.filter(x => ['residential', 'tertiary', 'secondary', 'unclassified', 'primary', 'living_street'].includes(x.t) && x.p.length > 1);
    let guard = 0; let placed = 0;
    while (placed < count && guard++ < count * 40) {
      const road = urban[Math.floor(r() * urban.length)]; const i = Math.floor(r() * (road.p.length - 1)); const a = road.p[i], b = road.p[i + 1]; const t = r(); const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (Math.hypot(x - center.x, z - center.z) > radius) continue; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 6) continue;
      const side = r() < 0.5 ? 1 : -1; const off = (ROAD_W[road.t] ?? 6) / 2 + 0.05; const nx = -dz / l * side, nz = dx / l * side; const px = x + nx * off, pz = z + nz * off;
      const q = { x: px, z: pz }; if (coll.resolve(q, 1.4).depth > 0) continue; if (this.list.some(v => Math.abs(v.x - px) < 5.5 && Math.abs(v.z - pz) < 5.5)) continue;
      const type = r() < 0.07 ? 'utilitaire' : CIVIL_TYPES[Math.floor(r() * CIVIL_TYPES.length)]; const dir = Math.atan2(dx, dz) + (side > 0 ? 0 : Math.PI);
      this.add({ type, paint: PAINTS[Math.floor(r() * PAINTS.length)], hp: SPECS[type].hp * (0.6 + r() * 0.4), x: px, z: pz, h: dir, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 0 }); placed++;
    }
  }
}

/** Rendu instancié : un InstancedMesh par type (carrosserie + feux), peinture et clignotement par instance. */
export class VehicleRenderer {
  private meshes = new Map<VehicleType, { body: THREE.InstancedMesh; lights: THREE.InstancedMesh; n: number }>(); private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private c = new THREE.Color(); private up = new THREE.Vector3(0, 1, 0);
  constructor(scene: THREE.Scene, cap = 120) {
    const bm = bodyMaterial(), lm = lightMaterial();
    for (const t of Object.keys(SPECS) as VehicleType[]) {
      const g = vehicleGeometry(t, true); const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(m); return m; };
      this.meshes.set(t, { body: mk(g.body, bm, true), lights: mk(g.lights, lm, false), n: 0 });
    }
  }
  begin() { for (const m of this.meshes.values()) m.n = 0; }
  add(type: VehicleType, paint: number, x: number, z: number, h: number, flash = 1, hp = 1) {
    const m = this.meshes.get(type)!; if (m.n >= m.body.instanceMatrix.count) return; this.q.setFromAxisAngle(this.up, h); this.m.compose(this.p.set(x, 0, z), this.q, this.one);
    m.body.setMatrixAt(m.n, this.m); m.body.setColorAt(m.n, this.c.set(paint).lerp(new THREE.Color(0x2a2522), (1 - hp) * 0.55)); m.lights.setMatrixAt(m.n, this.m); m.lights.setColorAt(m.n, this.c.setScalar(flash)); m.n++;
  }
  end() { for (const m of this.meshes.values()) { for (const k of [m.body, m.lights]) { k.count = m.n; k.instanceMatrix.needsUpdate = true; if (k.instanceColor) k.instanceColor.needsUpdate = true; } } }
  count() { let n = 0; for (const m of this.meshes.values()) n += m.n; return n; }
}
