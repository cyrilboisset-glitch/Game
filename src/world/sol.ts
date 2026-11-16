import * as THREE from 'three';
import type { WorldData } from './data';

/**
 * Carte de couleur du sol tirée de la photo aérienne de l'IGN (public/data/sol.jpg, ≈ 2,2 m par pixel, tools/import_ortho.py).
 * Sert à teinter le sol (champs, prés, bois, cours, parkings), à ne pas mettre d'herbe sur le goudron
 * et à planter les arbres des jardins là où il y en a vraiment.
 */
export class SolMap {
  tex: THREE.Texture | null = null; rect = new THREE.Vector4(); private px: Uint8ClampedArray | null = null; private w = 0; private h = 0;
  async load(world: WorldData) {
    if (!world.sol) return;
    try {
      const r = await fetch(import.meta.env.BASE_URL + 'data/sol.jpg'); if (!r.ok) return;
      const bmp = await createImageBitmap(await r.blob()); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bmp, 0, 0); this.px = g.getImageData(0, 0, c.width, c.height).data; this.w = c.width; this.h = c.height;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; this.tex = t;
      const [x0, z0, x1, z1] = world.sol; this.rect.set(x0, z0, x1, z1);
    } catch { /* pas de carte : sol procédural */ }
  }
  /** Couleur sRGB (0–255) au point (x, z), ou null hors de la carte. */
  sample(x: number, z: number): [number, number, number] | null {
    if (!this.px) return null; const u = (x - this.rect.x) / (this.rect.z - this.rect.x), v = (z - this.rect.y) / (this.rect.w - this.rect.y);
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return null; const i = (Math.floor(v * this.h) * this.w + Math.floor(u * this.w)) * 4; return [this.px[i], this.px[i + 1], this.px[i + 2]];
  }
  /** Arbre ou haie sur la photo : vert franc et sombre. */
  canopy(x: number, z: number) { const c = this.sample(x, z); if (!c) return null; const [r, g, b] = c; return g > r + 5 && g >= b - 4 && r + g + b < 265; }
  /** Végétation basse (pelouse, pré) : vert et clair. */
  lawn(x: number, z: number) { const c = this.sample(x, z); if (!c) return null; const [r, g, b] = c; return g > r + 5 && g >= b - 4 && r + g + b >= 265; }
  /** Sol minéral (goudron, gravier, dalle, toit) : peu saturé, pas vert. */
  paved(x: number, z: number) { const c = this.sample(x, z); if (!c) return false; const [r, g, b] = c; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 22 && g <= r + 4; }
}
export const sol = new SolMap();
