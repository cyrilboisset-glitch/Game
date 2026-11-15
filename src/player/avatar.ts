import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetClips } from './retarget';
import { prepareTemplate, dress, type Outfit } from './outfit';

export type AnimName = 'Idle' | 'Walk' | 'Run';
/** Une instance animée du personnage (clone du modèle, mixer propre, vêtements propres). */
export class AvatarInstance {
  root = new THREE.Group(); private mixer: THREE.AnimationMixer; private act = {} as Record<AnimName, THREE.AnimationAction>; private cur: AnimName = 'Idle';
  constructor(model: THREE.Object3D, clips: Record<AnimName, THREE.AnimationClip>) {
    this.root.add(model); this.mixer = new THREE.AnimationMixer(model);
    (Object.keys(clips) as AnimName[]).forEach(k => (this.act[k] = this.mixer.clipAction(clips[k]))); this.act.Idle.play();
  }
  set(n: AnimName, speed = 1) { if (n !== this.cur) { const a = this.act[n], b = this.act[this.cur]; a.reset().play(); a.crossFadeFrom(b, 0.25, false); this.cur = n; } this.act.Walk.timeScale = Math.max(0.5, speed / 1.6); this.act.Run.timeScale = Math.max(0.6, speed / 5.2); }
  update(dt: number) { this.mixer.update(dt); }
  dispose() { this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }); }
}

/** Charge le modèle et les animations une fois ; fabrique des instances habillées à la demande. */
export class AvatarFactory {
  private template!: THREE.Object3D; private clips!: Record<AnimName, THREE.AnimationClip>; private scale = 1;
  async load(modelUrl: string, animsUrl: string) {
    const loader = new GLTFLoader(); const [g, ag] = await Promise.all([loader.loadAsync(modelUrl), loader.loadAsync(animsUrl)]);
    this.template = g.scene; prepareTemplate(this.template);
    this.template.updateMatrixWorld(true); this.scale = 1.75 / new THREE.Box3().setFromObject(this.template).getSize(new THREE.Vector3()).y;
    ag.scene.updateMatrixWorld(true);
    const wanted = ag.animations.filter(c => ['idle', 'walk', 'run'].includes(c.name.toLowerCase())); const out = {} as Record<AnimName, THREE.AnimationClip>;
    for (const c of retargetClips(ag.scene, wanted, this.template)) out[(c.name[0].toUpperCase() + c.name.slice(1).toLowerCase()) as AnimName] = c;
    this.clips = out;
  }
  create(outfit: Outfit, height = 1.75): AvatarInstance {
    const m = skClone(this.template); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.frustumCulled = false; } });
    dress(m, outfit); m.scale.setScalar(this.scale * height / 1.75); return new AvatarInstance(m, this.clips);
  }
}
