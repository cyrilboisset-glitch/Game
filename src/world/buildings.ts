import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder';
import { area, obb, type Pt } from './geom';
import type { Build } from './data';
import { rnd } from './textures';

const PLASTER = ['#f1e8d6', '#e6d3b0', '#d9bf98', '#efe0c4', '#c9c4bb', '#e8cfc0', '#d8d9cf', '#f3efe6', '#d6b79a', '#c7b79d'].map(c => new THREE.Color(c));
const FLOOR_H = 3.0, BAY = 3.8;
// cases de l'atlas (origine en bas à gauche, coordonnées v inversées par rapport au canvas)
const CELL = { win: [0, 1], shut: [1, 1], lit: [2, 1], plain: [3, 1], door: [0, 0], shop: [1, 0] } as const;
const cell = (k: keyof typeof CELL, u: number, v: number) => [(CELL[k][0] + u) / 4, (CELL[k][1] + v) / 2];

export interface BuildBuilders { wall: MeshBuilder; roof: MeshBuilder; flat: MeshBuilder; }

function wallRun(B: BuildBuilders, p: Pt[], h: number, floors: number, col: THREE.Color, seedv: number) {
  // le polygone doit être anti-horaire dans le plan (x, -z) pour que les normales sortent
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.3) continue;
    const bays = Math.max(1, Math.round(len / BAY));
    const doorBay = (seedv + i) % Math.max(1, bays);
    for (let f = 0; f < floors; f++) {
      const y0 = f * (h / floors), y1 = (f + 1) * (h / floors);
      for (let k = 0; k < bays; k++) {
        const t0 = k / bays, t1 = (k + 1) / bays;
        let kind: keyof typeof CELL = 'win';
        if (len < 2.2) kind = 'plain';
        else if (f === 0 && i % 3 === 0 && k === doorBay) kind = 'door';
        else if (f === 0 && floors > 1 && (seedv + i + k) % 9 === 0 && len > 6) kind = 'shop';
        else if (((seedv >> 3) + i + k + f) % 5 === 0) kind = 'shut';
        else if (((seedv * 7 + i * 3 + k * 5 + f * 11) % 10) < 4) kind = 'lit';
        const A = [a[0] + (b[0] - a[0]) * t0, y0, a[1] + (b[1] - a[1]) * t0], Bp = [a[0] + (b[0] - a[0]) * t1, y0, a[1] + (b[1] - a[1]) * t1];
        const C = [Bp[0], y1, Bp[2]], D = [A[0], y1, A[2]];
        // le plan x/z : normale vers l'extérieur ⇒ ordre A, B, C, D (dépend de l'orientation ; polygone normalisé avant)
        B.wall.planar([A, Bp, C, D], [cell(kind, 0, 0), cell(kind, 1, 0), cell(kind, 1, 1), cell(kind, 0, 1)], col);
      }
    }
  }
}

function gableTri(B: BuildBuilders, a: number[], b: number[], m: number[], out: [number, number], col: THREE.Color) {
  // triangle de pignon, normale orientée vers l'extérieur (out = direction x/z)
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [m[0] - a[0], m[1] - a[1], m[2] - a[2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  let tri = [a, b, m];
  if (n[0] * out[0] + n[2] * out[1] < 0) { tri = [b, a, m]; n = n.map(v => -v); }
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  const uv = [cell('plain', 0.1, 0.1), cell('plain', 0.9, 0.1), cell('plain', 0.5, 0.9)];
  const i = tri.map((q, k) => B.wall.vert(q[0], q[1], q[2], n[0] / l, n[1] / l, n[2] / l, uv[k][0], uv[k][1], col));
  B.wall.tri(i[0], i[1], i[2]);
}

function gable(B: BuildBuilders, p: Pt[], h: number, roofCol: THREE.Color, wallCol: THREE.Color) {
  const o = obb(p); const c = Math.cos(o.ang), s = Math.sin(o.ang);
  const w = o.maxX - o.minX, d = o.maxY - o.minY;
  const along = w >= d; // faîtage le long du grand côté
  const ov = 0.35;
  const W = (u: number, v: number): Pt => [u * c - v * s, u * s + v * c];  // inverse de la rotation de obb()
  const P = (u: number, v: number, y: number) => { const q = W(u, v); return [q[0], y, q[1]]; };
  const u0 = o.minX - ov, u1 = o.maxX + ov, v0 = o.minY - ov, v1 = o.maxY + ov;
  const rh = Math.min(w, d) * 0.32 + 0.6;
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const dirU = W(1, 0), dirV = W(0, 1);
  if (along) {
    const r0 = P(u0, vm, h + rh), r1 = P(u1, vm, h + rh);
    const len = u1 - u0, sl = Math.hypot(vm - v0, rh);
    const uvs = [[0, 0], [len / 5, 0], [len / 5, sl / 3.2], [0, sl / 3.2]];
    B.roof.planar([P(u0, v0, h), P(u1, v0, h), r1, r0], uvs, roofCol);
    B.roof.planar([P(u1, v1, h), P(u0, v1, h), r0, r1], uvs, roofCol);
    gableTri(B, P(o.minX, o.minY, h), P(o.minX, o.maxY, h), P(o.minX, vm, h + rh), [-dirU[0], -dirU[1]], wallCol);
    gableTri(B, P(o.maxX, o.minY, h), P(o.maxX, o.maxY, h), P(o.maxX, vm, h + rh), [dirU[0], dirU[1]], wallCol);
  } else {
    const r0 = P(um, v0, h + rh), r1 = P(um, v1, h + rh);
    const len = v1 - v0, sl = Math.hypot(um - u0, rh);
    const uvs = [[0, 0], [len / 5, 0], [len / 5, sl / 3.2], [0, sl / 3.2]];
    B.roof.planar([P(u1, v0, h), P(u1, v1, h), r1, r0], uvs, roofCol);
    B.roof.planar([P(u0, v1, h), P(u0, v0, h), r0, r1], uvs, roofCol);
    gableTri(B, P(o.minX, o.minY, h), P(o.maxX, o.minY, h), P(um, o.minY, h + rh), [-dirV[0], -dirV[1]], wallCol);
    gableTri(B, P(o.minX, o.maxY, h), P(o.maxX, o.maxY, h), P(um, o.maxY, h + rh), [dirV[0], dirV[1]], wallCol);
  }
}

function flatRoof(B: BuildBuilders, p: Pt[], h: number) {
  const contour = p.map(q => new THREE.Vector2(q[0], q[1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const base = B.flat.count;
  for (const q of p) B.flat.vert(q[0], h, q[1], 0, 1, 0, q[0] / 4, q[1] / 4, null);
  for (const t of tris) B.flat.tri(base + t[0], base + t[2], base + t[1]);
}

/** Génère les géométries d'un bâtiment dans les builders du chunk. Retourne false si polygone inutilisable. */
export function addBuilding(B: BuildBuilders, b: Build, idx: number) {
  let p = b.p.slice(0, -1) as Pt[]; if (p.length < 3) return false;
  const a = area(p); if (Math.abs(a) < 6) return false;
  // orientation : normales sortantes (le plan x/z est vu de dessus avec z vers le sud ⇒ orientation inversée)
  if (a > 0) p = p.slice().reverse();
  const floors = b.l > 0 ? b.l : (b.h > 0 ? Math.max(1, Math.round(b.h / FLOOR_H)) : (Math.abs(a) > 600 ? 2 : (rnd() < 0.55 ? 2 : 3)));
  const h = b.h > 0 ? b.h : floors * FLOOR_H;
  const col = PLASTER[idx % PLASTER.length].clone().multiplyScalar(0.92 + rnd() * 0.12);
  wallRun(B, p, h, floors, col, idx);
  const o = obb(p); const fill = Math.abs(a) / Math.max(1, o.a);
  const useGable = Math.abs(a) < 420 && fill > 0.8 && p.length <= 10 && floors <= 4 && rnd() < 0.85;
  if (useGable) { gable(B, p, h, new THREE.Color().setHSL(0.03 + rnd() * 0.03, 0.2 + rnd() * 0.25, 0.65 + rnd() * 0.35), col); }
  else flatRoof(B, p, h);
  return true;
}
