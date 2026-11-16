// Enquête différée : chaque crime grave ouvre un dossier. Les preuves s'accumulent ou s'effacent ; à l'échéance, classement ou mandat d'arrêt. Peine de prison à l'arrestation. Logique pure.
export type Kind = 'braquage' | 'enlevement' | 'incendie' | 'feu' | 'tir' | 'homejacking' | 'holdup';
export interface Dossier { id: number; kind: Kind; titre: string; jour: number; preuves: number; gravite: number; echeance: number; vehicule: string | null; tenue: string | null; clos: boolean; mandat: boolean; }
const TITRES: Record<Kind, string> = { braquage: 'Braquage', enlevement: 'Enlèvement', incendie: 'Incendie criminel', feu: 'Véhicule incendié', tir: 'Coups de feu', homejacking: 'Home-jacking', holdup: 'Hold-up' };
const GRAVITE: Record<Kind, number> = { braquage: 8, enlevement: 10, incendie: 7, feu: 2, tir: 6, homejacking: 5, holdup: 4 };

export class Enquete {
  dossiers: Dossier[] = []; private next = 1; gants = false;
  /** Heure absolue (jours × 24 + heures). */
  static abs(day: number, hour: number) { return day * 24 + hour; }
  /** Ouvre (ou complète, si un dossier du même type est ouvert depuis moins d'une heure) un dossier. `w` : poids des preuves laissées (0-1+). */
  open(kind: Kind, day: number, hour: number, w: number, traces: { vehicule: string | null; tenue: string | null }) {
    const now = Enquete.abs(day, hour); const base = 25 * w * (this.gants ? 0.6 : 1);
    const cur = this.dossiers.find(d => !d.clos && d.kind === kind && now - Enquete.abs(d.jour, 0) < 26 && d.echeance - now > 20);
    if (cur) { cur.preuves = Math.min(100, cur.preuves + base * 0.6); cur.vehicule ??= traces.vehicule; cur.tenue ??= traces.tenue; return cur; }
    const d: Dossier = { id: this.next++, kind, titre: TITRES[kind], jour: day, preuves: Math.min(100, base), gravite: GRAVITE[kind], echeance: now + 24 + GRAVITE[kind] * 3, vehicule: traces.vehicule, tenue: traces.tenue, clos: false, mandat: false };
    this.dossiers.push(d); return d;
  }
  /** Le véhicule utilisé brûle : cette piste s'éteint. */
  burnCar(id: string | null) { for (const d of this.dossiers) if (!d.clos && (id === null || d.vehicule === id)) { if (d.vehicule) d.preuves = Math.max(0, d.preuves - 30); d.vehicule = null; } }
  /** Nouvelle tenue : la description vestimentaire ne vaut plus grand-chose. */
  changeOutfit() { for (const d of this.dossiers) if (!d.clos && d.tenue) { d.preuves = Math.max(0, d.preuves - 8); d.tenue = null; } }
  /** Témoignages, images de vidéosurveillance… : ajoute des preuves au dossier ouvert le plus récent du type. */
  add(kind: Kind, v: number) { const d = [...this.dossiers].reverse().find(q => !q.clos && q.kind === kind); if (d) d.preuves = Math.min(100, d.preuves + v); }
  /** Avance le temps. Les pistes (véhicule encore en circulation) font monter les preuves ; à l'échéance : mandat (≥ 60) ou classement. */
  tick(h: number, day: number, hour: number, hiddenCar: string | null = null) {
    const now = Enquete.abs(day, hour); const ev: { mandat: Dossier[]; classes: Dossier[] } = { mandat: [], classes: [] };
    for (const d of this.dossiers) { if (d.clos || d.mandat) continue; d.preuves = Math.min(100, d.preuves + (d.vehicule && d.vehicule !== hiddenCar ? 1.2 : 0) * h + (d.tenue ? 0.4 : 0) * h);
      if (now >= d.echeance) { if (d.preuves >= 60) { d.mandat = true; ev.mandat.push(d); } else { d.clos = true; ev.classes.push(d); } } }
    return ev;
  }
  get mandat() { return this.dossiers.some(d => d.mandat && !d.clos); }
  get open_() { return this.dossiers.filter(d => !d.clos); }
  /** Peine (jours) : flagrant délit selon les étoiles + dossiers sous mandat + dossiers ouverts aux preuves solides. 0 = simple amende. */
  sentence(stars: number) {
    let days = stars >= 4 ? 3 : stars >= 3 ? 1 : 0;
    for (const d of this.dossiers) { if (d.clos) continue; if (d.mandat) days += d.gravite * 2; else if (d.preuves >= 45) days += d.gravite; }
    return Math.min(60, days);
  }
  /** Après la prison ou un non-lieu : tout est clos. */
  closeAll() { for (const d of this.dossiers) d.clos = true; this.dossiers = this.dossiers.filter(d => Enquete.abs(d.jour, 0) > 0).slice(-20); }
  save() { return { d: this.dossiers, n: this.next, g: this.gants }; }
  load(s: any) { if (!s) return; this.dossiers = s.d ?? []; this.next = s.n ?? 1; this.gants = !!s.g; }
}
