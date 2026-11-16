import * as THREE from 'three';
import { vehicleGeometry, vehicleMaterials } from './models';
import { SPECS, type VehicleSpec, type VehicleType } from './specs';
import { dent, crackTexture } from './damage';

export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; }

/** Véhicule conduit par le joueur : modèle procédural, physique arcade pilotée par les caractéristiques du véhicule, dégâts. */
export class Car {
  root = new THREE.Group(); body = new THREE.Group(); spec: VehicleSpec = SPECS.depart; paint = 0xb9b2a0; hp = 70; upgrade = 0;
  pos = new THREE.Vector3(); heading = 0; speed = 0; steer = 0; lateral = 0; yawRate = 0;
  private wheelMeshes: { m: THREE.Mesh; front: boolean }[] = []; private mats = vehicleMaterials();
  private geos: THREE.BufferGeometry[] = []; private orig: Float32Array[] = []; broken = new Set<number>(); cracked = false;
  roll: { t: number; dur: number; turns: number; side: number } | null = null; flipped = false; lost = new Set<string>();
  private doorP?: THREE.Group; private doorCur = 0; private doorTgt = 0;
  headlights: THREE.SpotLight[] = []; beams: THREE.Mesh[] = []; lightsOn = false; slip = 0; braking = false; wheelRoll = 0; smokeAcc = 0;
  get length() { return this.spec.L; }
  get dead() { return this.hp <= 0; }
  /** Charge un modèle de véhicule (remplace l'actuel) avec sa peinture et son état. */
  setVehicle(type: VehicleType, paint: number, hp: number, upgrade = 0) {
    this.spec = SPECS[type]; this.paint = paint; this.hp = hp; this.upgrade = upgrade;
    this.body.clear(); this.wheelMeshes = []; this.headlights = [];
    const g0 = vehicleGeometry(type, false); const g = { ...g0, paint: g0.paint.clone(), trim: g0.trim.clone(), glass: g0.glass.clone(), lights: g0.lights.clone() }; this.geos = [g.paint, g.trim, g.glass, g.lights]; this.orig = this.geos.map(q => (q.getAttribute('position').array as Float32Array).slice()); this.broken.clear(); this.setCracked(false); this.body.add(Object.assign(new THREE.Mesh(g.paint, this.mats.paint), { castShadow: true, receiveShadow: true }), Object.assign(new THREE.Mesh(g.trim, this.mats.trim), { castShadow: true }), new THREE.Mesh(g.glass, this.mats.glass), new THREE.Mesh(g.lights, this.mats.lights));
    for (const w of g.wheels) { const m = new THREE.Mesh(w.x < 0 ? g.wheelL : g.wheelR, this.mats.trim); m.position.set(w.x, w.y, w.z); m.castShadow = true; this.body.add(m); this.wheelMeshes.push({ m, front: w.front }); }
    const L = this.spec.L; for (const x of [-0.6, 0.6]) { const sp = new THREE.SpotLight(0xfff1d0, 0, 90, 0.5, 0.6, 1.4); sp.position.set(x, 0.75, L / 2 - 0.2); const t = new THREE.Object3D(); t.position.set(x * 0.5, 0.2, L / 2 + 25); this.body.add(sp, t); sp.target = t; this.headlights.push(sp); }
    for (const x of [-0.6, 0.6]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 20, 1, true).translate(0, -8, 0).rotateX(-Math.PI / 2 + 0.08), new THREE.MeshBasicMaterial({ color: 0xfff2cf, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); cone.position.set(x, 0.75, L / 2); cone.scale.set(0.45, 0.45, 1); cone.visible = false; this.body.add(cone); this.beams.push(cone); }
    // portière conducteur (côté gauche) : panneau visible seulement quand elle s'ouvre, pivot à l'avant
    { const sp = this.spec; this.doorP = new THREE.Group(); this.doorP.position.set(sp.W / 2 - 0.02, 0, 0.55); const pan = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 1.05), this.mats.paint); pan.position.set(0, 0.62, -0.52); const win = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.9), this.mats.glass); win.position.set(0, 1.13, -0.55); this.doorP.add(pan, win); this.doorP.visible = false; this.body.add(this.doorP); }
    this.root.add(this.body); this.refreshPaint(); if (this.lightsOn) this.setLights(true);
  }
  refreshPaint() { const dirt = 1 - Math.min(1, this.hp / this.spec.hp); this.mats.paint.color.set(this.paint).lerp(new THREE.Color(0x2a2522), dirt * 0.55); }
  setLights(on: boolean) { this.lightsOn = on; this.headlights.forEach((h, i) => (h.intensity = on && !this.broken.has(i) ? 420 : 0)); this.beams.forEach((b, i) => (b.visible = on && !this.broken.has(i))); }
  /** Choc localisé (repère du véhicule) : tôle enfoncée, pare-brise fissuré au-delà d'un gros choc, phare cassé si l'avant est touché. */
  impact(lx: number, lz: number, dmg: number) {
    const hw = this.spec.W / 2, hl = this.spec.L / 2; dent(this.geos, lx, lz, Math.min(0.3, dmg * 0.012), 0.7 + Math.min(0.7, dmg * 0.02), hw, hl);
    if (dmg > 14 && !this.cracked) this.setCracked(true);
    if (lz > hl * 0.6 && dmg > 8) { const i = lx < 0 ? 0 : 1; if (!this.broken.has(i)) { this.broken.add(i); this.setLights(this.lightsOn); } }
  }
  private setCracked(on: boolean) { this.cracked = on; const m = this.mats.glass as THREE.MeshStandardMaterial; m.map = on ? crackTexture() : null; m.color.set(on ? 0x8a9aa6 : 0x0c141c); m.opacity = on ? 0.88 : 0.72; m.needsUpdate = true; }
  /** Dégâts : retourne true si le véhicule vient de tomber en panne. */
  damage(amount: number) { const was = this.hp > 0; this.hp = Math.max(0, this.hp - amount / this.spec.mass); this.refreshPaint(); return was && this.hp <= 0; }
  repair() { this.flipped = false; this.roll = null; this.lost.clear(); this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); this.hp = this.spec.hp; this.refreshPaint(); this.geos.forEach((g, i) => { const p = g.getAttribute('position') as THREE.BufferAttribute; (p.array as Float32Array).set(this.orig[i]); p.needsUpdate = true; g.computeVertexNormals(); }); this.broken.clear(); this.setCracked(false); this.setLights(this.lightsOn); }
  /** Tonneaux : `turns` demi-tours entiers = retombe sur les roues, sinon sur le toit (épave). */
  startRoll(side: number, turns: number) { if (this.roll || this.flipped) return; this.roll = { t: 0, dur: 0.55 + turns * 0.5, turns, side: Math.sign(side) || 1 }; }
  /** Pièce arrachée (capot ou portière) : retourne un maillage à lancer, positionné dans le monde. */
  tearOff(part: 'capot' | 'porte') {
    if (this.lost.has(part)) return null; this.lost.add(part); const sp = this.spec; const mat = new THREE.MeshStandardMaterial({ color: this.paint, roughness: 0.45, metalness: 0.3 });
    const m = part === 'capot' ? new THREE.Mesh(new THREE.BoxGeometry(sp.W * 0.8, 0.05, sp.L * 0.26), mat) : new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 1.05), mat); m.castShadow = true;
    const p = part === 'capot' ? new THREE.Vector3(0, 1.0, sp.L * 0.32) : new THREE.Vector3(sp.W / 2, 0.75, 0.05); this.body.updateWorldMatrix(true, false); this.body.localToWorld(p); m.position.copy(p); m.rotation.y = this.heading; return m;
  }
  /** Ouvre (1) ou ferme (0) la portière conducteur. */
  door(t: number) { this.doorTgt = t; }
  setFlash(on: boolean) { this.mats.lights.color.setScalar(on ? 1 : 0.35); }
  update(dt: number, c: Controls) {
    const s = this.spec; const up = 1 + this.upgrade * 0.08; const dead = this.dead || this.flipped || !!this.roll; const accel = s.accel * up * (this.hp < s.hp * 0.25 ? 0.6 : 1);
    if (c.throttle > 0 && !dead) this.speed += accel * c.throttle * (1 - Math.max(0, this.speed) / (s.maxSpeed * up)) * dt;
    if (c.brake > 0) { if (this.speed > 0.3) this.speed -= s.brake * c.brake * dt; else if (!dead) this.speed -= 5 * c.brake * dt; this.speed = Math.max(this.speed, -9); }
    this.speed -= Math.sign(this.speed) * (0.012 * this.speed * this.speed + 0.25 + (dead ? 2.5 : 0)) * dt; if (Math.abs(this.speed) < 0.05 && !c.throttle && !c.brake) this.speed = 0;
    if (c.handbrake) this.speed -= Math.sign(this.speed) * 14 * dt;
    const maxSteer = THREE.MathUtils.lerp(s.steer + 0.07, 0.14, Math.min(1, Math.abs(this.speed) / (s.maxSpeed * 0.8)));
    this.steer += (c.steer * maxSteer - this.steer) * Math.min(1, dt * 6);
    const yaw = this.speed / s.wheelbase * Math.tan(this.steer); const grip = c.handbrake ? 0.8 : s.grip + 1;
    this.yawRate += (yaw - this.yawRate) * Math.min(1, dt * (c.handbrake ? 3 : 10)); this.heading += this.yawRate * dt;
    this.lateral -= this.lateral * Math.min(1, grip * dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.pos.x += (fx * this.speed + fz * this.lateral) * dt; this.pos.z += (fz * this.speed - fx * this.lateral) * dt;
    this.braking = c.brake > 0.3 && this.speed > 1; this.mats.lights.color.setScalar(this.braking ? 1.7 : 1);
    this.slip = (c.handbrake && Math.abs(this.speed) > 5) || (c.brake > 0.7 && this.speed > 14) || Math.abs(this.lateral) > 2.2 ? 1 : 0;
    this.wheelRoll += this.speed * dt / s.wheelR;
    for (const w of this.wheelMeshes) { w.m.rotation.set(this.wheelRoll, w.front ? this.steer * 0.8 : 0, 0, 'YXZ'); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.heading;
    if (this.doorP) { this.doorCur += (this.doorTgt - this.doorCur) * Math.min(1, dt * 9); this.doorP.visible = this.doorCur > 0.03; this.doorP.rotation.y = -this.doorCur * 1.05; }
    if (this.roll) {   // tonneaux autour du centre de la caisse (0,75 m), avec un saut
      const r = this.roll; r.t += dt; const k = Math.min(1, r.t / r.dur), e = 1 - (1 - k) ** 2, a = r.side * r.turns * Math.PI * e, C = 0.75; this.body.rotation.set(0, 0, a); this.body.position.set(C * Math.sin(a), C - C * Math.cos(a) + Math.sin(k * Math.PI) * (0.6 + r.turns * 0.3), 0); this.speed *= 1 - Math.min(1, dt * 1.8);
      if (k >= 1) { this.roll = null; if (r.turns % 2 === 1) { this.flipped = true; this.hp = 0; this.body.rotation.set(0, 0, Math.PI); this.body.position.set(0, 2 * C, 0); } else { this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); } }
    } else if (this.flipped) { this.speed *= 1 - Math.min(1, dt * 4); }
    else { this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -this.yawRate * this.speed * 0.004, 0.1); this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -(c.throttle - c.brake) * 0.015, 0.1); }
  }
}
