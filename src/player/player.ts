import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetClips } from './retarget';

/** Personnage piéton : modèle animé (Idle/Walk/Run), déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  private mixer?: THREE.AnimationMixer; private act: Record<string, THREE.AnimationAction> = {}; private cur = 'Idle';
  readonly radius = 0.4;
  /** Corps : citizen.glb ; animations (idle/walk/run) : anims.glb — même squelette Mixamo, donc les clips se réutilisent tels quels. */
  async load(modelUrl: string, animsUrl: string) {
    const loader = new GLTFLoader(); const [g, ag] = await Promise.all([loader.loadAsync(modelUrl), loader.loadAsync(animsUrl)]);
    const m = skClone(g.scene); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = false; me.frustumCulled = false; } });
    // tenue sobre : pas de chapeau, veste et pantalon de couleurs ordinaires (la texture d'origine est un costume)
    m.traverse(o => { const me = o as THREE.Mesh; if (!me.isMesh) return; const mt = me.material as THREE.MeshStandardMaterial; if (me.name === 'Wolf3D_Headwear') me.visible = false; if (me.name === 'Wolf3D_Outfit_Top') mt.color.set(0x6f7f95); if (me.name === 'Wolf3D_Outfit_Bottom') mt.color.set(0x4a5260); });
    m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(m); const h = box.getSize(new THREE.Vector3()).y; m.scale.setScalar(1.75 / h);   // taille normalisée : 1,75 m
    this.root.add(m); this.mixer = new THREE.AnimationMixer(m);
    // Les clips Mixamo (squelette « Xbot ») sont recalés sur le squelette Ready Player Me (voir retarget.ts).
    const wanted = ag.animations.filter(c => ['idle', 'walk', 'run'].includes(c.name.toLowerCase()));
    ag.scene.updateMatrixWorld(true); m.updateMatrixWorld(true);
    for (const c of retargetClips(ag.scene, wanted, m)) { const key = c.name.toLowerCase() === 'idle' ? 'Idle' : c.name.toLowerCase() === 'walk' ? 'Walk' : 'Run'; this.act[key] = this.mixer.clipAction(c); }
    this.act.Idle.play();
  }
  setAnim(n: 'Idle' | 'Walk' | 'Run') { if (n === this.cur || !this.act[n]) return; const a = this.act[n], b = this.act[this.cur]; a.reset().play(); a.crossFadeFrom(b, 0.25, false); this.cur = n; }
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
    this.setAnim(this.speed > 3.6 ? 'Run' : this.speed > 0.4 ? 'Walk' : 'Idle');
    if (this.act.Walk) this.act.Walk.timeScale = Math.max(0.5, this.speed / 1.6); if (this.act.Run) this.act.Run.timeScale = Math.max(0.6, this.speed / 5.2);
    this.mixer?.update(dt);
  }
}
