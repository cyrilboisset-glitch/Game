import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Personnage piéton : modèle animé (Idle/Walk/Run), déplacement relatif à la caméra. */
export class Player {
  root = new THREE.Group(); pos = new THREE.Vector3(); heading = 0; speed = 0; visible = true;
  private mixer?: THREE.AnimationMixer; private act: Record<string, THREE.AnimationAction> = {}; private cur = 'Idle';
  readonly radius = 0.4;
  async load(url: string) {
    const g = await new GLTFLoader().loadAsync(url); const m = skClone(g.scene); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = false; (me.material as THREE.MeshStandardMaterial).envMapIntensity = 0.5; } });
    m.rotation.y = Math.PI;   // le modèle regarde vers -Z : on le retourne pour que heading = direction de marche
    const pivot = new THREE.Group(); pivot.add(m); this.root.add(pivot); this.mixer = new THREE.AnimationMixer(m);
    for (const c of g.animations) if (['Idle', 'Walk', 'Run'].includes(c.name)) { this.act[c.name] = this.mixer.clipAction(c); }
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
