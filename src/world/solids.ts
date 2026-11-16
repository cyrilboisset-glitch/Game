// Obstacles « solides » hors bâtiments : mobilier et végétation (par chunk) + géométrie cercle ↔ rectangle orienté (véhicules).
import { CHUNK } from './data';

export interface Sink { c: number[]; s: number[]; f?: number[]; b?: number[]; }   // c : [x, z, r]… ; s : [ax, az, bx, bz, demi-épaisseur]… ; f : clôtures [ax, az, bx, bz, hauteur]… ; b : bancs [x, z, fx, fz]…
/** Collecteur rempli par les fonctions de props pendant la génération d'un chunk. */
export const propSink: { cur: Sink | null } = { cur: null };
export const sinkCircle = (x: number, z: number, r: number) => { propSink.cur?.c.push(x, z, r); };
export const sinkSeg = (ax: number, az: number, bx: number, bz: number, t: number) => { propSink.cur?.s.push(ax, az, bx, bz, t); };
export const sinkFence = (ax: number, az: number, bx: number, bz: number, h: number) => { const c = propSink.cur; if (c) (c.f ??= []).push(ax, az, bx, bz, h); };
export const sinkBench = (x: number, z: number, fx: number, fz: number) => { const c = propSink.cur; if (c) (c.b ??= []).push(x, z, fx, fz); };

export class PropColliders {
  private chunks = new Map<string, Sink>();
  set(key: string, s: Sink) { this.chunks.set(key, s); }
  remove(key: string) { this.chunks.delete(key); }
  /** Distance au plus proche obstacle (pour se cacher). */
  nearDist(x: number, z: number) { let best = 99; const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const s = this.chunks.get(`${cx + dx},${cz + dz}`); if (!s) continue; for (let i = 0; i < s.c.length; i += 3) { if (Math.abs(x - s.c[i]) > 4 || Math.abs(z - s.c[i + 1]) > 4) continue; best = Math.min(best, Math.hypot(x - s.c[i], z - s.c[i + 1]) - s.c[i + 2]); } for (let i = 0; i < s.s.length; i += 5) { const ax = s.s[i], az = s.s[i + 1], ex = s.s[i + 2] - ax, ez = s.s[i + 3] - az, l2 = ex * ex + ez * ez || 1; const k = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)); best = Math.min(best, Math.hypot(x - ax - ex * k, z - az - ez * k) - s.s[i + 4]); } } return best; }
  /** Clôture (muret, grille, haie) la plus proche à moins de `maxD` m : segment, hauteur, point le plus proche. */
  nearestFence(x: number, z: number, maxD: number) { let best: { ax: number; az: number; bx: number; bz: number; h: number; qx: number; qz: number; d: number } | null = null; const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const f = this.chunks.get(`${cx + dx},${cz + dz}`)?.f; if (!f) continue; for (let i = 0; i < f.length; i += 5) { const ax = f[i], az = f[i + 1], ex = f[i + 2] - ax, ez = f[i + 3] - az, l2 = ex * ex + ez * ez || 1; const k = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)); const qx = ax + ex * k, qz = az + ez * k, d = Math.hypot(x - qx, z - qz); if (d < maxD && (!best || d < best.d)) best = { ax, az, bx: f[i + 2], bz: f[i + 3], h: f[i + 4], qx, qz, d }; } }
    return best; }
  /** Banc le plus proche (position et direction vers laquelle on s'assoit). */
  nearestBench(x: number, z: number, maxD: number) { let best: { x: number; z: number; fx: number; fz: number; d: number } | null = null; const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const b = this.chunks.get(`${cx + dx},${cz + dz}`)?.b; if (!b) continue; for (let i = 0; i < b.length; i += 4) { const d = Math.hypot(x - b[i], z - b[i + 1]); if (d < maxD && (!best || d < best.d)) best = { x: b[i], z: b[i + 1], fx: b[i + 2], fz: b[i + 3], d }; } }
    return best; }
  /** Repousse un cercle hors des troncs, poteaux, bancs, haies, murets. */
  resolve(pos: { x: number; z: number }, r: number, skip?: { ax: number; az: number }) {
    let depth = 0, nx = 0, nz = 0; const cx = Math.floor(pos.x / CHUNK), cz = Math.floor(pos.z / CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const s = this.chunks.get(`${cx + dx},${cz + dz}`); if (!s) continue;
      for (let i = 0; i < s.c.length; i += 3) { const ox = pos.x - s.c[i], oz = pos.z - s.c[i + 1]; if (Math.abs(ox) > 4 || Math.abs(oz) > 4) continue; const d = Math.hypot(ox, oz), m = r + s.c[i + 2]; if (d < m && d > 1e-5) { const p = m - d; pos.x += ox / d * p; pos.z += oz / d * p; if (p > depth) { depth = p; nx = ox / d; nz = oz / d; } } }
      for (let i = 0; i < s.s.length; i += 5) { const ax = s.s[i], az = s.s[i + 1], bx = s.s[i + 2], bz = s.s[i + 3], t = s.s[i + 4]; if (skip && skip.ax === ax && skip.az === az) continue; const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1; const k = Math.max(0, Math.min(1, ((pos.x - ax) * ex + (pos.z - az) * ez) / l2)); const qx = ax + ex * k, qz = az + ez * k; const ox = pos.x - qx, oz = pos.z - qz, d = Math.hypot(ox, oz), m = r + t; if (d < m && d > 1e-5) { const p = m - d; pos.x += ox / d * p; pos.z += oz / d * p; if (p > depth) { depth = p; nx = ox / d; nz = oz / d; } } }
    }
    return { depth, nx, nz };
  }
}

/** Cercle (px,pz,r) contre rectangle orienté (centre, cap h, demi-longueur hl selon le cap, demi-largeur hw). Retourne la poussée à appliquer au cercle, ou null. */
export function circleVsBox(px: number, pz: number, r: number, cx: number, cz: number, h: number, hl: number, hw: number): { x: number; z: number; d: number } | null {
  const fx = Math.sin(h), fz = Math.cos(h); const dx = px - cx, dz = pz - cz; const lf = dx * fx + dz * fz, ll = dx * fz - dz * fx;   // coordonnées locales (avant, côté)
  const qf = Math.max(-hl, Math.min(hl, lf)), ql = Math.max(-hw, Math.min(hw, ll)); let of = lf - qf, ol = ll - ql; let d = Math.hypot(of, ol);
  if (d >= r) return null;
  if (d < 1e-5) { const pf = hl - Math.abs(lf), pl = hw - Math.abs(ll); if (pf < pl) { of = Math.sign(lf) || 1; ol = 0; d = 0; const push = pf + r; return { x: fx * of * push, z: fz * of * push, d: push }; } ol = Math.sign(ll) || 1; const push = pl + r; return { x: fz * ol * push, z: -fx * ol * push, d: push }; }
  const p = r - d; of /= d; ol /= d; return { x: (fx * of + fz * ol) * p, z: (fz * of - fx * ol) * p, d: p };
}
