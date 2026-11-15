/** « Recherche » : niveau de suspicion 0-100 (0 = oublié). Décroît quand on se tient à l'écart. */
export class Heat {
  value = 0;
  add(v: number) { this.value = Math.min(100, this.value + v); }
  /** h = heures de jeu ; discret = true si personne ne regarde (décroissance 3x plus rapide). */
  tick(h: number, discret: boolean) { this.value = Math.max(0, this.value - (discret ? 9 : 3) * h); }
  get stars() { return this.value >= 80 ? 5 : this.value >= 60 ? 4 : this.value >= 40 ? 3 : this.value >= 20 ? 2 : this.value > 0 ? 1 : 0; }
}
