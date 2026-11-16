// Dégâts visibles des véhicules : tôle enfoncée à l'endroit du choc, pare-brise fissuré. Repère local du véhicule : +Z avant, +X côté gauche, +Y haut.
import * as THREE from 'three';

/** Enfonce la carrosserie autour du point (lx, lz) : déplacement vers l'intérieur, plus marqué à hauteur de pare-chocs, avec un froissé irrégulier. */
export function dent(geos: THREE.BufferGeometry[], lx: number, lz: number, depth: number, radius: number, halfW: number, halfL: number) {
  const nl = Math.hypot(lx / halfW, lz / halfL) || 1; const nx = lx / halfW / nl, nz = lz / halfL / nl;   // direction de l'impact (vers l'extérieur)
  for (const g of geos) {
    const p = g.getAttribute('position') as THREE.BufferAttribute; if (!p) continue;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = Math.hypot(x - lx, z - lz); if (d >= radius) continue;
      const k = (1 - d / radius) ** 2 * depth * (y < 1.1 ? 1 : 0.45) * (0.75 + 0.25 * Math.sin(x * 37 + z * 23 + y * 11));
      p.setXYZ(i, x - nx * k, y - k * 0.18 * Math.abs(Math.sin(x * 13 + z * 7)), z - nz * k);
    }
    p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
}
/** Ramène un point du monde dans le repère du véhicule, projeté sur sa carrosserie. */
export function toLocal(wx: number, wz: number, cx: number, cz: number, h: number, halfW: number, halfL: number) {
  const dx = wx - cx, dz = wz - cz; let lx = dx * Math.cos(h) - dz * Math.sin(h), lz = dx * Math.sin(h) + dz * Math.cos(h);
  const s = Math.max(Math.abs(lx) / halfW, Math.abs(lz) / halfL) || 1; lx /= s; lz /= s; return { lx, lz };
}
let crackT: THREE.CanvasTexture | undefined;
/** Texture de vitre fissurée (impact en étoile). */
export function crackTexture() {
  if (crackT) return crackT; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; g.fillStyle = '#9fb3c2'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2;
  for (const [cx, cy] of [[90, 120], [180, 80]]) { for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + Math.random() * 0.3; let x = cx, y = cy; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += Math.cos(a + (Math.random() - 0.5) * 0.6) * (10 + Math.random() * 18); y += Math.sin(a + (Math.random() - 0.5) * 0.6) * (10 + Math.random() * 18); g.lineTo(x, y); } g.stroke(); }
    for (let r = 8; r < 60; r += 12) { g.beginPath(); g.arc(cx, cy, r + Math.random() * 4, 0, Math.PI * 2); g.stroke(); } }
  crackT = new THREE.CanvasTexture(c); crackT.colorSpace = THREE.SRGBColorSpace; crackT.wrapS = crackT.wrapT = THREE.RepeatWrapping; crackT.repeat.set(0.5, 0.5); return crackT;
}
