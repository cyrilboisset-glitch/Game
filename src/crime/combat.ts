// Bagarre : armes contondantes, cible devant soi, attaque par surprise (assommer). Les mineurs ne sont jamais des cibles.
export type WeaponId = 'poings' | 'bouteille' | 'cle' | 'barre' | 'batte';
export const WEAPONS: Record<WeaponId, { nom: string; dmg: [number, number]; range: number; cd: number; sneakKO: boolean; color: number; len: number }> = {
  poings: { nom: 'Poings', dmg: [12, 20], range: 1.45, cd: 0.45, sneakKO: false, color: 0, len: 0 },
  bouteille: { nom: 'Bouteille', dmg: [20, 30], range: 1.6, cd: 0.6, sneakKO: true, color: 0x2f6b3a, len: 0.3 },
  cle: { nom: 'Clé à molette', dmg: [26, 36], range: 1.6, cd: 0.6, sneakKO: true, color: 0x8a9096, len: 0.32 },
  barre: { nom: 'Barre de fer', dmg: [32, 44], range: 1.85, cd: 0.75, sneakKO: true, color: 0x5a5f66, len: 0.75 },
  batte: { nom: 'Batte', dmg: [36, 50], range: 1.9, cd: 0.8, sneakKO: true, color: 0x9a6a3a, len: 0.8 },
};
export interface Target { id: number; x: number; z: number; h: number; minor: boolean; }
/** Cible la plus proche dans un cône de ±60° devant le joueur, à portée de l'arme. */
export function findTarget(px: number, pz: number, heading: number, list: Target[], range: number): Target | null {
  let best: Target | null = null, bd = range; const fx = Math.sin(heading), fz = Math.cos(heading);
  for (const t of list) { if (t.minor) continue; const dx = t.x - px, dz = t.z - pz, d = Math.hypot(dx, dz); if (d > bd || d < 1e-3) continue; if ((dx * fx + dz * fz) / d < 0.5) continue; bd = d; best = t; }
  return best;
}
/** Le joueur est-il dans le dos de la cible (±65°) ? */
export function isBehind(px: number, pz: number, t: { x: number; z: number; h: number }) { const dx = px - t.x, dz = pz - t.z, d = Math.hypot(dx, dz) || 1; return (dx * Math.sin(t.h) + dz * Math.cos(t.h)) / d < -0.42; }
/** Dégâts d'un coup : surprise dans le dos = ×2 ; avec un objet contondant, dans le dos d'une cible qui ne se méfie pas = assommée net. */
export function hitDamage(w: WeaponId, behind: boolean, unaware: boolean, rnd: number) {
  const W = WEAPONS[w]; const base = W.dmg[0] + (W.dmg[1] - W.dmg[0]) * rnd; const ko = behind && unaware && W.sneakKO;
  return { dmg: Math.round(ko ? 999 : base * (behind && unaware ? 2 : 1)), ko };
}
