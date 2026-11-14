import type { Pt } from './geom';
export interface Road { t: string; n: string; o: number; p: Pt[]; }
export interface Build { l: number; h: number; n: string; p: Pt[]; }
export interface Water { a: number; p: Pt[]; }
export interface Green { k: string; p: Pt[]; }
export interface WorldData { origin: [number, number]; roads: Road[]; builds: Build[]; rails: Pt[][]; waters: Water[]; greens: Green[]; }

export async function loadWorld(): Promise<WorldData> {
  const r = await fetch(import.meta.env.BASE_URL + 'data/pontcharra.json');
  return r.json();
}
export const CHUNK = 200;
export const chunkKey = (x: number, y: number) => `${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`;
