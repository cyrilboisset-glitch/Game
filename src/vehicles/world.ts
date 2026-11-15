import * as THREE from 'three';
import { vehicleGeometry, vehicleMaterials } from './models';
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

/** Rendu instancié : par type, 4 InstancedMesh (peinture teintée, vitres, finitions, feux) + ombre de contact commune. */
export class VehicleRenderer {
  private meshes = new Map<VehicleType, { paint: THREE.InstancedMesh; glass: THREE.InstancedMesh; trim: THREE.InstancedMesh; lights: THREE.InstancedMesh; n: number }>(); private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private c = new THREE.Color(); private up = new THREE.Vector3(0, 1, 0);
  private shadow: THREE.InstancedMesh; private sn = 0; private sc = new THREE.Vector3();
  constructor(scene: THREE.Scene, private cap = 120) {
    const mt = vehicleMaterials();
    for (const t of Object.keys(SPECS) as VehicleType[]) {
      const g = vehicleGeometry(t, true); const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean, color: boolean) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; if (color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(m); return m; };
      this.meshes.set(t, { paint: mk(g.paint, mt.paint, true, true), glass: mk(g.glass, mt.glass, false, false), trim: mk(g.trim, mt.trim, true, false), lights: mk(g.lights, mt.lights, false, true), n: 0 });
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g2 = cv.getContext('2d')!; const gr = g2.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: true }), cap * 3);
    this.shadow.count = 0; this.shadow.frustumCulled = false; scene.add(this.shadow);
  }
  begin() { for (const m of this.meshes.values()) m.n = 0; this.sn = 0; }
  add(type: VehicleType, paint: number, x: number, z: number, h: number, flash = 1, hp = 1) {
    const m = this.meshes.get(type)!; if (m.n >= this.cap) return; this.q.setFromAxisAngle(this.up, h); this.m.compose(this.p.set(x, 0, z), this.q, this.one);
    m.paint.setMatrixAt(m.n, this.m); m.paint.setColorAt(m.n, this.c.set(paint).lerp(new THREE.Color(0x2a2522), (1 - hp) * 0.55)); m.glass.setMatrixAt(m.n, this.m); m.trim.setMatrixAt(m.n, this.m); m.lights.setMatrixAt(m.n, this.m); m.lights.setColorAt(m.n, this.c.setScalar(flash)); m.n++;
    const sp = SPECS[type]; if (this.sn < this.shadow.instanceMatrix.count) { this.m.compose(this.p.set(x, 0.1, z), this.q, this.sc.set(sp.W * 1.5, 1, sp.L * 1.2)); this.shadow.setMatrixAt(this.sn++, this.m); }
  }
  end() { for (const m of this.meshes.values()) for (const k of [m.paint, m.glass, m.trim, m.lights]) { k.count = m.n; k.instanceMatrix.needsUpdate = true; if (k.instanceColor) k.instanceColor.needsUpdate = true; } this.shadow.count = this.sn; this.shadow.instanceMatrix.needsUpdate = true; }
  count() { let n = 0; for (const m of this.meshes.values()) n += m.n; return n; }
}
