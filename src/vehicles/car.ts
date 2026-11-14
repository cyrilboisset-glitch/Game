import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; }

/** Voiture : modèle glTF + physique arcade (accélération, freinage, direction progressive, adhérence, frein à main). */
export class Car {
  root = new THREE.Group(); body = new THREE.Group();
  pos = new THREE.Vector3(); heading = 0; speed = 0; steer = 0; lateral = 0; yawRate = 0;
  wheels: THREE.Object3D[] = []; frontWheels: THREE.Object3D[] = []; wheelRoll = 0;
  headlights: THREE.SpotLight[] = []; lightsOn = false;
  readonly maxSpeed = 38; readonly length = 4.3;
  async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url); const m = gltf.scene;
    const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3());
    // le modèle est exprimé avec le Z comme axe long : on normalise vers -Z = avant
    const longest = size.z > size.x ? 'z' : 'x'; if (longest === 'x') m.rotation.y = Math.PI / 2;
    const s = this.length / Math.max(size.x, size.z); m.scale.setScalar(s); m.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; m.position.x -= (b2.min.x + b2.max.x) / 2; m.position.z -= (b2.min.z + b2.max.z) / 2;
    m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; } });
    for (const n of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']) { const w = m.getObjectByName(n); if (w) { this.wheels.push(w); if (n.startsWith('WheelFront')) this.frontWheels.push(w); } }
    this.body.add(m);
    for (const x of [-0.6, 0.6]) { const sp = new THREE.SpotLight(0xfff1d0, 0, 90, 0.5, 0.6, 1.4); sp.position.set(x, 0.7, this.length / 2 - 0.2); const t = new THREE.Object3D(); t.position.set(x * 0.5, 0.2, this.length / 2 + 25); this.body.add(sp, t); sp.target = t; this.headlights.push(sp); }
    this.root.add(this.body);
  }
  setLights(on: boolean) { this.lightsOn = on; for (const h of this.headlights) h.intensity = on ? 900 : 0; }
  update(dt: number, c: Controls) {
    const accel = 11, brakeF = 22, drag = 0.012;
    if (c.throttle > 0) this.speed += accel * c.throttle * (1 - Math.max(0, this.speed) / this.maxSpeed) * dt;
    if (c.brake > 0) { if (this.speed > 0.3) this.speed -= brakeF * c.brake * dt; else this.speed -= 5 * c.brake * dt; this.speed = Math.max(this.speed, -9); }
    this.speed -= Math.sign(this.speed) * (drag * this.speed * this.speed + 0.25) * dt; if (Math.abs(this.speed) < 0.05 && !c.throttle && !c.brake) this.speed = 0;
    if (c.handbrake) this.speed -= Math.sign(this.speed) * 14 * dt;
    // direction : braquage progressif, réduit avec la vitesse
    const maxSteer = THREE.MathUtils.lerp(0.62, 0.14, Math.min(1, Math.abs(this.speed) / 28));
    this.steer += (c.steer * maxSteer - this.steer) * Math.min(1, dt * 6);
    const wheelBase = 2.7; let yaw = this.speed / wheelBase * Math.tan(this.steer);
    const grip = c.handbrake ? 0.8 : 6; // le frein à main fait déraper l'arrière
    this.yawRate += (yaw - this.yawRate) * Math.min(1, dt * (c.handbrake ? 3 : 10));
    this.heading += this.yawRate * dt;
    // glissement latéral (dérive) dissipé selon l'adhérence
    this.lateral += (this.speed * Math.sin(this.steer) * 0.18 * (c.handbrake ? 2.2 : 0.2)) * dt * Math.sign(this.yawRate || 1) * 0; this.lateral -= this.lateral * Math.min(1, grip * dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.pos.x += (fx * this.speed + fz * this.lateral) * dt; this.pos.z += (fz * this.speed - fx * this.lateral) * dt;
    this.wheelRoll += this.speed * dt / 0.34; for (const w of this.wheels) w.children.length && (w.rotation.x = 0);
    for (const w of this.frontWheels) w.rotation.y = -this.steer * 0.6;
    this.root.position.copy(this.pos); this.root.rotation.y = this.heading;
    // roulis/tangage léger
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -this.yawRate * this.speed * 0.004, 0.1);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -(c.throttle - c.brake) * 0.015, 0.1);
  }
}
