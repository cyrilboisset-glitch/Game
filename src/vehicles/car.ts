import * as THREE from 'three';
import { vehicleGeometry, bodyMaterial, lightMaterial } from './models';
import { SPECS, type VehicleSpec, type VehicleType } from './specs';

export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; }

/** Véhicule conduit par le joueur : modèle procédural, physique arcade pilotée par les caractéristiques du véhicule, dégâts. */
export class Car {
  root = new THREE.Group(); body = new THREE.Group(); spec: VehicleSpec = SPECS.depart; paint = 0xb9b2a0; hp = 70; upgrade = 0;
  pos = new THREE.Vector3(); heading = 0; speed = 0; steer = 0; lateral = 0; yawRate = 0;
  private wheelMeshes: { m: THREE.Mesh; front: boolean }[] = []; private bodyMat = bodyMaterial(); private lightMat = lightMaterial(); private flash = 0;
  headlights: THREE.SpotLight[] = []; lightsOn = false; wheelRoll = 0; smokeAcc = 0;
  get length() { return this.spec.L; }
  get dead() { return this.hp <= 0; }
  /** Charge un modèle de véhicule (remplace l'actuel) avec sa peinture et son état. */
  setVehicle(type: VehicleType, paint: number, hp: number, upgrade = 0) {
    this.spec = SPECS[type]; this.paint = paint; this.hp = hp; this.upgrade = upgrade;
    this.body.clear(); this.wheelMeshes = []; this.headlights = [];
    const g = vehicleGeometry(type, false); this.body.add(Object.assign(new THREE.Mesh(g.body, this.bodyMat), { castShadow: true, receiveShadow: true }), new THREE.Mesh(g.lights, this.lightMat));
    for (const w of g.wheels) { const m = new THREE.Mesh(w.x < 0 ? g.wheelL : g.wheelR, this.bodyMat); m.position.set(w.x, w.y, w.z); m.castShadow = true; this.body.add(m); this.wheelMeshes.push({ m, front: w.front }); }
    const L = this.spec.L; for (const x of [-0.6, 0.6]) { const sp = new THREE.SpotLight(0xfff1d0, 0, 90, 0.5, 0.6, 1.4); sp.position.set(x, 0.75, L / 2 - 0.2); const t = new THREE.Object3D(); t.position.set(x * 0.5, 0.2, L / 2 + 25); this.body.add(sp, t); sp.target = t; this.headlights.push(sp); }
    this.root.add(this.body); this.refreshPaint(); if (this.lightsOn) this.setLights(true);
  }
  refreshPaint() { const dirt = 1 - Math.min(1, this.hp / this.spec.hp); this.bodyMat.color.set(this.paint).lerp(new THREE.Color(0x2a2522), dirt * 0.55); }
  setLights(on: boolean) { this.lightsOn = on; for (const h of this.headlights) h.intensity = on ? 900 : 0; }
  /** Dégâts : retourne true si le véhicule vient de tomber en panne. */
  damage(amount: number) { const was = this.hp > 0; this.hp = Math.max(0, this.hp - amount / this.spec.mass); this.refreshPaint(); return was && this.hp <= 0; }
  repair() { this.hp = this.spec.hp; this.refreshPaint(); }
  setFlash(on: boolean) { this.lightMat.color.setScalar(on ? 1 : 0.35); }
  update(dt: number, c: Controls) {
    const s = this.spec; const up = 1 + this.upgrade * 0.08; const dead = this.dead; const accel = s.accel * up * (this.hp < s.hp * 0.25 ? 0.6 : 1);
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
    this.wheelRoll += this.speed * dt / s.wheelR;
    for (const w of this.wheelMeshes) { w.m.rotation.set(this.wheelRoll, w.front ? this.steer * 0.8 : 0, 0, 'YXZ'); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.heading;
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -this.yawRate * this.speed * 0.004, 0.1);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -(c.throttle - c.brake) * 0.015, 0.1);
  }
}
