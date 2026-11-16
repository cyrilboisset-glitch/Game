// Téléphone du joueur : carte plein écran (repères, itinéraire), messages du milieu, dossiers d'enquête, contacts, missions, sauvegardes.
import type { Game } from '../game';
import type { WorldData } from '../world/data';
import * as Save from '../core/save';
import { ROLES, type Role } from '../crime/heist';

type Tab = 'carte' | 'messages' | 'dossiers' | 'contacts' | 'sauvegardes';
const esc = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c]);

export class Phone {
  el = document.createElement('div'); btn = document.createElement('button'); open = false; tab: Tab = 'carte';
  private cv!: HTMLCanvasElement; private cx = 0; private cz = 0; private zoom = 0.35; private drag: { x: number; y: number; cx: number; cz: number; moved: boolean } | null = null; private shownUnread = -1; private lastDraw = 0;
  constructor(private g: Game, private w: WorldData) {
    this.btn.id = 'phoneBtn'; this.btn.className = 'ui'; this.btn.textContent = '📱'; this.btn.setAttribute('aria-label', 'Téléphone'); document.body.appendChild(this.btn);
    this.btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.toggle(); });
    this.el.id = 'phone'; this.el.className = 'ui'; this.el.style.display = 'none'; document.body.appendChild(this.el);
    this.el.innerHTML = `<div class="ph-top"><b>📱 Téléphone</b><span class="ph-clock"></span><button data-x="1">✕</button></div><div class="ph-body"></div>
      <div class="ph-tabs">${(['carte', 'messages', 'dossiers', 'contacts', 'sauvegardes'] as Tab[]).map(t => `<button data-t="${t}">${{ carte: '🗺️<br>Carte', messages: '✉️<br>Messages', dossiers: '🗂️<br>Dossiers', contacts: '👥<br>Contacts', sauvegardes: '💾<br>Sauver' }[t]}</button>`).join('')}</div>`;
    this.el.addEventListener('pointerdown', e => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b) return; e.preventDefault(); if (b.dataset.x) this.toggle(false); else if (b.dataset.t) this.show(b.dataset.t as Tab); else if (b.dataset.do) this.act(b.dataset.do, b.dataset.arg ?? ''); });
    addEventListener('keydown', e => { if (e.code === 'KeyP') this.toggle(); else if (e.code === 'Escape' && this.open) this.toggle(false); });
  }
  toggle(on = !this.open) { this.open = on; this.el.style.display = on ? 'flex' : 'none'; if (on) { this.cx = this.g.pos.x; this.cz = this.g.pos.z; this.show(this.tab); } }
  private body() { return this.el.querySelector('.ph-body') as HTMLElement; }
  show(t: Tab) {
    this.tab = t; this.el.querySelectorAll<HTMLButtonElement>('.ph-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); const g = this.g, B = this.body();
    if (t === 'carte') { B.innerHTML = `<canvas class="ph-map"></canvas><div class="ph-row"><button data-do="zoom" data-arg="1.4">＋</button><button data-do="zoom" data-arg="0.7">－</button><button data-do="center">◎ Moi</button><button data-do="clear">Effacer le repère</button></div><div class="ph-legend">🔵 vous · 🟦 vos voitures · 🟪 receleur · 🩵 planques · 🟧 coups préparés · 🟨 mission · 🟩 maisons repérées · 🔷 gendarmerie · 📍 repère (toucher la carte)</div>`; this.cv = B.querySelector('canvas')!; this.bindMap(); this.drawMap(); return; }
    if (t === 'messages') { const L = g.inbox.list; L.forEach(m => (m.read = true)); B.innerHTML = L.length ? L.map(m => `<div class="ph-card"><div class="ph-from">${esc(m.from)} <span>jour ${m.day} · ${m.hour} h</span></div><div>${esc(m.text)}</div>${m.kind === 'tuyau' && !m.done ? `<button data-do="tuyau" data-arg="${m.id}">Accepter le tuyau</button>` : ''}${m.kind === 'planque' && !m.done ? `<button data-do="planque" data-arg="${m.id}">Localiser</button>` : ''}${m.done ? '<div class="ph-ok">✔ fait</div>' : ''}</div>`).join('') : '<p class="ph-empty">Aucun message pour l\'instant.</p>'; return; }
    if (t === 'dossiers') { const D = g.enquete.open_; B.innerHTML = D.length ? D.map(d => `<div class="ph-card"><b>${esc(d.titre)}</b> <span class="ph-sub">jour ${d.jour}${d.mandat ? ' · <b style="color:#ff6b6b">MANDAT D\'ARRÊT</b>' : ''}</span><div class="ph-bar"><i style="width:${Math.round(d.preuves)}%;background:${d.preuves >= 60 ? '#e05a5a' : '#e0a040'}"></i></div><div class="ph-sub">Preuves ${Math.round(d.preuves)} %${d.vehicule ? ` · piste : ${esc(d.vehicule)} (la brûler efface la piste)` : ''}${d.tenue ? ` · tenue : ${esc(d.tenue)}` : ''}</div></div>`).join('') : '<p class="ph-empty">Aucune enquête en cours contre vous.</p>'; return; }
    if (t === 'contacts') { const crew = [...g.heists.crew] as Role[]; const f = g.uw.fence;
      B.innerHTML = `<div class="ph-card"><b>Le receleur</b><div class="ph-sub">Box de garage (lieu fictif) · reçoit de 20 h à 6 h</div>${f ? '<button data-do="goto" data-arg="fence">Localiser</button>' : ''}</div>`
        + (Object.keys(ROLES) as Role[]).map(r => `<div class="ph-card"><b>${ROLES[r].nom}</b> <span class="ph-sub">${ROLES[r].titre} · ${Math.round(ROLES[r].part * 100)} % du magot</span><div class="ph-sub">${crew.includes(r) ? '✔ dans le coup' : 'Se recrute chez le receleur'}</div></div>`).join('')
        + `<div class="ph-card"><b>Missions</b><div class="ph-sub">Livraisons, courses, taxi, colis discrets</div><button data-do="missions">Ouvrir</button></div><div class="ph-card"><b>Réglages</b><button data-do="settings">Ouvrir</button></div>`; return; }
    B.innerHTML = [1, 2, 3].map(n => { const i = Save.slotInfo(n); return `<div class="ph-card"><b>Emplacement ${n}</b><div class="ph-sub">${i ? `Jour ${i.day} · ${String(Math.floor(i.hour)).padStart(2, '0')} h · ${i.money} € · ${esc(i.when)}` : 'vide'}</div><button data-do="save" data-arg="${n}">Sauvegarder ici</button>${i ? `<button data-do="load" data-arg="${n}">Charger</button>` : ''}</div>`; }).join('') + '<p class="ph-empty">La partie est aussi sauvegardée automatiquement toutes les 8 secondes.</p>';
  }
  private act(what: string, arg: string) {
    const g = this.g;
    if (what === 'zoom') { this.zoom = Math.min(3, Math.max(0.08, this.zoom * +arg)); this.drawMap(); }
    else if (what === 'center') { this.cx = g.pos.x; this.cz = g.pos.z; this.drawMap(); }
    else if (what === 'clear') { g.waypoint = null; this.drawMap(); }
    else if (what === 'goto' && arg === 'fence' && g.uw.fence) { g.waypoint = { x: g.uw.fence.x, z: g.uw.fence.z, label: 'Receleur' }; this.show('carte'); }
    else if (what === 'missions') { this.toggle(false); g.onMissionsKey(); }
    else if (what === 'settings') { this.toggle(false); (document.getElementById('gear') as HTMLElement | null)?.click(); }
    else if (what === 'tuyau') { const m = g.inbox.list.find(q => q.id === +arg); if (m && g.heists.acceptTip(m.data?.target)) { m.done = true; g.heists.crew.add('chauffeur'); g.hud.toast('Tuyau accepté : Fredo sera ton chauffeur. La cible est marquée sur la carte.', 4); } else g.hud.toast('Tu as déjà un coup en préparation.', 3); this.show('messages'); }
    else if (what === 'planque') { const m = g.inbox.list.find(q => q.id === +arg); const d = g.uw.dens[1]; if (m && d) { m.done = true; g.waypoint = { x: d.x, z: d.z, label: 'Cabanon libre' }; this.show('carte'); } }
    else if (what === 'save') { g.persist(); const s = Save.load(); if (s && Save.saveSlot(+arg, s)) g.hud.toast(`Partie sauvegardée (emplacement ${arg}).`, 2.5); this.show('sauvegardes'); }
    else if (what === 'load') { if (confirm(`Charger l'emplacement ${arg} ? La partie en cours sera remplacée.`) && Save.loadSlot(+arg)) location.reload(); }
  }
  private bindMap() {
    const c = this.cv; const P = (e: PointerEvent) => ({ x: e.offsetX, y: e.offsetY });
    c.addEventListener('pointerdown', e => { const p = P(e); this.drag = { x: p.x, y: p.y, cx: this.cx, cz: this.cz, moved: false }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (!this.drag) return; const p = P(e), dx = p.x - this.drag.x, dy = p.y - this.drag.y; if (Math.hypot(dx, dy) > 6) this.drag.moved = true; this.cx = this.drag.cx - dx / this.zoom; this.cz = this.drag.cz - dy / this.zoom; this.drawMap(); });
    c.addEventListener('pointerup', e => { const d = this.drag; this.drag = null; if (!d || d.moved) return; const p = P(e); const x = this.cx + (p.x - c.width / 2) / this.zoom, z = this.cz + (p.y - c.height / 2) / this.zoom; this.g.waypoint = { x, z, label: 'Repère' }; this.drawMap(); });
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.min(3, Math.max(0.08, this.zoom * (e.deltaY < 0 ? 1.15 : 0.87))); this.drawMap(); }, { passive: false });
  }
  /** Carte : rues, bâtiments, eau, et tous les repères utiles. */
  drawMap() {
    const c = this.cv; if (!c) return; const r = c.getBoundingClientRect(); c.width = Math.max(200, r.width); c.height = Math.max(200, r.height); const g = c.getContext('2d')!, W = c.width, H = c.height, k = this.zoom, G = this.g;
    const tx = (x: number) => W / 2 + (x - this.cx) * k, ty = (z: number) => H / 2 + (z - this.cz) * k, vis = (x: number, z: number, m = 60) => Math.abs(x - this.cx) * k < W / 2 + m * k && Math.abs(z - this.cz) * k < H / 2 + m * k;
    g.fillStyle = '#1d2a22'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#28506e'; for (const wa of this.w.waters) { if (!vis(wa.p[0][0], wa.p[0][1], 3000)) continue; g.beginPath(); wa.p.forEach((p, i) => (i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1])))); g.fill(); }
    g.fillStyle = '#7d766d'; for (const b of this.w.builds) { const q = b.p[0]; if (!vis(q[0], q[1])) continue; g.beginPath(); b.p.forEach((p, i) => (i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1])))); g.fill(); }
    g.strokeStyle = '#d6d9dd'; g.lineCap = 'round'; for (const rd of this.w.roads) { const q = rd.p[0]; if (!vis(q[0], q[1], 800)) continue; g.lineWidth = Math.max(0.6, (rd.t === 'primary' || rd.t === 'secondary' ? 9 : rd.t === 'footway' || rd.t === 'path' ? 1.5 : 6) * k); g.beginPath(); rd.p.forEach((p, i) => (i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1])))); g.stroke(); }
    const dot = (x: number, z: number, col: string, s = 7, shape: 'c' | 's' = 's') => { g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); if (shape === 'c') g.arc(tx(x), ty(z), s / 2, 0, 7); else g.rect(tx(x) - s / 2, ty(z) - s / 2, s, s); g.fill(); g.stroke(); };
    for (const [key] of G.uw.scouted) { const bi = Math.floor(key / 1000); const p = this.w.builds[bi]?.p[0]; if (p) dot(p[0], p[1], '#4ad06a', 6, 'c'); }
    for (const p of G.pois) if (p.sous_type === 'police') dot(p.x, p.y, '#5aa0ff', 9);
    if (G.uw.fence) dot(G.uw.fence.x, G.uw.fence.z, '#a66bff', 10); G.uw.dens.forEach((d, i) => dot(d.x, d.z, G.uw.owned.has(i) ? '#3ad1ff' : '#4a8fb0', 10));
    const ct = G.crimeTarget(); if (ct) dot(ct.x, ct.z, '#ff9a3a', 11); const mt = G.missionTarget(); if (mt) dot(mt.x, mt.z, '#ffd34a', 11);
    for (const v of G.vehicles.list) if (v.mine) dot(v.x, v.z, '#3a7bd5', 8); dot(G.car.pos.x, G.car.pos.z, '#3a7bd5', 9);
    if (G.waypoint) { const x = tx(G.waypoint.x), y = ty(G.waypoint.z); g.fillStyle = '#ff4040'; g.beginPath(); g.arc(x, y - 12, 7, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 5, y - 9); g.lineTo(x, y); g.lineTo(x + 5, y - 9); g.fill(); }
    const P = G.pos, h = G.mode === 'car' ? G.car.heading : G.player.heading; g.save(); g.translate(tx(P.x), ty(P.z)); g.rotate(-h + Math.PI); g.fillStyle = '#3aa0ff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#fff'; g.font = '12px system-ui'; g.fillText(`${Math.round(100 / k)} m ⟷`, 10, H - 10); g.fillRect(10, H - 26, 100, 3);
  }
  /** Rafraîchit l'horloge, le badge des messages non lus, et la carte ouverte. */
  update() {
    const u = this.g.inbox.unread; if (u !== this.shownUnread) { this.shownUnread = u; this.btn.dataset.badge = u ? String(u) : ''; this.btn.classList.toggle('badge', u > 0); }
    if (!this.open) return; (this.el.querySelector('.ph-clock') as HTMLElement).textContent = `Jour ${this.g.clock.day} · ${this.g.clock.label}`; if (this.tab === 'carte' && !this.drag && performance.now() - this.lastDraw > 250) { this.lastDraw = performance.now(); this.drawMap(); }
  }
}
