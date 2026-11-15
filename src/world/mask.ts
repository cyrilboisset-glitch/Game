import type { WorldData } from './data';
import { ROAD_W, PATH_TYPES } from './roads';

/** Carte d'occupation au sol (maille 2 m) : 1 = chaussée/trottoir, 2 = bâtiment, 3 = eau/voie ferrée. Sert à placer jardins, haies et herbes sans empiéter. */
export class GroundMask {
  readonly cell = 2; readonly x0: number; readonly z0: number; readonly n: number; data: Uint8Array;
  constructor(w: WorldData, cx: number, cz: number, half = 2600) {
    this.x0 = cx - half; this.z0 = cz - half; this.n = Math.ceil((half * 2) / this.cell); this.data = new Uint8Array(this.n * this.n);
    for (const r of w.roads) { const ww = ROAD_W[r.t]; const hw = ww ? ww / 2 + (['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street'].includes(r.t) ? 2.3 : 0.6) : PATH_TYPES.has(r.t) ? 1.2 : 0; if (!hw) continue; for (let i = 0; i < r.p.length - 1; i++) this.seg(r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw, 1); }
    for (const rl of w.rails) for (let i = 0; i < rl.length - 1; i++) this.seg(rl[i][0], rl[i][1], rl[i + 1][0], rl[i + 1][1], 3, 3);
    for (const b of w.builds) this.poly(b.p, 2, 1.0);
    for (const wa of w.waters) if (wa.a) this.poly(wa.p, 3, 1); else for (let i = 0; i < wa.p.length - 1; i++) this.seg(wa.p[i][0], wa.p[i][1], wa.p[i + 1][0], wa.p[i + 1][1], 4, 3);
  }
  private idx(x: number, z: number) { const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell); return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i; }
  get(x: number, z: number) { const k = this.idx(x, z); return k < 0 ? 0 : this.data[k]; }
  free(x: number, z: number, r = 0) { if (this.get(x, z)) return false; if (r <= 0) return true; for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (this.get(x + dx, z + dz)) return false; return true; }
  /** Vrai si un bâtiment est à moins de r mètres (échantillonnage en couronne). */
  nearBuilding(x: number, z: number, r: number) { for (let a = 0; a < 8; a++) for (const f of [0.5, 1]) if (this.get(x + Math.cos(a * 0.785) * r * f, z + Math.sin(a * 0.785) * r * f) === 2) return true; return false; }
  private seg(ax: number, az: number, bx: number, bz: number, hw: number, v: number) {
    const c = this.cell, minx = Math.min(ax, bx) - hw, maxx = Math.max(ax, bx) + hw, minz = Math.min(az, bz) - hw, maxz = Math.max(az, bz) + hw; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    for (let z = minz; z <= maxz; z += c) for (let x = minx; x <= maxx; x += c) { const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= hw) { const k = this.idx(x, z); if (k >= 0 && (this.data[k] === 0 || v === 2)) this.data[k] = v; } }
  }
  private poly(p: [number, number][], v: number, margin: number) {
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity; for (const [x, z] of p) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    const c = this.cell; for (let z = minz - margin; z <= maxz + margin; z += c) { const xs: number[] = []; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [x1, z1] = p[i], [x2, z2] = p[j]; if ((z1 > z) !== (z2 > z)) xs.push(x1 + (z - z1) / (z2 - z1) * (x2 - x1)); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = xs[k] - margin; x <= xs[k + 1] + margin; x += c) { const q = this.idx(x, z); if (q >= 0) this.data[q] = v; } }
  }
}
