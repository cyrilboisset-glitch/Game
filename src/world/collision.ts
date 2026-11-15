import { CHUNK as _C, type Build } from './data';
import type { Pt } from './geom';
void _C;
const CELL = 30;
interface Seg { ax: number; ay: number; bx: number; by: number; }

/** Collisions cercle ↔ murs de bâtiments via une grille de hachage spatiale de segments. */
export class Collision {
  private cells = new Map<string, Seg[]>();
  constructor(builds: Build[]) {
    for (const b of builds) {
      const p = b.p as Pt[]; if (p.length < 4) continue;
      for (let i = 0; i < p.length - 1; i++) this.addSeg({ ax: p[i][0], ay: p[i][1], bx: p[i + 1][0], by: p[i + 1][1] });
    }
  }
  private addSeg(s: Seg) {
    const x0 = Math.floor(Math.min(s.ax, s.bx) / CELL), x1 = Math.floor(Math.max(s.ax, s.bx) / CELL);
    const y0 = Math.floor(Math.min(s.ay, s.by) / CELL), y1 = Math.floor(Math.max(s.ay, s.by) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; const l = this.cells.get(k); if (l) l.push(s); else this.cells.set(k, [s]); }
  }
  private near(x: number, y: number, r: number) {
    const out = new Set<Seg>();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) { const l = this.cells.get(cx + ',' + cy); if (l) for (const s of l) out.add(s); }
    return out;
  }
  /** Ligne de vue : vrai si un mur de bâtiment coupe le segment A→B. */
  blocked(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / (CELL / 2))); const seen = new Set<Seg>();
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; const l = this.cells.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!l) continue;
      for (const s of l) { if (seen.has(s)) continue; seen.add(s); if (segX(ax, az, bx, bz, s.ax, s.ay, s.bx, s.by)) return true; } }
    return false;
  }
  /** Repousse un cercle hors des murs. Retourne la profondeur de pénétration maximale (0 = aucune) et la normale moyenne. */
  resolve(pos: { x: number; z: number }, r: number): { depth: number; nx: number; nz: number } {
    let depth = 0, nx = 0, nz = 0;
    for (let it = 0; it < 2; it++) for (const s of this.near(pos.x, pos.z, r + 1)) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy || 1;
      let t = ((pos.x - s.ax) * dx + (pos.z - s.ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
      const cx = s.ax + dx * t, cy = s.ay + dy * t; let ox = pos.x - cx, oy = pos.z - cy; const d = Math.hypot(ox, oy);
      if (d < r && d > 1e-6) { ox /= d; oy /= d; const pen = r - d; pos.x += ox * pen; pos.z += oy * pen; if (pen > depth) { depth = pen; nx = ox; nz = oy; } }
    }
    return { depth, nx, nz };
  }
}

/** Intersection stricte de deux segments. */
function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx), d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
