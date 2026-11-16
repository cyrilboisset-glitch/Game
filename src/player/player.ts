import * as THREE from 'three';
import { AvatarInstance, type AvatarFactory } from './avatar';
import { PLAYER_OUTFIT, type Outfit } from './outfit';

/** Gestes longs pilotés par le jeu (le personnage ne se déplace pas librement pendant ce temps). */
export type Act = { kind: 'vault'; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; h: number } | { kind: 'bench'; t: number; standing: number } | { kind: 'fallen'; t: number } | { kind: 'rise'; t: number } | { kind: 'door'; t: number; dur: number };

/** Personnage piéton : animations enregistrées (bibliothèque Quaternius, CC0) recalées sur le modèle, déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  readonly radius = 0.4;
  private av?: AvatarInstance; private factory?: AvatarFactory; outfit: Outfit = { ...PLAYER_OUTFIT }; crouch = false; picking = false; carrying = false; armed = false; pistol = false; act: Act | null = null;
  private aimT = 0; private box?: THREE.Mesh; private weaponMesh?: THREE.Mesh; private combo = 0; private comboT = 0; private kickT = 0;
  attach(f: AvatarFactory, outfit: Outfit = this.outfit) { this.factory = f; this.outfit = { ...outfit }; if (this.av) { this.root.remove(this.av.root); this.av.dispose(); } this.av = f.create(this.outfit); this.root.add(this.av.root); this.weaponMesh = undefined; this.ensureBox(); }
  /** Change de tenue (nouvelles couleurs) ou lève/baisse la capuche. */
  setOutfit(o: Outfit) { if (this.factory) this.attach(this.factory, o); }
  /** Objet tenu en main droite (null = mains nues). */
  setWeapon(color: number | null, len: number, pistol = false) {
    if (this.weaponMesh) { this.weaponMesh.parent?.remove(this.weaponMesh); this.weaponMesh = undefined; } this.armed = false; this.pistol = false; if (color === null || !this.av) return; const hand = this.av.bone('RightHand'); if (!hand) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, len, 8).translate(0, -len / 2 + 0.05, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 })); const ws = new THREE.Vector3(); hand.getWorldScale(ws); m.scale.setScalar(1 / (ws.x || 1)); m.rotation.x = Math.PI / 2.4; m.castShadow = true; hand.add(m); this.weaponMesh = m; this.armed = !pistol; this.pistol = pistol;
  }
  /** Frapper : enchaînement direct, crochet, coup de pied à mains nues ; coup de batte/barre avec un objet ; coup de crosse avec le pistolet. Retourne le type de coup. */
  punch(): 'poing' | 'pied' | 'objet' {
    const A = this.av; if (!A) return 'poing';
    if (this.armed) { A.play('Swing', { speed: 1.35, fade: 0.08 }); return 'objet'; }
    this.combo = this.comboT > 0 ? this.combo + 1 : 0; this.comboT = 1.1;
    if (!this.pistol && this.combo % 3 === 2) { this.kickT = 0.55; return 'pied'; }
    A.play(this.combo % 2 ? 'Cross' : 'Jab', { speed: 1.3, fade: 0.06 }); return 'poing';
  }
  /** Tir au pistolet : bras tendus et recul. */
  aim(t = 0.7) { this.aimT = t; this.av?.play('Shoot', { speed: 1.4, fade: 0.05 }); }
  /** Coup reçu : recul de la tête ou du buste. */
  hit(strong = false) { if (!this.act) this.av?.play(strong ? 'HitHead' : 'HitChest', { speed: 1.2, fade: 0.06 }); }
  /** Renversé : chute au sol (tenue), puis `rise()` pour se relever. */
  fall() { this.act = { kind: 'fallen', t: 0 }; this.av?.play('Fall', { hold: true, speed: 1.3, fade: 0.08 }); }
  rise() { this.act = { kind: 'rise', t: this.av?.play('Fall', { reverse: true, speed: 1.6, fade: 0.1 }) ?? 0.6 }; }
  /** Sauter une clôture ou escalader un muret : élan, passage par-dessus, réception. */
  vault(to: THREE.Vector3, h: number) { const dur = 0.85; this.act = { kind: 'vault', t: 0, dur, from: this.pos.clone(), to: to.clone(), h }; this.heading = Math.atan2(to.x - this.pos.x, to.z - this.pos.z); this.av?.play('JumpStart', { speed: 1.5, fade: 0.06 }); }
  /** S'asseoir sur un banc (face à `heading`) ; `stand()` pour se lever. */
  sit(x: number, z: number, heading: number) { this.pos.set(x, 0, z); this.heading = heading; this.act = { kind: 'bench', t: 0, standing: -1 }; this.av?.set('Sit'); this.av?.play('SitDown', { fade: 0.15 }); }
  stand() { if (this.act?.kind !== 'bench' || this.act.standing >= 0) return; this.act.standing = this.av?.play('StandUp', { fade: 0.1 }) ?? 0.5; this.av?.set('Idle'); }
  /** Ouvrir la portière (geste de la main vers la poignée). */
  openDoor() { this.act = { kind: 'door', t: 0, dur: 0.55 }; this.av?.play('Interact', { speed: 1.6, fade: 0.1 }); }
  get busy() { return !!this.act && this.act.kind !== 'bench'; }
  /** Au volant : assis à la place du conducteur (à gauche), mains sur le volant ; suit la caisse (roulis, tangage). */
  seat(body: THREE.Object3D, dt: number) {
    if (!this.av) return; const A = this.av; body.updateWorldMatrix(true, false); const p = new THREE.Vector3(0.36, 0.1, -0.12); body.localToWorld(p); this.root.position.copy(p); const q = new THREE.Quaternion(); body.getWorldQuaternion(q); this.root.quaternion.copy(q);
    this.root.visible = true; this.act = null; if (this.box) this.box.visible = false; A.root.position.set(0, 0, 0); A.pose('carry', 0, true); A.pose('kick', 0, true); A.set('Drive'); if (A.current !== 'Drive') A.release(0.25); A.update(dt);
  }
  unseat() { this.root.quaternion.identity(); this.root.rotation.set(0, this.heading, 0); this.av?.set('Idle'); }
  /** Sac volumineux porté devant soi (butin lourd). */
  private ensureBox() { if (this.box) return; this.box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.9 })); this.box.position.set(0, 1.0, 0.36); this.box.castShadow = true; this.box.visible = false; this.root.add(this.box); }
  /** Avance les gestes longs ; retourne true si le joueur ne doit pas être déplacé par les commandes ce tour-ci. */
  private tickAct(dt: number): boolean {
    const a = this.act; if (!a) return false; a.t += dt; const A = this.av;
    if (a.kind === 'vault') { const k = Math.min(1, a.t / a.dur); this.pos.lerpVectors(a.from, a.to, k); this.root.position.copy(this.pos); this.root.position.y = Math.sin(k * Math.PI) * Math.max(0.35, a.h * 0.55); if (k > 0.55 && A?.current === 'JumpStart') A.play('JumpLand', { speed: 1.4, fade: 0.08 }); if (k >= 1) { this.act = null; this.root.position.y = 0; } return true; }
    if (a.kind === 'bench') { if (a.standing >= 0 && (a.standing -= dt) <= 0) this.act = null; return true; }
    if (a.kind === 'fallen') return true;
    if (a.kind === 'rise') { if (a.t >= 0) { a.t -= dt * 2; if (a.t <= 0) { this.act = null; A?.release(0.2); } } return true; }
    if (a.kind === 'door') { if (a.t >= a.dur) this.act = null; return true; }
    return false;
  }
  /** mx/mz : intention (-1..1) dans le repère de la caméra (camYaw = direction de visée). */
  update(dt: number, mx: number, my: number, camYaw: number, run: boolean, factor: number) {
    const locked = this.tickAct(dt); const mag = locked ? 0 : Math.min(1, Math.hypot(mx, my)); const target = mag > 0.05 ? (run ? 5.6 : 1.9 * (0.5 + mag * 0.5) + 0.8) * factor : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (mag > 0.05) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;   // avant / droite (repère monde, z vers le sud)
      const dx = fx * my + rx * mx, dz = fz * my + rz * mx; const want = Math.atan2(dx, dz);
      let da = want - this.heading; da = Math.atan2(Math.sin(da), Math.cos(da)); this.heading += da * Math.min(1, dt * 12);
      this.pos.x += Math.sin(this.heading) * this.speed * dt; this.pos.z += Math.cos(this.heading) * this.speed * dt;
    }
    if (this.act?.kind !== 'vault') { this.root.position.copy(this.pos); } this.root.rotation.y = this.heading;
    if (!this.av) return; const A = this.av; this.aimT = Math.max(0, this.aimT - dt); this.comboT -= dt; this.kickT = Math.max(0, this.kickT - dt);
    // boucle de fond : à genoux (crochetage), accroupi, course, marche, pistolet en main, repos
    if (!this.act || this.act.kind === 'door') A.set(this.picking ? 'Kneel' : this.crouch ? (this.speed > 0.4 ? 'CrouchWalk' : 'CrouchIdle') : this.speed > 4.4 ? 'Sprint' : this.speed > 3.2 ? 'Run' : this.speed > 0.4 ? 'Walk' : this.pistol ? (this.aimT > 0 ? 'Aim' : 'PistolIdle') : 'Idle', this.speed);
    A.pose('kick', this.kickT > 0 ? Math.sin((1 - this.kickT / 0.55) * Math.PI) : 0, true);
    A.pose('carry', this.carrying && !this.picking && !this.crouch && !this.act && this.aimT <= 0 ? 1 : 0);
    A.update(dt); if (this.box) this.box.visible = this.carrying && !this.picking && !this.act;
  }
}
