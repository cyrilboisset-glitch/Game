import type { WorldData } from '../world/data';
import type { Poi } from '../world/poi';
import type { BuildingIndex } from '../interiors/entry';
import type { RoadGraph } from '../roads/graph';
import { area, centroid, type Pt } from '../world/geom';
import { generatePopulation, type Npc, type Place } from './identity';

export interface Address { numero: string; rue: string; x: number; y: number; }
export async function loadAddresses(): Promise<Address[]> { return (await fetch(import.meta.env.BASE_URL + 'data/adresses.json')).json(); }

/** Construit la population à partir des données réelles : domiciles (bâtiments sans commerce), lieux de travail (POI), commerces, parcs. */
export function buildPopulation(world: WorldData, pois: Poi[], index: BuildingIndex, graph: RoadGraph, addrs: Address[], center: { x: number; z: number }, count: number, radius = 2600, seed = 20240611): Npc[] {
  const doorOf = (bi: number, prefer?: { x: number; z: number }): Place | null => {
    const p = world.builds[bi].p; let best: { x: number; z: number; s: number } | null = null;
    for (let i = 0; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, mz = (p[i][1] + p[i + 1][1]) / 2; const e = index.find(mx, mz, 0.6); if (!e || e.bi !== bi) continue;
      const dx = e.px + e.nx * 1.4, dz = e.pz + e.nz * 1.4; const gi = graph.nearest(dx, dz, 60); const s = gi < 0 ? 999 : Math.hypot(graph.pts[gi][0] - dx, graph.pts[gi][1] - dz) + (prefer ? Math.hypot(dx - prefer.x, dz - prefer.z) * 0.01 : 0);
      if (!best || s < best.s) best = { x: dx, z: dz, s };
    }
    return best && best.s < 60 ? { x: best.x, z: best.z, nom: '', bi, kind: 'maison' } : null;
  };
  const homeCand: number[] = []; world.builds.forEach((b, i) => { if (index.poi(i)) return; const a = Math.abs(area(b.p.slice(0, -1) as Pt[])); if (a < 40 || a > 600) return; const c = centroid(b.p.slice(0, -1) as Pt[]); if (Math.hypot(c[0] - center.x, c[1] - center.z) < radius) homeCand.push(i); });
  const cache = new Map<string, Place[]>();
  const poiPlaces = (types: string[], kind: Place['kind']) => { const k = types.join(',') + kind; let r = cache.get(k); if (!r) { r = []; for (const p of pois) { if (!types.includes(p.sous_type)) continue; const e = index.entryOfPoi(p); if (!e) continue; r.push({ x: e.px + e.nx * 1.4, z: e.pz + e.nz * 1.4, nom: p.nom, bi: e.bi, kind }); } cache.set(k, r); } return r; };
  const parks: Place[] = world.greens.filter(g => ['park', 'garden', 'recreation_ground', 'pitch'].includes(g.k) && Math.abs(area(g.p.slice(0, -1) as Pt[])) > 400).map(g => { const c = centroid(g.p.slice(0, -1) as Pt[]); return { x: c[0], z: c[1], nom: 'Espace vert', kind: 'parc' as const }; }).filter(p => Math.hypot(p.x - center.x, p.z - center.z) < radius * 1.4);
  if (!parks.length) parks.push({ x: center.x, z: center.z, nom: 'Place du village', kind: 'parc' });
  const shops = poiPlaces(['supermarket', 'bakery', 'butcher', 'greengrocer', 'variety_store', 'pastry'], 'commerce'); const restos = poiPlaces(['restaurant', 'fast_food', 'cafe', 'bar'], 'resto');
  let rng = seed; const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
  const homes: Place[] = []; const taken = new Set<number>();
  const wantHomes = Math.ceil(count / 2.4); for (let tries = 0; homes.length < wantHomes && tries < wantHomes * 5 && homeCand.length; tries++) { const bi = homeCand[Math.floor(rnd() * homeCand.length)]; if (taken.has(bi)) continue; taken.add(bi); const d = doorOf(bi); if (d) { d.nom = 'Domicile'; homes.push(d); } }
  const named: { x: number; z: number; n: string }[] = []; for (const r of world.roads) if (r.n && !['footway', 'path', 'steps', 'cycleway'].includes(r.t)) for (let i = 0; i < r.p.length; i += 1) named.push({ x: r.p[i][0], z: r.p[i][1], n: r.n });
  const addressOf = (x: number, z: number) => { let b: Address | null = null, bd = 90; for (const a of addrs) { const d = Math.hypot(a.x - x, a.y - z); if (d < bd) { bd = d; b = a; } } if (b) return `${b.numero} ${b.rue}`; let nb: { n: string } | null = null, nd = 70; for (const q of named) { const d = Math.hypot(q.x - x, q.z - z); if (d < nd) { nd = d; nb = q; } } return nb ? `${1 + (Math.abs(Math.round(x * 7 + z * 13)) % 58)} ${nb.n}` : 'adresse inconnue'; };   // numéro inventé quand OSM n'a pas d'adresse (voir docs/hypotheses.md)
  return generatePopulation({ homes, poiByType: t => poiPlaces(t, t.includes('school') ? 'ecole' : 'travail'), park: parks, shops: shops.length ? shops : [homes[0]], restos: restos.length ? restos : (shops.length ? shops : [homes[0]]), addressOf, count, seed });
}
