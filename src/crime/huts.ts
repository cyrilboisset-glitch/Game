// Petits bâtiments fictifs du milieu : box de garage (receleur, garage loué) et cabanon en bois (squat). Placés sur des emplacements neutres.
import * as THREE from 'three';

const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
let doorTex: THREE.Texture | undefined, woodTex: THREE.Texture | undefined, glowTex: THREE.Texture | undefined, concTex: THREE.Texture | undefined;
const rollDoor = () => (doorTex ??= canvasTex(128, 128, g => { g.fillStyle = '#8d9296'; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 8) { g.fillStyle = '#6f7478'; g.fillRect(0, y, 128, 2); g.fillStyle = '#a5aaae'; g.fillRect(0, y + 2, 128, 1); } g.fillStyle = 'rgba(60,40,20,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, 100 + Math.random() * 28, 3, 2); }));
const planks = () => (woodTex ??= canvasTex(128, 128, g => { for (let x = 0; x < 128; x += 16) { const v = 90 + Math.random() * 30; g.fillStyle = `rgb(${v},${v * 0.72},${v * 0.48})`; g.fillRect(x, 0, 16, 128); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 1.5, 128); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(40,25,10,0.15)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 8 + Math.random() * 20); } }));
const concrete = () => (concTex ??= canvasTex(128, 128, g => { g.fillStyle = '#9b9a94'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 120 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v - 6},0.25)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } g.fillStyle = 'rgba(70,60,50,0.25)'; g.fillRect(0, 110, 128, 18); }));
const glow = () => (glowTex ??= canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,200,130,0.85)'); r.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));

export type HutStyle = 'box' | 'cabanon';
/** Construit la cabane : retourne sa boîte de collision (centre, cap, demi-longueur, demi-largeur) et le point devant la porte. */
export function buildHut(scene: THREE.Scene, x: number, z: number, h: number, style: HutStyle, neon?: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = h; const W = style === 'box' ? 3.4 : 2.6, D = style === 'box' ? 5.6 : 2.6, H = style === 'box' ? 2.7 : 2.3;
  const wallMat = style === 'box' ? new THREE.MeshStandardMaterial({ map: concrete(), roughness: 0.95 }) : new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat); body.position.y = H / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const roof = style === 'box' ? new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, D + 0.3), new THREE.MeshStandardMaterial({ color: 0x5a5c5e, roughness: 0.8 })) : new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.08, D + 0.6), new THREE.MeshStandardMaterial({ color: 0x3b3f3a, roughness: 0.9 }));
  roof.position.y = H + 0.06; if (style === 'cabanon') { roof.rotation.x = 0.18; roof.position.y = H + 0.1; } roof.castShadow = true; g.add(roof);
  // porte côté +Z local (vers la voie)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(style === 'box' ? 2.6 : 0.9, style === 'box' ? 2.2 : 1.9), style === 'box' ? new THREE.MeshStandardMaterial({ map: rollDoor(), emissiveMap: rollDoor(), emissive: 0x6a5238, roughness: 0.6, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0x4a3420, emissive: 0x3a2814, roughness: 0.85 }));
  door.position.set(0, style === 'box' ? 1.1 : 0.95, D / 2 + 0.01); g.add(door);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc070, emissiveIntensity: 2.5 }); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), lampMat); lamp.position.set(style === 'box' ? 1.45 : 0.75, H - 0.25, D / 2 + 0.07); g.add(lamp);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })); pool.position.set(0.6, 0.04, D / 2 + 1.8); g.add(pool);
  if (neon !== undefined) { const n = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 3 })); n.position.set(0, H - 0.08, D / 2 + 0.04); g.add(n); }
  scene.add(g);
  const fx = Math.sin(h), fz = Math.cos(h);
  return { box: { x, z, h, hl: D / 2, hw: W / 2 }, door: { x: x + fx * (D / 2 + 1.6), z: z + fz * (D / 2 + 1.6) } };
}
/** Choisit où poser la cabane à côté d'un point de voie : la direction la plus éloignée des routes. Retourne centre et cap (porte tournée vers le point). */
export function siteFor(px: number, pz: number, roadDist: (x: number, z: number) => number, blocked: (x: number, z: number) => boolean) {
  let best = { x: px + 6, z: pz, h: -Math.PI / 2, s: -1 };
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const x = px + Math.sin(a) * 6.5, z = pz + Math.cos(a) * 6.5; if (blocked(x, z)) continue; const s = roadDist(x, z); if (s > best.s) best = { x, z, h: a + Math.PI, s }; }
  return best;
}
