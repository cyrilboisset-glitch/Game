/** Besoins vitaux (0-100). Logique pure, testable : le temps est donné en heures de jeu. */
export interface NeedsState { faim: number; soif: number; energie: number; vessie: number; sante: number; }
export const NEEDS_DEFAULT: NeedsState = { faim: 80, soif: 80, energie: 90, vessie: 15, sante: 100 };

export const RATES = { faim: -4.2, soif: -6.0, energie: -3.8, vessie: 7.5 } as const; // par heure de jeu (éveillé)
export type Status = 'ok' | 'faible' | 'critique';

export class Needs {
  s: NeedsState;
  constructor(init?: Partial<NeedsState>) { this.s = { ...NEEDS_DEFAULT, ...init }; }
  /** Avance de `h` heures de jeu. `sleeping` : le sommeil restaure l'énergie et ralentit faim/soif. */
  tick(h: number, sleeping = false, effort = 1) {
    const s = this.s; const k = sleeping ? 0.35 : effort;
    s.faim = clamp(s.faim + RATES.faim * h * k); s.soif = clamp(s.soif + RATES.soif * h * k);
    s.vessie = clamp(s.vessie + RATES.vessie * h * (sleeping ? 0.4 : 1));
    s.energie = clamp(s.energie + (sleeping ? 12 : RATES.energie * effort) * h);
    const critical = [s.faim <= 0, s.soif <= 0, s.energie <= 0, s.vessie >= 100].filter(Boolean).length;
    if (critical) s.sante = clamp(s.sante - 6 * critical * h);
    else if (s.faim > 40 && s.soif > 40 && s.energie > 25) s.sante = clamp(s.sante + 2.5 * h);
  }
  eat(v: number) { this.s.faim = clamp(this.s.faim + v); }
  drink(v: number) { this.s.soif = clamp(this.s.soif + v); }
  relieve() { this.s.vessie = 0; }
  status(k: 'faim' | 'soif' | 'energie' | 'vessie'): Status {
    const v = k === 'vessie' ? 100 - this.s[k] : this.s[k];
    return v <= 5 ? 'critique' : v <= 25 ? 'faible' : 'ok';
  }
  get dead() { return this.s.sante <= 0; }
  /** Multiplicateur de vitesse de déplacement dû à la fatigue/faim. */
  get speedFactor() { return this.s.energie < 10 ? 0.7 : this.s.energie < 25 ? 0.85 : 1; }
}
const clamp = (v: number) => Math.max(0, Math.min(100, v));
