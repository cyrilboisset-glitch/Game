import * as THREE from 'three';
import { AvatarInstance, type AvatarFactory } from './avatar';
import { PLAYER_OUTFIT, type Outfit } from './outfit';

/** Personnage piéton : modèle animé (Idle/Walk/Run), déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  readonly radius = 0.4;
  private av?: AvatarInstance; private factory?: AvatarFactory; outfit: Outfit = { ...PLAYER_OUTFIT }; crouch = false; picking = false; carrying = false; armed = false; private aimT = 0; private box?: THREE.Mesh; private punchT = 0; private weaponMesh?: THREE.Mesh;
  attach(f: AvatarFactory, outfit: Outfit = this.outfit) { this.factory = f; this.outfit = { ...outfit }; if (this.av) { this.root.remove(this.av.root); this.av.dispose(); } this.av = f.create(this.outfit); this.root.add(this.av.root); this.weaponMesh = undefined; this.ensureBox(); }
  /** Change de tenue (nouvelles couleurs) ou lève/baisse la capuche. */
  setOutfit(o: Outfit) { if (this.factory) this.attach(this.factory, o); }
  /** Objet tenu en main droite (null = mains nues). */
  setWeapon(color: number | null, len: number) {
    if (this.weaponMesh) { this.weaponMesh.parent?.remove(this.weaponMesh); this.weaponMesh = undefined; } this.armed = false; if (color === null || !this.av) return; const hand = this.av.bone('RightHand'); if (!hand) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, len, 8).translate(0, -len / 2 + 0.05, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 })); const ws = new THREE.Vector3(); hand.getWorldScale(ws); m.scale.setScalar(1 / (ws.x || 1)); m.rotation.x = Math.PI / 2.4; m.castShadow = true; hand.add(m); this.weaponMesh = m; this.armed = true;
  }
  punch() { this.punchT = 0.36; }
  /** Au volant : assis à la place du conducteur (à gauche), mains sur le volant ; suit la caisse (roulis, tangage). */
  seat(body: THREE.Object3D, dt: number) {
    if (!this.av) return; const A = this.av; body.updateWorldMatrix(true, false); const p = new THREE.Vector3(0.36, 0.08, -0.12); body.localToWorld(p); this.root.position.copy(p); const q = new THREE.Quaternion(); body.getWorldQuaternion(q); this.root.quaternion.copy(q);
    this.root.visible = true; if (this.box) this.box.visible = false; A.root.position.z = 0; for (const n of ['crouch', 'pick', 'carry', 'aim', 'punch', 'swingUp', 'swingDown']) A.pose(n, 0, true); A.pose('sit', 1, true); A.set('Idle'); A.update(dt);
  }
  unseat() { this.av?.pose('sit', 0, true); this.root.quaternion.identity(); this.root.rotation.set(0, this.heading, 0); }
  /** Bras tendus pour tirer (pistolet). */
  aim(t = 0.7) { this.aimT = t; }
  /** Sac volumineux porté devant soi (butin lourd). */
  private ensureBox() { if (this.box) return; this.box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.9 })); this.box.position.set(0, 1.0, 0.36); this.box.castShadow = true; this.box.visible = false; this.root.add(this.box); }
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
    this.av?.set(this.speed > 3.6 ? 'Run' : this.speed > 0.4 ? 'Walk' : 'Idle', this.speed);
    if (this.av) { const A = this.av; this.punchT = Math.max(0, this.punchT - dt); this.aimT = Math.max(0, this.aimT - dt); const f = this.punchT > 0 ? 1 - this.punchT / 0.36 : 1; const k = this.punchT > 0 ? Math.sin(f * Math.PI) : 0;
      // frapper : coup droit (mains nues) ou armé-frappé (objet) ; viser : bras tendus ; s'accroupir, porter, crocheter
      if (this.armed && this.punchT > 0) { A.pose('swingUp', f < 0.45 ? 1 : 0, true); A.pose('swingDown', f >= 0.45 ? Math.sin((f - 0.45) / 0.55 * Math.PI) : 0, true); } else { A.pose('swingUp', 0); A.pose('swingDown', 0); A.pose('punch', k, true); }
      A.pose('aim', this.aimT > 0 && this.armed ? 1 : 0); A.pose('crouch', this.crouch && !this.picking ? (this.speed > 0.4 ? 0.7 : 1) : 0); A.pose('pick', this.picking ? 1 : 0); A.pose('carry', this.carrying && !this.picking && this.aimT <= 0 ? 1 : 0);
      A.root.position.z = k * 0.15; A.update(dt); if (this.box) this.box.visible = this.carrying && !this.picking; }
  }
}
