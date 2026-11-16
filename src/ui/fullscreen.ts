// Plein écran sur téléphone : masque la barre d'adresse du navigateur dès le premier appui (l'API exige un geste de l'utilisateur),
// et le rétablit au prochain appui si on en est sorti (geste retour). Désactivable dans le menu.
export class Fullscreen {
  wanted = true;
  constructor(private touch: boolean) {
    try { this.wanted = localStorage.getItem('pontcharra-fs') !== '0'; } catch { /* stockage indisponible */ }
    if (!touch) return;
    addEventListener('pointerdown', () => { if (this.wanted && !this.active) this.enter(); }, { capture: true });
    addEventListener('resize', () => scrollTo(0, 1));
  }
  get active() { return !!document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches; }
  enter() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try { const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : (el.webkitRequestFullscreen?.(), undefined); p?.catch(() => {}); } catch { /* refusé par le navigateur */ }
  }
  /** Bouton du menu : bascule plein écran et mémorise le choix. */
  toggle() {
    this.wanted = !document.fullscreenElement; try { localStorage.setItem('pontcharra-fs', this.wanted ? '1' : '0'); } catch { /* ignoré */ }
    if (this.wanted) this.enter(); else document.exitFullscreen?.().catch(() => {});
  }
}
