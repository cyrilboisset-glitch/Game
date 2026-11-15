// Règles de la gendarmerie (logique pure, testable). Niveau de recherche = étoiles de src/survival/heat.ts.
/** Nombre d'unités lancées à la poursuite selon le niveau (0-5). */
export const unitsForStars = (s: number) => [0, 1, 2, 4, 6, 8][Math.max(0, Math.min(5, s))];
/** Nombre de barrages (2 véhicules en travers de la route) selon le niveau. */
export const blocksForStars = (s: number) => (s >= 5 ? 3 : s >= 4 ? 2 : s >= 3 ? 1 : 0);
/** Part d'un délit effectivement signalée : gendarmerie à portée = tout, simple témoin = 60 %, personne = 25 % (rumeur/trace). */
export function witnessFactor(policeDist: number | null, npcDist: number | null) { if (policeDist !== null && policeDist < 80) return 1; if (npcDist !== null && npcDist < 25) return 0.6; return 0.25; }
/** Amende : proportionnelle au niveau, jamais plus que l'argent du joueur. */
export const fineFor = (money: number, stars: number) => Math.min(Math.max(0, money), 100 + stars * 80);
/** Refroidissement (points/s) : la recherche ne baisse que si le joueur n'a pas été vu depuis 20 s. */
export const cooldownRate = (unseenSeconds: number) => (unseenSeconds < 20 ? 0 : 3.5);
export const ARREST_TIME = 2.5;
/** Progression de l'arrestation : le joueur quasi immobile à moins de 7 m d'une unité ; sinon la jauge retombe vite. */
export function arrestStep(timer: number, playerSpeed: number, nearestDist: number, dt: number) { return playerSpeed < 2 && nearestDist < 7 ? timer + dt : Math.max(0, timer - dt * 2); }
