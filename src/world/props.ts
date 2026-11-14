import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder';
import { rnd } from './textures';

const TRUNK = new THREE.Color('#6b5038');
/** Arbre : tronc à 6 pans + houppier fait de 3 icosaèdres déformés (feuillage = matériau texturé à alphaTest). */
export function addTree(trunk: MeshBuilder, crown: MeshBuilder, x: number, z: number, s: number) {
  const th = 2.4 * s, tr = 0.17 * s; const n = 6; const b = trunk.count;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), si = Math.sin(a); trunk.vert(x + c * tr, 0, z + si * tr, c, 0, si, i / n, 0, TRUNK); trunk.vert(x + c * tr * 0.7, th, z + si * tr * 0.7, c, 0.2, si, i / n, 1, TRUNK); }
  for (let i = 0; i < n; i++) { const k = b + i * 2; trunk.tri(k, k + 2, k + 1); trunk.tri(k + 1, k + 2, k + 3); }
  const hue = new THREE.Color().setHSL(0.24 + rnd() * 0.07, 0.4 + rnd() * 0.2, 0.28 + rnd() * 0.14);
  const blobs: [number, number, number, number][] = [[0, th + 1.5 * s, 0, 1.9 * s], [0.8 * s, th + 0.8 * s, 0.3 * s, 1.3 * s], [-0.6 * s, th + 1.1 * s, -0.6 * s, 1.4 * s]];
  for (const [ox, oy, oz, r] of blobs) {
    const rings = 5, segs = 7; const base = crown.count;
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
      const phi = i / rings * Math.PI, th2 = j / segs * Math.PI * 2; const rr = r * (0.85 + rnd() * 0.3);
      const nx = Math.sin(phi) * Math.cos(th2), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th2);
      const c = hue.clone().multiplyScalar(0.8 + ny * 0.3 + rnd() * 0.1);
      crown.vert(x + ox + nx * rr, oy + ny * rr * 0.85, z + oz + nz * rr, nx, ny, nz, j / segs * 3, i / rings * 3, c);
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = base + i * (segs + 1) + j; crown.tri(a, a + segs + 1, a + 1); crown.tri(a + 1, a + segs + 1, a + segs + 2); }
  }
}

const GREY = new THREE.Color('#3a3d42');
/** Lampadaire : mât, console orientée vers la route (dx,dz) et tête lumineuse. */
export function addLamp(poles: MeshBuilder, heads: MeshBuilder, x: number, z: number, dx: number, dz: number) {
  const h = 7, r = 0.09; const n = 6; const b = poles.count;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); poles.vert(x + c * r, 0, z + s * r, c, 0, s, 0, 0, GREY); poles.vert(x + c * r * 0.7, h, z + s * r * 0.7, c, 0, s, 0, 1, GREY); }
  for (let i = 0; i < n; i++) { const k = b + i * 2; poles.tri(k, k + 2, k + 1); poles.tri(k + 1, k + 2, k + 3); }
  const ex = x + dx * 1.6, ez = z + dz * 1.6; const w = 0.1; const nx = -dz * w, nz = dx * w;
  poles.planar([[x + nx, h, z + nz], [ex + nx, h, ez + nz], [ex - nx, h, ez - nz], [x - nx, h, z - nz]], [[0, 0], [1, 0], [1, 1], [0, 1]], GREY);
  poles.planar([[x - nx, h - 0.1, z - nz], [ex - nx, h - 0.1, ez - nz], [ex + nx, h - 0.1, ez + nz], [x + nx, h - 0.1, z + nz]], [[0, 0], [1, 0], [1, 1], [0, 1]], GREY);
  const hx = ex, hz = ez, L = 0.55, Wd = 0.2;
  const ux = dx, uz = dz, vx = -dz, vz = dx;
  const P = (a: number, c: number) => [hx + ux * a + vx * c, h - 0.12, hz + uz * a + vz * c];
  heads.planar([P(-L / 2, -Wd), P(-L / 2, Wd), P(L / 2, Wd), P(L / 2, -Wd)], [[0, 0], [1, 0], [1, 1], [0, 1]], null);
}
