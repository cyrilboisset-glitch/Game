import * as THREE from 'three';
import type { AvatarFactory, AvatarInstance } from '../player/avatar';
import type { Npc } from './identity';
import type { NpcState } from './sim';
import { SKIN_DISPLAY } from './appearance';

const MAX_PED = 450, AVATAR_RANGE = 22;
const SKIN = SKIN_DISPLAY.map(c => new THREE.Color(c));
const box = (w: number, h: number, d: number, y: number) => new THREE.BoxGeometry(w, h, d).translate(0, y, 0);

/** Rendu des habitants : silhouettes instanciées (6 draw calls pour tous), avatars complets animés pour les plus proches et le PNJ observé. */
export class NpcRenderer {
  private parts: { mesh: THREE.InstancedMesh; px: number; py: number; pz: number; kind: 'torse' | 'jambeG' | 'jambeD' | 'brasG' | 'brasD' | 'tete' | 'cheveux' | 'jupe' }[] = [];
  drivers: NpcState[] = []; private avatars = new Map<number, { av: AvatarInstance; t: number; st?: 'down' | 'rise'; sw?: boolean; fl?: boolean }>(); private dummy = new THREE.Matrix4(); private q = new THREE.Quaternion(); private qx = new THREE.Quaternion(); private v = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private zero = new THREE.Vector3(0.0001, 0.0001, 0.0001); private sc = new THREE.Vector3();
  limits = { pedMax: 450, avatars: 5, range: 190 };
  visible: { id: number; x: number; z: number; head: number }[] = [];
  constructor(private scene: THREE.Scene, private factory: AvatarFactory, private npcById: Map<number, Npc>) {
    const mk = (geo: THREE.BufferGeometry, px: number, py: number, pz: number, kind: any) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX_PED); m.count = 0; m.castShadow = true; m.frustumCulled = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PED * 3), 3); scene.add(m); this.parts.push({ mesh: m, px, py, pz, kind }); };
    mk(box(0.46, 0.6, 0.26, 0.3).translate(0, 1.2, 0), 0, 0, 0, 'torse'); mk(box(0.19, 0.86, 0.2, -0.43), -0.12, 0.9, 0, 'jambeG'); mk(box(0.19, 0.86, 0.2, -0.43), 0.12, 0.9, 0, 'jambeD');
    mk(box(0.13, 0.6, 0.14, -0.28), -0.32, 1.48, 0, 'brasG'); mk(box(0.13, 0.6, 0.14, -0.28), 0.32, 1.48, 0, 'brasD'); mk(new THREE.SphereGeometry(0.115, 10, 8).translate(0, 1.67, 0), 0, 0, 0, 'tete');
    mk(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.69, -0.005), 0, 0, 0, 'cheveux'); mk(new THREE.CylinderGeometry(0.2, 0.3, 0.46, 10, 1, true).translate(0, 0.72, 0), 0, 0, 0, 'jupe');
  }
  update(dt: number, states: NpcState[], fx: number, fz: number, selectedId: number | null, now: number, timeScale = 1, over?: Map<number, { x: number; z: number; h: number; lying: boolean; fall?: number; rising?: boolean; swing?: boolean; flinch?: boolean; speed: number; pose?: string; pw?: number; keep?: boolean }>) {
    const knocked = new Set<number>(); if (over && over.size) states = states.map(s0 => { const k = over.get(s0.id); if (!k) return s0; if (k.lying) knocked.add(s0.id); if (k.keep) return s0; return { ...s0, x: k.x, z: k.z, h: k.h, speed: k.speed, kind: (k.speed > 0.4 ? 'marche' : 'dehors') as NpcState['kind'] }; });
    const near = states.filter(s => (s.kind === 'marche' || s.kind === 'dehors' || s.kind === 'conduit') && (Math.hypot(s.x - fx, s.z - fz) < this.limits.range || s.id === selectedId));
    near.sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz));
    this.visible = []; this.drivers = []; let ped = 0; const wantAvatar = new Set<number>(); let na = 0;
    for (const s of near) { if (s.kind !== 'conduit' && (s.id === selectedId || (na < this.limits.avatars && Math.hypot(s.x - fx, s.z - fz) < AVATAR_RANGE))) { wantAvatar.add(s.id); if (s.id !== selectedId) na++; } }
    for (const [id, a] of this.avatars) if (!wantAvatar.has(id)) { this.scene.remove(a.av.root); a.av.dispose(); this.avatars.delete(id); }
    for (const s of near) {
      const n = this.npcById.get(s.id)!; this.visible.push({ id: s.id, x: s.x, z: s.z, head: s.kind === 'conduit' ? 1.3 : 1.7 });
      if (s.kind === 'conduit') { this.drivers.push(s); continue; }
      if (wantAvatar.has(s.id)) {
        let a = this.avatars.get(s.id); if (!a) { a = { av: this.factory.create(n.outfit, n.look), t: 0 }; this.scene.add(a.av.root); this.avatars.set(s.id, a); }
        a.av.root.position.set(s.x, 0, s.z); a.av.root.rotation.order = 'YXZ'; a.av.root.rotation.y = s.h; a.av.root.rotation.x = 0; const lying = knocked.has(s.id); const ov = over?.get(s.id);
        // animations enregistrées : chute (tenue au sol), relevé (chute à l'envers), coups, impact ; poses pour le téléphone, la garde, les mains en l'air
        if (lying && !ov?.rising && a.st !== 'down') { a.st = 'down'; a.av.play('Fall', { hold: true, speed: 1.3, fade: 0.08 }); }
        else if (lying && ov?.rising && a.st === 'down') { a.st = 'rise'; a.av.play('Fall', { reverse: true, speed: 1.6, fade: 0.1 }); }
        else if (!lying && a.st) { a.st = undefined; a.av.release(0.2); }
        if (!lying && ov?.swing && !a.sw) a.av.play(n.seed % 2 ? 'Cross' : 'Jab', { speed: 1.3, fade: 0.06 }); a.sw = !!ov?.swing;
        if (!lying && ov?.flinch && !a.fl) a.av.play(n.seed % 3 ? 'HitChest' : 'HitHead', { speed: 1.2, fade: 0.06 }); a.fl = !!ov?.flinch;
        const sp = lying ? 0 : s.kind === 'dehors' ? 0.9 : Math.min(s.speed * Math.min(timeScale, 4), 6.5); a.av.set(sp > 4.2 ? 'Sprint' : sp > 3 ? 'Run' : sp > 0.4 ? 'Walk' : 'Idle', sp);
        const ps = ov?.pose; for (const pn of ['phone', 'guard', 'handsup']) a.av.pose(pn, !lying && ps === pn ? 1 : 0); a.av.update(dt); continue;
      }
      if (ped >= Math.min(MAX_PED, this.limits.pedMax)) continue; const phase = now * 0.0075 * Math.max(0.8, Math.min(s.speed * Math.min(timeScale, 4), 6.5)) + n.seed; const sw = Math.sin(phase) * (s.speed > 0.3 ? 0.55 : 0); const bob = Math.abs(Math.cos(phase)) * 0.025 * (s.speed > 0.3 ? 1 : 0);
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), s.h); if (knocked.has(s.id)) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); const base = new THREE.Matrix4().compose(this.v.set(s.x, knocked.has(s.id) ? 0.15 : bob, s.z), this.q, this.one);
      const hoodie = new THREE.Color(n.outfit.hoodie), jeans = new THREE.Color(n.outfit.jeans), skin = SKIN[n.look.skin], hair = new THREE.Color(n.look.hairColor);
      const hs = n.look.height / 1.75, ws = n.look.width; this.sc.set(ws, hs, ws * 0.92); base.scale(this.sc);
      for (const p of this.parts) {
        const hide = (p.kind === 'cheveux' && n.look.hairStyle === 'chauve') || (p.kind === 'jupe' && !n.look.skirt);
        const ang = p.kind === 'jambeG' || p.kind === 'brasD' ? sw : p.kind === 'jambeD' || p.kind === 'brasG' ? -sw : 0; this.qx.setFromAxisAngle(this.v.set(1, 0, 0), ang);
        this.dummy.compose(this.v.set(p.px, p.py, p.pz), this.qx, hide ? this.zero : this.one); this.dummy.premultiply(base); p.mesh.setMatrixAt(ped, this.dummy);
        p.mesh.setColorAt(ped, p.kind.startsWith('jambe') ? jeans : p.kind === 'tete' ? skin : p.kind === 'cheveux' ? hair : p.kind === 'jupe' ? jeans : hoodie);
      }
      ped++;
    }
    for (const p of this.parts) { p.mesh.count = ped; p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true; }
  }
  stats() { return { silhouettes: this.parts[0].mesh.count, voitures: this.drivers.length, avatars: this.avatars.size }; }
  /** PNJ le plus proche d'un clic (distance écran) parmi les PNJ affichés. */
  pick(px: number, py: number, camera: THREE.Camera, w: number, h: number, maxPx = 55): number | null {
    let best: number | null = null, bd = maxPx;
    for (const v of this.visible) { this.v.set(v.x, v.head * 0.8, v.z).project(camera); if (this.v.z > 1) continue; const sx = (this.v.x * 0.5 + 0.5) * w, sy = (-this.v.y * 0.5 + 0.5) * h; const d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; best = v.id; } }
    return best;
  }
}
