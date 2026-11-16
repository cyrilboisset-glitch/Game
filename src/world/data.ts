import type { Pt } from './geom';
export interface Road { t: string; n: string; o: number; p: Pt[]; j?: number; }   // j = 1 : anneau de rond-point
/** u = usage IGN (r résidentiel, c commerce, i industriel, a agricole, x annexe, s sportif, g religieux), lg = logements, t = hauteur du toit (≈ 0 : plat), mw/mt = matériaux murs/toit : présents seulement après tools/import_ign.py ; rc = couleur du toit (photo aérienne, tools/import_ortho.py). */
export interface Build { l: number; h: number; n: string; p: Pt[]; u?: string; lg?: number; t?: number; mw?: number; mt?: number; rc?: string; wc?: string; }
export interface Water { a: number; p: Pt[]; }
export interface Green { k: string; p: Pt[]; }
export interface WorldData { origin: [number, number]; roads: Road[]; builds: Build[]; rails: Pt[][]; waters: Water[]; greens: Green[]; sol?: [number, number, number, number]; fences?: [number, number, number, number, number][]; }

export async function loadWorld(): Promise<WorldData> {
  const r = await fetch(import.meta.env.BASE_URL + 'data/pontcharra.json');
  return r.json();
}
export const CHUNK = 200;
export const chunkKey = (x: number, y: number) => `${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`;
