import * as THREE from 'three';
import { AvatarInstance, type AvatarFactory } from './avatar';
import { PLAYER_OUTFIT, type Outfit } from './outfit';

/** Personnage piéton : modèle animé (Idle/Walk/Run), déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  readonly radius = 0.4;
  private av?: AvatarInstance;
  attach(f: AvatarFactory, outfit: Outfit = PLAYER_OUTFIT) { this.av = f.create(outfit); this.root.add(this.av.root); }
  /** mx/mz : intention (-1..1) dans le repère de la caméra (camYaw = direction de visée). */
  update(dt: number, mx: number, my: number, camYaw: number, run: boolean, factor: number) {
    const mag = Math.min(1, Math.hypot(mx, my)); const target = mag > 0.05 ? (run ? 5.6 : 1.9 * (0.5 + mag * 0.5) + 0.8) * factor : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (mag > 0.05) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;   // avant / droite (repère monde, z vers le sud)
      const dx = fx * my + rx * mx, dz = fz * my + rz * mx; const want = Math.atan2(dx, dz);
      let da = want - this.heading; da = Math.atan2(Math.sin(da), Math.cos(da)); this.heading += da * Math.min(1, dt * 12);
      this.pos.x += Math.sin(this.heading) * this.speed * dt; this.pos.z += Math.cos(this.heading) * this.speed * dt;
    }
    this.root.position.copy(this.pos); this.root.rotation.y = this.heading;
    this.av?.set(this.speed > 3.6 ? 'Run' : this.speed > 0.4 ? 'Walk' : 'Idle', this.speed); this.av?.update(dt);
  }
}
