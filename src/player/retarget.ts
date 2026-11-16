import * as THREE from 'three';

/**
 * Recale des clips Mixamo (squelette source) sur un squelette cible de même nomenclature (préfixe `mixamorig` ignoré),
 * en supposant deux poses de repos en T. Pour chaque os : monde_cible(t) = monde_source(t) · monde_source_repos⁻¹ · monde_cible_repos.
 * Seule la translation du bassin est conservée, mise à l'échelle selon la hauteur des bassins.
 */
/** Squelette Rigify de la bibliothèque Quaternius (« DEF-… ») → noms du personnage. */
const SIDE = (s: string) => (s === 'L' ? 'Left' : 'Right');
export function ualName(n0: string): string | null {
  const n = n0.replace(/^(DEF-[a-z_]+?)(?:\.?)(\d{3})$/, '$1.$2').replace(/^(DEF-[a-z_]+?)\.?(\d{2})\.?([LR])$/, '$1.$2.$3').replace(/^(DEF-[a-z_]+?)\.?([LR])$/, '$1.$2');   // le chargeur retire les points des noms
  const fixed: Record<string, string> = { 'DEF-hips': 'Hips', 'DEF-spine.001': 'Spine', 'DEF-spine.002': 'Spine1', 'DEF-spine.003': 'Spine2', 'DEF-neck': 'Neck', 'DEF-head': 'Head' }; if (fixed[n]) return fixed[n];
  let m = n.match(/^DEF-(shoulder|upper_arm|forearm|hand|thigh|shin|foot|toe)\.([LR])$/); if (m) return SIDE(m[2]) + ({ shoulder: 'Shoulder', upper_arm: 'Arm', forearm: 'ForeArm', hand: 'Hand', thigh: 'UpLeg', shin: 'Leg', foot: 'Foot', toe: 'ToeBase' } as Record<string, string>)[m[1]];
  m = n.match(/^DEF-(thumb|f_index|f_middle|f_ring|f_pinky)\.0(\d)\.([LR])$/); if (m) return `${SIDE(m[3])}Hand${({ thumb: 'Thumb', f_index: 'Index', f_middle: 'Middle', f_ring: 'Ring', f_pinky: 'Pinky' } as Record<string, string>)[m[1]]}${m[2]}`;
  return null;
}
export function retargetClips(srcRoot: THREE.Object3D, clips: THREE.AnimationClip[], tgtRoot: THREE.Object3D, fps = 30, rename: (n: string) => string | null = n => n.replace('mixamorig', '')): THREE.AnimationClip[] {
  const srcBones = new Map<string, THREE.Object3D>(); srcRoot.traverse(o => { if (!(o as THREE.Bone).isBone) return; const k = rename(o.name); if (k) srcBones.set(k, o); });
  const tgtBones: THREE.Object3D[] = []; tgtRoot.traverse(o => { if ((o as THREE.Bone).isBone) tgtBones.push(o); });   // parents avant enfants
  srcRoot.updateMatrixWorld(true); tgtRoot.updateMatrixWorld(true);
  const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
  const srcRest = new Map<string, THREE.Quaternion>(); srcBones.forEach((b, n) => srcRest.set(n, wq(b)));
  const tgtRest = new Map<string, THREE.Quaternion>(); tgtBones.forEach(b => tgtRest.set(b.name, wq(b)));
  // Les deux squelettes n'ont pas la même pose de repos (ex. bras : T pour la source, A pour la cible) : pour chaque os on calcule la
  // rotation Q qui ramène la direction de l'os cible sur celle de l'os source, afin que les bras finissent au même endroit et pas « tournés de plus ».
  const Q = new Map<string, THREE.Quaternion>(); const dirTo = (a: THREE.Object3D, b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
  for (const b of tgtBones) {
    const child = b.children.find(c => (c as THREE.Bone).isBone && srcBones.has(c.name)); const sb = srcBones.get(b.name);
    if (child && sb) { const sc = srcBones.get(child.name)!; Q.set(b.name, new THREE.Quaternion().setFromUnitVectors(dirTo(b, child), dirTo(sb, sc))); }
    else Q.set(b.name, (b.parent && Q.get(b.parent.name)) ? Q.get(b.parent.name)!.clone() : new THREE.Quaternion());
  }
  const tgtLocalRest = new Map<string, THREE.Quaternion>(); tgtBones.forEach(b => tgtLocalRest.set(b.name, b.quaternion.clone()));
  const hipsS = srcBones.get('Hips')!, hipsT = tgtBones.find(b => b.name === 'Hips')!;
  const ratio = hipsT.getWorldPosition(new THREE.Vector3()).y / hipsS.getWorldPosition(new THREE.Vector3()).y;
  const srcScale = new THREE.Vector3(); hipsS.parent!.getWorldScale(srcScale); const hipsLocalToWorld = srcScale.y * ratio;
  const parentInv = hipsT.parent!.matrixWorld.clone().invert(); void hipsLocalToWorld;
  const mixer = new THREE.AnimationMixer(srcRoot); const out: THREE.AnimationClip[] = [];
  const tmp = new THREE.Quaternion(), inv = new THREE.Quaternion();
  for (const clip of clips) {
    const n = Math.max(2, Math.round(clip.duration * fps)); const times: number[] = []; const rot = new Map<string, number[]>(); const hipPos: number[] = [];
    tgtBones.forEach(b => rot.set(b.name, []));
    const act = mixer.clipAction(clip); act.play();
    for (let i = 0; i < n; i++) {
      const t = i / fps; times.push(t); mixer.setTime(t); srcRoot.updateMatrixWorld(true);
      const cur = new Map<string, THREE.Quaternion>();
      for (const b of tgtBones) {
        const s = srcBones.get(b.name); let world: THREE.Quaternion;
        const parentIsBone = (b.parent as THREE.Bone | null)?.isBone; const pw = parentIsBone ? cur.get(b.parent!.name)! : wq(b.parent!);
        if (s) { world = wq(s).multiply(inv.copy(srcRest.get(b.name)!).invert()).multiply(Q.get(b.name)!).multiply(tgtRest.get(b.name)!); }
        else { world = pw.clone().multiply(tgtLocalRest.get(b.name)!); }
        cur.set(b.name, world.clone());
        tmp.copy(pw).invert().multiply(world); rot.get(b.name)!.push(tmp.x, tmp.y, tmp.z, tmp.w);
      }
      // bassin : position monde de la source (relative à sa racine), mise à l'échelle, puis exprimée dans le repère du parent du bassin cible (axes indépendants)
      const hw = hipsS.getWorldPosition(new THREE.Vector3()).sub(srcRoot.getWorldPosition(new THREE.Vector3())).multiplyScalar(ratio).add(tgtRoot.getWorldPosition(new THREE.Vector3())); const hp = hw.applyMatrix4(parentInv); hipPos.push(hp.x, hp.y, hp.z);
    }
    act.stop(); mixer.uncacheClip(clip);
    const tracks: THREE.KeyframeTrack[] = tgtBones.map(b => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, rot.get(b.name)!));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos)); out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  return out;
}
