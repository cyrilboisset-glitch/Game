import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyPoses, POSES } from '../src/player/poses';
import { makeLook } from '../src/npc/appearance';
import { rng } from '../src/interiors/generator';

/** Squelette minimal : bras droit le long du corps (vers le bas). */
function rig() {
  const model = new THREE.Group(); const spine = new THREE.Bone(); spine.name = 'Spine'; const s1 = new THREE.Bone(); s1.name = 'Spine1'; s1.position.y = 0.3;
  const arm = new THREE.Bone(); arm.name = 'RightArm'; arm.position.set(-0.2, 0.2, 0); const fore = new THREE.Bone(); fore.name = 'RightForeArm'; fore.position.set(0, -0.3, 0); const hand = new THREE.Bone(); hand.name = 'RightHand'; hand.position.set(0, -0.28, 0);
  model.add(spine); spine.add(s1); s1.add(arm); arm.add(fore); fore.add(hand); const bones = new Map<string, THREE.Object3D>(); model.traverse(o => { if ((o as THREE.Bone).isBone) bones.set(o.name, o); }); return { model, bones, arm, fore };
}
const dirOf = (a: THREE.Object3D, b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();

describe('poses d\'action', () => {
  it('« viser » tend le bras droit devant le personnage, quel que soit son cap', () => {
    for (const h of [0, 1.2, -2.5]) { const r = rig(); r.model.rotation.y = h; applyPoses(r.model, new Map([['aim', 1]]), r.bones);
      const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)); expect(dirOf(r.arm, r.fore).dot(fwd)).toBeGreaterThan(0.95); expect(dirOf(r.fore, r.bones.get('RightHand')!).dot(fwd)).toBeGreaterThan(0.95); }
  });
  it('« mains en l\'air » lève l\'avant-bras ; poids 0 = rien ne bouge ; accroupi abaisse le bassin', () => {
    const r = rig(); applyPoses(r.model, new Map([['handsup', 1]]), r.bones); expect(dirOf(r.fore, r.bones.get('RightHand')!).y).toBeGreaterThan(0.95);
    const r2 = rig(); const before = dirOf(r2.arm, r2.fore); applyPoses(r2.model, new Map([['aim', 0]]), r2.bones); expect(dirOf(r2.arm, r2.fore).distanceTo(before)).toBeLessThan(1e-6);
    expect(applyPoses(rig().model, new Map([['crouch', 1]]), new Map())).toBeCloseTo(POSES.crouch.drop!);
  });
  it('apparences : visages variés, barbes chez les hommes adultes seulement, corpulence cohérente', () => {
    const r = rng(3); const looks = Array.from({ length: 400 }, (_, i) => ({ l: makeLook(r, 'europe', i % 2 ? 'F' : 'M', 5 + (i % 80)), f: i % 2 === 1, age: 5 + (i % 80) }));
    expect(new Set(looks.map(x => x.l.face)).size).toBeGreaterThan(10);
    expect(looks.every(x => !x.l.beard || (!x.f && x.age >= 18))).toBe(true);
    expect(looks.every(x => x.l.shape!.belly >= 0.85 && x.l.shape!.belly <= 1.9)).toBe(true);
    const heavy = looks.filter(x => x.l.width > 1.15 && x.age >= 18), thin = looks.filter(x => x.l.width < 0.95 && x.age >= 18);
    expect(Math.min(...heavy.map(x => x.l.shape!.belly))).toBeGreaterThan(Math.max(...thin.map(x => x.l.shape!.belly)));
  });
});
