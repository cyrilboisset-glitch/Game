import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetClips, ualName } from './retarget';
import { prepareTemplate, dress, type Outfit } from './outfit';
import type { Look } from '../npc/appearance';
import { FaceBank, shapeBody } from './body';
import { applyPoses } from './poses';

/** Boucles (locomotion et attitudes) et gestes ponctuels, recalés depuis la bibliothèque d'animations universelle de Quaternius (CC0). */
export const CLIP_NAMES: Record<string, string> = { Idle: 'Idle_Loop', Walk: 'Walk_Loop', Run: 'Jog_Fwd_Loop', Sprint: 'Sprint_Loop', CrouchIdle: 'Crouch_Idle_Loop', CrouchWalk: 'Crouch_Fwd_Loop', Jab: 'Punch_Jab', Cross: 'Punch_Cross', Swing: 'Sword_Attack',
  PistolIdle: 'Pistol_Idle_Loop', Aim: 'Pistol_Aim_Neutral', Shoot: 'Pistol_Shoot', HitChest: 'Hit_Chest', HitHead: 'Hit_Head', Fall: 'Death01', SitDown: 'Sitting_Enter', Sit: 'Sitting_Idle_Loop', StandUp: 'Sitting_Exit', SitTalk: 'Sitting_Talking_Loop',
  Drive: 'Driving_Loop', Kneel: 'Fixing_Kneeling', Interact: 'Interact', PickUp: 'PickUp_Table', JumpStart: 'Jump_Start', JumpLoop: 'Jump_Loop', JumpLand: 'Jump_Land', Roll: 'Roll', Talk: 'Idle_Talking_Loop', Push: 'Push_Loop' };
export type AnimName = string;
export interface PlayOpts { fade?: number; speed?: number; reverse?: boolean; hold?: boolean; }
/** Une instance animée du personnage (clone du modèle, mixer propre, vêtements propres). */
export class AvatarInstance {
  root = new THREE.Group(); private mixer: THREE.AnimationMixer; private act = new Map<string, THREE.AnimationAction>(); private cur: AnimName = 'Idle'; private once: { name: string; a: THREE.AnimationAction; t: number; hold: boolean } | null = null;
  private stoopBones: THREE.Object3D[] = []; private stoop = 0; private model: THREE.Object3D; private poseW = new Map<string, number>(); private poseT = new Map<string, number>(); private bones = new Map<string, THREE.Object3D>();
  constructor(model: THREE.Object3D, private clips: Record<AnimName, THREE.AnimationClip>, look?: Look) {
    if (look && look.stoop > 0) { this.stoop = look.stoop; for (const n of ['Spine', 'Spine1', 'Spine2']) { const b = model.getObjectByName(n); if (b) this.stoopBones.push(b); } }
    if (look) { const h = model.getObjectByName('Head'); if (h) h.scale.setScalar(look.head); }
    this.model = model; model.traverse(o => { if ((o as THREE.Bone).isBone) this.bones.set(o.name, o); }); this.root.add(model); this.mixer = new THREE.AnimationMixer(model);
    this.a('Idle').play();
  }
  has(n: AnimName) { return !!this.clips[n]; }
  private a(n: AnimName) { let x = this.act.get(n); if (!x) { x = this.mixer.clipAction(this.clips[n] ?? this.clips.Idle); this.act.set(n, x); } return x; }
  /** Boucle de fond (marche, course, accroupi, assis, conduite…) avec fondu ; `speed` règle la cadence de marche/course. Ignorée pendant un geste ponctuel. */
  set(n: AnimName, speed = 1) {
    if (!this.clips[n]) n = 'Idle';
    if (n !== this.cur) { const a = this.a(n), b = this.a(this.cur); a.reset().play(); if (!this.once) a.crossFadeFrom(b, 0.25, false); else a.setEffectiveWeight(0); this.cur = n; }
    const a = this.a(n); a.timeScale = n === 'Walk' || n === 'CrouchWalk' ? Math.max(0.5, speed / 1.5) : n === 'Run' ? Math.max(0.6, speed / 4.2) : n === 'Sprint' ? Math.max(0.7, speed / 6.5) : 1;
  }
  get current() { return this.once?.name ?? this.cur; }
  get busy() { return !!this.once && !this.once.hold; }
  /** Geste ponctuel (coup, tir, chute, s'asseoir…) joué une fois par-dessus la boucle ; `hold` le fige à la dernière image (au sol, assis). Retourne sa durée. */
  play(n: AnimName, o: PlayOpts = {}) {
    const clip = this.clips[n]; if (!clip) return 0; const a = this.a(n); const prev = this.once?.a ?? this.a(this.cur);
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = (o.speed ?? 1) * (o.reverse ? -1 : 1); if (o.reverse) a.time = clip.duration;
    a.play(); a.crossFadeFrom(prev, o.fade ?? 0.12, false); this.once = { name: n, a, t: clip.duration / (o.speed ?? 1), hold: !!o.hold }; return this.once.t;
  }
  /** Fin d'un geste tenu (ex. se relever puis reprendre la boucle). */
  release(fade = 0.25) { if (!this.once) return; const a = this.a(this.cur); a.reset().play(); a.crossFadeFrom(this.once.a, fade, false); this.once = null; }
  /** Pose d'action (voir poses.ts) : poids cible 0-1, atteint en douceur. `now` : sans transition. */
  pose(name: string, w: number, now = false) { if (w <= 0 && !this.poseW.has(name)) return; this.poseT.set(name, w); if (now) this.poseW.set(name, w); }
  clearPoses() { for (const k of this.poseT.keys()) this.poseT.set(k, 0); }
  update(dt: number) {
    this.mixer.update(dt); if (this.once && !this.once.hold && (this.once.t -= dt) <= 0) this.release(0.2); for (const b of this.stoopBones) b.rotateX(this.stoop / this.stoopBones.length);   // dos voûté : appliqué après l'animation
    if (!this.poseT.size) return;
    for (const [k, t] of this.poseT) { const w = this.poseW.get(k) ?? 0; const nw = w + (t - w) * Math.min(1, dt * 10); if (t <= 0 && nw < 0.01) { this.poseW.delete(k); this.poseT.delete(k); } else this.poseW.set(k, nw); }
    this.model.position.y = -applyPoses(this.model, this.poseW, this.bones);
  }
  bone(name: string) { return this.root.getObjectByName(name); }
  dispose() { this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }); }
}

/** Charge le modèle et les animations une fois ; fabrique des instances habillées à la demande. */
export class AvatarFactory {
  private template!: THREE.Object3D; private clips!: Record<AnimName, THREE.AnimationClip>; private scale = 1; faces = new FaceBank(); retargetMs = 0;
  async load(modelUrl: string, animsUrl: string) {
    const loader = new GLTFLoader(); const [g, ag] = await Promise.all([loader.loadAsync(modelUrl), loader.loadAsync(animsUrl)]);
    this.template = g.scene; prepareTemplate(this.template); this.faces.build(this.template);
    this.template.updateMatrixWorld(true); this.scale = 1.75 / new THREE.Box3().setFromObject(this.template).getSize(new THREE.Vector3()).y;
    ag.scene.updateMatrixWorld(true);
    const byName = new Map(Object.entries(CLIP_NAMES).map(([k, v]) => [v, k])); const wanted = ag.animations.filter(c => byName.has(c.name)); const out = {} as Record<AnimName, THREE.AnimationClip>;
    const t0 = performance.now(); for (const c of retargetClips(ag.scene, wanted, this.template, 30, ualName)) { c.name = byName.get(c.name)!; out[c.name] = c; } this.retargetMs = performance.now() - t0;
    this.clips = out;
  }
  create(outfit: Outfit, look?: Look, height = 1.75): AvatarInstance {
    const m = skClone(this.template); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.frustumCulled = false; } });
    if (look) this.faces.apply(m, look.face ?? 0); dress(m, outfit, look); if (look?.shape) shapeBody(m, look.shape); const hh = look ? look.height : height; const sc = this.scale * hh / 1.75; const w = look ? 1 + (look.width - 1) * (look.shape ? 0.35 : 1) : 1; m.scale.set(sc * w, sc, sc * w * 0.92); return new AvatarInstance(m, this.clips, look);
  }
}
