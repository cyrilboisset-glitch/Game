import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder';
import { CHUNK, type WorldData } from './data';
import { addBuilding, type BuildBuilders } from './buildings';
import { addRoadPiece, addRail, addStrip, junctions, sidewalkCuts, splitGrid, ROAD_W, PATH_TYPES, type RoadBuilders } from './roads';
import { addTree, addLamp, addConifer, addBush, addFence, addBench, addBin, addSign } from './props';
import type { GroundMask } from './mask';
import { PropColliders, propSink, type Sink } from './solids';
import { area, centroid, length, pointInPoly, slice, type Pt } from './geom';
import { rnd, reseed } from './textures';
import type { Materials } from './materials';

interface Raw { builds: number[]; roads: { ri: number; piece: Pt[]; sBase: number }[]; rails: Pt[][]; waters: { p: Pt[]; a: number }[]; greens: { p: Pt[]; k: string }[]; }
const ck = (cx: number, cy: number) => `${cx},${cy}`;
const cOf = (x: number, y: number) => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];

export class Chunks {
  grid = new Map<string, Raw>(); loaded = new Map<string, THREE.Group>(); lamps: THREE.Vector3[] = [];
  mask?: GroundMask; props = new PropColliders();
  constructor(private w: WorldData, private mats: Materials, private scene: THREE.Scene) { this.index(); }
  private raw(k: string): Raw { let r = this.grid.get(k); if (!r) { r = { builds: [], roads: [], rails: [], waters: [], greens: [] }; this.grid.set(k, r); } return r; }

  private index() {
    const w = this.w;
    w.builds.forEach((b, i) => { const [cx, cy] = cOf(...centroid(b.p.slice(0, -1)) as [number, number]); this.raw(ck(cx, cy)).builds.push(i); });
    const J = junctions(w.roads);
    w.roads.forEach((r, ri) => {
      const cuts = sidewalkCuts(r, ri, J); (r as any)._cuts = cuts; let s = 0;
      for (const piece of splitGrid(r.p, CHUNK)) { const m = piece[Math.floor(piece.length / 2)]; const [cx, cy] = cOf((piece[0][0] + piece[piece.length - 1][0]) / 2, (piece[0][1] + piece[piece.length - 1][1]) / 2); void m; this.raw(ck(cx, cy)).roads.push({ ri, piece, sBase: s }); s += length(piece); }
    });
    for (const p of w.rails) for (const piece of splitGrid(p, CHUNK)) { const [cx, cy] = cOf((piece[0][0] + piece[piece.length - 1][0]) / 2, (piece[0][1] + piece[piece.length - 1][1]) / 2); this.raw(ck(cx, cy)).rails.push([...piece]); }
    for (const wa of w.waters) { const [cx, cy] = cOf(...centroid(wa.p) as [number, number]); this.raw(ck(cx, cy)).waters.push(wa); }
    for (const g of w.greens) { const [cx, cy] = cOf(...centroid(g.p) as [number, number]); this.raw(ck(cx, cy)).greens.push(g); }
  }

  private make(cx: number, cy: number): THREE.Group {
    reseed(((cx * 73856093) ^ (cy * 19349663)) >>> 0 || 1); const raw = this.grid.get(ck(cx, cy)); const g = new THREE.Group(); g.name = ck(cx, cy);
    if (!raw) return g; const sink: Sink = { c: [], s: [] }; propSink.cur = sink; this.props.set(ck(cx, cy), sink);
    const m = this.mats;
    const BB: BuildBuilders = { wall: new MeshBuilder(), roof: new MeshBuilder(), flat: new MeshBuilder(), trim: new MeshBuilder() };
    const RB: RoadBuilders = { marked: new MeshBuilder(), plain: new MeshBuilder(), paving: new MeshBuilder(), gravel: new MeshBuilder(), marks: new MeshBuilder() };
    const ground = new MeshBuilder(), water = new MeshBuilder(), trees = new MeshBuilder(), leaves = new MeshBuilder(), poles = new MeshBuilder(), heads = new MeshBuilder(), hedges = new MeshBuilder(), solids = new MeshBuilder();
    const nearBuilds: Pt[][] = [];
    // bâtiments voisins pour éviter d'y planter des arbres
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const r2 = this.grid.get(ck(cx + dx, cy + dy)); if (r2) for (const bi of r2.builds) nearBuilds.push(this.w.builds[bi].p); }
    const inBuilding = (x: number, y: number) => nearBuilds.some(p => { const q = p[0]; if (Math.abs(q[0] - x) > 60 || Math.abs(q[1] - y) > 60) return false; return pointInPoly(x, y, p); });
    for (const bi of raw.builds) addBuilding(BB, this.w.builds[bi], bi);
    for (const rr of raw.roads) {
      const road = this.w.roads[rr.ri]; addRoadPiece(RB, road, rr.piece, (road as any)._cuts, rr.sBase);
      const urban = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street'].includes(road.t);
      if (urban) {
        const hw = ROAD_W[road.t] / 2 + 3.2; let acc = rnd() * 20;
        for (let i = 0; i < rr.piece.length - 1; i++) {
          const a = rr.piece[i], b = rr.piece[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
          for (let t = acc; t < l; t += 14) {
            const x = a[0] + dx * t, z = a[1] + dz * t; const side = (Math.floor(t / 14) % 2) ? 1 : -1;
            const px = x - dz * hw * side, pz = z + dx * hw * side;
            if (inBuilding(px, pz)) continue;
            const k = Math.floor(t / 14) + rr.ri;
            if (k % 3 === 0) { addLamp(poles, heads, px, pz, -dz * side, dx * side); this.lamps.push(new THREE.Vector3(px, 7, pz)); }
            else if (k % 3 === 1 && rnd() < 0.7) { if (rnd() < 0.12) addConifer(trees, leaves, px, pz, 0.7 + rnd() * 0.3); else addTree(trees, leaves, px, pz, 0.8 + rnd() * 0.5); }
          }
          acc = (acc + 1e6) % 14;
        }
      }
    }
    for (const rl of raw.rails) addRail(RB.gravel, rl);
    for (const wa of raw.waters) {
      if (wa.a && wa.p.length > 3) { try { const p = wa.p.slice(0, -1); const tris = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []); const b = water.count; for (const q of p) water.vert(q[0], 0.02, q[1], 0, 1, 0, q[0] / 12, q[1] / 12, null); for (const t of tris) water.tri(b + t[0], b + t[2], b + t[1]); } catch { /* polygone invalide : ignoré */ } }
      else addStrip(water, wa.p, 3, 0.02, 12);
    }
    for (const gr of raw.greens) {
      const p = gr.p.slice(0, -1); if (p.length < 3) continue; const forest = gr.k === 'forest' || gr.k === 'wood' || gr.k === 'scrub';
      try { const tris = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []); const b = ground.count; const c = forest ? new THREE.Color(0.5, 0.62, 0.45) : new THREE.Color(1.05, 1.05, 0.9); for (const q of p) ground.vert(q[0], 0.012, q[1], 0, 1, 0, q[0] / 6, q[1] / 6, c); for (const t of tris) ground.tri(b + t[0], b + t[2], b + t[1]); } catch { continue; }
      const a = Math.abs(area(p)); const n = Math.min(forest ? 70 : 14, Math.floor(a / (forest ? 90 : 700)));
      let xs = Infinity, xe = -Infinity, ys = Infinity, ye = -Infinity; for (const q of p) { xs = Math.min(xs, q[0]); xe = Math.max(xe, q[0]); ys = Math.min(ys, q[1]); ye = Math.max(ye, q[1]); }
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) { const x = xs + rnd() * (xe - xs), z = ys + rnd() * (ye - ys); if (pointInPoly(x, z, p) && !inBuilding(x, z)) { if (forest && rnd() < 0.4) addConifer(trees, leaves, x, z, 0.9 + rnd() * 0.5); else addTree(trees, leaves, x, z, 0.9 + rnd() * 0.9); k++; } }
    }
    // jardins (arbustes, arbres) et clôtures de propriété (haies, murets + grilles), placés grâce à la carte d'occupation
    const M = this.mask;
    if (M) {
      const x0 = cx * CHUNK, z0 = cy * CHUNK;
      for (let i = 0; i < 110; i++) { const x = x0 + rnd() * CHUNK, z = z0 + rnd() * CHUNK; if (!M.free(x, z, 1.6) || !M.nearBuilding(x, z, 10)) continue; const r = rnd(); if (r < 0.55) addBush(leaves, x, z, 0.8 + rnd() * 0.7); else if (r < 0.88) addTree(trees, leaves, x, z, 0.65 + rnd() * 0.45); else addConifer(trees, leaves, x, z, 0.6 + rnd() * 0.4); }
      for (const rr of raw.roads) {   // mobilier urbain : bancs + poubelles le long des axes, panneaux aux carrefours
        const road = this.w.roads[rr.ri]; if (!['primary', 'secondary', 'tertiary', 'residential', 'unclassified'].includes(road.t)) continue; const hw = ROAD_W[road.t] / 2; const total = length(rr.piece);
        const at = (sAt: number) => { const sg = slice(rr.piece, sAt, sAt + 0.5); if (sg.length < 2) return null; const a = sg[0], b = sg[sg.length - 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { x: a[0], z: a[1], dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l }; };
        if (road.t !== 'residential' && road.t !== 'unclassified') for (let sAt = 20 + rnd() * 30; sAt < total - 2; sAt += 55 + rnd() * 40) { const p = at(sAt); if (!p) continue; const side = rnd() < 0.5 ? 1 : -1; const bx = p.x - p.dz * (hw + 2.3) * side, bz = p.z + p.dx * (hw + 2.3) * side; if (M.get(bx, bz) === 2) continue; addBench(solids, bx, bz, p.dz * side, -p.dx * side); addBin(solids, bx + p.dx * 1.4, bz + p.dz * 1.4); }
        if (road.t === 'residential' || road.t === 'unclassified') for (const [c0] of ((road as any)._cuts as [number, number][]) ?? []) { const sAt = c0 - rr.sBase - 0.5; if (sAt < 0 || sAt > total - 1 || rnd() > 0.35) continue; const p = at(sAt); if (!p) continue; addSign(poles, solids, p.x - p.dz * (hw + 0.5), p.z + p.dx * (hw + 0.5), p.dx, p.dz, rnd() < 0.4); }
      }
      for (const rr of raw.roads) {
        const road = this.w.roads[rr.ri]; if (!['residential', 'tertiary', 'unclassified', 'living_street'].includes(road.t)) continue; const off = ROAD_W[road.t] / 2 + 2.9;
        for (const side of [1, -1]) { let run: Pt[] = []; const flush = () => { if (run.length >= 3) { const a = run[0], b = run[run.length - 1]; const h = Math.abs(Math.sin(a[0] * 12.9898 + a[1] * 78.233) * 43758.5453) % 1; addFence(hedges, solids, poles, a[0], a[1], b[0], b[1], h < 0.6 ? 'haie' : 'muret'); } run = []; };
          let acc = 0; for (let i = 0; i < rr.piece.length - 1; i++) { const a = rr.piece[i], b = rr.piece[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.5) continue; const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
            for (let t = 0; t < l; t += 2) { acc += 2; const x = a[0] + dx * t - dz * off * side, z = a[1] + dz * t + dx * off * side; const ok = M.free(x, z) && M.nearBuilding(x, z, 12) && (acc % 18) > 3.5; if (ok) run.push([x, z]); else flush(); } flush(); } }
      }
    }
    const add = (b: MeshBuilder, mat: THREE.Material, shadow = false, recv = true) => { const geo = b.build(); if (!geo) return; const me = new THREE.Mesh(geo, mat); me.castShadow = shadow; me.userData.shadowCaster = shadow; me.receiveShadow = recv; g.add(me); };
    add(BB.wall, m.wall, true); add(BB.roof, m.roof, true); add(BB.flat, m.flat, true); add(BB.trim!, m.bark, true);
    add(RB.marked, m.asphaltMarked); add(RB.plain, m.asphalt); add(RB.paving, m.pavement); add(RB.gravel, m.gravel); add(RB.marks, m.marks);
    add(ground, m.greens); add(water, m.water, false); add(trees, m.bark, true); add(leaves, m.leaves, true); add(poles, m.metal, true); add(heads, m.lampHead, false, false); add(hedges, m.hedge, true); add(solids, m.bark, true);
    propSink.cur = null; return g;
  }

  /** Seuls les chunks proches projettent des ombres (économie de passes de rendu). range = 0 : aucune. */
  setShadowRange(px: number, pz: number, range: number) {
    for (const [k, g] of this.loaded) { const [cx, cy] = k.split(',').map(Number); const d = Math.hypot((cx + 0.5) * CHUNK - px, (cy + 0.5) * CHUNK - pz); const on = range > 0 && d < range + CHUNK * 0.7; if (g.userData.sh !== on) { g.userData.sh = on; g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = on && m.userData.shadowCaster !== false; }); } }
  }
  update(px: number, pz: number, radius: number) {
    const [cx, cy] = cOf(px, pz); const n = Math.ceil(radius / CHUNK); const want = new Set<string>();
    for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) {
      const x = (cx + dx + 0.5) * CHUNK, z = (cy + dy + 0.5) * CHUNK; if (Math.hypot(x - px, z - pz) > radius + CHUNK * 0.7) continue;
      const k = ck(cx + dx, cy + dy); want.add(k);
      if (!this.loaded.has(k)) { const g = this.make(cx + dx, cy + dy); this.scene.add(g); this.loaded.set(k, g); }
    }
    for (const [k, g] of this.loaded) if (!want.has(k)) { this.props.remove(k); this.scene.remove(g); g.traverse(o => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); this.loaded.delete(k); }
  }
}
export const _unused = { PATH_TYPES, addStrip };
