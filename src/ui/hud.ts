import type { Needs } from '../survival/needs';
import type { Heat } from '../survival/heat';

const BARS: [string, string, string][] = [['faim', 'Faim', '#e0a040'], ['soif', 'Soif', '#4aa3e0'], ['energie', 'Énergie', '#8bd05a'], ['vessie', 'Vessie', '#d6c24a'], ['sante', 'Santé', '#e05a5a']];
export class Hud {
  el = document.getElementById('hud')!; private msgT = 0;
  constructor() {
    this.el.insertAdjacentHTML('beforeend', `<div id="bars" class="pill"></div><div id="stats" class="pill" style="left:14px;top:56px"></div><div id="prompt" class="pill" style="left:50%;bottom:90px;transform:translateX(-50%);display:none"></div><div id="toast" class="pill" style="left:50%;top:18%;transform:translateX(-50%);display:none"></div><div id="veil"></div><div id="msgbox"></div>`);
    document.getElementById('bars')!.innerHTML = BARS.map(([k, l, c]) => `<div class="bar"><span>${l}</span><i><b id="b_${k}" style="background:${c}"></b></i></div>`).join('');
  }
  update(n: Needs, heat: Heat, money: number, inv: { nourriture: number; eau: number }, clock: string, day: number) {
    for (const [k] of BARS) { const v = k === 'vessie' ? 100 - (n.s as any)[k] : (n.s as any)[k]; const b = document.getElementById('b_' + k)!; b.style.width = v + '%'; b.parentElement!.parentElement!.classList.toggle('warn', v < 25); }
    document.getElementById('stats')!.textContent = `Jour ${day} · ${clock} · ${money} € · 🍞 ${inv.nourriture} · 💧 ${inv.eau} · ${'★'.repeat(heat.stars)}${'☆'.repeat(5 - heat.stars)}`;
  }
  prompt(t: string) { const p = document.getElementById('prompt')!; p.style.display = t ? 'block' : 'none'; p.textContent = t; }
  toast(t: string, s = 3) { const e = document.getElementById('toast')!; e.textContent = t; e.style.display = 'block'; this.msgT = s; }
  tick(dt: number) { if (this.msgT > 0 && (this.msgT -= dt) <= 0) document.getElementById('toast')!.style.display = 'none'; }
  veil(a: number) { (document.getElementById('veil') as HTMLElement).style.opacity = String(a); }
}
