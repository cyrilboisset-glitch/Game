import type { WorldData } from '../world/data';
import type { Poi } from '../world/poi';

/** Minimap 2D (canvas) centrée sur le joueur, orientée nord en haut. */
export class Minimap {
  c = document.createElement('canvas'); g: CanvasRenderingContext2D; R = 180; last = 0;
  constructor(private w: WorldData, private pois: Poi[]) {
    this.c.width = this.c.height = 180; this.c.id = 'minimap'; document.body.appendChild(this.c); this.g = this.c.getContext('2d')!;
  }
  draw(x: number, z: number, heading: number, now: number) {
    if (now - this.last < 100) return; this.last = now; const g = this.g, S = 180, k = S / (2 * this.R);
    g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip(); g.fillStyle = 'rgba(30,40,34,0.88)'; g.fillRect(0, 0, S, S);
    const tx = (px: number) => S / 2 + (px - x) * k, ty = (pz: number) => S / 2 + (pz - z) * k;
    g.fillStyle = 'rgba(140,130,120,0.55)'; for (const b of this.w.builds) { const q = b.p[0]; if (Math.abs(q[0] - x) > this.R + 40 || Math.abs(q[1] - z) > this.R + 40) continue; g.beginPath(); b.p.forEach((p, i) => (i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1])))); g.fill(); }
    g.strokeStyle = '#cfd3d8'; g.lineCap = 'round';
    for (const r of this.w.roads) { const q = r.p[0]; if (Math.abs(q[0] - x) > this.R + 150 || Math.abs(q[1] - z) > this.R + 150) continue; g.lineWidth = r.t === 'primary' || r.t === 'secondary' ? 3 : r.t === 'footway' || r.t === 'path' ? 0.6 : 1.8; g.beginPath(); r.p.forEach((p, i) => (i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1])))); g.stroke(); }
    g.fillStyle = '#ffcf4a'; for (const p of this.pois) { if (Math.hypot(p.x - x, p.y - z) < this.R) { g.beginPath(); g.arc(tx(p.x), ty(p.y), 2.6, 0, 7); g.fill(); } }
    g.translate(S / 2, S / 2); g.rotate(-heading + Math.PI); g.fillStyle = '#3aa0ff'; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.fill(); g.restore();
  }
}
