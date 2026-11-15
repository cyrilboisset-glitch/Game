import * as THREE from 'three';
import * as TX from './textures';

/** Sol naturel : deux échelles de texture (casse la répétition) + variations de teinte (herbe grasse / sèche / sombre) selon la position. */
function naturalGround(m: THREE.MeshStandardMaterial, strength = 1) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(gh(i), gh(i+vec2(1,0)), u.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 t1 = texture2D(map, vMapUv); vec4 t2 = texture2D(map, vMapUv * 0.27 + vec2(0.31, 0.17));
  diffuseColor *= mix(t1, t2, 0.5);
  float nn = gn(vWP.xz * 0.011) * 0.6 + gn(vWP.xz * 0.043) * 0.4; float fine = gn(vWP.xz * 0.27);
  vec3 lush = vec3(0.70, 0.80, 0.52), dry = vec3(0.95, 0.86, 0.60), dark = vec3(0.50, 0.62, 0.40);
  vec3 tint = mix(lush, dry, smoothstep(0.45, 0.8, nn)); tint = mix(tint, dark, smoothstep(0.55, 0.15, nn) * 0.6);
  diffuseColor.rgb *= mix(vec3(1.0), tint * (0.86 + fine * 0.26), ${strength.toFixed(2)});
#endif`);
  };
}
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
  const wn = TX.waterNormal(); wn.repeat.set(0.08, 0.08); const water = std({ color: 0x2c4f5c, roughness: 0.12, metalness: 0.15, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bark = std({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const leaves = std({ map: TX.leaf(), alphaTest: 0.42, alphaToCoverage: true, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const hedgeT = TX.leaf(); const hedge = std({ map: TX.hedgeTex(), vertexColors: true, roughness: 0.95 }); void hedgeT;
  const metal = std({ color: 0x40444a, metalness: 0.6, roughness: 0.5, vertexColors: true, side: THREE.DoubleSide });
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0, side: THREE.DoubleSide });
  const groundTex = TX.grass(); groundTex.map.repeat.set(600, 600); groundTex.normalMap.repeat.set(600, 600);
  const ground = std({ map: groundTex.map, normalMap: groundTex.normalMap, roughness: 1, color: 0xffffff }); naturalGround(ground); naturalGround(greens, 0.8);
  const marks = std({ color: 0xe9e9e2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
  return { marks, wall, roof, flat, asphaltMarked, asphalt, pavement, gravel, greens, water, bark, leaves, metal, lampHead, ground, hedge };
}
export type Materials = ReturnType<typeof createMaterials>;
