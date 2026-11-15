import * as THREE from 'three';
import { MeshBuilder } from '../world/meshbuilder';
import * as TX from '../world/textures';
import type { Layout } from './generator';

const floors: Partial<Record<string, TX.PBR>> = {}; let plasterT: TX.PBR | undefined;

/** Construit la scène 3D d'un intérieur (murs et meubles fusionnés : 3 draw calls + lumières). */
export function buildInterior(l: Layout): THREE.Scene {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x14171c);
  plasterT ??= TX.plaster(); const ft = (floors[l.floor] ??= TX.floorTex(l.floor));
  // sol
  const fl = new MeshBuilder(); const x0 = -0.2, x1 = l.W + 0.2, z0 = -0.2, z1 = l.D + 1.2, k = 0.5;
  fl.planar([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [[x0 * k, z1 * k], [x1 * k, z1 * k], [x1 * k, z0 * k], [x0 * k, z0 * k]], null);
  const fm = new THREE.MeshStandardMaterial({ map: ft.map.clone(), normalMap: ft.normalMap.clone(), roughness: l.floor === 'carrelage' ? 0.35 : 0.7 }); [fm.map!, fm.normalMap!].forEach(t => { t.needsUpdate = true; });
  const floorMesh = new THREE.Mesh(fl.build()!, fm); floorMesh.receiveShadow = false; scene.add(floorMesh);
  // plafond
  const cb = new MeshBuilder(); cb.planar([[x0, l.H, z0], [x1, l.H, z0], [x1, l.H, z1 - 1.2], [x0, l.H, z1 - 1.2]], [[0, 0], [1, 0], [1, 1], [0, 1]], null);
  scene.add(new THREE.Mesh(cb.build()!, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0xf4f1ea, emissiveIntensity: 0.55, roughness: 1, side: THREE.DoubleSide })));
  // murs + meubles : une couleur par boîte
  const mb = new MeshBuilder(); const panels = new MeshBuilder();
  const bulky = new Set(['tv', 'console', 'pc']);
  for (const b of l.boxes) { if (b.tag && bulky.has(b.tag)) { const o = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.4, metalness: 0.2 })); o.position.set(b.x, b.y + b.h / 2, b.z); o.userData.bulky = b.tag; scene.add(o); continue; } mb.box(b.x, b.z, b.w, b.d, b.h, b.y, new THREE.Color(b.color)); }
  for (const p of l.lights) panels.box(p.x, p.z, 1.2, 0.5, 0.04, l.H - 0.05, new THREE.Color(1, 1, 1));
  scene.add(new THREE.Mesh(mb.build()!, new THREE.MeshStandardMaterial({ map: plasterT.map, normalMap: plasterT.normalMap, vertexColors: true, roughness: 0.85 })));
  scene.add(new THREE.Mesh(panels.build()!, new THREE.MeshBasicMaterial({ color: 0xfff4d8 })));
  // « dehors » vu par la porte : un panneau lumineux
  const out = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: 0xcfe2f5 })); out.position.set(l.W / 2, 2, l.D + 3); out.rotation.y = Math.PI; scene.add(out);
  // éclairage
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x706a60, 0.9));
  l.lights.slice(0, 4).forEach(p => { const pl = new THREE.PointLight(0xffe2b8, 14, 16, 1.6); pl.position.set(p.x, l.H - 0.4, p.z); scene.add(pl); });
  // repères d'interaction
  const m = new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.85, depthTest: false });
  for (const s of l.spots) { if (s.kind === 'sortie') continue; const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m); d.position.set(s.x, 1.15, s.z); d.renderOrder = 10; d.userData.spot = s.id; scene.add(d); }
  return scene;
}
