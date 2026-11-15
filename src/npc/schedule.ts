import { rng } from '../interiors/generator';
import { JOBS, type Npc, type Place } from './identity';

export type Act = 'sommeil' | 'maison' | 'travail' | 'ecole' | 'dejeuner' | 'courses' | 'loisir' | 'hors_carte';
export interface Stay { act: Act; place: Place; t0: number; t1: number; }
export const ACT_LABEL: Record<Act, string> = { sommeil: 'dort', maison: 'est chez soi', travail: 'travaille', ecole: 'est en cours', dejeuner: 'déjeune', courses: 'fait ses courses', loisir: 'se promène', hors_carte: 'travaille hors de la commune' };

/** Emploi du temps d'une journée (heures 0-24), déterministe : graine PNJ + numéro de jour. dow : 0 = lundi. */
export function dayPlan(n: Npc, dow: number, day: number): Stay[] {
  const r = rng(n.seed ^ (day * 7919)); const job = JOBS.find(j => j.m === n.metier)!; const we = dow >= 5; const j = () => (r() - 0.5);
  const wake = (we ? 8 : 6.4) + r() * 1.3 + (n.metier === 'boulanger' && !we ? -2.2 : 0), bed = 22.2 + r() * 1.4;
  const S: Stay[] = []; let t = 0; const add = (act: Act, place: Place, dur: number | null, until?: number) => { const t1 = Math.min(24, until ?? t + (dur ?? 0)); if (t1 <= t + 0.01) return; S.push({ act, place, t0: t, t1 }); t = t1; };
  add('sommeil', n.home, null, wake); add('maison', n.home, null, wake + 0.6 + r() * 0.4);
  const worksToday = !we && job.shift[1] > 0 || (we && n.metier === 'serveur') || (n.metier === 'vendeur' && dow === 5) || (n.metier === 'boulanger' && dow < 6);
  const closedWed = n.metier === 'eleve' && dow === 2;
  if (worksToday && job.shift[1] > 0) {
    const s = job.shift[0] + j() * 0.5; const e = job.shift[1] + j() * 0.5; const act: Act = n.metier === 'eleve' ? 'ecole' : job.off ? 'hors_carte' : 'travail';
    if (t < s - 0.1) add('maison', n.home, null, s - 0.25);
    const e2 = closedWed ? 12.2 : e;
    if (job.lunch && !closedWed && e2 - s > 6) { const l0 = s + (e2 - s) * 0.5 - 0.25, l1 = l0 + 1.0; add(act, n.work, null, l0); add('dejeuner', r() < 0.4 && n.metier !== 'eleve' ? n.resto : (n.metier === 'eleve' ? n.work : n.home), null, l1); add(act, n.work, null, e2); }
    else add(act, n.work, null, e2);
  } else if (n.metier === 'retraite' || n.metier === 'sans_emploi' || we || !worksToday) {
    if (r() < 0.8) { add('maison', n.home, null, 9.5 + r()); add('courses', n.shop, 0.5 + r() * 0.4); }
    add('maison', n.home, null, 11.8 + r() * 0.5); add('dejeuner', r() < 0.2 && !n.minor ? n.resto : n.home, 1.1);
    if (r() < 0.65) { add('maison', n.home, null, 14.3 + r() * 1.5); add('loisir', n.park, 1 + r() * 1.5); }
  }
  if (!n.minor && t < 19.5 && r() < 0.45 && (worksToday || we)) { add('maison', n.home, null, t + 0.3); add('courses', n.shop, 0.4 + r() * 0.3); }
  else if (n.minor && t < 19) { add('maison', n.home, null, t + 0.4); if (r() < 0.4) add('loisir', n.park, 0.8); }
  add('maison', n.home, null, Math.max(t, 19.0 + r() * 0.8)); if (!n.minor && r() < 0.25 && t < 21) add('loisir', n.park, 0.7);
  add('maison', n.home, null, bed); add('sommeil', n.home, null, 24); return S;
}
