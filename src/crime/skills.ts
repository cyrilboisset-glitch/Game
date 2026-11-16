// Compétences qui s'améliorent en pratiquant (crochetage, conduite, discrétion, endurance) et réputation dans le milieu. Logique pure.
export type Skill = 'crochetage' | 'conduite' | 'discretion' | 'endurance';
export const SKILLS: Record<Skill, { nom: string; effet: (l: number) => string }> = {
  crochetage: { nom: 'Crochetage', effet: l => `serrure en ${pickTime(l).toFixed(1)} s, alarme ${Math.round(alarmK(l) * 100)} % du risque` },
  conduite: { nom: 'Conduite', effet: l => `+${l * 4} % d'accélération et d'adhérence` },
  discretion: { nom: 'Discrétion', effet: l => `les témoins vous voient ${l * 6} % moins loin` },
  endurance: { nom: 'Endurance', effet: l => `course +${l * 2} %, fatigue −${l * 7} %` },
};
export const LEVELS = [3, 8, 15, 25, 40];   // points d'expérience cumulés pour passer les niveaux 1 à 5
export const levelOf = (xp: number) => LEVELS.filter(t => xp >= t).length;
export const pickTime = (l: number) => Math.max(2.1, 4.5 * (1 - 0.11 * l));
export const alarmK = (l: number) => 1 - 0.12 * l;
export const sightK = (l: number) => 1 - 0.06 * l;

export class Skills {
  xp: Record<Skill, number> = { crochetage: 0, conduite: 0, discretion: 0, endurance: 0 }; private acc: Record<Skill, number> = { crochetage: 0, conduite: 0, discretion: 0, endurance: 0 };
  level(s: Skill) { return levelOf(this.xp[s]); }
  /** Ajoute de l'expérience (fractions accumulées) ; retourne le nouveau niveau s'il vient d'augmenter. */
  gain(s: Skill, n: number): number | null { const before = this.level(s); this.acc[s] += n; const whole = Math.floor(this.acc[s]); if (whole > 0) { this.acc[s] -= whole; this.xp[s] += whole; } const after = this.level(s); return after > before ? after : null; }
  /** Progression vers le niveau suivant (0-1). */
  progress(s: Skill) { const l = this.level(s); if (l >= LEVELS.length) return 1; const lo = l ? LEVELS[l - 1] : 0; return (this.xp[s] - lo) / (LEVELS[l] - lo); }
  save() { return this.xp; }
  load(s: any) { if (s) this.xp = { ...this.xp, ...s }; }
}
/** Rangs dans le milieu selon la réputation (0-100). */
export const RANKS: [number, string][] = [[0, 'Inconnu'], [10, 'Petite main'], [25, 'Débrouillard'], [45, 'Pointure'], [70, 'Caïd de la vallée']];
export const rankOf = (rep: number) => [...RANKS].reverse().find(([r]) => rep >= r)![1];
