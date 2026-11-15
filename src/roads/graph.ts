import type { Road } from '../world/data';
import type { Pt } from '../world/geom';

interface Edge { to: number; w: number; off: number; ped: boolean; veh: boolean; lim: number; lane: number; vr: boolean; }
const NO_PED = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link']);
const NO_VEH = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track', 'corridor', 'bridleway']);
/** Vitesses de circulation (m/s) par type de voie. */
export const LIMIT: Record<string, number> = { motorway: 28, motorway_link: 18, trunk: 24, primary: 15, secondary: 13, tertiary: 11, unclassified: 10, residential: 8.3, living_street: 4.5, service: 5 };
const HALF: Record<string, number> = { primary: 4.5, secondary: 4, tertiary: 3.5, residential: 3, unclassified: 3, living_street: 2.5, service: 2, track: 1.5 };
const CELL = 50;

/** Graphe piéton/routier : un nœud par sommet OSM (arrondi à 0,5 m) ; A* avec cache. `off` = décalage latéral (trottoir) à droite du sens de marche. */
export class RoadGraph {
  pts: Pt[] = []; adj: Edge[][] = []; private idx = new Map<string, number>(); private grid = new Map<string, number[]>(); private cache = new Map<string, number[] | null>();
  constructor(roads: Road[]) {
    for (const r of roads) {
      const ped = !NO_PED.has(r.t), veh = !NO_VEH.has(r.t); if (!ped && !veh) continue; const off = (HALF[r.t] ?? 0) + (HALF[r.t] ? 1.4 : 0); const lim = LIMIT[r.t] ?? 8; const lane = (HALF[r.t] ?? 3) * 0.5;
      for (let i = 0; i < r.p.length - 1; i++) { const a = this.node(r.p[i]), b = this.node(r.p[i + 1]); if (a === b) continue; const w = Math.hypot(r.p[i][0] - r.p[i + 1][0], r.p[i][1] - r.p[i + 1][1]); this.adj[a].push({ to: b, w, off, ped, veh, lim, lane, vr: veh }); this.adj[b].push({ to: a, w, off, ped, veh: veh && !r.o, lim, lane, vr: veh }); }   // sens unique : le sens inverse n'est ouvert qu'aux piétons
    }
  }
  private node(p: Pt) {
    const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); let i = this.idx.get(k);
    if (i === undefined) { i = this.pts.length; this.idx.set(k, i); this.pts.push(p); this.adj.push([]); const gk = Math.floor(p[0] / CELL) + ',' + Math.floor(p[1] / CELL); const l = this.grid.get(gk); if (l) l.push(i); else this.grid.set(gk, [i]); }
    return i;
  }
  nearest(x: number, z: number, maxD = 80, vehicle = false): number {
    let best = -1, bd = maxD; const r = Math.ceil(maxD / CELL);
    for (let cx = Math.floor(x / CELL) - r; cx <= Math.floor(x / CELL) + r; cx++) for (let cz = Math.floor(z / CELL) - r; cz <= Math.floor(z / CELL) + r; cz++) for (const i of this.grid.get(cx + ',' + cz) ?? []) { if (vehicle && !this.adj[i].some(e => e.veh)) continue; const d = Math.hypot(this.pts[i][0] - x, this.pts[i][1] - z); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  /** Plus court chemin (suite de nœuds) ou null si les deux points ne sont pas connectés. */
  path(a: number, b: number, vehicle = false): number[] | null {
    if (a < 0 || b < 0) return null; if (a === b) return [a];
    const key = (vehicle ? 'v' : 'p') + a + '>' + b; if (this.cache.has(key)) return this.cache.get(key)!;
    const g = new Map<number, number>([[a, 0]]), prev = new Map<number, number>(); const heap: [number, number][] = [[0, a]]; const closed = new Set<number>();
    const h = (n: number) => Math.hypot(this.pts[n][0] - this.pts[b][0], this.pts[n][1] - this.pts[b][1]);
    const push = (f: number, n: number) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let found = false, guard = 0;
    while (heap.length && guard++ < 60000) {
      const [, n] = pop(); if (closed.has(n)) continue; if (n === b) { found = true; break; } closed.add(n);
      for (const e of this.adj[n]) { if (vehicle ? !e.veh : !e.ped) continue; const ng = g.get(n)! + e.w; if (ng < (g.get(e.to) ?? Infinity)) { g.set(e.to, ng); prev.set(e.to, n); push(ng + h(e.to), e.to); } }
    }
    let res: number[] | null = null;
    if (found) { res = [b]; while (res[0] !== a) res.unshift(prev.get(res[0])!); }
    if (this.cache.size > 5000) this.cache.clear(); this.cache.set(key, res); return res;
  }
  /** Chemin véhicule : points (2 par arête, voie de droite) + limite de vitesse par arête + nœuds. */
  vehPolyline(nodes: number[], k = 0.38): { pts: Pt[]; lim: number[]; nodes: number[] } {
    const pts: Pt[] = [], lim: number[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const A = this.pts[nodes[i]], B = this.pts[nodes[i + 1]]; const e = this.adj[nodes[i]].find(x => x.to === nodes[i + 1] && x.veh); const off = (e?.lane ?? 1.5) * (k / 0.38) + 0.15;
      const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; const nx = -dz / l * off, nz = dx / l * off;
      pts.push([A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz]); lim.push(e?.lim ?? 8);
    }
    return { pts, lim, nodes };
  }
  /** Nœud au hasard dans une couronne (utile pour faire apparaître la circulation hors du champ de vision). */
  randomNodeInRing(x: number, z: number, rmin: number, rmax: number, rnd: () => number, vehicle = true): number {
    const c: number[] = []; const r = Math.ceil(rmax / CELL);
    for (let cx = Math.floor(x / CELL) - r; cx <= Math.floor(x / CELL) + r; cx++) for (let cz = Math.floor(z / CELL) - r; cz <= Math.floor(z / CELL) + r; cz++) for (const i of this.grid.get(cx + ',' + cz) ?? []) { const d = Math.hypot(this.pts[i][0] - x, this.pts[i][1] - z); if (d >= rmin && d <= rmax && (!vehicle || this.adj[i].some(e => e.veh))) c.push(i); }
    return c.length ? c[Math.floor(rnd() * c.length)] : -1;
  }
  /** Degré d'un nœud (nombre de voies qui s'y rejoignent). */
  degree(n: number) { let d = 0; for (const e of this.adj[n]) if (e.vr) d++; return d; }
  /** Chemin en points monde avec décalage de trottoir (à droite du sens de marche). */
  polyline(nodes: number[], lateral = true, k = 1): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const A = this.pts[nodes[i]], B = this.pts[nodes[i + 1]]; const e = this.adj[nodes[i]].find(x => x.to === nodes[i + 1]); const off = lateral ? (e?.off ?? 0) * k : 0;
      const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; const nx = -dz / l * off, nz = dx / l * off;   // droite du sens de marche (z vers le sud)
      out.push([A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz]);
    }
    if (!out.length && nodes.length) out.push([this.pts[nodes[0]][0], this.pts[nodes[0]][1]]);
    return out;
  }
}
export const polyLength = (p: Pt[]) => { let s = 0; for (let i = 0; i < p.length - 1; i++) s += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return s; };
/** Point (et cap) à la distance d le long d'une polyligne. */
export function pointAlong(p: Pt[], d: number): { x: number; z: number; h: number } {
  if (p.length === 1) return { x: p[0][0], z: p[0][1], h: 0 };
  let s = 0; for (let i = 0; i < p.length - 1; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); if (d <= s + l || i === p.length - 2) { const t = l > 0 ? Math.min(1, Math.max(0, (d - s) / l)) : 0; return { x: p[i][0] + (p[i + 1][0] - p[i][0]) * t, z: p[i][1] + (p[i + 1][1] - p[i][1]) * t, h: Math.atan2(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) }; } s += l; }
  return { x: p[p.length - 1][0], z: p[p.length - 1][1], h: 0 };
}
