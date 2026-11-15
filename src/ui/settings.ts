import type { Level } from '../core/quality';

/** Réglages (⚙) : qualité (auto/bas/moyen/élevé), volume, son, informations de performance. Mémorisés en localStorage. */
export class Settings {
  el = document.createElement('div'); btn = document.createElement('button'); open = false; stats = ''; quality: Level | 'auto' = 'auto'; volume = 0.7; muted = false;
  onQuality: (q: Level | 'auto') => void = () => {}; onVolume: (v: number) => void = () => {}; onMute: (m: boolean) => void = () => {};
  constructor() {
    try { const s = JSON.parse(localStorage.getItem('pontcharra-settings') ?? '{}'); if (s.quality) this.quality = s.quality; if (typeof s.volume === 'number') this.volume = s.volume; if (s.muted) this.muted = true; } catch { /* réglages par défaut */ }
    this.btn.id = 'gear'; this.btn.className = 'ui'; this.btn.textContent = '⚙'; this.btn.setAttribute('aria-label', 'Réglages'); document.body.appendChild(this.btn);
    this.el.id = 'settings'; this.el.className = 'ui'; this.el.style.display = 'none'; document.body.appendChild(this.el);
    this.btn.addEventListener('click', () => this.toggle()); addEventListener('keydown', e => { if (e.code === 'KeyM') { this.muted = !this.muted; this.onMute(this.muted); this.save(); this.render(); } if (e.code === 'F2') this.toggle(); });
    this.el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; if (b.dataset.q) { this.quality = b.dataset.q as Level | 'auto'; this.onQuality(this.quality); } if (b.dataset.mute) { this.muted = !this.muted; this.onMute(this.muted); } this.save(); this.render(); });
    this.el.addEventListener('input', e => { const t = e.target as HTMLInputElement; if (t.id === 'vol') { this.volume = +t.value / 100; this.onVolume(this.volume); this.save(); } });
  }
  toggle() { this.open = !this.open; this.el.style.display = this.open ? 'block' : 'none'; if (this.open) this.render(); }
  private save() { try { localStorage.setItem('pontcharra-settings', JSON.stringify({ quality: this.quality, volume: this.volume, muted: this.muted })); } catch { /* stockage indisponible */ } }
  setStats(s: string) { if (this.open && s !== this.stats) { this.stats = s; const e = this.el.querySelector('#perf'); if (e) e.innerHTML = s; } this.stats = s; }
  render() {
    const q = (v: string, l: string) => `<button data-q="${v}" class="${this.quality === v ? 'on' : ''}">${l}</button>`;
    this.el.innerHTML = `<h3>Réglages</h3><div>Qualité graphique</div><div class="r">${q('auto', 'Auto')}${q('bas', 'Bas')}${q('moyen', 'Moyen')}${q('eleve', 'Élevé')}</div>
      <div>Volume <input id="vol" type="range" min="0" max="100" value="${Math.round(this.volume * 100)}"> <button data-mute="1">${this.muted ? '🔇 Son coupé' : '🔊 Son'}</button></div><div id="perf" class="p">${this.stats}</div><div class="hint">F2 réglages · M son · lieux et intérieurs générés (aucune reproduction réelle)</div>`;
  }
}
