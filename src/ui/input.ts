/** Entrées unifiées : clavier/souris sur PC, joystick + boutons tactiles sur mobile. */
export class Input {
  x = 0; y = 0; run = false; handbrake = false; lookDX = 0; lookDY = 0;
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
    this.y = THREE_clamp((k('KeyW', 'KeyZ', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0) + this.touchMove.y);
    this.run = k('ShiftLeft', 'ShiftRight') || this.touchBtn.has('run'); this.handbrake = k('Space') || this.touchBtn.has('brake');
  }
  /** Vrai une seule fois par appui (clavier ou bouton tactile). */
  hit(code: string, btn?: string) { const a = this.pressed.delete(code); const b = btn ? this.touchBtn.delete('hit:' + btn) : false; return a || b; }
  takeLook() { const r = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return r; }

  private buildTouch() {
    const root = document.createElement('div'); root.className = 'ui'; root.id = 'touch'; document.body.appendChild(root);
    root.innerHTML = `<div id="joy"><div id="knob"></div></div>
      <div id="btns"><button data-a="action">E</button><button data-a="eat">Manger</button><button data-a="drink">Boire</button><button data-h="run">Courir</button><button data-h="brake">Frein</button><button data-a="sleep">Dormir</button><button data-a="pee">Besoin</button><button data-a="lights">Phares</button><button data-a="garage">Garage</button></div>`;
    const joy = root.querySelector('#joy') as HTMLElement, knob = root.querySelector('#knob') as HTMLElement; let id = -1;
    const upd = (e: PointerEvent) => { const r = joy.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.touchMove = { x: dx, y: -dy }; knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; };
    joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); upd(e); }); joy.addEventListener('pointermove', e => { if (e.pointerId === id) upd(e); });
    const end = () => { id = -1; this.touchMove = { x: 0, y: 0 }; knob.style.transform = ''; }; joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      const a = b.dataset.a, h = b.dataset.h;
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (h) this.touchBtn.add(h); if (a) this.touchBtn.add('hit:' + a); }); const up = () => { if (h) this.touchBtn.delete(h); };
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
    });
    let look = -1, lx = 0, ly = 0;   // regarder : glisser sur la moitié droite de l'écran
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.clientX > innerWidth * 0.45 && !(e.target as HTMLElement).closest('.ui')) { look = e.pointerId; lx = e.clientX; ly = e.clientY; } });
    addEventListener('pointermove', e => { if (e.pointerId === look) { this.lookDX += e.clientX - lx; this.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY; } });
    addEventListener('pointerup', e => { if (e.pointerId === look) look = -1; });
  }
}
const THREE_clamp = (v: number) => Math.max(-1, Math.min(1, v));
