// Morphologie et visages : corpulence par mise à l'échelle des os (ventre, poitrine, cuisses, bras) et visages variés par déformation du maillage de la tête.
import * as THREE from 'three';

export interface Shape { belly: number; chest: number; thigh: number; arm: number; }
const HEAD_MESHES = ['Wolf3D_Head', 'EyeLeft', 'EyeRight', 'Wolf3D_Teeth', 'Wolf3D_Beard'];

/** Corpulence : chaque os reçoit une échelle et ses enfants la compensent, pour ne gonfler que la zone voulue. */
export function shapeBody(root: THREE.Object3D, s: Shape) {
  const b = (n: string) => root.getObjectByName(n) as THREE.Bone | undefined;
  const sp = b('Spine'), s1 = b('Spine1'), s2 = b('Spine2'); if (!sp || !s1 || !s2) return;
  const b0 = 1 + (s.belly - 1) * 0.55;
  sp.scale.set(b0, 1, b0 * (1 + (s.belly - 1) * 0.2));
  const bz = 1 + (s.belly - 1) * 1.35; s1.scale.set(s.belly / b0, 1, bz / sp.scale.z);
  const cz = Math.max(s.chest, 1 + (bz - 1) * 0.6); s2.scale.set(s.chest / s.belly, 1, cz / bz);
  for (const n of ['Neck', 'LeftShoulder', 'RightShoulder']) { const o = b(n); if (o) o.scale.set(1 / s.chest, 1, 1 / cz); }
  for (const n of ['LeftArm', 'RightArm']) { const o = b(n); if (o) o.scale.set(s.arm, 1, s.arm); }
  for (const n of ['LeftForeArm', 'RightForeArm']) { const o = b(n); if (o) o.scale.set(1 / s.arm * (1 + (s.arm - 1) * 0.6), 1, 1 / s.arm * (1 + (s.arm - 1) * 0.6)); }
  for (const n of ['LeftHand', 'RightHand']) { const o = b(n); if (o) o.scale.set(1 / (1 + (s.arm - 1) * 0.6), 1, 1 / (1 + (s.arm - 1) * 0.6)); }
  for (const n of ['LeftUpLeg', 'RightUpLeg']) { const o = b(n); if (o) o.scale.set(s.thigh, 1, s.thigh); }
  for (const n of ['LeftLeg', 'RightLeg']) { const o = b(n); if (o) o.scale.set(1 / s.thigh * (1 + (s.thigh - 1) * 0.5), 1, 1 / s.thigh * (1 + (s.thigh - 1) * 0.5)); }
  for (const n of ['LeftFoot', 'RightFoot']) { const o = b(n); if (o) o.scale.set(1 / (1 + (s.thigh - 1) * 0.5), 1, 1 / (1 + (s.thigh - 1) * 0.5)); }
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
export interface FaceParams { width: number; jaw: number; chin: number; nose: number; cheeks: number; brow: number; length: number; lips: number; }

/** Banque de visages : K variantes de la géométrie de la tête (et des yeux, dents, barbe, cou), déformées de façon cohérente. */
export class FaceBank {
  variants: Map<string, THREE.BufferGeometry>[] = [];
  build(template: THREE.Object3D, k = 16, seed = 7) {
    const meshes: THREE.SkinnedMesh[] = []; template.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && HEAD_MESHES.includes(m.name)) meshes.push(m); });
    const head = meshes.find(m => m.name === 'Wolf3D_Head'); if (!head) return;
    const wHead = (m: THREE.SkinnedMesh) => { const si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight'); const ids = new Set(m.skeleton.bones.map((bn, i) => (/Head|Eye/.test(bn.name) ? i : -1)).filter(i => i >= 0)); const out = new Float32Array(si.count); for (let v = 0; v < si.count; v++) { let w = 0; for (let c = 0; c < 4; c++) if (ids.has(si.getComponent(v, c))) w += sw.getComponent(v, c); out[v] = w; } return out; };
    // repère du visage : boîte des sommets entièrement liés à la tête
    const hp = head.geometry.getAttribute('position'), hw = wHead(head); const bb = new THREE.Box3(); const v3 = new THREE.Vector3();
    for (let v = 0; v < hp.count; v++) if (hw[v] > 0.95) bb.expandByPoint(v3.fromBufferAttribute(hp, v)); const c = bb.getCenter(new THREE.Vector3()), h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
    const weights = new Map(meshes.map(m => [m.name, wHead(m)]));
    for (let i = 0; i < k; i++) {
      const p: FaceParams = i === 0 ? { width: 0, jaw: 0, chin: 0, nose: 0, cheeks: 0, brow: 0, length: 0, lips: 0 } : { width: r(), jaw: r(), chin: r(), nose: r(), cheeks: r(), brow: r(), length: r(), lips: r() };
      const map = new Map<string, THREE.BufferGeometry>();
      for (const m of meshes) { const g = m.geometry.clone(); const pos = g.getAttribute('position') as THREE.BufferAttribute; const w = weights.get(m.name)!;
        for (let v = 0; v < pos.count; v++) { if (w[v] < 0.05) continue; const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v); const u = (x - c.x) / h.x, uy = (y - c.y) / h.y, uz = (z - c.z) / h.z; const front = smooth(-0.1, 0.5, uz);
          let dx = u * h.x * (0.07 * p.width * smooth(-1, -0.2, -Math.abs(uy) + 0.2) + 0.12 * p.jaw * smooth(-0.05, -0.75, uy) * front + 0.08 * p.cheeks * bump(uy, -0.2, 0.3) * bump(Math.abs(u), 0.6, 0.3) * front);
          let dy = (uy < 0 ? uy * h.y * 0.07 * p.length : 0) - h.y * 0.06 * p.chin * smooth(-0.55, -0.95, uy) * front;
          let dz = h.z * (0.09 * p.nose * bump(u, 0, 0.18) * bump(uy, -0.12, 0.2) * smooth(0.5, 0.95, uz) + 0.04 * p.brow * bump(uy, 0.25, 0.12) * front + 0.05 * p.chin * smooth(-0.6, -0.95, uy) * front + 0.03 * p.lips * bump(u, 0, 0.3) * bump(uy, -0.45, 0.1) * smooth(0.6, 0.95, uz));
          dx *= w[v]; dy *= w[v]; dz *= w[v]; pos.setXYZ(v, x + dx, y + dy, z + dz); }
        pos.needsUpdate = true; map.set(m.name, g); }
      this.variants.push(map);
    }
  }
  apply(root: THREE.Object3D, idx: number) { const map = this.variants[idx % Math.max(1, this.variants.length)]; if (!map) return; root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && map.has(m.name)) m.geometry = map.get(m.name)!; }); }
}
