// Mémoire du voisinage : maisons cambriolées qui s'équipent d'une alarme, commerçants braqués qui reconnaissent un visage, quartiers qui deviennent méfiants. Logique pure.
const CELL = 300;
export const cellOf = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
export interface Face { day: number; outfit: string; }

export class Memory {
  alarms = new Map<string, number>();     // logement (bâtiment/appartement) → jour où l'alarme est posée
  known = new Map<string, Face>();        // commerce (identifiant du lieu) → souvenir du visage du braqueur
  heat = new Map<string, number>();       // quartier → méfiance (0-1)
  /** Un logement est cambriolé : les habitants font poser une alarme le lendemain. */
  burgled(home: string, day: number) { if (!this.alarms.has(home)) this.alarms.set(home, day + 1); }
  alarmed(home: string, day: number) { const d = this.alarms.get(home); return d !== undefined && day >= d; }
  /** Un commerçant a vu le visage du braqueur (et sa tenue). */
  saw(shop: string, day: number, outfit: string) { this.known.set(shop, { day, outfit }); }
  /** Le commerçant reconnaît-il le joueur ? Oui pendant 10 jours si le visage est découvert ; plus facilement avec la même tenue. */
  recognizes(shop: string, day: number, hooded: boolean, outfit: string, rnd: number) { const f = this.known.get(shop); if (!f || day - f.day > 10 || hooded) return false; return rnd < (f.outfit === outfit ? 0.95 : 0.6); }
  /** Un délit dans un quartier augmente sa méfiance (plafonnée à 1). */
  crimeAt(x: number, z: number, v: number) { const k = cellOf(x, z); this.heat.set(k, Math.min(1, (this.heat.get(k) ?? 0) + v / 120)); }
  suspicion(x: number, z: number) { return this.heat.get(cellOf(x, z)) ?? 0; }
  /** La méfiance retombe lentement (environ la moitié par jour). */
  tick(h: number) { for (const [k, v] of this.heat) { const n = v * Math.pow(0.5, h / 24); if (n < 0.02) this.heat.delete(k); else this.heat.set(k, n); } }
  save() { return { a: [...this.alarms], k: [...this.known], h: [...this.heat] }; }
  load(s: any) { if (!s) return; this.alarms = new Map(s.a ?? []); this.known = new Map(s.k ?? []); this.heat = new Map(s.h ?? []); }
}
