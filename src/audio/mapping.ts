// Fonctions pures de l'audio (testables) : régime moteur, fréquences, atténuation par la distance.
const GEARS = [0, 7, 13, 20, 29, 42];   // vitesses (m/s) de passage des rapports
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Régime moteur (tr/min) simulé : 5 rapports, ralenti à 900. */
export function engineRpm(speed: number, throttle: number) {
  const v = Math.abs(speed); let g = 0; while (g < GEARS.length - 2 && v > GEARS[g + 1]) g++;
  const f = clamp((v - GEARS[g]) / (GEARS[g + 1] - GEARS[g])); const base = g === 0 ? 900 + f * 2600 : 1900 + f * 3200;
  return Math.round(clamp(base + throttle * 600, 800, 6800));
}
export const rpmToFreq = (rpm: number) => (rpm / 60) * 2;   // 4 cylindres : 2 explosions par tour
/** Sirène française deux tons : alterne ~435 Hz et ~580 Hz toutes les 0,55 s. */
export const sirenFreq = (t: number) => (Math.floor(t / 0.55) % 2 === 0 ? 435 : 580);
/** Gain selon la distance : plein à bout portant, nul au-delà de max. */
export const distGain = (d: number, ref = 25, max = 260) => (d >= max ? 0 : clamp((ref / (d + ref)) * (1 - d / max) * 1.4));
/** Intervalle entre deux pas (s) selon la vitesse de marche. */
export const stepInterval = (speed: number) => (speed < 0.4 ? Infinity : clamp(0.9 / (speed / 1.5), 0.22, 0.7));
