// Armes à feu : visée dans un cône étroit, ligne de tir dégagée. On ne tire jamais si un enfant est dans la ligne de mire. Logique pure.
export interface ShotCand { id: number; x: number; z: number; minor: boolean; }
export const PISTOL = { range: 32, cone: 0.965, cd: 0.55, clip: 12 } as const;

/** Distance d'un point au segment [a, b]. */
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

/** Cible d'un tir : la personne la plus proche dans le cône, avec ligne de vue. `child` : un enfant est dans le cône ou près de la ligne de tir → pas de tir. */
export function aimShot(px: number, pz: number, heading: number, list: ShotCand[], blocked: (ax: number, az: number, bx: number, bz: number) => boolean, range: number = PISTOL.range): { target: ShotCand | null; child: boolean } {
  const fx = Math.sin(heading), fz = Math.cos(heading); let best: ShotCand | null = null, bd = range;
  for (const c of list) { const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz); if (d > range || d < 0.3) continue; if ((dx * fx + dz * fz) / d < PISTOL.cone) continue; if (blocked(px, pz, c.x, c.z)) continue; if (d < bd) { bd = d; best = c; } }
  const ex = best ? best.x : px + fx * range, ez = best ? best.z : pz + fz * range;
  const child = list.some(c => c.minor && Math.hypot(c.x - px, c.z - pz) <= bd + 6 && segDist(c.x, c.z, px, pz, ex, ez) < 1.6);
  if (child) return { target: null, child: true };
  return { target: best && !best.minor ? best : null, child: false };
}
/** Riposte de la gendarmerie : seulement à 3 étoiles ou plus, contre un joueur armé d'un pistolet, vu et à moins de 35 m. Renvoie les dégâts (0 = raté ou pas de tir). */
export function policeVolley(dist: number, seen: boolean, armed: boolean, stars: number, rnd: number, rnd2: number) {
  if (stars < 3 || !armed || !seen || dist > 35) return 0;
  const p = 0.55 - dist / 100; return rnd < p ? Math.round(9 + rnd2 * 9) : 0;
}
