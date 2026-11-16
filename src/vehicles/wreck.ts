// Débris d'accident : capot ou portière arrachés qui volent et retombent, éclats de vitres. Physique simple (gravité, rebonds, frottement au sol).
import * as THREE from 'three';

interface Piece { m: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; life: number; rest: boolean; }
export class Debris {
  private pieces: Piece[] = []; private shards: THREE.InstancedMesh; private sh: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; life: number }[] = []; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private one = new THREE.Vector3(1, 1, 1);
  constructor(private scene: THREE.Scene, nShards = 160) {
    this.shards = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xbfd8e6, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), nShards);
    this.shards.count = 0; this.shards.frustumCulled = false; scene.add(this.shards);
    for (let i = 0; i < nShards; i++) this.sh.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
  }
  /** Pièce de carrosserie arrachée (maillage déjà construit), lancée depuis `pos` avec la vitesse `vel`. */
  throwPiece(mesh: THREE.Object3D, pos: THREE.Vector3, vel: THREE.Vector3) {
    mesh.position.copy(pos); this.scene.add(mesh); this.pieces.push({ m: mesh, v: vel.clone(), w: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9), life: 90, rest: false });
    while (this.pieces.length > 24) { const old = this.pieces.shift()!; this.scene.remove(old.m); }
  }
  /** Gerbe d'éclats de verre. */
  shatter(pos: THREE.Vector3, dir: THREE.Vector3, n = 40) {
    let k = 0; for (const s of this.sh) { if (k >= n) break; if (s.life > 0) continue; s.life = 4 + Math.random() * 6; s.p.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.4, (Math.random() - 0.5) * 0.8)); s.v.copy(dir).multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4)); s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); s.w.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20); k++; }
  }
  update(dt: number) {
    for (const p of this.pieces) {
      if ((p.life -= dt) <= 0) { this.scene.remove(p.m); continue; } if (p.rest) continue;
      p.v.y -= 9.8 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
      if (p.m.position.y < 0.04) { p.m.position.y = 0.04; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.5); if (Math.abs(p.v.y) < 0.4 && Math.hypot(p.v.x, p.v.z) < 0.3) { p.rest = true; p.m.rotation.x = Math.round(p.m.rotation.x / Math.PI) * Math.PI; p.m.rotation.z = Math.round(p.m.rotation.z / Math.PI) * Math.PI; } }
    }
    this.pieces = this.pieces.filter(p => p.life > 0);
    let n = 0; for (const s of this.sh) { if (s.life <= 0) continue; s.life -= dt; if (s.p.y > 0.02) { s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt); s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; } else { s.p.y = 0.02; s.r.x = -Math.PI / 2; s.v.set(0, 0, 0); } this.m4.compose(s.p, this.q.setFromEuler(s.r), this.one); this.shards.setMatrixAt(n++, this.m4); }
    this.shards.count = n; this.shards.instanceMatrix.needsUpdate = true;
  }
}
