import type { Offer } from '../missions/generator';

/** Journal de missions (touche J) : offres du jour, sélection au clavier (↑↓, Entrée) ou au toucher. */
export class MissionsPanel {
  el = document.createElement('div'); open = false; sel = 0; offers: Offer[] = []; onAccept: (o: Offer) => void = () => {}; onAbandon: () => void = () => {};
  private info = { rep: 0, active: '' as string };
  constructor() {
    this.el.id = 'missions'; this.el.className = 'ui'; this.el.style.display = 'none'; document.body.appendChild(this.el);
    this.el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-i],[data-abandon],[data-close]') as HTMLElement | null; if (!b) return; if (b.dataset.close) this.toggle(false); else if (b.dataset.abandon) { this.onAbandon(); this.render(); } else { this.sel = +b.dataset.i!; this.accept(); } });
    addEventListener('keydown', e => { if (!this.open) return; if (e.code === 'ArrowDown') { this.sel = (this.sel + 1) % Math.max(1, this.offers.length); this.render(); } if (e.code === 'ArrowUp') { this.sel = (this.sel + this.offers.length - 1) % Math.max(1, this.offers.length); this.render(); } if (e.code === 'Enter') this.accept(); if (e.code === 'Escape') this.toggle(false); });
  }
  toggle(on = !this.open) { this.open = on; this.el.style.display = on ? 'block' : 'none'; if (on) this.render(); }
  setOffers(o: Offer[], rep: number, active: string) { this.offers = o; this.info = { rep, active }; if (this.open) this.render(); }
  private accept() { const o = this.offers[this.sel]; if (o) { this.onAccept(o); this.toggle(false); } }
  render() {
    const rows = this.offers.map((o, i) => `<div class="row ${i === this.sel ? 'sel' : ''}" data-i="${i}"><b>${o.titre}</b><span>${o.pay ? o.pay + ' €' : 'à la course'}${o.limit ? ' · ' + Math.floor(o.limit / 60) + ' min' : ''}${o.risky ? ' · ⚠ risqué' : ''}${o.needsCar ? ' · 🚗' : ''}</span><small>${o.desc}</small></div>`).join('');
    this.el.innerHTML = `<h3>Missions <small>réputation ${Math.round(this.info.rep)}/100</small></h3>${this.info.active ? `<div class="act">En cours : ${this.info.active} <button data-abandon="1">Abandonner</button></div>` : ''}${rows || '<i>Aucune offre pour l\'instant.</i>'}<div class="hint">↑↓ choisir · Entrée accepter · J fermer <button data-close="1">Fermer</button></div>`;
  }
}
