import * as THREE from 'three';

/** Fumée de moteur (véhicule endommagé) : petit pool de sprites. */
export class Smoke {
  private sprites: { s: THREE.Sprite; life: number; vy: number }[] = []; private acc = 0;
  constructor(scene: THREE.Scene, n = 36) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: true })); s.visible = false; scene.add(s); this.sprites.push({ s, life: 0, vy: 0 }); }
  }
  /** intensité 0-1 : 0 = rien, 1 = moteur en feu. */
  emit(x: number, y: number, z: number, intensity: number, dt: number) {
    this.acc += dt * (4 + intensity * 14); const dark = 1 - intensity * 0.8;
    while (this.acc >= 1) { this.acc -= 1; const p = this.sprites.find(q => q.life <= 0); if (!p) break; p.life = 1.6 + Math.random(); p.vy = 0.8 + Math.random() * 0.8; p.s.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4); p.s.scale.setScalar(0.5); p.s.visible = true; (p.s.material as THREE.SpriteMaterial).color.setScalar(dark); }
  }
  update(dt: number) { for (const p of this.sprites) { if (p.life <= 0) continue; p.life -= dt; p.s.position.y += p.vy * dt; p.s.scale.addScalar(dt * 1.4); (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(0.6, p.life * 0.4)); if (p.life <= 0) p.s.visible = false; } }
}
