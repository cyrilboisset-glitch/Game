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
