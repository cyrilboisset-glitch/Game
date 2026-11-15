import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder';
import { rnd } from './textures';
import { orientedBox } from './buildings';

const TRUNK = new THREE.Color('#5e4632'), TRUNK2 = new THREE.Color('#7a6a5a');
/** Quad orienté (feuillage) avec normale imposée (normale « sphérique » du houppier → éclairage doux et volumique). */
function card(b: MeshBuilder, cx: number, cy: number, cz: number, size: number, rx: number, ry: number, n: THREE.Vector3, col: THREE.Color, uvo: number) {
  const e = new THREE.Euler(rx, ry, rnd() * 3); const u = new THREE.Vector3(size / 2, 0, 0).applyEuler(e), v = new THREE.Vector3(0, size / 2, 0).applyEuler(e);
  const P = (a: number, c: number) => [cx + u.x * a + v.x * c, cy + u.y * a + v.y * c, cz + u.z * a + v.z * c];
  const ps = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], uv = [[uvo, 0], [uvo + 0.5, 0], [uvo + 0.5, 1], [uvo, 1]]; const base = b.count;
  ps.forEach((p, i) => b.vert(p[0], p[1], p[2], n.x, n.y, n.z, uv[i][0], uv[i][1], col)); b.quad(base, base + 1, base + 2, base + 3);
}
function cylinder(b: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number, col: THREE.Color, n = 6) {
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize(); const a = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); const u = new THREE.Vector3().crossVectors(d, a).normalize(), w = new THREE.Vector3().crossVectors(d, u);
  const base = b.count; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2; const nx = u.x * Math.cos(t) + w.x * Math.sin(t), ny = u.y * Math.cos(t) + w.y * Math.sin(t), nz = u.z * Math.cos(t) + w.z * Math.sin(t); b.vert(x0 + nx * r0, y0 + ny * r0, z0 + nz * r0, nx, ny, nz, i / n, 0, col); b.vert(x1 + nx * r1, y1 + ny * r1, z1 + nz * r1, nx, ny, nz, i / n, 1, col); }
  for (let i = 0; i < n; i++) { const k = base + i * 2; b.tri(k, k + 2, k + 1); b.tri(k + 1, k + 2, k + 3); }
}

/** Feuillu : tronc, 3-4 branches maîtresses, houppier fait de ~16 cartes de feuillage (texture alpha) réparties dans un ellipsoïde. */
export function addTree(trunk: MeshBuilder, crown: MeshBuilder, x: number, z: number, s: number) {
  const th = (2.2 + rnd() * 0.8) * s, tr = 0.16 * s; cylinder(trunk, x, 0, z, x, th, z, tr, tr * 0.7, TRUNK);
  const hue = new THREE.Color().setHSL(0.2 + rnd() * 0.09, 0.35 + rnd() * 0.2, 0.3 + rnd() * 0.1); const R = (1.8 + rnd() * 0.8) * s, H = R * (1.1 + rnd() * 0.4), cy = th + H * 0.55;
  for (let k = 0; k < 4; k++) { const a = rnd() * 6.28; cylinder(trunk, x, th * 0.85, z, x + Math.cos(a) * R * 0.55, th + H * (0.3 + rnd() * 0.3), z + Math.sin(a) * R * 0.55, tr * 0.5, tr * 0.2, TRUNK, 4); }
  const n = 18; for (let k = 0; k < n; k++) {
    const u = rnd() * 2 - 1, phi = rnd() * 6.28, rr = Math.cbrt(rnd()) * 0.75 + 0.25; const dx = Math.sqrt(1 - u * u) * Math.cos(phi), dy = u, dz = Math.sqrt(1 - u * u) * Math.sin(phi);
    const px = x + dx * R * rr * 0.85, py = cy + dy * H * 0.5 * rr, pz = z + dz * R * rr * 0.85; const nn = new THREE.Vector3(dx, dy * 0.8 + 0.25, dz).normalize();
    const c = hue.clone().multiplyScalar(0.75 + (dy * 0.5 + 0.5) * 0.45 + rnd() * 0.08); card(crown, px, py, pz, (1.5 + rnd() * 0.9) * s, rnd() * 3, rnd() * 3, nn, c, rnd() < 0.5 ? 0 : 0.5);
  }
}
/** Conifère : tronc + étages de cartes inclinées (silhouette conique). */
export function addConifer(trunk: MeshBuilder, crown: MeshBuilder, x: number, z: number, s: number) {
  const h = (7 + rnd() * 5) * s; cylinder(trunk, x, 0, z, x, h * 0.95, z, 0.2 * s, 0.05, TRUNK);
  const col = new THREE.Color().setHSL(0.33 + rnd() * 0.04, 0.35, 0.18 + rnd() * 0.06); const layers = 7;
  for (let l = 0; l < layers; l++) { const f = l / (layers - 1); const y = h * (0.22 + f * 0.72), r = (1 - f) * 2.1 * s + 0.35; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + l; const nn = new THREE.Vector3(Math.cos(a), 0.55, Math.sin(a)).normalize(); card(crown, x + Math.cos(a) * r * 0.45, y, z + Math.sin(a) * r * 0.45, r * 1.25 + 0.4, -0.9, -a + Math.PI / 2, nn, col.clone().multiplyScalar(0.8 + f * 0.35), 0.5); } }
}
/** Arbuste de jardin. */
export function addBush(crown: MeshBuilder, x: number, z: number, s: number) {
  const hue = new THREE.Color().setHSL(0.22 + rnd() * 0.1, 0.4, 0.26 + rnd() * 0.1); for (let k = 0; k < 7; k++) { const a = rnd() * 6.28, r = rnd() * 0.5 * s; const nn = new THREE.Vector3(Math.cos(a), 0.7, Math.sin(a)).normalize(); card(crown, x + Math.cos(a) * r, 0.45 * s + rnd() * 0.35 * s, z + Math.sin(a) * r, (0.9 + rnd() * 0.5) * s, rnd() * 3, rnd() * 3, nn, hue.clone().multiplyScalar(0.8 + rnd() * 0.3), rnd() < 0.5 ? 0 : 0.5); }
}
const HEDGE = new THREE.Color('#3d5a2c'), WALL = new THREE.Color('#bdb3a2'), GRILLE = new THREE.Color('#2a2c2e');
/** Clôture de propriété le long de la rue : haie taillée, ou muret + grille. (ax,az)→(bx,bz). */
export function addFence(hedges: MeshBuilder, solids: MeshBuilder, poles: MeshBuilder, ax: number, az: number, bx: number, bz: number, kind: 'haie' | 'muret') {
  const l = Math.hypot(bx - ax, bz - az); if (l < 1) return; const dx = (bx - ax) / l, dz = (bz - az) / l, nx = -dz, nz = dx;
  const box = (b: MeshBuilder, w: number, h: number, y0: number, col: THREE.Color) => { const P = (s: number, o: number, y: number) => [ax + dx * s + nx * o, y, az + dz * s + nz * o]; const o = w / 2;
    b.planar([P(0, o, y0), P(l, o, y0), P(l, o, y0 + h), P(0, o, y0 + h)], [[0, 0], [l / 2, 0], [l / 2, h / 2], [0, h / 2]], col); b.planar([P(l, -o, y0), P(0, -o, y0), P(0, -o, y0 + h), P(l, -o, y0 + h)], [[0, 0], [l / 2, 0], [l / 2, h / 2], [0, h / 2]], col);
    b.planar([P(0, -o, y0 + h), P(0, o, y0 + h), P(l, o, y0 + h), P(l, -o, y0 + h)], [[0, 0], [w / 2, 0], [w / 2, l / 2], [0, l / 2]], col.clone().multiplyScalar(1.1)); b.planar([P(0, -o, y0), P(0, o, y0), P(0, o, y0 + h), P(0, -o, y0 + h)], [[0, 0], [1, 0], [1, 1], [0, 1]], col); b.planar([P(l, o, y0), P(l, -o, y0), P(l, -o, y0 + h), P(l, o, y0 + h)], [[0, 0], [1, 0], [1, 1], [0, 1]], col); };
  if (kind === 'haie') box(hedges, 0.75, 1.35 + rnd() * 0.3, 0, HEDGE.clone().multiplyScalar(0.85 + rnd() * 0.3));
  else { box(solids, 0.25, 0.7, 0, WALL); box(poles, 0.04, 0.6, 0.7, GRILLE); for (let s = 0; s < l; s += 2.5) { const x = ax + dx * s, z = az + dz * s; solids.box(x, z, 0.32, 0.32, 1.4, 0, WALL); } }
}

const WOOD = new THREE.Color('#7a5434'), IRON = new THREE.Color('#2b2f33'), BIN = new THREE.Color('#2f5a3a'), SIGNR = new THREE.Color('#c41e1e'), SIGNW = new THREE.Color('#f2f2f2');
/** Banc public face à la rue (fx,fz = direction vers la chaussée). */
export function addBench(solids: MeshBuilder, x: number, z: number, fx: number, fz: number) {
  const rx = fz, rz = -fx; orientedBox(solids, x, z, fx, fz, 1.7, 0.45, 0.05, 0.42, WOOD); orientedBox(solids, x - fx * 0.24, z - fz * 0.24, fx, fz, 1.7, 0.05, 0.4, 0.5, WOOD);
  for (const s2 of [-0.75, 0.75]) orientedBox(solids, x + rx * s2, z + rz * s2, fx, fz, 0.06, 0.5, 0.42, 0, IRON);
}
/** Poubelle de rue. */
export function addBin(solids: MeshBuilder, x: number, z: number) { orientedBox(solids, x, z, 1, 0, 0.45, 0.45, 0.85, 0, BIN); orientedBox(solids, x, z, 1, 0, 0.5, 0.5, 0.05, 0.85, IRON); }
/** Panneau (stop octogonal ou cédez-le-passage triangulaire), tourné vers les véhicules qui arrivent. */
export function addSign(poles: MeshBuilder, solids: MeshBuilder, x: number, z: number, fx: number, fz: number, stop: boolean) {
  cylinder(poles, x, 0, z, x, 2.3, z, 0.035, 0.035, IRON, 5); const rx = fz, rz = -fx; const n = stop ? 8 : 3, R = stop ? 0.32 : 0.42, cy = 2.25; const base = solids.count;
  solids.vert(x - fx * 0.03, cy, z - fz * 0.03, -fx, 0, -fz, 0.5, 0.5, stop ? SIGNR : SIGNW);
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 + (stop ? Math.PI / 8 : -Math.PI / 2); const px = x - fx * 0.03 + rx * Math.cos(a) * R, pz = z - fz * 0.03 + rz * Math.cos(a) * R, py = cy + Math.sin(a) * R * (stop ? 1 : -1); solids.vert(px, py, pz, -fx, 0, -fz, 0, 0, stop ? SIGNR : SIGNR); }
  for (let i = 0; i < n; i++) solids.tri(base, base + 1 + i, base + 2 + i);
  for (let i = 0; i < n; i++) solids.tri(base, base + 2 + i, base + 1 + i);
}

const GREY = new THREE.Color('#3a3d42');
/** Lampadaire : mât, console orientée vers la route (dx,dz) et tête lumineuse. */
export function addLamp(poles: MeshBuilder, heads: MeshBuilder, x: number, z: number, dx: number, dz: number) {
  cylinder(poles, x, 0, z, x, 7, z, 0.1, 0.065, GREY); poles.box(x, z, 0.3, 0.3, 0.5, 0, GREY);
  const ex = x + dx * 1.6, ez = z + dz * 1.6; cylinder(poles, x, 6.95, z, ex, 7.05, ez, 0.05, 0.04, GREY, 5);
  const hx = ex, hz = ez, L = 0.6, Wd = 0.22, ux = dx, uz = dz, vx = -dz, vz = dx; const P = (a: number, c: number, y: number) => [hx + ux * a + vx * c, y, hz + uz * a + vz * c];
  poles.planar([P(-L / 2, -Wd, 7.12), P(L / 2, -Wd, 7.12), P(L / 2, Wd, 7.12), P(-L / 2, Wd, 7.12)], [[0, 0], [1, 0], [1, 1], [0, 1]], GREY);
  heads.planar([P(-L / 2, -Wd, 6.98), P(-L / 2, Wd, 6.98), P(L / 2, Wd, 6.98), P(L / 2, -Wd, 6.98)], [[0, 0], [1, 0], [1, 1], [0, 1]], null);
}
void TRUNK2;
