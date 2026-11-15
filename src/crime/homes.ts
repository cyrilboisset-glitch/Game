// Logements : qui est à la maison, qui dort, quand la maison sera vide (repérage). Logique pure, testable.
import type { Npc } from '../npc/identity';
import type { NpcState } from '../npc/sim';

export interface Occupancy { adults: Npc[]; minors: Npc[]; asleep: boolean; }
const home = (s: NpcState) => s.kind === 'dedans' && s.place.kind === 'maison';

/** Occupants présents dans le logement (d'après l'emploi du temps simulé de chaque habitant du foyer). */
export function occupancy(residents: Npc[], stateOf: (n: Npc) => NpcState): Occupancy {
  const adults: Npc[] = [], minors: Npc[] = []; let awake = 0;
  for (const n of residents) { const s = stateOf(n); if (!home(s)) continue; (n.minor ? minors : adults).push(n); if (s.act !== 'sommeil') awake++; }
  return { adults, minors, asleep: adults.length + minors.length > 0 && awake === 0 };
}
/** Indice visible depuis la rue : lumière la nuit si quelqu'un est réveillé. */
export function streetCue(o: Occupancy, hour: number) {
  const night = hour >= 19.5 || hour < 7; const n = o.adults.length + o.minors.length;
  if (night) return n && !o.asleep ? 'lumière allumée' : 'tout est éteint';
  return 'volets entrouverts';
}
/** Ce qu'on apprend en écoutant à la porte. */
export function listenReport(o: Occupancy) {
  if (o.minors.length) return 'des voix d\'enfants';
  if (!o.adults.length) return 'aucun bruit : personne';
  if (o.asleep) return o.adults.length > 1 ? `${o.adults.length} personnes endormies` : 'quelqu\'un dort';
  return o.adults.length > 1 ? `${o.adults.length} adultes réveillés` : 'un adulte réveillé';
}
const fmt = (h: number) => { const x = ((h % 24) + 24) % 24; return `${Math.floor(x)} h ${String(Math.floor((x % 1) * 60)).padStart(2, '0')}`; };
/** Prochaine période (dans les 24 h) où tout le foyer est absent, par pas de 10 minutes. `stateAt(n, jour, heure)`. */
export function nextEmpty(residents: Npc[], stateAt: (n: Npc, day: number, hour: number) => NpcState, day: number, hour: number): { from: number; to: number; text: string } | null {
  const step = 1 / 6; let from = -1;
  for (let k = 0; k <= 24 * 6; k++) {
    const t = hour + k * step, d = day + Math.floor(t / 24), h = t % 24;
    const empty = residents.every(n => !home(stateAt(n, d, h)));
    if (empty && from < 0) from = t;
    if (!empty && from >= 0) { if (t - from >= 0.5) return { from, to: t, text: from <= hour ? `vide jusqu'à ${fmt(t)}` : `vide de ${fmt(from)} à ${fmt(t)}` }; from = -1; }
  }
  return from >= 0 ? { from, to: hour + 24, text: from <= hour ? 'vide pour la journée' : `vide à partir de ${fmt(from)}` } : null;
}
