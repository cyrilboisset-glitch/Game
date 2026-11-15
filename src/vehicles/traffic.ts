import { RoadGraph, pointAlong } from '../roads/graph';
import { VehicleWorld, type WVehicle } from './world';
import { SPECS, CIVIL_TYPES, PAINTS } from './specs';
import type { Pt } from '../world/geom';

interface TCar { why?: string; v: WVehicle; pts: Pt[]; cum: number[]; lim: number[]; nodes: number[]; s: number; blocked: number; target: number; patrol: boolean; }
export interface Obstacle { x: number; z: number; h: number; speed: number; L: number; }

/** Circulation : voitures qui suivent le graphe routier (sens uniques, limites, distance de sécurité, une voiture à la fois par carrefour). Elles n'existent qu'autour du joueur. */
export class Traffic {
  cars: TCar[] = []; private claims = new Map<number, { owner: number; until: number }>(); private clock = 0; private r: () => number; stats = { spawns: 0, attente: 0 };
  constructor(private graph: RoadGraph, private world: VehicleWorld, private count = 40, private patrols = 2, seed = 5) { let a = seed; this.r = () => (a = (a * 16807) % 2147483647) / 2147483647; }

  private spawn(fx: number, fz: number, patrol: boolean): boolean {
    for (let tries = 0; tries < 6; tries++) {
      const a = this.graph.randomNodeInRing(fx, fz, patrol ? 160 : 130, patrol ? 380 : 300, this.r); if (a < 0) continue;
      let b = this.graph.randomNodeInRing(this.graph.pts[a][0], this.graph.pts[a][1], 450, 1500, this.r); if (b < 0) b = this.graph.randomNodeInRing(this.graph.pts[a][0], this.graph.pts[a][1], 150, 2500, this.r); if (b < 0) continue;
      const nodes = this.graph.path(a, b, true); if (!nodes || nodes.length < 4) continue;
      const pl = this.graph.vehPolyline(nodes); const cum = [0]; for (let i = 0; i < pl.pts.length - 1; i++) cum.push(cum[i] + Math.hypot(pl.pts[i + 1][0] - pl.pts[i][0], pl.pts[i + 1][1] - pl.pts[i][1]));
      const p = pointAlong(pl.pts, 0.5); if (this.world.list.some(v => Math.hypot(v.x - p.x, v.z - p.z) < 6)) continue;
      const type = patrol ? 'gendarmerie_berline' : (this.r() < 0.1 ? 'utilitaire' : CIVIL_TYPES[Math.floor(this.r() * CIVIL_TYPES.length)]);
      const v = this.world.add({ type, paint: PAINTS[Math.floor(this.r() * PAINTS.length)], hp: SPECS[type].hp, x: p.x, z: p.z, h: p.h, speed: 0, kind: patrol ? 'patrouille' : 'trafic', mine: false, upgrade: 0, stun: 0 });
      this.cars.push({ v, pts: pl.pts, cum, lim: pl.lim, nodes, s: 0.5, blocked: 0, target: 0, patrol });
      this.stats.spawns++; return true;
    }
    return false;
  }
  despawn(c: TCar) { this.world.remove(c.v); const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1); for (const [k, cl] of this.claims) if (cl.owner === c.v.id) this.claims.delete(k); }
  /** Retire une voiture de la circulation (vol de véhicule) sans la supprimer du monde. */
  release(v: WVehicle) { const i = this.cars.findIndex(c => c.v === v); if (i >= 0) this.cars.splice(i, 1); for (const [k, cl] of this.claims) if (cl.owner === v.id) this.claims.delete(k); v.kind = 'gare'; v.speed = 0; }

  update(dt: number, fx: number, fz: number, others: Obstacle[]) {
    this.clock += dt;
    const nCiv = this.cars.filter(c => !c.patrol).length, nPat = this.cars.length - nCiv;
    if (nCiv < this.count && this.spawn(fx, fz, false)) { /* un apparition par image au plus */ } else if (nPat < this.patrols) this.spawn(fx, fz, true);
    const cell = new Map<string, TCar[]>(); const key = (x: number, z: number) => Math.floor(x / 20) + ',' + Math.floor(z / 20);
    for (const c of this.cars) { const k = key(c.v.x, c.v.z); (cell.get(k) ?? cell.set(k, []).get(k)!).push(c); }
    for (const c of [...this.cars]) {
      const v = c.v, sp = SPECS[v.type]; if (v.stun > 0) { v.stun -= dt; v.speed = Math.max(0, v.speed - 9 * dt); continue; }
      const seg = this.segIndex(c); const edge = Math.min(Math.floor(seg / 2), c.lim.length - 1); c.why = ''; let target = c.lim[edge] * (c.patrol ? 1.2 : 1) * (v.hp < sp.hp * 0.3 ? 0.6 : 1);
      // virages : ralentir avant un angle marqué
      if (seg + 2 < c.pts.length) { const a = pointAlong(c.pts, c.s), dToEnd = c.cum[seg + 1] - c.s; const nh = Math.atan2(c.pts[seg + 2][0] - c.pts[seg + 1][0], c.pts[seg + 2][1] - c.pts[seg + 1][1]); let d = Math.atan2(Math.sin(nh - a.h), Math.cos(nh - a.h)); d = Math.abs(d); if (d > 0.6 && dToEnd < 18) target = Math.min(target, 5.5 - d); c.why = c.why || 'virage'; }
      // carrefours : un seul véhicule à la fois (premier arrivé), les autres s'arrêtent à 3 m
      for (let e = Math.floor(seg / 2); e <= Math.min(Math.floor(seg / 2) + 1, c.nodes.length - 2); e++) {
        const node = c.nodes[e + 1]; if (this.graph.degree(node) < 3) continue; const dN = c.cum[2 * e + 1] - c.s; if (dN > 11 || dN < -7) continue;
        const cl = this.claims.get(node);
        if (!cl || cl.owner === v.id || cl.until < this.clock) this.claims.set(node, { owner: v.id, until: this.clock + Math.max(0, dN) / Math.max(v.speed, 3) + 3 });
        else if (dN > 3) { target = Math.min(target, Math.max(0, (dN - 3) * 0.9)); this.stats.attente++; c.why = 'carrefour'; }
      }
      // distance de sécurité (voitures + joueur)
      const hx = Math.sin(v.h), hz = Math.cos(v.h);
      const check = (ox: number, oz: number, osp: number, oL: number, oh: number, latMax = 1.7) => { const al = hx * Math.sin(oh) + hz * Math.cos(oh); const dx = ox - v.x, dz = oz - v.z; const f = dx * hx + dz * hz; if (f <= 0 || f > 22) return; const lat = Math.abs(dx * hz - dz * hx); if (lat > latMax) return; if (al < 0.35 && f > 9) return; if (al < -0.3 && lat > 1.0) return; const gap = f - (sp.L + oL) / 2; const t2 = Math.max(0, osp + (gap - 3.2) * 0.75); if (t2 < target) { target = t2; c.why = 'suivi'; (c as any).obs = [Math.round(f * 10) / 10, +osp.toFixed(1), +al.toFixed(2), +lat.toFixed(1), oL]; } };
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of cell.get(Math.floor(v.x / 20) + dx + ',' + (Math.floor(v.z / 20) + dz)) ?? []) if (o !== c) check(o.v.x, o.v.z, o.v.speed, SPECS[o.v.type].L, o.v.h);
      for (const o of others) check(o.x, o.z, o.speed, o.L, o.h);
      for (const o of this.world.list) if (o.kind === 'gare' && Math.abs(o.x - v.x) < 14 && Math.abs(o.z - v.z) < 14) check(o.x, o.z, 0, SPECS[o.type].L * 0.8, o.h, 1.35);
      v.speed += Math.max(-8 * dt, Math.min(sp.accel * 0.3 * dt, target - v.speed)); if (v.speed < 0.3 && target < 0.5) c.blocked += dt; else c.blocked = 0;
      c.s += v.speed * dt; const p = pointAlong(c.pts, c.s); v.x = p.x; v.z = p.z; let dh = p.h - v.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); v.h += dh * Math.min(1, dt * 6);
      const far = Math.hypot(v.x - fx, v.z - fz) > 480; if (c.s >= c.cum[c.cum.length - 1] - 1 || far || c.blocked > 25) this.despawn(c);
    }
  }
  private segIndex(c: TCar) { let lo = 0, hi = c.cum.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c.cum[m] <= c.s) lo = m; else hi = m - 1; } return lo; }
}
