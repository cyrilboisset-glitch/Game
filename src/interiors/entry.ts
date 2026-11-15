import type { Build } from '../world/data';
import type { Poi } from '../world/poi';
import { area, obb, pointInPoly, type Pt } from '../world/geom';

export interface Entry { bi: number; px: number; pz: number; nx: number; nz: number; dist: number; }
const CELL = 40;

/** Retrouve le bâtiment le plus proche d'un point, son point d'entrée et le lieu (POI) qui s'y trouve. */
export class BuildingIndex {
  private cells = new Map<string, number[]>(); private poiOf = new Map<number, Poi>();
  constructor(private builds: Build[], pois: Poi[]) {
    builds.forEach((b, i) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of b.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) { const k = cx + ',' + cz; const l = this.cells.get(k); if (l) l.push(i); else this.cells.set(k, [i]); } });
    for (const p of pois) { const bi = this.containing(p.x, p.y) ?? this.nearestByEdge(p.x, p.y, 28); if (bi !== null && !this.poiOf.has(bi)) this.poiOf.set(bi, p); }
  }
  private candidates(x: number, z: number, r: number) { const s = new Set<number>(); for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) for (const i of this.cells.get(cx + ',' + cz) ?? []) s.add(i); return s; }
  private containing(x: number, z: number) { for (const i of this.candidates(x, z, 1)) if (pointInPoly(x, z, this.builds[i].p)) return i; return null; }
    private nearestByEdge(x: number, z: number, r: number) {
    let best: number | null = null, bd = r;
    for (const i of this.candidates(x, z, r)) { const p = this.builds[i].p; for (let k = 0; k < p.length - 1; k++) { const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1], l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - p[k][0]) * dx + (z - p[k][1]) * dz) / l2)); const d = Math.hypot(x - p[k][0] - dx * t, z - p[k][1] - dz * t); if (d < bd) { bd = d; best = i; } } }
    return best;
  }
  poi(bi: number) { return this.poiOf.get(bi); }
  /** Bâtiment associé à un POI (outil de test/placement) : un point d'entrée sur son mur le plus proche du POI. */
  entryOfPoi(poi: Poi): Entry | null { for (const [bi, p] of this.poiOf) if (p.id === poi.id) { const c = this.builds[bi].p; let best: Entry | null = null; for (let i = 0; i < c.length - 1; i++) { const mx = (c[i][0] + c[i + 1][0]) / 2, mz = (c[i][1] + c[i + 1][1]) / 2; const e = this.find(mx, mz, 0.5); if (e && e.bi === bi && (!best || Math.hypot(mx - poi.x, mz - poi.y) < Math.hypot(best.px - poi.x, best.pz - poi.y))) best = e; } return best; } return null; }
  dims(bi: number) { const p = this.builds[bi].p.slice(0, -1) as Pt[]; const o = obb(p); return { w: Math.max(o.maxX - o.minX, o.maxY - o.minY), d: Math.min(o.maxX - o.minX, o.maxY - o.minY), area: Math.abs(area(p)) }; }
  /** Entrée la plus proche (mur à moins de maxD mètres). */
  find(x: number, z: number, maxD = 2.4): Entry | null {
    let best: Entry | null = null;
    for (const bi of this.candidates(x, z, maxD + 1)) {
      const p = this.builds[bi].p; const a = area(p.slice(0, -1) as Pt[]);
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; if (l2 < 4) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); const px = ax + dx * t, pz = az + dz * t; const d = Math.hypot(x - px, z - pz);
        if (d < maxD && (!best || d < best.dist)) { const l = Math.sqrt(l2); let nx = -dz / l, nz = dx / l; if (a > 0) { nx = -nx; nz = -nz; } if (pointInPoly(px + nx * 0.6, pz + nz * 0.6, p)) { nx = -nx; nz = -nz; } best = { bi, px, pz, nx, nz, dist: d }; }
      }
    }
    return best;
  }
}
