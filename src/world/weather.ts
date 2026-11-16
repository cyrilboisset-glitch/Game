// Météo et saisons : temps par tranches de 6 h selon la saison (pluie, neige, brouillard du matin dans la vallée), routes mouillées, feuillage de saison.
import * as THREE from 'three';
import type { Materials } from './materials';

export type Season = 'printemps' | 'été' | 'automne' | 'hiver';
export const SEASONS: Season[] = ['printemps', 'été', 'automne', 'hiver'];
/** Saison du jour de jeu : chaque saison dure 7 jours, la partie commence en automne. */
export const seasonOf = (day: number): Season => SEASONS[(2 + Math.floor((day - 1) / 7)) % 4];
const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export interface Wx { rain: number; snow: number; cloud: number; fog: number; }
const RAIN_P: Record<Season, number> = { printemps: 0.28, été: 0.12, automne: 0.38, hiver: 0.32 };
const FOG_P: Record<Season, number> = { printemps: 0.25, été: 0.1, automne: 0.6, hiver: 0.5 };
/** Temps d'une tranche de 6 h (déterministe : même jour, même temps). */
export function blockWx(day: number, block: number): Wx {
  const s = seasonOf(day), r = rng(day * 31 + block * 7 + 3); const wet = r() < RAIN_P[s], heavy = r();
  const cloud = wet ? 0.8 + heavy * 0.2 : r() < 0.4 ? 0.3 + r() * 0.4 : r() * 0.2; const amount = wet ? 0.35 + heavy * 0.65 : 0;
  const cold = s === 'hiver' && (block === 0 || block === 3 || r() < 0.55);
  return { rain: cold ? 0 : amount, snow: cold ? amount : 0, cloud, fog: 0 };
}
/** Temps à une heure donnée : transitions douces entre tranches, brouillard du matin (5 h – 10 h) certains jours. */
export function weatherAt(day: number, hour: number): Wx {
  const b = Math.floor(hour / 6), f = (hour % 6) / 6, a = blockWx(day, b), n = b === 3 ? blockWx(day + 1, 0) : blockWx(day, b + 1); const k = f > 0.75 ? (f - 0.75) / 0.25 : 0; const L = (x: number, y: number) => x + (y - x) * k;
  const s = seasonOf(day); const fogDay = rng(day * 13 + 1)() < FOG_P[s]; const fog = fogDay && hour > 4.5 && hour < 10.5 ? Math.min(1, (hour - 4.5) / 1.2, (10.5 - hour) / 1.8) : 0;
  return { rain: L(a.rain, n.rain), snow: L(a.snow, n.snow), cloud: Math.max(L(a.cloud, n.cloud), fog * 0.6), fog };
}
const TINT: Record<Season, { leaves: number; grass: number }> = { printemps: { leaves: 0xe6ffd8, grass: 0xf2fff0 }, été: { leaves: 0xffffff, grass: 0xfff6dc }, automne: { leaves: 0xf0a860, grass: 0xe8dcb4 }, hiver: { leaves: 0xb8b4a8, grass: 0xd4d8d0 } };

/** Rendu : pluie (traits), neige (flocons), routes mouillées, teintes de saison, nuages et brouillard appliqués après le cycle jour/nuit. */
export class WeatherFx {
  wx: Wx = { rain: 0, snow: 0, cloud: 0, fog: 0 }; season: Season = 'automne'; wet = 0; snowCover = 0;
  private rain: THREE.InstancedMesh; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private one = new THREE.Vector3(1, 1, 1); private up = new THREE.Vector3(0, 1, 0); private v = new THREE.Vector3(); private snow: THREE.Points; private rp: Float32Array; private sp: Float32Array; private N = 1600; private M = 1800;
  private base: { m: THREE.MeshStandardMaterial; r: number; c: THREE.Color; e: number }[];
  constructor(scene: THREE.Scene, private mats: Materials) {
    this.rp = new Float32Array(this.N * 6); const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rp, 3));
    void rg; this.rain = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.022, 0.85), new THREE.MeshBasicMaterial({ color: 0xd8e2ec, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: true }), this.N); this.rain.frustumCulled = false; this.rain.count = 0; scene.add(this.rain);   // gouttes : traits fins orientés vers la caméra
    this.sp = new Float32Array(this.M * 3); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false })); this.snow.frustumCulled = false; scene.add(this.snow);
    for (let i = 0; i < this.N; i++) this.seedDrop(i, 0, 0, true); for (let i = 0; i < this.M; i++) this.seedFlake(i, 0, 0, true);
    this.base = [mats.asphalt, mats.asphaltMarked, mats.pavement, mats.marks, mats.gravel].map(m => ({ m: m as THREE.MeshStandardMaterial, r: (m as THREE.MeshStandardMaterial).roughness, c: (m as THREE.MeshStandardMaterial).color.clone(), e: (m as THREE.MeshStandardMaterial).envMapIntensity }));
  }
  private seedDrop(i: number, cx: number, cz: number, any: boolean) { const x = cx + (Math.random() - 0.5) * 50, z = cz + (Math.random() - 0.5) * 50, y = any ? Math.random() * 22 : 20 + Math.random() * 4; const o = i * 6; this.rp[o] = x; this.rp[o + 1] = y; this.rp[o + 2] = z; this.rp[o + 3] = x + 0.06; this.rp[o + 4] = y - 0.95; this.rp[o + 5] = z + 0.02; }
  private seedFlake(i: number, cx: number, cz: number, any: boolean) { const o = i * 3; this.sp[o] = cx + (Math.random() - 0.5) * 44; this.sp[o + 1] = any ? Math.random() * 16 : 15 + Math.random() * 3; this.sp[o + 2] = cz + (Math.random() - 0.5) * 44; }
  /** À appeler après la mise à jour du cycle jour/nuit (assombrit le soleil, épaissit le brouillard). */
  update(dt: number, day: number, hour: number, cam: THREE.Vector3, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, fog: THREE.FogExp2, indoor: boolean) {
    this.wx = weatherAt(day, hour); const w = this.wx; this.season = seasonOf(day);
    // routes : se mouillent vite sous la pluie, sèchent lentement ; la neige blanchit le sol
    this.wet = THREE.MathUtils.clamp(this.wet + (w.rain > 0.05 ? dt * 0.05 * (0.5 + w.rain) : -dt * 0.004), 0, 1); this.snowCover = THREE.MathUtils.clamp(this.snowCover + (w.snow > 0.05 ? dt * 0.01 * w.snow : -dt * 0.002), 0, 1);
    for (const b of this.base) { b.m.roughness = THREE.MathUtils.lerp(b.r, 0.18, this.wet * 0.85); b.m.color.copy(b.c).multiplyScalar(1 - this.wet * 0.35).lerp(new THREE.Color(0xf4f6f8), this.snowCover * 0.7); b.m.envMapIntensity = b.e * (1 + this.wet * 2.5); }
    const T = TINT[this.season]; (this.mats.leaves as THREE.MeshStandardMaterial).color.set(T.leaves); const gc = new THREE.Color(T.grass).lerp(new THREE.Color(0xffffff), this.snowCover * 0.85); (this.mats.greens as THREE.MeshStandardMaterial).color.copy(gc); (this.mats.ground as THREE.MeshStandardMaterial).color.copy(gc);
    // ciel couvert, brouillard
    sun.intensity *= 1 - w.cloud * 0.7; hemi.intensity *= 1 - w.cloud * 0.25; fog.density *= 1 + w.fog * 14 + w.rain * 2 + w.snow * 3.5; fog.color.lerp(new THREE.Color(0xb4bcc4).multiplyScalar(0.45 + Math.min(1, sun.intensity) * 0.5), Math.max(w.cloud * 0.5, w.fog * 0.9));
    // précipitations autour de la caméra
    this.rain.visible = w.rain > 0.02 && !indoor; this.snow.visible = w.snow > 0.02 && !indoor;
    if (this.rain.visible) { const n = Math.floor(this.N * w.rain); for (let i = 0; i < n; i++) { const o = i * 6; const fall = 18 * dt; this.rp[o + 1] -= fall; this.rp[o + 4] -= fall; if (this.rp[o + 4] < 0 || Math.abs(this.rp[o] - cam.x) > 26 || Math.abs(this.rp[o + 2] - cam.z) > 26) this.seedDrop(i, cam.x, cam.z, this.rp[o + 1] < -40 || Math.abs(this.rp[o] - cam.x) > 26); const x = this.rp[o], z = this.rp[o + 2]; this.q.setFromAxisAngle(this.up, Math.atan2(cam.x - x, cam.z - z)); this.m4.compose(this.v.set(x, this.rp[o + 1] - 0.45, z), this.q, this.one); this.rain.setMatrixAt(i, this.m4); } this.rain.count = n; this.rain.instanceMatrix.needsUpdate = true; }
    if (this.snow.visible) { const n = Math.floor(this.M * w.snow), t = performance.now() * 0.001; for (let i = 0; i < this.M; i++) { const o = i * 3; if (i >= n) { this.sp[o + 1] = -50; continue; } this.sp[o + 1] -= 1.1 * dt; this.sp[o] += Math.sin(t + i) * 0.3 * dt; if (this.sp[o + 1] < 0 || Math.abs(this.sp[o] - cam.x) > 23 || Math.abs(this.sp[o + 2] - cam.z) > 23) this.seedFlake(i, cam.x, cam.z, this.sp[o + 1] < -40); } (this.snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; }
  }
  label() { const w = this.wx; const s = w.snow > 0.1 ? '❄ neige' : w.rain > 0.5 ? '🌧 forte pluie' : w.rain > 0.1 ? '🌦 pluie' : w.fog > 0.3 ? '🌫 brouillard' : w.cloud > 0.6 ? '☁ couvert' : w.cloud > 0.3 ? '⛅ nuageux' : '☀ beau temps'; return `${this.season} · ${s}`; }
}
