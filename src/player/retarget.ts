import * as THREE from 'three';

/**
 * Recale des clips Mixamo (squelette source) sur un squelette cible de même nomenclature (préfixe `mixamorig` ignoré),
 * en supposant deux poses de repos en T. Pour chaque os : monde_cible(t) = monde_source(t) · monde_source_repos⁻¹ · monde_cible_repos.
 * Seule la translation du bassin est conservée, mise à l'échelle selon la hauteur des bassins.
 */
export function retargetClips(srcRoot: THREE.Object3D, clips: THREE.AnimationClip[], tgtRoot: THREE.Object3D, fps = 30): THREE.AnimationClip[] {
  const strip = (n: string) => n.replace('mixamorig', '');
  const srcBones = new Map<string, THREE.Object3D>(); srcRoot.traverse(o => { if ((o as THREE.Bone).isBone) srcBones.set(strip(o.name), o); });
  const tgtBones: THREE.Object3D[] = []; tgtRoot.traverse(o => { if ((o as THREE.Bone).isBone) tgtBones.push(o); });   // parents avant enfants
  srcRoot.updateMatrixWorld(true); tgtRoot.updateMatrixWorld(true);
  const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
  const srcRest = new Map<string, THREE.Quaternion>(); srcBones.forEach((b, n) => srcRest.set(n, wq(b)));
  const tgtRest = new Map<string, THREE.Quaternion>(); tgtBones.forEach(b => tgtRest.set(b.name, wq(b)));
  const tgtLocalRest = new Map<string, THREE.Quaternion>(); tgtBones.forEach(b => tgtLocalRest.set(b.name, b.quaternion.clone()));
  const hipsS = srcBones.get('Hips')!, hipsT = tgtBones.find(b => b.name === 'Hips')!;
  const ratio = hipsT.getWorldPosition(new THREE.Vector3()).y / hipsS.getWorldPosition(new THREE.Vector3()).y;
  const srcScale = new THREE.Vector3(); hipsS.parent!.getWorldScale(srcScale); const hipsLocalToWorld = srcScale.y * ratio;
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
        if (s) { world = wq(s).multiply(inv.copy(srcRest.get(b.name)!).invert()).multiply(tgtRest.get(b.name)!); }
        else { world = pw.clone().multiply(tgtLocalRest.get(b.name)!); }
        cur.set(b.name, world.clone());
        tmp.copy(pw).invert().multiply(world); rot.get(b.name)!.push(tmp.x, tmp.y, tmp.z, tmp.w);
      }
      const hp = new THREE.Vector3().copy(hipsS.position).multiplyScalar(hipsLocalToWorld / (hipsT.parent!.getWorldScale(new THREE.Vector3()).y || 1)); hipPos.push(hp.x, hp.y, hp.z);
    }
    act.stop(); mixer.uncacheClip(clip);
    const tracks: THREE.KeyframeTrack[] = tgtBones.map(b => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, rot.get(b.name)!));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos)); out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  return out;
}
