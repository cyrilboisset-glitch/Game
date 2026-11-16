import * as THREE from 'three';
import { grassBlades } from './textures';
import type { GroundMask } from './mask';
import { sol } from './sol';

const REF = new THREE.Color(100 / 255, 118 / 255, 92 / 255).convertSRGBToLinear(), TMP = new THREE.Color();
/** Teinte de la touffe selon la photo aérienne : herbe verte dans un pré, paille dans un champ moissonné. */
function tintAt(x: number, z: number) { const c = sol.sample(x, z); if (!c) return TMP.setRGB(1, 1, 1); TMP.setRGB(c[0] / 255, c[1] / 255, c[2] / 255).convertSRGBToLinear(); return TMP.setRGB(Math.min(1.8, Math.max(0.5, TMP.r / REF.r)), Math.min(1.8, Math.max(0.5, TMP.g / REF.g)), Math.min(1.8, Math.max(0.5, TMP.b / REF.b))); }
/** Touffes d'herbe autour de la caméra (1 draw call), qui ondulent au vent ; replacées quand on se déplace. Jamais sur la route ni dans un bâtiment. */
export class GrassField {
  mesh: THREE.InstancedMesh; private last = new THREE.Vector2(1e9, 1e9); private uTime = { value: 0 }; enabled = true;
  constructor(scene: THREE.Scene, private mask: GroundMask, private n = 2400, private R = 40) {
    const g = new THREE.BufferGeometry(); const P: number[] = [], U: number[] = [], N: number[] = [];
    for (const a of [0, Math.PI / 3, 2 * Math.PI / 3]) { const c = Math.cos(a) * 0.45, s = Math.sin(a) * 0.45; P.push(-c, 0, -s, c, 0, s, c, 0.38, s, -c, 0, -s, c, 0.38, s, -c, 0.38, -s); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); for (let k = 0; k < 6; k++) N.push(0, 1, 0); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    const m = new THREE.MeshStandardMaterial({ map: grassBlades(), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, color: 0x98a878 });
    m.onBeforeCompile = sh => { sh.uniforms.uTime = this.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0); float sway = sin(uTime * 1.7 + wp0.x * 0.35 + wp0.z * 0.27) * 0.09 + sin(uTime * 3.1 + wp0.x) * 0.03; transformed.x += sway * position.y * 1.8; transformed.z += sway * position.y * 0.9;`); };
    this.mesh = new THREE.InstancedMesh(g, m, n); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; scene.add(this.mesh);
  }
  update(dt: number, x: number, z: number) {
    this.uTime.value += dt; this.mesh.visible = this.enabled; if (!this.enabled || Math.hypot(x - this.last.x, z - this.last.y) < 10) return; this.last.set(x, z);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0; let seed = (Math.floor(x / 10) * 92821 + Math.floor(z / 10) * 68917) >>> 0; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < this.n * 2 && k < this.n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * this.R; const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.mask.get(px, pz) || sol.paved(px, pz)) continue; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); const sc = 0.45 + r() * 0.6; m.compose(p.set(px, 0.01, pz), q, s.set(sc, sc * (0.7 + r() * 0.6), sc)); this.mesh.setMatrixAt(k, m); this.mesh.setColorAt(k++, tintAt(px, pz)); }
    this.mesh.count = k; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
