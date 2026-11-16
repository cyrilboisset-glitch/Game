/** Entrées unifiées : clavier/souris sur PC, joystick + boutons tactiles sur mobile. */
export class Input {
  x = 0; y = 0; run = false; handbrake = false; horn = false; lookDX = 0; lookDY = 0;
  /** Dernier glissement de caméra (ms) : la caméra se replace d'elle-même après un moment sans toucher. */
  lookT = 0; onUi: (k: string) => void = () => {}; private root?: HTMLElement; private last = '';
  private keys = new Set<string>(); private pressed = new Set<string>(); private touchMove = { x: 0, y: 0 }; private touchBtn = new Set<string>();
  readonly touch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  constructor(el: HTMLElement) {
    addEventListener('keydown', e => { if (!this.keys.has(e.code)) this.pressed.add(e.code); this.keys.add(e.code); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    let drag = false;
    el.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('.ui')) return; drag = true; });
    addEventListener('pointerup', () => (drag = false));
    addEventListener('pointermove', e => { if (drag && e.pointerType === 'mouse') { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
    if (this.touch) this.buildTouch();
  }
  poll() {
    const k = (...c: string[]) => c.some(x => this.keys.has(x));
    this.x = THREE_clamp((k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'KeyQ', 'ArrowLeft') ? 1 : 0) + this.touchMove.x);
    this.y = THREE_clamp((k('KeyW', 'KeyZ', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0) + this.touchMove.y + (this.touchBtn.has('gas') ? 1 : 0) - (this.touchBtn.has('rev') ? 1 : 0));
    // course : bouton Courir, ou joystick poussé à fond
    this.run = k('ShiftLeft', 'ShiftRight') || this.touchBtn.has('run') || (this.touch && Math.hypot(this.touchMove.x, this.touchMove.y) > 0.93); this.handbrake = k('Space') || this.touchBtn.has('brake'); this.horn = k('KeyH') || this.touchBtn.has('horn');
  }
  /** Vrai une seule fois par appui (clavier ou bouton tactile). */
  hit(code: string, btn?: string) { const a = this.pressed.delete(code); const b = btn ? this.touchBtn.delete('hit:' + btn) : false; return a || b; }
  panel(on: boolean) { const p = this.root?.querySelector('#tpanel') as HTMLElement | null; if (p) p.style.display = on ? 'grid' : 'none'; }
  /** Met à jour les boutons tactiles selon la situation (n'écrit dans la page que si quelque chose change). */
  setContext(c: TouchCtx) {
    if (!this.root) return; const key = JSON.stringify(c); if (key === this.last) return; this.last = key; const $ = (id: string) => this.root!.querySelector('#' + id) as HTMLButtonElement;
    const A = $('bA'), B = $('bB'), C = $('bC'), D = $('bD');
    const set = (b: HTMLButtonElement, label: string, a?: string, h?: string) => { b.textContent = label; if (a) b.dataset.a = a; else delete b.dataset.a; if (h) b.dataset.h = h; else delete b.dataset.h; };
    // en voiture : pédales sous le pouce droit (le joystick sert de volant) ; à pied : action, frapper, courir, accroupi
    if (c.car) { set(A, 'Gaz', undefined, 'gas'); A.classList.remove('off'); B.style.display = ''; set(B, 'Frein', undefined, 'rev'); set(C, 'Frein à main', undefined, 'brake'); set(D, 'Klaxon', undefined, 'horn'); }
    else { set(A, c.primary ?? 'E', c.act ?? 'action'); A.classList.toggle('off', !c.primary); B.style.display = c.attack ? '' : 'none'; set(B, c.attack ?? 'Frapper', 'hit'); set(C, 'Courir', undefined, 'run'); set(D, 'Accroupi', 'crouch'); }
    this.root.querySelector('#chips')!.innerHTML = c.chips.map(([a, l]) => `<button class="chip" data-a="${a}">${l}</button>`).join('');
  }
  takeLook() { const r = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return r; }

  private buildTouch() {
    const root = document.createElement('div'); root.className = 'ui'; root.id = 'touch'; document.body.appendChild(root);
    // pad droit : A = action principale (étiquette selon le contexte), B = frapper/tirer, C = courir/freiner, D = accroupi/klaxon ; rangée de boutons contextuels ; menu ☰ pour le reste
    root.innerHTML = `<div id="joy"><div id="knob"></div></div>
      <div id="pad"><button class="rb" id="bA" data-a="action">E</button><button class="rb" id="bB" data-a="hit">Frapper</button><button class="rb" id="bC" data-h="run">Courir</button><button class="rb" id="bD" data-a="crouch">Accroupi</button><button class="rb" id="bM" data-m="1">☰</button></div>
      <div id="chips"></div>
      <div id="tpanel" style="display:none">${MENU.map(([a, l, h]) => `<button ${h ? 'data-h' : 'data-a'}="${a}" data-close="1">${l}</button>`).join('')}<button data-ui="fullscreen" data-close="1">Plein écran</button><button data-ui="gear" data-close="1">Réglages</button><button data-ui="reset" data-close="1">Nouvelle partie</button><button data-close="1" class="x" style="grid-column:auto">Fermer</button></div>`;
    this.root = root;
    const joy = root.querySelector('#joy') as HTMLElement, knob = root.querySelector('#knob') as HTMLElement; let id = -1;
    const upd = (e: PointerEvent) => { const r = joy.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.touchMove = { x: dx, y: -dy }; knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; };
    // joystick flottant : il se place là où le pouce gauche se pose (moitié gauche de l'écran)
    addEventListener('pointerdown', e => { const t = e.target as HTMLElement; if (id >= 0 || e.clientX > innerWidth * 0.45 || t.closest('button, #phone, #tpanel, #settings, #missions, #observe, #phoneBtn')) return;
      id = e.pointerId; joy.style.left = `${e.clientX - 65}px`; joy.style.top = `${e.clientY - 65}px`; joy.style.bottom = 'auto'; joy.classList.add('on'); upd(e); }, { capture: true });
    addEventListener('pointermove', e => { if (e.pointerId === id) upd(e); });
    const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; this.touchMove = { x: 0, y: 0 }; knob.style.transform = ''; joy.style.left = ''; joy.style.top = ''; joy.style.bottom = ''; joy.classList.remove('on'); }; addEventListener('pointerup', end); addEventListener('pointercancel', end);
    // délégation : les boutons contextuels sont recréés à la volée
    const btnOf = (e: Event) => (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    root.addEventListener('pointerdown', e => { const b = btnOf(e); if (!b) return; e.preventDefault(); const a = b.dataset.a, h = b.dataset.h; if (h) this.touchBtn.add(h); if (a) this.touchBtn.add('hit:' + a); b.classList.add('down');
      if (b.dataset.ui && !['gear', 'reset'].includes(b.dataset.ui)) this.onUi(b.dataset.ui); if (b.dataset.ui === 'gear') (document.getElementById('gear') as HTMLElement | null)?.click(); if (b.dataset.ui === 'reset' && confirm('Effacer la sauvegarde et recommencer ?')) document.getElementById('reset')?.click();
      if (b.dataset.m) this.panel(true); else if (b.dataset.close) setTimeout(() => this.panel(false), 60); if (navigator.vibrate) navigator.vibrate(12); });
    const up = (e: Event) => { const b = btnOf(e); if (!b) return; const h = b.dataset.h; if (h && !b.dataset.close) this.touchBtn.delete(h); b.classList.remove('down'); if (h && b.dataset.close) setTimeout(() => this.touchBtn.delete(h), 400); };
    root.addEventListener('pointerup', up); root.addEventListener('pointerout', up); root.addEventListener('pointercancel', up);
    let look = -1, lx = 0, ly = 0;   // regarder : glisser sur la moitié droite de l'écran
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.clientX > innerWidth * 0.45 && !(e.target as HTMLElement).closest('.ui')) { look = e.pointerId; lx = e.clientX; ly = e.clientY; this.lookT = performance.now(); } });
    addEventListener('pointermove', e => { if (e.pointerId === look) { this.lookT = performance.now(); this.lookDX += e.clientX - lx; this.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY; } });
    addEventListener('pointerup', e => { if (e.pointerId === look) look = -1; });
  }
}
const THREE_clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** Actions rares, rangées dans le menu ☰. */
const MENU: [string, string, boolean?][] = [['eat', 'Manger'], ['drink', 'Boire'], ['heal', 'Soin'], ['sleep', 'Dormir'], ['pee', 'Besoin'], ['hood', 'Capuche'], ['weapon', 'Objet'], ['fire', 'Feu'], ['missions', 'Missions'], ['dossier', 'Dossiers'], ['lights', 'Phares'], ['radio', 'Radio'], ['horn', 'Klaxon', true]];
export interface TouchCtx { primary: string | null; act?: string; attack: string | null; car: boolean; chips: [string, string][]; }
