import * as THREE from 'three';
import * as TX from './textures';

export function createMaterials() {
  const fa = TX.facadeAtlas(), asM = TX.asphalt(true), asP = TX.asphalt(false), pv = TX.pavement(), gr = TX.grass(), gv = TX.gravel(), rt = TX.roofTiles(), fl = TX.flatRoof();
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const wall = std({ map: fa.map, normalMap: fa.normalMap, roughnessMap: fa.roughnessMap, roughness: 1, metalness: 0, vertexColors: true, normalScale: new THREE.Vector2(0.9, 0.9), emissive: 0xffffff, emissiveMap: fa.emissiveMap, emissiveIntensity: 0 });
  const roof = std({ map: rt.map, normalMap: rt.normalMap, roughness: 0.85, vertexColors: true, side: THREE.DoubleSide });
  const flat = std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.95 });
  const mk = (p: TX.PBR, rough: number, rep?: number) => { if (rep) { p.map.repeat.set(rep, 1); p.normalMap.repeat.set(rep, 1); } return std({ map: p.map, normalMap: p.normalMap, roughness: rough, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); };
  const asphaltMarked = mk(asM, 0.88), asphalt = mk(asP, 0.9);
  const pavement = mk(pv, 0.9); pavement.polygonOffsetFactor = 0; pavement.polygonOffsetUnits = 0;
  const gravel = mk(gv, 1);
  const greens = std({ map: gr.map, normalMap: gr.normalMap, roughness: 1, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const water = std({ color: 0x3f6f86, roughness: 0.08, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bark = std({ color: 0xffffff, vertexColors: true, roughness: 1 });
  const leaves = std({ map: TX.leaf(), alphaTest: 0.5, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const metal = std({ color: 0x40444a, metalness: 0.6, roughness: 0.5, vertexColors: true, side: THREE.DoubleSide });
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0, side: THREE.DoubleSide });
  const groundTex = TX.grass(); groundTex.map.repeat.set(600, 600); groundTex.normalMap.repeat.set(600, 600);
  const ground = std({ map: groundTex.map, normalMap: groundTex.normalMap, roughness: 1, color: 0xe6e0c4 });
  return { wall, roof, flat, asphaltMarked, asphalt, pavement, gravel, greens, water, bark, leaves, metal, lampHead, ground };
}
export type Materials = ReturnType<typeof createMaterials>;
