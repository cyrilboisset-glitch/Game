// Incendies : départ de feu (voiture, bâtiment), montée en puissance, propagation de proche en proche, extinction par les pompiers.
// Logique pure (FireSim) + rendu (FireFx : flammes et fumée en sprites). Les écoles ne brûlent jamais ; les habitants évacuent toujours sains et saufs.
import * as THREE from 'three';

export type FireKind = 'voiture' | 'batiment';
export interface FireNode { id: number; kind: FireKind; x: number; z: number; key: string; pts: [number, number, number][]; t: number; power: number; out: boolean; burnt: boolean; }
export interface Fuel { key: string; kind: FireKind; x: number; z: number; pts: [number, number, number][]; }
export const FIRE = { grow: 14, carBurn: 70, buildBurn: 240, spreadAfter: { voiture: 18, batiment: 35 }, spreadR: { voiture: 7, batiment: 13 }, spreadRate: 0.05 } as const;

export class FireSim {
  nodes: FireNode[] = []; private next = 1;
  burning(key: string) { return this.nodes.some(n => n.key === key && !n.out); }
  done(key: string) { return this.nodes.some(n => n.key === key); }
  ignite(f: Fuel, power = 0.15) { if (this.done(f.key)) return null; const n: FireNode = { id: this.next++, kind: f.kind, x: f.x, z: f.z, key: f.key, pts: f.pts, t: 0, power, out: false, burnt: false }; this.nodes.push(n); return n; }
  get active() { return this.nodes.filter(n => !n.out); }
  /** Avance le feu. `near(n)` : combustibles voisins (déjà filtrés : jamais d'école). `rnd` : aléa. Retourne les nouveaux foyers et ceux qui s'éteignent. */
  step(dt: number, near: (n: FireNode, r: number) => Fuel[], rnd: () => number) {
    const born: FireNode[] = [], ended: FireNode[] = [];
    for (const n of [...this.nodes]) {
      if (n.out) continue; n.t += dt; const life = n.kind === 'voiture' ? FIRE.carBurn : FIRE.buildBurn; if (n.t <= life) n.power = Math.min(1, n.power + dt / FIRE.grow);
      if (n.t > life) { n.power -= dt / 20; if (n.power <= 0) { n.out = true; n.burnt = true; ended.push(n); continue; } }
      if (n.t > FIRE.spreadAfter[n.kind] && n.power > 0.6) for (const f of near(n, FIRE.spreadR[n.kind])) { if (this.done(f.key)) continue; const d = Math.hypot(f.x - n.x, f.z - n.z); const p = FIRE.spreadRate * n.power * (1 - d / (FIRE.spreadR[n.kind] + 2)) * dt; if (rnd() < p) { const b = this.ignite(f); if (b) born.push(b); } }
    }
    return { born, ended };
  }
  /** Lance d'incendie : réduit la puissance des foyers dans le rayon. */
  water(x: number, z: number, r: number, rate: number, dt: number) { const ended: FireNode[] = []; for (const n of this.nodes) { if (n.out || Math.hypot(n.x - x, n.z - z) > r) continue; n.power -= rate * dt; if (n.power <= 0) { n.out = true; n.burnt = n.t > 30; ended.push(n); } } return ended; }
  /** Dégâts au joueur trop près des flammes (par seconde). */
  heatAt(x: number, z: number) { let h = 0; for (const n of this.nodes) { if (n.out) continue; for (const [px, , pz] of n.pts) { const d = Math.hypot(px - x, pz - z); if (d < 2.2) h = Math.max(h, (2.2 - d) / 2.2 * 14 * n.power); } } return h; }
}

const flameTex = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 92, 2, 32, 80, 50); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,190,60,0.95)'); gr.addColorStop(0.6, 'rgba(230,80,10,0.6)'); gr.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 60, 62, 120, 32, 126); g.bezierCurveTo(2, 120, 4, 60, 32, 2); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const smokeTex = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(90,86,82,0.7)'); gr.addColorStop(0.6, 'rgba(70,66,62,0.3)'); gr.addColorStop(1, 'rgba(60,56,52,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };

/** Rendu : pools de sprites de flammes (additifs, lumineux) et de fumée sombre. */
export class FireFx {
  private flames: { s: THREE.Sprite; life: number; max: number; vy: number; w: number }[] = []; private smoke: { s: THREE.Sprite; life: number; vy: number; vx: number }[] = []; private acc = 0; private sacc = 0;
  spray: THREE.Points; light = new THREE.PointLight(0xff8a3a, 0, 30, 1.4); private sprayPos: Float32Array; private sprayN = 0;
  constructor(scene: THREE.Scene, nFlames = 90, nSmoke = 70) {
    const ft = flameTex(), st = smokeTex();
    for (let i = 0; i < nFlames; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: new THREE.Color(2.2, 1.6, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; s.center.set(0.5, 0.1); scene.add(s); this.flames.push({ s, life: 0, max: 1, vy: 0, w: 1 }); }
    for (let i = 0; i < nSmoke; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); this.smoke.push({ s, life: 0, vy: 0, vx: 0 }); }
    this.sprayPos = new Float32Array(300 * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sprayPos, 3)); g.setDrawRange(0, 0);
    this.spray = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfefff, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false })); this.spray.frustumCulled = false; scene.add(this.spray); scene.add(this.light);
  }
  update(dt: number, nodes: FireNode[], jets: { x: number; z: number; tx: number; tz: number }[], camX: number, camZ: number) {
    const live = nodes.filter(n => !n.out && Math.hypot(n.x - camX, n.z - camZ) < 260);
    const tot = live.reduce((a, n) => a + n.power * n.pts.length, 0);
    this.acc += dt * Math.min(160, tot * 16); this.sacc += dt * Math.min(30, tot * 1.6);
    { const top = [...live].sort((a, b) => b.power - a.power)[0]; if (top) { this.light.position.set(top.x, 2.5, top.z); this.light.intensity = (top.kind === 'batiment' ? 60 : 35) * top.power * (0.75 + Math.random() * 0.35); } else this.light.intensity = 0; }
    const pick = () => { let r = Math.random() * tot; for (const n of live) { const w = n.power * n.pts.length; if ((r -= w) <= 0) return { n, p: n.pts[Math.floor(Math.random() * n.pts.length)] }; } return null; };
    while (this.acc >= 1 && tot > 0) { this.acc -= 1; const f = this.flames.find(q => q.life <= 0); const q = pick(); if (!f || !q) break; const k = 0.7 + q.n.power * (q.n.kind === 'batiment' ? 2.2 : 1.3); f.max = f.life = 0.45 + Math.random() * 0.5; f.vy = 0.8 + Math.random() * 1.2; f.w = k * (0.6 + Math.random() * 0.6); f.s.position.set(q.p[0] + (Math.random() - 0.5) * 0.8, q.p[1], q.p[2] + (Math.random() - 0.5) * 0.8); f.s.visible = true; }
    while (this.sacc >= 1 && tot > 0) { this.sacc -= 1; const s = this.smoke.find(q => q.life <= 0); const q = pick(); if (!s || !q) break; s.life = 3.5 + Math.random() * 2; s.vy = 1.6 + Math.random(); s.vx = 0.3 + Math.random() * 0.4; s.s.position.set(q.p[0], q.p[1] + 2, q.p[2]); s.s.scale.setScalar(1 + q.n.power * 1.2); s.s.visible = true; }
    for (const f of this.flames) { if (f.life <= 0) continue; f.life -= dt; const a = f.life / f.max; f.s.position.y += f.vy * dt; f.s.scale.set(f.w * (0.7 + a * 0.3), f.w * 1.8 * (0.5 + a * 0.5), 1); (f.s.material as THREE.SpriteMaterial).opacity = Math.min(1, a * 1.6); if (f.life <= 0) f.s.visible = false; }
    for (const s of this.smoke) { if (s.life <= 0) continue; s.life -= dt; s.s.position.y += s.vy * dt; s.s.position.x += s.vx * dt; s.s.scale.addScalar(dt * 0.9); (s.s.material as THREE.SpriteMaterial).opacity = Math.min(0.5, s.life * 0.15); if (s.life <= 0) s.s.visible = false; }
    // jets des lances : gouttes le long d'une parabole
    let k = 0; for (const j of jets) for (let i = 0; i < 70 && k < 300; i++, k++) { const t = (i / 70 + performance.now() * 0.0011) % 1; const x = j.x + (j.tx - j.x) * t, z = j.z + (j.tz - j.z) * t, y = 1.2 + Math.sin(t * Math.PI) * 2.2 - t * 0.9; this.sprayPos[k * 3] = x + (Math.random() - 0.5) * 0.15; this.sprayPos[k * 3 + 1] = y; this.sprayPos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.15; }
    this.sprayN = k; (this.spray.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; this.spray.geometry.setDrawRange(0, this.sprayN);
  }
}
