import { RoadGraph } from '../roads/graph';
import { VehicleWorld, type WVehicle } from '../vehicles/world';
import { SPECS } from '../vehicles/specs';
import type { Traffic } from '../vehicles/traffic';
import type { Collision } from '../world/collision';
import type { Pt } from '../world/geom';
import { unitsForStars, blocksForStars, arrestStep, cooldownRate, ARREST_TIME } from './rules';

interface Unit { v: WVehicle; pts: Pt[]; repath: number; blocked: number; }
export interface PoliceCtx { px: number; pz: number; pspeed: number; heading: number; inCar: boolean; stars: number; }
export interface PoliceOut { arrested: boolean; seen: boolean; nearest: number; speeding: boolean; }

/** Gendarmerie : unités lancées à la poursuite (itinéraire A* + poursuite directe de près), barrages en travers de la route, arrestation, refroidissement. */
export class Police {
  units: Unit[] = []; blocks: WVehicle[] = []; arrestTimer = 0; unseen = 99; nearest = 999; private spawnT = 0; private blockT = 0; private speedT = 0; private r: () => number;
  constructor(private graph: RoadGraph, private world: VehicleWorld, private traffic: Traffic, private coll: Collision, seed = 77) { let a = seed; this.r = () => (a = (a * 16807) % 2147483647) / 2147483647; }

  private place(px: number, pz: number, rmin: number, rmax: number): { x: number; z: number; h: number } | null {
    for (let i = 0; i < 6; i++) { const n = this.graph.randomNodeInRing(px, pz, rmin, rmax, this.r, true); if (n < 0) continue; const [x, z] = this.graph.pts[n]; if (this.world.list.some(v => Math.hypot(v.x - x, v.z - z) < 7)) continue; const to = this.graph.adj[n].find(e => e.veh); const q = to ? this.graph.pts[to.to] : [x, z + 1]; return { x, z, h: Math.atan2(q[0] - x, q[1] - z) }; }
    return null;
  }
  private spawnUnit(ctx: PoliceCtx) {
    const p = this.place(ctx.px, ctx.pz, 150, 320); if (!p) return; const type = ctx.stars >= 4 && this.r() < 0.3 ? 'gendarmerie_fourgon' : 'gendarmerie_berline';
    const v = this.world.add({ type, paint: 0xf2f2f2, hp: SPECS[type].hp, x: p.x, z: p.z, h: p.h, speed: 0, kind: 'poursuite', mine: false, upgrade: 0, stun: 0 }); this.units.push({ v, pts: [], repath: 0, blocked: 0 });
  }
  /** Les patrouilles de la circulation rejoignent la poursuite dès que le joueur est recherché. */
  private recruit(ctx: PoliceCtx) { for (const c of [...this.traffic.cars]) if (c.patrol && Math.hypot(c.v.x - ctx.px, c.v.z - ctx.pz) < 260) { this.traffic.release(c.v); c.v.kind = 'poursuite'; this.units.push({ v: c.v, pts: [], repath: 0, blocked: 0 }); } }
  private dropUnit(u: Unit) { this.world.remove(u.v); const i = this.units.indexOf(u); if (i >= 0) this.units.splice(i, 1); }
  private placeBlock(ctx: PoliceCtx) {
    const fx = ctx.inCar ? Math.sin(ctx.heading) : 0, fz = ctx.inCar ? Math.cos(ctx.heading) : 1; const n = this.graph.nearest(ctx.px + fx * 320, ctx.pz + fz * 320, 140, true); if (n < 0) return;
    const [x, z] = this.graph.pts[n]; if (Math.hypot(x - ctx.px, z - ctx.pz) < 150) return; const e = this.graph.adj[n].find(q => q.veh); if (!e) return; const q = this.graph.pts[e.to]; const dh = Math.atan2(q[0] - x, q[1] - z) + Math.PI / 2;
    for (const off of [-1.7, 1.7]) { const bx = x + Math.cos(dh) * off * 1.0, bz = z - Math.sin(dh) * off * 1.0; const v = this.world.add({ type: 'gendarmerie_berline', paint: 0xf2f2f2, hp: SPECS.gendarmerie_berline.hp, x: bx, z: bz, h: dh, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 0 }); this.blocks.push(v); }
  }
  clearBlocks() { for (const b of this.blocks) this.world.remove(b); this.blocks = []; }
  clearAll() { for (const u of [...this.units]) this.dropUnit(u); this.clearBlocks(); this.arrestTimer = 0; }

  update(dt: number, ctx: PoliceCtx, heatValue: { value: number }): PoliceOut {
    const want = unitsForStars(ctx.stars); let seen = false, speeding = false; this.nearest = 999;
    if (ctx.stars > 0) {
      this.recruit(ctx); this.spawnT -= dt; if (this.units.length < want && this.spawnT <= 0) { this.spawnUnit(ctx); this.spawnT = 0.8; }
      const wb = blocksForStars(ctx.stars); this.blockT -= dt; if (this.blocks.length < wb * 2 && this.blockT <= 0) { this.placeBlock(ctx); this.blockT = 6; }
    } else { this.spawnT -= dt; if (this.units.length && this.spawnT <= 0) { const far = this.units.find(u => Math.hypot(u.v.x - ctx.px, u.v.z - ctx.pz) > 130) ?? this.units[0]; this.dropUnit(far); this.spawnT = 1.5; } if (this.blocks.length) this.clearBlocks(); }
    for (const u of [...this.units]) {
      const v = u.v, sp = SPECS[v.type]; const dx = ctx.px - v.x, dz = ctx.pz - v.z, d = Math.hypot(dx, dz); this.nearest = Math.min(this.nearest, d); if (d < 95) seen = true;
      if (v.stun > 0) { v.stun -= dt; v.speed = Math.max(0, v.speed - 10 * dt); continue; }
      u.repath -= dt; if (u.repath <= 0 && d > 40) { u.repath = 1.4; const a = this.graph.nearest(v.x, v.z, 70, true), b = this.graph.nearest(ctx.px, ctx.pz, 160, true); const nodes = a >= 0 && b >= 0 ? this.graph.path(a, b, true) : null; u.pts = nodes ? this.graph.vehPolyline(nodes, 0.1).pts : []; }
      let tx = ctx.px, tz = ctx.pz;
      if (d > 40 && u.pts.length) { let bi = 0, bd = 1e9; for (let i = 0; i < u.pts.length; i++) { const q = Math.hypot(u.pts[i][0] - v.x, u.pts[i][1] - v.z); if (q < bd) { bd = q; bi = i; } } let acc = 0, j = bi; while (j < u.pts.length - 1 && acc < 11) { acc += Math.hypot(u.pts[j + 1][0] - u.pts[j][0], u.pts[j + 1][1] - u.pts[j][1]); j++; } tx = u.pts[j][0]; tz = u.pts[j][1]; }
      const want2 = Math.atan2(tx - v.x, tz - v.z); let diff = Math.atan2(Math.sin(want2 - v.h), Math.cos(want2 - v.h)); const rate = 2.1 * Math.min(1, 14 / (v.speed + 6)); v.h += Math.max(-rate * dt, Math.min(rate * dt, diff));
      let target = Math.min(sp.maxSpeed * 0.7, 30) * Math.max(0.25, 1 - Math.abs(diff) * 0.55); if (d < 16 && ctx.pspeed < 3) target = Math.min(target, Math.max(0, (d - 5) * 1.5));
      for (const o of this.world.list) { if (o === v || Math.abs(o.x - v.x) > 12 || Math.abs(o.z - v.z) > 12) continue; const ox = o.x - v.x, oz = o.z - v.z; const f = ox * Math.sin(v.h) + oz * Math.cos(v.h); const lat = Math.abs(ox * Math.cos(v.h) - oz * Math.sin(v.h)); if (f > 0 && f < 9 && lat < 2.1 && o.kind !== 'poursuite') target = Math.min(target, Math.max(0, (f - 4) * 1.5)); }
      v.speed += Math.max(-14 * dt, Math.min(sp.accel * 0.9 * dt, target - v.speed)); const nx = v.x + Math.sin(v.h) * v.speed * dt, nz = v.z + Math.cos(v.h) * v.speed * dt; const q = { x: nx, z: nz }; const r = this.coll.resolve(q, sp.W / 2 + 0.1); v.x = q.x; v.z = q.z; if (r.depth > 0.05) v.speed *= 0.7;
      if (v.speed < 0.5 && target > 3) u.blocked += dt; else u.blocked = 0; if (u.blocked > 6) { v.h += 0.6; v.speed = -1.5; u.blocked = 0; }
      if (d > 560) this.dropUnit(u);
    }
    for (const v of this.world.list) if (v.kind === 'patrouille') { const d = Math.hypot(v.x - ctx.px, v.z - ctx.pz); this.nearest = Math.min(this.nearest, d); if (d < 95) seen = true; if (ctx.inCar && ctx.pspeed > 25 && d < 60) { this.speedT -= dt; if (this.speedT <= 0) { speeding = true; this.speedT = 4; } } }
    for (const b of this.blocks) { const d = Math.hypot(b.x - ctx.px, b.z - ctx.pz); if (d < 95) seen = true; if (d > 750) { this.clearBlocks(); break; } }
    if (ctx.stars > 0) {
      this.unseen = seen ? 0 : this.unseen + dt; heatValue.value = Math.max(0, heatValue.value - cooldownRate(this.unseen) * dt);
      const prev = this.arrestTimer; this.arrestTimer = arrestStep(this.arrestTimer, ctx.pspeed, this.units.length ? Math.min(...this.units.map(u => Math.hypot(u.v.x - ctx.px, u.v.z - ctx.pz))) : 999, dt); void prev;
      if (this.arrestTimer >= ARREST_TIME) { this.arrestTimer = 0; return { arrested: true, seen, nearest: this.nearest, speeding }; }
    } else { this.arrestTimer = 0; this.unseen = 99; }
    return { arrested: false, seen, nearest: this.nearest, speeding };
  }
}
