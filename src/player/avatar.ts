import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetClips } from './retarget';
import { prepareTemplate, dress, type Outfit } from './outfit';
import type { Look } from '../npc/appearance';
import { FaceBank, shapeBody } from './body';
import { applyPoses } from './poses';

export type AnimName = 'Idle' | 'Walk' | 'Run';
/** Une instance animée du personnage (clone du modèle, mixer propre, vêtements propres). */
export class AvatarInstance {
  root = new THREE.Group(); private mixer: THREE.AnimationMixer; private act = {} as Record<AnimName, THREE.AnimationAction>; private cur: AnimName = 'Idle';
  private stoopBones: THREE.Object3D[] = []; private stoop = 0; private model: THREE.Object3D; private poseW = new Map<string, number>(); private poseT = new Map<string, number>(); private bones = new Map<string, THREE.Object3D>();
  constructor(model: THREE.Object3D, clips: Record<AnimName, THREE.AnimationClip>, look?: Look) {
    if (look && look.stoop > 0) { this.stoop = look.stoop; for (const n of ['Spine', 'Spine1', 'Spine2']) { const b = model.getObjectByName(n); if (b) this.stoopBones.push(b); } }
    if (look) { const h = model.getObjectByName('Head'); if (h) h.scale.setScalar(look.head); }
    this.model = model; model.traverse(o => { if ((o as THREE.Bone).isBone) this.bones.set(o.name, o); }); this.root.add(model); this.mixer = new THREE.AnimationMixer(model);
    (Object.keys(clips) as AnimName[]).forEach(k => (this.act[k] = this.mixer.clipAction(clips[k]))); this.act.Idle.play();
  }
  set(n: AnimName, speed = 1) { if (n !== this.cur) { const a = this.act[n], b = this.act[this.cur]; a.reset().play(); a.crossFadeFrom(b, 0.25, false); this.cur = n; } this.act.Walk.timeScale = Math.max(0.5, speed / 1.6); this.act.Run.timeScale = Math.max(0.6, speed / 5.2); }
  /** Pose d'action (voir poses.ts) : poids cible 0-1, atteint en douceur. `now` : sans transition. */
  pose(name: string, w: number, now = false) { if (w <= 0 && !this.poseW.has(name)) return; this.poseT.set(name, w); if (now) this.poseW.set(name, w); }
  clearPoses() { for (const k of this.poseT.keys()) this.poseT.set(k, 0); }
  update(dt: number) {
    this.mixer.update(dt); for (const b of this.stoopBones) b.rotateX(this.stoop / this.stoopBones.length);   // dos voûté : appliqué après l'animation
    if (!this.poseT.size) return;
    for (const [k, t] of this.poseT) { const w = this.poseW.get(k) ?? 0; const nw = w + (t - w) * Math.min(1, dt * 10); if (t <= 0 && nw < 0.01) { this.poseW.delete(k); this.poseT.delete(k); } else this.poseW.set(k, nw); }
    this.model.position.y = -applyPoses(this.model, this.poseW, this.bones);
  }
  bone(name: string) { return this.root.getObjectByName(name); }
  dispose() { this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }); }
}

/** Charge le modèle et les animations une fois ; fabrique des instances habillées à la demande. */
export class AvatarFactory {
  private template!: THREE.Object3D; private clips!: Record<AnimName, THREE.AnimationClip>; private scale = 1; faces = new FaceBank();
  async load(modelUrl: string, animsUrl: string) {
    const loader = new GLTFLoader(); const [g, ag] = await Promise.all([loader.loadAsync(modelUrl), loader.loadAsync(animsUrl)]);
    this.template = g.scene; prepareTemplate(this.template); this.faces.build(this.template);
    this.template.updateMatrixWorld(true); this.scale = 1.75 / new THREE.Box3().setFromObject(this.template).getSize(new THREE.Vector3()).y;
    ag.scene.updateMatrixWorld(true);
    const wanted = ag.animations.filter(c => ['idle', 'walk', 'run'].includes(c.name.toLowerCase())); const out = {} as Record<AnimName, THREE.AnimationClip>;
    for (const c of retargetClips(ag.scene, wanted, this.template)) out[(c.name[0].toUpperCase() + c.name.slice(1).toLowerCase()) as AnimName] = c;
    this.clips = out;
  }
  create(outfit: Outfit, look?: Look, height = 1.75): AvatarInstance {
    const m = skClone(this.template); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.frustumCulled = false; } });
    if (look) this.faces.apply(m, look.face ?? 0); dress(m, outfit, look); if (look?.shape) shapeBody(m, look.shape); const hh = look ? look.height : height; const sc = this.scale * hh / 1.75; const w = look ? 1 + (look.width - 1) * (look.shape ? 0.35 : 1) : 1; m.scale.set(sc * w, sc, sc * w * 0.92); return new AvatarInstance(m, this.clips, look);
  }
}
