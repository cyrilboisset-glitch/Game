/** Horloge du monde : 20 minutes réelles = 24 h de jeu (réglable). */
export class Clock {
  hour: number; day = 1; scale = 1; realMinutesPerDay = 20;
  constructor(start = 15) { this.hour = start; }
  /** Avance de dt secondes réelles ; retourne les heures de jeu écoulées. */
  tick(dt: number) {
    const h = dt / 60 / this.realMinutesPerDay * 24 * this.scale; this.hour += h;
    while (this.hour >= 24) { this.hour -= 24; this.day++; } return h;
  }
  get label() { const hh = Math.floor(this.hour), mm = Math.floor((this.hour % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
}
