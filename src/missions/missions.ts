import type { Offer, Stage } from './generator';
import { repMult } from './generator';

export interface Active { offer: Offer; stage: number; t: number; carrying: boolean; }
export interface MissionCtx { x: number; z: number; speed: number; inCar: boolean; stars: number; target?: { x: number; z: number } | null; }
export type MEvent = { type: 'prise'; label: string } | { type: 'point'; label: string; n: number } | { type: 'fini'; pay: number; rep: number; note: string } | { type: 'echec'; why: string } | null;

/** Progression d'une mission : étapes à rejoindre, délai, paie (réduite si la gendarmerie est aux trousses sur une mission risquée). */
export class Missions {
  active: Active | null = null; rep = 0; done = 0;
  accept(o: Offer) { this.active = { offer: o, stage: 0, t: 0, carrying: false }; }
  abandon() { this.active = null; }
  stage(): Stage | null { return this.active ? this.active.offer.stages[this.active.stage] ?? null : null; }
  /** Avance d'un pas ; retourne l'événement déclenché (s'il y en a un). */
  update(dt: number, c: MissionCtx): MEvent {
    const a = this.active; if (!a) return null; a.t += dt; const o = a.offer;
    if (o.limit !== null && a.t > o.limit) { this.active = null; return { type: 'echec', why: 'Temps écoulé.' }; }
    const s = this.stage(); if (!s) return null; if (o.needsCar && !c.inCar) return null;
    const tx = c.target?.x ?? s.x, tz = c.target?.z ?? s.z; if (Math.hypot(c.x - tx, c.z - tz) > s.r) return null; if (s.kind !== 'point' && c.speed > 7) return null;
    a.stage++;
    if (s.kind === 'prise') { a.carrying = true; return { type: 'prise', label: s.label }; }
    if (s.kind === 'point' && a.stage < o.stages.length) return { type: 'point', label: s.label, n: a.stage };
    // dernière étape : paie
    const done = o; const cut = done.risky && c.stars >= 2 ? 0.5 : 1; const pay = Math.round(done.pay * cut); const gain = done.rep; this.rep = Math.min(100, this.rep + gain); this.done++; this.active = null;
    return { type: 'fini', pay, rep: gain, note: cut < 1 ? 'Prime réduite de moitié : la gendarmerie est sur vos talons.' : '' };
  }
  fail(why: string): MEvent { if (!this.active) return null; this.active = null; return { type: 'echec', why }; }
  mult() { return repMult(this.rep); }
  remaining() { const a = this.active; return a && a.offer.limit !== null ? Math.max(0, Math.round(a.offer.limit - a.t)) : null; }
}
