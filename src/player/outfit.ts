import * as THREE from 'three';
import { SKIN_TINTS, type Look } from '../npc/appearance';

export interface Outfit { hoodie: number; jeans: number; shoes: number; hair: number | null; hood: boolean; }
export const PLAYER_OUTFIT: Outfit = { hoodie: 0x3d4f6b, jeans: 0x2f4a7a, shoes: 0xe8e8e8, hair: 0x2a1d14, hood: true };

const fabrics: Record<string, THREE.CanvasTexture> = {};
/** Texture de tissu neutre (multipliée par la couleur du matériau) : tricot (pull) ou sergé (jean). */
function fabric(denim: boolean) {
  const k = denim ? 'd' : 'p'; if (fabrics[k]) return fabrics[k];
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d', { willReadFrequently: true })!; g.fillStyle = denim ? '#d8d8dc' : '#e6e6e6'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < W; i += 2) { g.strokeStyle = `rgba(0,0,0,${denim ? 0.10 : 0.07})`; g.lineWidth = 1; g.beginPath(); if (denim) { g.moveTo(i, 0); g.lineTo(i - W / 3, W); } else { g.moveTo(0, i); g.lineTo(W, i); } g.stroke(); }
  const d = g.getImageData(0, 0, W, W); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace; return (fabrics[k] = t);
}

/** Préparation (une seule fois, sur le modèle d'origine) : cache chapeau/barbe, coupe la queue-de-pie du haut pour obtenir un pull court. */
export function prepareTemplate(root: THREE.Object3D) {
  root.updateMatrixWorld(true); let hipsY = 1;
  root.traverse(n => { if ((n as THREE.Bone).isBone && n.name === 'Hips') hipsY = n.getWorldPosition(new THREE.Vector3()).y; });
  root.traverse(n => {
    const me = n as THREE.Mesh; if (!me.isMesh) return;
    if (me.name === 'Wolf3D_Headwear' || me.name === 'Wolf3D_Beard') me.visible = false;
    if (me.name === 'Wolf3D_Outfit_Top') {
      const g = me.geometry, p = g.getAttribute('position'), idx = g.getIndex()!; const keep: number[] = [];
      for (let i = 0; i < idx.count; i += 3) { const y = (p.getY(idx.getX(i)) + p.getY(idx.getX(i + 1)) + p.getY(idx.getX(i + 2))) / 3; if (y > hipsY - 0.03) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); }
      g.setIndex(keep);
    }
  });
}

/** Habille une copie du modèle : matériaux clonés (couleurs propres à ce personnage), cheveux et capuche. */
export function dress(root: THREE.Object3D, o: Outfit, look?: Look) {
  const bones: THREE.Bone[] = []; root.traverse(n => { if ((n as THREE.Bone).isBone) bones.push(n as THREE.Bone); });
  root.traverse(n => {
    const me = n as THREE.Mesh; if (!me.isMesh) return; me.material = (me.material as THREE.Material).clone(); const mt = me.material as THREE.MeshStandardMaterial;
    if (me.name === 'Wolf3D_Outfit_Top') { mt.map = fabric(false); mt.normalMap = null; mt.color.set(o.hoodie); mt.roughness = 0.92; mt.metalness = 0; }
    else if (me.name === 'Wolf3D_Outfit_Bottom') { mt.map = fabric(true); mt.normalMap = null; mt.color.set(o.jeans); mt.roughness = 0.85; mt.metalness = 0; }
    else if (me.name === 'Wolf3D_Outfit_Footwear') { mt.map = fabric(false); mt.normalMap = null; mt.color.set(o.shoes); mt.roughness = 0.7; }
    else if (look && (me.name === 'Wolf3D_Head' || me.name === 'Wolf3D_Body')) mt.color.set(SKIN_TINTS[look.skin]);
    mt.needsUpdate = true;
  });
  root.updateMatrixWorld(true);
  const bone = (nm: string) => bones.find(x => x.name === nm)!;
  const attach = (boneName: string, geom: THREE.BufferGeometry, mat: THREE.Material, off: THREE.Vector3, sc: THREE.Vector3) => {
    const bn = bone(boneName); const wp = bn.getWorldPosition(new THREE.Vector3()).add(off); const ws = bn.getWorldScale(new THREE.Vector3()).x || 1;
    const m = new THREE.Mesh(geom, mat); m.position.copy(bn.worldToLocal(wp)); m.scale.copy(sc).multiplyScalar(1 / ws); m.castShadow = true; bn.add(m); return m;
  };
  const style = look?.hairStyle ?? 'courts';
  if (o.hair !== null && style !== 'chauve') {
    const hm = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.95 }); const one = new THREE.Vector3(1, 1, 1);
    if (style === 'boucles') attach('Head', new THREE.SphereGeometry(0.138, 18, 14), hm, new THREE.Vector3(0, 0.13, -0.012), new THREE.Vector3(1, 0.88, 1));
    else {
      attach('Head', new THREE.SphereGeometry(style === 'rases' ? 0.104 : 0.108, 20, 12, 0, Math.PI * 2, 0, Math.PI * (style === 'rases' ? 0.5 : 0.56)), hm, new THREE.Vector3(0, 0.125, -0.005), one);
      if (style === 'longs') attach('Head', new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), hm, new THREE.Vector3(0, 0.02, -0.07), new THREE.Vector3(1.25, 1, 0.65));
      if (style === 'queue') attach('Head', new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), hm, new THREE.Vector3(0, 0.07, -0.13), one);
    }
  }
  if (look?.skirt) { const sm = new THREE.MeshStandardMaterial({ color: o.jeans, roughness: 0.9, side: THREE.DoubleSide, map: fabric(false) }); attach('Hips', new THREE.CylinderGeometry(0.2, 0.3, 0.46, 16, 1, true), sm, new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(1, 1, 1)); }
  if (o.hood) attach('Neck', new THREE.SphereGeometry(0.115, 16, 10), new THREE.MeshStandardMaterial({ color: o.hoodie, roughness: 0.9, map: fabric(false) }), new THREE.Vector3(0, 0.005, -0.085), new THREE.Vector3(1.15, 0.55, 0.7));
}
