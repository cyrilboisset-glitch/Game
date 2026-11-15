import * as THREE from 'three';
import { AvatarInstance, type AvatarFactory } from './avatar';
import { PLAYER_OUTFIT, type Outfit } from './outfit';

/** Personnage piéton : modèle animé (Idle/Walk/Run), déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  readonly radius = 0.4;
  private av?: AvatarInstance; private factory?: AvatarFactory; outfit: Outfit = { ...PLAYER_OUTFIT }; crouch = false; private punchT = 0; private weaponMesh?: THREE.Mesh;
  attach(f: AvatarFactory, outfit: Outfit = this.outfit) { this.factory = f; this.outfit = { ...outfit }; if (this.av) { this.root.remove(this.av.root); this.av.dispose(); } this.av = f.create(this.outfit); this.root.add(this.av.root); this.weaponMesh = undefined; }
  /** Change de tenue (nouvelles couleurs) ou lève/baisse la capuche. */
  setOutfit(o: Outfit) { if (this.factory) this.attach(this.factory, o); }
  /** Objet tenu en main droite (null = mains nues). */
  setWeapon(color: number | null, len: number) {
    if (this.weaponMesh) { this.weaponMesh.parent?.remove(this.weaponMesh); this.weaponMesh = undefined; } if (color === null || !this.av) return; const hand = this.av.bone('RightHand'); if (!hand) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, len, 8).translate(0, -len / 2 + 0.05, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 })); const ws = new THREE.Vector3(); hand.getWorldScale(ws); m.scale.setScalar(1 / (ws.x || 1)); m.rotation.x = Math.PI / 2.4; m.castShadow = true; hand.add(m); this.weaponMesh = m;
  }
  punch() { this.punchT = 0.28; }
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
    if (this.av) { const r = this.av.root; this.punchT = Math.max(0, this.punchT - dt); const k = Math.sin(Math.min(1, (0.28 - this.punchT) / 0.28) * Math.PI) * (this.punchT > 0 ? 1 : 0);
      r.position.z = k * 0.35; r.rotation.x = k * 0.25; r.scale.y = this.crouch ? 0.72 : 1; const ra = this.av.bone('RightArm'); if (ra && k > 0) ra.rotateX(-k * 1.2); }
  }
}
