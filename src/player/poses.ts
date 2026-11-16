// Poses d'action superposées à l'animation (marche, course, repos) : on oriente des os vers des directions voulues, exprimées dans le repère du personnage
// (+Z devant, +Y haut, +X à sa gauche). Indépendant des axes locaux du squelette, mélangeable par poids.
import * as THREE from 'three';

type V = [number, number, number];
export interface PoseDef { dirs: Partial<Record<string, V>>; drop?: number; }
export const POSES: Record<string, PoseDef> = {
  aim: { dirs: { RightArm: [-0.12, 0.06, 1], RightForeArm: [-0.05, 0.06, 1], LeftArm: [-0.3, -0.12, 0.9], LeftForeArm: [-0.8, 0.05, 0.6] } },
  punch: { dirs: { RightArm: [-0.12, 0.12, 1], RightForeArm: [-0.05, 0.12, 1], Spine: [0, 1, 0.22] } },
  swingUp: { dirs: { RightArm: [-0.4, 0.75, -0.15], RightForeArm: [-0.1, 0.85, -0.5] } },
  swingDown: { dirs: { RightArm: [-0.15, -0.3, 1], RightForeArm: [-0.05, -0.55, 0.85], Spine: [0, 1, 0.38] } },
  crouch: { dirs: { LeftUpLeg: [0.18, -0.38, 0.9], RightUpLeg: [-0.18, -0.38, 0.9], LeftLeg: [0.05, -1, -0.18], RightLeg: [-0.05, -1, -0.18], Spine: [0, 1, 0.45] }, drop: 0.4 },
  carry: { dirs: { LeftArm: [0.18, -0.5, 0.85], LeftForeArm: [-0.2, 0.15, 1], RightArm: [-0.18, -0.5, 0.85], RightForeArm: [0.2, 0.15, 1], Spine: [0, 1, -0.12] } },
  handsup: { dirs: { LeftArm: [0.6, 0.8, 0.05], LeftForeArm: [0.05, 1, 0.08], RightArm: [-0.6, 0.8, 0.05], RightForeArm: [-0.05, 1, 0.08] } },
  phone: { dirs: { RightArm: [-0.3, -0.85, 0.3], RightForeArm: [0.35, 0.85, 0.35] } },
  guard: { dirs: { LeftArm: [0.35, -0.65, 0.65], LeftForeArm: [-0.25, 0.75, 0.6], RightArm: [-0.35, -0.65, 0.65], RightForeArm: [0.25, 0.75, 0.6], Spine: [0, 1, 0.18] } },
  cower: { dirs: { LeftArm: [0.5, 0.6, 0.4], LeftForeArm: [-0.4, 0.6, 0.6], RightArm: [-0.5, 0.6, 0.4], RightForeArm: [0.4, 0.6, 0.6], Spine: [0, 1, 0.3] } },
  hose: { dirs: { LeftArm: [0.1, -0.25, 0.97], LeftForeArm: [-0.35, 0.12, 0.93], RightArm: [-0.15, -0.5, 0.86], RightForeArm: [0.1, 0.05, 1], Spine: [0, 1, 0.1] } },
  flinch: { dirs: { Spine: [0, 1, -0.4], Head: [0, 1, -0.35], LeftArm: [0.45, -0.5, 0.55], RightArm: [-0.45, -0.5, 0.55] } },
  sit: { dirs: { LeftUpLeg: [0.1, -0.08, 1], RightUpLeg: [-0.1, -0.08, 1], LeftLeg: [0.02, -1, 0.18], RightLeg: [-0.02, -1, 0.18], Spine: [0, 1, -0.1], LeftArm: [0.12, -0.4, 0.9], LeftForeArm: [-0.25, 0.4, 0.88], RightArm: [-0.12, -0.4, 0.9], RightForeArm: [0.25, 0.4, 0.88] }, drop: 0.48 },
  pick: { dirs: { LeftUpLeg: [0.2, -0.3, 0.93], RightUpLeg: [-0.2, -0.3, 0.93], LeftLeg: [0.05, -1, -0.25], RightLeg: [-0.05, -1, -0.25], Spine: [0, 1, 0.5], LeftArm: [0.15, -0.55, 0.82], LeftForeArm: [-0.1, 0.3, 0.95], RightArm: [-0.15, -0.55, 0.82], RightForeArm: [0.1, 0.3, 0.95] }, drop: 0.46 },
};
const CHILD: Record<string, string> = { Spine: 'Spine1', Head: 'HeadTop_End', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot' };
const ORDER = ['Spine', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
const a = new THREE.Vector3(), b = new THREE.Vector3(), cur = new THREE.Vector3(), tgt = new THREE.Vector3(), q = new THREE.Quaternion(), wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), rootQ = new THREE.Quaternion();

/** Applique un mélange de poses. `weights` : nom → poids (0-1). Retourne l'abaissement du bassin (m) à appliquer au modèle. */
export function applyPoses(model: THREE.Object3D, weights: Map<string, number>, bones: Map<string, THREE.Object3D>) {
  let drop = 0; const acc = new Map<string, { v: THREE.Vector3; w: number }>();
  for (const [name, w] of weights) { if (w < 0.01) continue; const p = POSES[name]; if (!p) continue; drop += (p.drop ?? 0) * w;
    for (const [bn, d] of Object.entries(p.dirs)) { if (!d) continue; const e = acc.get(bn) ?? { v: new THREE.Vector3(), w: 0 }; e.v.add(tgt.set(d[0], d[1], d[2]).normalize().multiplyScalar(w)); e.w += w; acc.set(bn, e); } }
  if (!acc.size) return drop;
  model.updateMatrixWorld(true); model.getWorldQuaternion(rootQ);
  for (const bn of ORDER) {
    const e = acc.get(bn); if (!e) continue; const bone = bones.get(bn), child = bones.get(CHILD[bn]); if (!bone || !child) continue;
    bone.getWorldPosition(a); child.getWorldPosition(b); cur.subVectors(b, a); if (cur.lengthSq() < 1e-10) continue; cur.normalize();
    tgt.copy(e.v).normalize().applyQuaternion(rootQ); const w = Math.min(1, e.w); tgt.lerp(cur, 1 - w).normalize(); q.setFromUnitVectors(cur, tgt);
    bone.getWorldQuaternion(wq); wq.premultiply(q); if (bone.parent) { bone.parent.getWorldQuaternion(pq); wq.premultiply(pq.invert()); } bone.quaternion.copy(wq); bone.updateMatrixWorld(true);
  }
  return drop;
}
