import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder';
import { ribbon, slice, length, type Pt } from './geom';
import type { Road } from './data';

export const ROAD_W: Record<string, number> = { motorway: 12, motorway_link: 7, trunk: 10, primary: 9, secondary: 8, tertiary: 7, unclassified: 6, residential: 6, living_street: 5, service: 4, track: 3 };
export const PATH_TYPES = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps']);
const RANK: Record<string, number> = { motorway: 4, trunk: 4, primary: 3, secondary: 3, tertiary: 2, unclassified: 1, residential: 1, living_street: 1, motorway_link: 3, service: 0, track: 0 };
const MARKED = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link']);
const SIDEWALK = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
export const SW_W = 2.0, SW_H = 0.14;

export interface RoadBuilders { marked: MeshBuilder; plain: MeshBuilder; paving: MeshBuilder; gravel: MeshBuilder; marks: MeshBuilder; }

const key = (p: Pt) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;

/** Index des jonctions : nœud → routes (largeur) qui le traversent. */
export function junctions(roads: Road[]) {
  const m = new Map<string, { i: number; w: number }[]>();
  roads.forEach((r, i) => {
    const w = ROAD_W[r.t]; if (!w || r.t === 'service' || r.t === 'track') return;   // les entrées de garage ne coupent pas le trottoir
    for (const p of r.p) { const k = key(p), l = m.get(k) ?? []; if (!l.some(e => e.i === i)) l.push({ i, w }); m.set(k, l); }
  });
  return m;
}

/** Coupe une polyligne aux lignes de la grille de chunks. Retourne des morceaux partageant leurs sommets de coupe. */
export function splitGrid(p: Pt[], size: number): Pt[][] {
  const out: Pt[][] = []; let cur: Pt[] = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1]; const ts: number[] = [];
    for (const ax of [0, 1]) {
      const ka = Math.floor(a[ax] / size), kb = Math.floor(b[ax] / size);
      for (let k = Math.min(ka, kb) + 1; k <= Math.max(ka, kb); k++) ts.push((k * size - a[ax]) / (b[ax] - a[ax]));
    }
    ts.sort((x, y) => x - y);
    for (const t of ts) { if (t <= 0 || t >= 1) continue; const q: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; cur.push(q); out.push(cur); cur = [q]; }
    cur.push(b);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

export function addStrip(B: MeshBuilder, p: Pt[], half: number, y: number, vScale: number, v0 = 0) {
  if (p.length < 2) return;
  const { L, R } = ribbon(p, half); let s = v0; const base = B.count;
  for (let i = 0; i < p.length; i++) {
    if (i) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    B.vert(L[i][0], y, L[i][1], 0, 1, 0, 0, s / vScale, null); B.vert(R[i][0], y, R[i][1], 0, 1, 0, 1, s / vScale, null);
  }
  for (let i = 0; i < p.length - 1; i++) { const a = base + i * 2; B.tri(a, a + 3, a + 1); B.tri(a, a + 2, a + 3); }
}

/** Trottoir surélevé d'un côté (side = +1 gauche / -1 droite) avec bordure verticale. */
function addSidewalk(B: MeshBuilder, p: Pt[], half: number, side: 1 | -1, y0: number) {
  if (p.length < 2) return;
  const inner = ribbon(p, half), outer = ribbon(p, half + SW_W);
  const A = side > 0 ? inner.L : inner.R, O = side > 0 ? outer.L : outer.R;
  let s = 0; const top0 = B.count; const nrm = side > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    if (i) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    B.vert(A[i][0], y0 + SW_H, A[i][1], 0, 1, 0, 0, s / 2, null); B.vert(O[i][0], y0 + SW_H, O[i][1], 0, 1, 0, 1, s / 2, null);
  }
  for (let i = 0; i < p.length - 1; i++) { const a = top0 + i * 2; if (nrm > 0) { B.tri(a, a + 1, a + 3); B.tri(a, a + 3, a + 2); } else { B.tri(a, a + 3, a + 1); B.tri(a, a + 2, a + 3); } }
  // bordure
  const c0 = B.count; s = 0;
  for (let i = 0; i < p.length; i++) {
    if (i) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const dx = i < p.length - 1 ? p[i + 1][0] - p[i][0] : p[i][0] - p[i - 1][0], dz = i < p.length - 1 ? p[i + 1][1] - p[i][1] : p[i][1] - p[i - 1][1];
    const l = Math.hypot(dx, dz) || 1; const nx = (dz / l) * -side * -1, nz = (-dx / l) * -side * -1;
    B.vert(A[i][0], y0, A[i][1], nx, 0, nz, 0.02, s / 2, null); B.vert(A[i][0], y0 + SW_H, A[i][1], nx, 0, nz, 0.06, s / 2, null);
  }
  for (let i = 0; i < p.length - 1; i++) { const a = c0 + i * 2; B.tri(a, a + 1, a + 3); B.tri(a, a + 3, a + 2); }
}

/** Ajoute une route (déjà découpée par chunk). `cuts` = intervalles d'abscisse à exclure du trottoir. */
export function addRoadPiece(B: RoadBuilders, r: Road, piece: Pt[], cuts: [number, number][], sBase: number) {
  if (PATH_TYPES.has(r.t)) { addStrip(B.paving, piece, 1.0, 0.04, 2); return; }
  const w = ROAD_W[r.t]; if (!w) return;
  const y = 0.03 + (RANK[r.t] ?? 0) * 0.012;
  addStrip(MARKED.has(r.t) ? B.marked : B.plain, piece, w / 2, y, 8, sBase);
  if (!SIDEWALK.has(r.t)) return;
  const total = length(piece);
  // passages piétons (bandes blanches) à l'entrée des carrefours des grands axes
  if (MARKED.has(r.t)) for (const [c0, c1] of cuts) for (const sAt of [c0 - sBase + 0.6, c1 - sBase - 3.1]) {
    if (sAt < 0 || sAt + 2.5 > total) continue; const seg = slice(piece, sAt, sAt + 2.5); if (seg.length < 2) continue; const a = seg[0], b = seg[seg.length - 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l, nx = -dz, nz = dx;
    for (let o = -w / 2 + 0.5; o <= w / 2 - 0.5; o += 1.0) { const P = (t: number, q: number) => [a[0] + dx * t + nx * q, y + 0.006, a[1] + dz * t + nz * q]; B.marks.planar([P(0, o + 0.25), P(2.5, o + 0.25), P(2.5, o - 0.25), P(0, o - 0.25)], [[0, 0], [1, 0], [1, 1], [0, 1]], null); }
  } let free: [number, number][] = [[0, total]];
  for (const [c0, c1] of cuts) {
    const a = c0 - sBase, b = c1 - sBase; const next: [number, number][] = [];
    for (const [f0, f1] of free) { if (b <= f0 || a >= f1) next.push([f0, f1]); else { if (a > f0) next.push([f0, a]); if (b < f1) next.push([b, f1]); } }
    free = next;
  }
  for (const [f0, f1] of free) {
    if (f1 - f0 < 1.2) continue; const sub = slice(piece, f0, f1);
    addSidewalk(B.paving, sub, w / 2, 1, 0.0); addSidewalk(B.paving, sub, w / 2, -1, 0.0);
  }
}

/** Intervalles (abscisse curviligne) autour des jonctions où le trottoir est interrompu. */
export function sidewalkCuts(r: Road, idx: number, J: Map<string, { i: number; w: number }[]>): [number, number][] {
  const cuts: [number, number][] = []; let s = 0;
  for (let i = 0; i < r.p.length; i++) {
    if (i) s += Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]);
    const others = (J.get(key(r.p[i])) ?? []).filter(e => e.i !== idx);
    if (others.length) { const rad = Math.max(...others.map(e => e.w)) / 2 + 2.2; cuts.push([s - rad, s + rad]); }
  }
  return cuts;
}

export function addRail(B: MeshBuilder, p: Pt[]) { addStrip(B, p, 1.9, 0.06, 2.2); }
export const roadRanks = RANK;
export const asThree = THREE;
