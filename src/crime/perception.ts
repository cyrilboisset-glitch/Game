// Perception : qui voit / entend un délit, ce qu'il en retient (signalement), et à quel point le joueur est reconnaissable.
export interface Profile { outfit: string | null; vehicle: string | null; face: boolean; }
export interface Candidate { id: number; x: number; z: number; minor: boolean; }
export interface Witness { id: number; dist: number; seen: boolean; }
/** Portée de vue d'un témoin selon l'heure et la discrétion du joueur. */
export const sightRange = (night: boolean, crouch: boolean, hidden: boolean) => (night ? 18 : 35) * (crouch ? 0.6 : 1) * (hidden ? 0.3 : 1);
/** Témoins d'un incident en (x,z) : ceux qui le voient (portée + ligne de vue) et ceux qui l'entendent (rayon de bruit). Les mineurs ne témoignent pas (ils ne sont mêlés à rien). */
export function gatherWitnesses(x: number, z: number, cands: Candidate[], sight: number, noise: number, blocked: (ax: number, az: number, bx: number, bz: number) => boolean): Witness[] {
  const out: Witness[] = [];
  for (const c of cands) {
    if (c.minor) continue; const d = Math.hypot(c.x - x, c.z - z); if (d > Math.max(sight, noise)) continue;
    const seen = d <= sight && !blocked(c.x, c.z, x, z); if (seen || d <= noise) out.push({ id: c.id, dist: d, seen });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, 6);
}
/** Ce que retient un témoin : la tenue s'il voit de près, le véhicule s'il voit, le visage s'il est près et que la capuche n'est pas levée. */
export function describe(w: Witness, outfit: string, vehicle: string | null, hooded: boolean): Profile {
  return { outfit: w.seen && w.dist < 25 && !vehicle ? outfit : null, vehicle: w.seen && vehicle ? vehicle : null, face: w.seen && w.dist < 12 && !hooded };
}
/** Fusionne un nouveau signalement dans celui que connaît la gendarmerie. */
export const merge = (a: Profile, b: Profile): Profile => ({ outfit: b.outfit ?? a.outfit, vehicle: b.vehicle ?? a.vehicle, face: a.face || b.face });
/** Reconnaissance par une patrouille (0-1) : multiplie sa portée de détection. À 4 étoiles et plus, tout le monde te cherche. */
export function recognizability(o: { stars: number; profile: Profile; outfit: string; vehicle: string | null; hooded: boolean; hidden: boolean; crouch: boolean }) {
  if (o.hidden) return 0.08; if (o.stars >= 4) return o.crouch ? 0.7 : 1;
  let r = 0.25; if (o.profile.outfit && o.profile.outfit === o.outfit && !o.vehicle) r += 0.45; if (o.profile.vehicle && o.vehicle === o.profile.vehicle) r += 0.5; if (o.profile.face && !o.hooded) r += 0.2; if (!o.profile.outfit && !o.profile.vehicle && !o.profile.face) r = 0.6;
  return Math.min(1, r) * (o.crouch ? 0.6 : 1);
}
/** Délai avant l'appel d'un témoin (s). */
export const reportDelay = (rnd: number, seen: boolean) => (seen ? 4 : 8) + rnd * 8;
