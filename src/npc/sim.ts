import { RoadGraph, polyLength, pointAlong } from '../roads/graph';
import { dayPlan, ACT_LABEL, type Act, type Stay } from './schedule';
import type { Npc, Place } from './identity';
import type { Pt } from '../world/geom';

export type Kind = 'dedans' | 'marche' | 'conduit' | 'dehors' | 'absent';
export interface NpcState { id: number; x: number; z: number; h: number; kind: Kind; act: Act; speed: number; place: Place; detail: string; }
interface Seg { t0: number; t1: number; type: 'stay' | 'travel'; stay?: Stay; from?: Place; to?: Place; mode?: 'marche' | 'conduit'; len: number; path?: Pt[] | null; act: Act; }
const WALK = 1.45, CAR = 8.5, INDOOR = new Set(['maison', 'travail', 'ecole', 'commerce', 'resto']);
const fmt = (h: number) => `${Math.floor(h)} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
export const dowOf = (day: number) => (day - 1 + 2) % 7;   // le jour 1 est un mercredi (hypothèse documentée)

/** Simulation des habitants : fonction pure du temps (jour, heure) → position/activité. Aucun état par PNJ à mettre à jour : les PNJ lointains ne coûtent rien. */
export class NpcSim {
  private tl = new Map<number, { day: number; segs: Seg[] }>();
  constructor(public npcs: Npc[], private graph: RoadGraph) {}

  timeline(n: Npc, day: number): Seg[] {
    const c = this.tl.get(n.id); if (c && c.day === day) return c.segs;
    const plan = dayPlan(n, dowOf(day), day); const segs: Seg[] = []; let cur = 0;
    for (let i = 0; i < plan.length; i++) {
      const s = plan[i]; const start = Math.max(s.t0, cur);
      if (i > 0 && segs.length) {
        const prev = plan[i - 1].place, d = Math.hypot(prev.x - s.place.x, prev.z - s.place.z);
        if (d > 12 && s.place.kind !== 'hors' && prev.kind !== 'hors') {
          const len = d * 1.35, mode: 'marche' | 'conduit' = n.hasCar && len > 700 ? 'conduit' : 'marche'; const dur = len / (mode === 'conduit' ? CAR : n.age > 70 ? 1.2 : WALK) / 3600;
          const last = segs[segs.length - 1]; const dep = Math.max(last.t0 + 0.02, s.t0 - dur - 0.02);
          last.t1 = dep; segs.push({ t0: dep, t1: dep + dur, type: 'travel', from: prev, to: s.place, mode, len, act: s.act }); cur = dep + dur;
        } else cur = Math.max(cur, segs[segs.length - 1].t1);
      }
      const t0 = Math.max(cur, i === 0 ? 0 : (segs[segs.length - 1]?.t1 ?? 0)); segs.push({ t0, t1: Math.max(t0 + 0.001, s.t1), type: 'stay', stay: s, act: s.act, len: 0 }); cur = Math.max(t0, s.t1);
    }
    this.tl.set(n.id, { day, segs }); return segs;
  }
  private ensurePath(sg: Seg) {
    if (sg.path !== undefined) return sg.path;
    const veh = sg.mode === 'conduit'; const a = this.graph.nearest(sg.from!.x, sg.from!.z, 120, veh), b = this.graph.nearest(sg.to!.x, sg.to!.z, 120, veh);
    const nodes = this.graph.path(a, b, veh); if (!nodes) { sg.path = null; return null; }
    const pl = veh ? this.graph.vehPolyline(nodes).pts : this.graph.polyline(nodes, true, 1);
    sg.path = [[sg.from!.x, sg.from!.z], ...pl, [sg.to!.x, sg.to!.z]]; sg.len = polyLength(sg.path); return sg.path;
  }
  /** `detailed` : calcule le vrai chemin (A*) ; sinon trajet en ligne droite (PNJ lointains, invisibles). */
  stateAt(n: Npc, day: number, hour: number, detailed: boolean): NpcState {
    const segs = this.timeline(n, day); let sg = segs[segs.length - 1]; for (const s of segs) if (hour < s.t1) { sg = s; break; }
    if (sg.type === 'stay') {
      const p = sg.stay!.place; const act = sg.stay!.act;
      if (act === 'hors_carte') return { id: n.id, x: p.x, z: p.z, h: 0, kind: 'absent', act, speed: 0, place: p, detail: ACT_LABEL[act] };
      if (INDOOR.has(p.kind)) return { id: n.id, x: p.x, z: p.z, h: 0, kind: 'dedans', act, speed: 0, place: p, detail: `${ACT_LABEL[act]} — ${p.nom}` };
      const ph = (n.seed % 1000) / 159 + hour * 0.35; const x = p.x + Math.cos(ph) * 9, z = p.z + Math.sin(ph * 1.3) * 7;    // promenade lente dans le parc
      return { id: n.id, x, z, h: Math.atan2(-Math.sin(ph) * 9, Math.cos(ph * 1.3) * 9 * 1.3 * 7 / 9), kind: 'dehors', act, speed: 0.8, place: p, detail: `${ACT_LABEL[act]} — ${p.nom}` };
    }
    const f = Math.min(1, Math.max(0, (hour - sg.t0) / Math.max(1e-6, sg.t1 - sg.t0)));
    const path = detailed ? this.ensurePath(sg) : null; const to = sg.to!, from = sg.from!;
    const verbe = sg.mode === 'conduit' ? 'en voiture' : 'à pied'; const detail = `en route vers ${to.nom} (${verbe})`;
    if (path) { const p = pointAlong(path, f * sg.len); return { id: n.id, x: p.x, z: p.z, h: p.h, kind: sg.mode!, act: sg.act, speed: sg.len / ((sg.t1 - sg.t0) * 3600), place: to, detail }; }
    return { id: n.id, x: from.x + (to.x - from.x) * f, z: from.z + (to.z - from.z) * f, h: Math.atan2(to.x - from.x, to.z - from.z), kind: sg.mode!, act: sg.act, speed: sg.len / ((sg.t1 - sg.t0) * 3600), place: to, detail };
  }
  /** Trajet en cours (chemin détaillé) : sert à le rejouer à vitesse réelle près du joueur. */
  trip(n: Npc, day: number, hour: number): { key: string; path: Pt[]; len: number; f: number; mode: 'marche' | 'conduit'; to: Place; act: Act; detail: string; slow: boolean } | null {
    const segs = this.timeline(n, day); let sg = segs[segs.length - 1]; for (const x of segs) if (hour < x.t1) { sg = x; break; }
    if (sg.type !== 'travel') return null; const path = this.ensurePath(sg); if (!path) return null;
    const f = Math.min(1, Math.max(0, (hour - sg.t0) / Math.max(1e-6, sg.t1 - sg.t0)));
    return { key: `${day}:${sg.t0.toFixed(4)}`, path, len: sg.len, f, mode: sg.mode!, to: sg.to!, act: sg.act, detail: `en route vers ${sg.to!.nom} (${sg.mode === 'conduit' ? 'en voiture' : 'à pied'})`, slow: n.age > 70 };
  }
  /** Journal d'activité du jour jusqu'à l'heure courante (plus récent en dernier). */
  journal(n: Npc, day: number, hour: number, max = 9): string[] {
    const out: string[] = []; const segs = this.timeline(n, day); let prevAct: Act | null = null;
    for (const s of segs) {
      if (s.t0 > hour) break;
      if (s.type === 'travel') { out.push(`${fmt(s.t0)} : part vers ${s.to!.nom} ${s.mode === 'conduit' ? 'en voiture' : 'à pied'}`); prevAct = null; }
      else if (s.stay!.act !== prevAct) { const p = s.stay!.place; if (s.stay!.act === 'hors_carte') out.push(`${fmt(s.t0)} : part travailler hors de la commune`); else out.push(`${fmt(s.t0)} : ${ACT_LABEL[s.stay!.act]}${INDOOR.has(p.kind) || p.kind === 'parc' ? ` (${p.nom})` : ''}`); prevAct = s.stay!.act; }
    }
    return out.slice(-max);
  }
}
