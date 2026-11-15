import * as THREE from 'three';

/** Effets de conduite : traces de pneus au sol, étincelles de choc. */
export class Effects {
  private marks: THREE.InstancedMesh; private mi = 0; private last = new Map<string, [number, number]>(); private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);
  private sparks: THREE.Points; private sp: { v: THREE.Vector3; life: number }[] = []; private sPos: Float32Array; shake = 0;
  constructor(scene: THREE.Scene, nMarks = 700) {
    this.marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), nMarks);
    this.marks.count = 0; this.marks.frustumCulled = false; scene.add(this.marks);
    const n = 80; this.sPos = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3));
    this.sparks = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc860, size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); this.sparks.frustumCulled = false; scene.add(this.sparks);
    for (let i = 0; i < n; i++) { this.sp.push({ v: new THREE.Vector3(), life: 0 }); this.sPos[i * 3 + 1] = -100; }
  }
  /** Trace de pneu à (x,z) pour la roue `id`, tous les 0,35 m environ. */
  skid(id: string, x: number, z: number, h: number) {
    const l = this.last.get(id); if (l && Math.hypot(l[0] - x, l[1] - z) < 0.35) return; this.last.set(id, [x, z]);
    this.q.setFromAxisAngle(this.up, h); this.m.compose(this.p.set(x, 0.095, z), this.q, this.s.set(1, 1, 1)); this.marks.setMatrixAt(this.mi % 700, this.m); this.mi++; this.marks.count = Math.min(this.mi, 700); this.marks.instanceMatrix.needsUpdate = true;
  }
  endSkid(id: string) { this.last.delete(id); }
  burst(x: number, y: number, z: number, n = 18) { let k = 0; for (let i = 0; i < this.sp.length && k < n; i++) { const s = this.sp[i]; if (s.life > 0) continue; s.life = 0.35 + Math.random() * 0.4; s.v.set((Math.random() - 0.5) * 6, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 6); this.sPos[i * 3] = x; this.sPos[i * 3 + 1] = y; this.sPos[i * 3 + 2] = z; k++; } this.shake = Math.min(1, this.shake + n / 25); }
  update(dt: number) {
    for (let i = 0; i < this.sp.length; i++) { const s = this.sp[i]; if (s.life <= 0) continue; s.life -= dt; s.v.y -= 14 * dt; this.sPos[i * 3] += s.v.x * dt; this.sPos[i * 3 + 1] += s.v.y * dt; this.sPos[i * 3 + 2] += s.v.z * dt; if (s.life <= 0 || this.sPos[i * 3 + 1] < 0) { s.life = 0; this.sPos[i * 3 + 1] = -100; } }
    (this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; this.shake = Math.max(0, this.shake - dt * 2.2);
  }
}
