export type Level = 'bas' | 'moyen' | 'eleve';
export interface QualityParams { pixelRatio: number; shadows: boolean; shadowSize: number; shadowRange: number; view: number; vehicleRange: number; npcRange: number; pedMax: number; avatars: number; trafficMax: number; }
const dpr = () => (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
/** Trois niveaux de qualité : résolution, ombres, distance d'affichage, nombre de silhouettes/avatars/voitures. */
export const levelParams = (l: Level): QualityParams => ({
  bas: { pixelRatio: Math.min(dpr(), 1) * 0.8, shadows: false, shadowSize: 512, shadowRange: 0, view: 280, vehicleRange: 170, npcRange: 110, pedMax: 70, avatars: 2, trafficMax: 14 },
  moyen: { pixelRatio: Math.min(dpr(), 1.5), shadows: true, shadowSize: 1024, shadowRange: 75, view: 340, vehicleRange: 230, npcRange: 150, pedMax: 200, avatars: 4, trafficMax: 26 },
  eleve: { pixelRatio: Math.min(dpr(), 2), shadows: true, shadowSize: 2048, shadowRange: 150, view: 480, vehicleRange: 280, npcRange: 190, pedMax: 450, avatars: 5, trafficMax: 40 },
}[l]);
const ORDER: Level[] = ['bas', 'moyen', 'eleve'];
/** Décision pure : baisse si < 24 FPS (3 s), monte si > 54 FPS (10 s) et stable depuis 25 s. */
export function nextLevel(level: Level, fps: number, lowSecs: number, highSecs: number, sinceChange: number): Level {
  const i = ORDER.indexOf(level); if (lowSecs >= 3 && fps < 24 && i > 0) return ORDER[i - 1]; if (highSecs >= 10 && fps > 54 && sinceChange > 25 && i < 2) return ORDER[i + 1]; return level;
}
/** Mesure les FPS en continu et propose un niveau (mode automatique). */
export class AutoQuality {
  level: Level; auto = true; fps = 60; private acc = 0; private frames = 0; private low = 0; private high = 0; private since = 0;
  constructor(start: Level) { this.level = start; }
  /** Retourne le nouveau niveau s'il change. */
  update(dt: number): Level | null {
    this.acc += dt; this.frames++; this.since += dt; if (this.acc < 1) return null; this.fps = this.frames / this.acc; this.acc = 0; this.frames = 0;
    this.low = this.fps < 24 ? this.low + 1 : 0; this.high = this.fps > 54 ? this.high + 1 : 0; if (!this.auto) return null;
    const n = nextLevel(this.level, this.fps, this.low, this.high, this.since); if (n !== this.level) { this.level = n; this.low = this.high = 0; this.since = 0; return n; } return null;
  }
  set(l: Level) { this.level = l; this.since = 0; this.low = this.high = 0; }
}
