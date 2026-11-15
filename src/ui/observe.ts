import type { Npc } from '../npc/identity';
import type { NpcSim, NpcState } from '../npc/sim';

/** Panneau du mode observation : fiche du PNJ suivi, journal d'activité en direct, vitesse du temps. */
export class ObservePanel {
  el = document.createElement('div'); private last = 0; onQuit: () => void = () => {}; onSpeed: (s: number) => void = () => {};
  constructor() {
    this.el.id = 'observe'; this.el.className = 'ui'; this.el.style.display = 'none'; document.body.appendChild(this.el);
    this.el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; if (b.dataset.speed) { this.onSpeed(+b.dataset.speed); this.el.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); } if (b.dataset.quit) this.onQuit(); });
  }
  show(on: boolean) { this.el.style.display = on ? 'block' : 'none'; this.last = 0; }
  update(n: Npc, s: NpcState, sim: NpcSim, day: number, hour: number, now: number, speed: number) {
    if (now - this.last < 500) return; this.last = now;
    const j = sim.journal(n, day, hour).map(l => `<li>${l}</li>`).join('');
    this.el.innerHTML = `<h3>${n.prenom} ${n.nom} <small>${n.age} ans</small></h3><div class="m">${n.metierLabel}</div>
      <div>🏠 ${n.adresse}</div><div>💼 ${n.work.kind === 'hors' ? 'hors de la commune' : n.work.nom}</div><div>${n.hasCar ? '🚗 a une voiture' : '🚶 se déplace à pied'} · 💶 ${n.argent} €</div>
      <div class="now">▶ ${s.detail}</div><ul>${j}</ul>
      <div class="sp">${[1, 10, 60].map(x => `<button data-speed="${x}" class="${x === speed ? 'on' : ''}">×${x}</button>`).join('')}<button data-quit="1">Quitter</button></div>`;
  }
}
