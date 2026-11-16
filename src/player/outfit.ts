import * as THREE from 'three';
import { SKIN_TINTS, type Look } from '../npc/appearance';

export interface Outfit { hoodie: number; jeans: number; shoes: number; hair: number | null; hood: boolean; hoodUp?: boolean; }
export const PLAYER_OUTFIT: Outfit = { hoodie: 0x3d4f6b, jeans: 0x2f4a7a, shoes: 0xe8e8e8, hair: 0x2a1d14, hood: true };

const fabrics: Record<string, THREE.CanvasTexture> = {};
let strands: THREE.CanvasTexture | undefined;
/** Texture de mèches (multipliée par la couleur des cheveux). */
function hairStrands() {
  if (strands) return strands; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const x = Math.random() * 128, y = Math.random() * 128, v = 140 + Math.random() * 115; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.6 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y + 10 + Math.random() * 14); g.stroke(); }
  strands = new THREE.CanvasTexture(c); strands.wrapS = strands.wrapT = THREE.RepeatWrapping; strands.repeat.set(3, 2); strands.colorSpace = THREE.SRGBColorSpace; return strands;
}
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
    else if (me.name === 'Wolf3D_Beard') { me.visible = !!look?.beard && !o.hoodUp; mt.color.set(look?.hairColor ?? 0x2a1d14); mt.roughness = 0.95; }
    mt.needsUpdate = true;
  });
  root.updateMatrixWorld(true);
  const bone = (nm: string) => bones.find(x => x.name === nm)!;
  const attach = (boneName: string, geom: THREE.BufferGeometry, mat: THREE.Material, off: THREE.Vector3, sc: THREE.Vector3) => {
    const bn = bone(boneName); const wp = bn.getWorldPosition(new THREE.Vector3()).add(off); const ws = bn.getWorldScale(new THREE.Vector3()).x || 1;
    const m = new THREE.Mesh(geom, mat); m.position.copy(bn.worldToLocal(wp)); m.scale.copy(sc).multiplyScalar(1 / ws); m.castShadow = true; bn.add(m); return m;
  };
  const style = look?.hairStyle ?? 'courts';
  const hairTex = hairStrands();
  if (o.hoodUp) attach('Head', new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: o.hoodie, roughness: 0.9, map: fabric(false), side: THREE.DoubleSide }), new THREE.Vector3(0, 0.1, -0.03), new THREE.Vector3(1.05, 1.08, 1.12));
  else if (o.hair !== null && style !== 'chauve') {
    const hm = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.8, map: hairTex, bumpMap: hairTex, bumpScale: 0.6 }); const one = new THREE.Vector3(1, 1, 1);
    if (style === 'boucles') attach('Head', new THREE.SphereGeometry(0.138, 18, 14), hm, new THREE.Vector3(0, 0.13, -0.012), new THREE.Vector3(1, 0.88, 1));
    else {
      const cap = attach('Head', new THREE.SphereGeometry(style === 'rases' ? 0.107 : 0.11, 24, 14, 0, Math.PI * 2, 0, Math.PI * (style === 'rases' ? 0.56 : 0.6)), hm, new THREE.Vector3(0, 0.126, -0.012), new THREE.Vector3(1.02, style === 'rases' ? 0.96 : 1.02, 1.08)); cap.rotation.x = -0.38;   // calotte inclinée : front dégagé, nuque couverte
      if (style === 'longs') attach('Head', new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), hm, new THREE.Vector3(0, 0.02, -0.07), new THREE.Vector3(1.25, 1, 0.65));
      if (style === 'queue') attach('Head', new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), hm, new THREE.Vector3(0, 0.07, -0.13), one);
    }
  }
  if (look?.glasses) { const gm = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.4, metalness: 0.3 }); const lens = new THREE.TorusGeometry(0.022, 0.0035, 6, 16); const g = new THREE.Group(); for (const sx of [-0.033, 0.033]) { const l = new THREE.Mesh(lens, gm); l.position.x = sx; g.add(l); } const br = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.004), gm); g.add(br);
    const hb = bone('Head'); const eye = bones.find(x => x.name === 'LeftEye'); const wp = eye ? eye.getWorldPosition(new THREE.Vector3()) : hb.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.03, 0.07, 0.09)); wp.x = hb.getWorldPosition(new THREE.Vector3()).x; wp.z += 0.035; const ws = hb.getWorldScale(new THREE.Vector3()).x || 1; g.position.copy(hb.worldToLocal(wp)); g.scale.setScalar(1 / ws); hb.add(g); }
  if (look?.skirt) { const sm = new THREE.MeshStandardMaterial({ color: o.jeans, roughness: 0.9, side: THREE.DoubleSide, map: fabric(false) }); attach('Hips', new THREE.CylinderGeometry(0.2, 0.3, 0.46, 16, 1, true), sm, new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(1, 1, 1)); }
  if (o.hood) attach('Neck', new THREE.SphereGeometry(0.115, 16, 10), new THREE.MeshStandardMaterial({ color: o.hoodie, roughness: 0.9, map: fabric(false) }), new THREE.Vector3(0, 0.005, -0.085), new THREE.Vector3(1.15, 0.55, 0.7));
}
