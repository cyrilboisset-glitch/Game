import { rng } from '../interiors/generator';

export type MKind = 'livraison' | 'course' | 'taxi' | 'coursier' | 'colis';
export interface Stage { x: number; z: number; label: string; kind: 'prise' | 'depot' | 'point'; r: number; }
export interface Offer { id: string; kind: MKind; titre: string; desc: string; stages: Stage[]; limit: number | null; pay: number; rep: number; risky: boolean; needsCar: boolean; npcId?: number; }
export interface Spot { x: number; z: number; nom: string; sous_type?: string; }
export interface GenCtx { day: number; seed: number; commerces: Spot[]; bureaux: Spot[]; neutres: Spot[]; nodes: { x: number; z: number }[]; rep: number; at: { x: number; z: number }; }

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** Multiplicateur de paie selon la réputation (0-100). */
export const repMult = (rep: number) => 1 + Math.max(0, Math.min(100, rep)) / 200;
/** Temps imparti (s) : trajet à ~7 m/s + marge. */
export const timeFor = (d: number, slack = 70) => Math.round(d / 7 + slack);

/** Offres du jour : déterministes (jour + graine). Les lieux « colis » sont toujours fictifs et neutres (jamais un commerce réel, jamais près d'une école). */
export function makeOffers(c: GenCtx): Offer[] {
  const r = rng(c.seed ^ (c.day * 104729)); const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]; const out: Offer[] = [];
  const near = (list: Spot[], from: { x: number; z: number }, dmin: number, dmax: number) => list.filter(s => { const d = dist(s, from); return d >= dmin && d <= dmax; });
  const rm = repMult(c.rep);
  for (let i = 0; i < 2 && c.commerces.length > 1; i++) {   // livraisons entre commerces
    const a = pick(near(c.commerces, c.at, 100, 2500).length ? near(c.commerces, c.at, 100, 2500) : c.commerces); const bs = near(c.commerces, a, 300, 1500); if (!bs.length) continue; const b = pick(bs); const d = dist(a, b);
    out.push({ id: `liv${i}`, kind: 'livraison', titre: `Livraison : ${a.nom} → ${b.nom}`, desc: 'Récupérer des marchandises et les livrer avant la fin du délai.', stages: [{ x: a.x, z: a.z, label: `Retirer le colis chez ${a.nom}`, kind: 'prise', r: 9 }, { x: b.x, z: b.z, label: `Livrer chez ${b.nom}`, kind: 'depot', r: 9 }], limit: timeFor(d + dist(c.at, a)), pay: Math.round((18 + d * 0.045) * rm), rep: 2, risky: false, needsCar: false });
  }
  if (c.bureaux.length > 1) { const a = pick(c.bureaux), bs = near(c.bureaux, a, 250, 2000); if (bs.length) { const b = pick(bs), d = dist(a, b); out.push({ id: 'cou0', kind: 'coursier', titre: `Coursier : ${a.nom} → ${b.nom}`, desc: 'Un pli urgent entre deux entreprises.', stages: [{ x: a.x, z: a.z, label: `Prendre le pli chez ${a.nom}`, kind: 'prise', r: 9 }, { x: b.x, z: b.z, label: `Remettre le pli à ${b.nom}`, kind: 'depot', r: 9 }], limit: timeFor(d + dist(c.at, a), 55), pay: Math.round((26 + d * 0.05) * rm), rep: 3, risky: false, needsCar: false }); } }
  if (c.nodes.length > 8) { const start = pick(c.nodes); const pts = [start]; for (let k = 0; k < 3; k++) { const cand = c.nodes.filter(n => dist(n, pts[pts.length - 1]) > 250 && dist(n, pts[pts.length - 1]) < 700); if (!cand.length) break; pts.push(pick(cand)); }
    if (pts.length === 4) { let tot = 0; for (let k = 1; k < 4; k++) tot += dist(pts[k - 1], pts[k]); out.push({ id: 'crs0', kind: 'course', titre: 'Course chronométrée', desc: 'Passe les trois points de contrôle en voiture, le plus vite possible.', stages: pts.map((p, k) => ({ x: p.x, z: p.z, label: k === 0 ? 'Rejoindre le départ' : `Point de contrôle ${k}`, kind: 'point' as const, r: 14 })), limit: Math.round(tot / 11 + 40), pay: Math.round((60 + tot * 0.06) * rm), rep: 4, risky: false, needsCar: true }); } }
  if (c.neutres.length > 1) { const a = pick(c.neutres), bs = near(c.neutres, a, 500, 3000); if (bs.length) { const b = pick(bs), d = dist(a, b); out.push({ id: 'col0', kind: 'colis', titre: `Colis discret : ${a.nom} → ${b.nom}`, desc: 'Marchandise générique, lieux fictifs et clients adultes. Si la gendarmerie est à tes trousses (2 étoiles ou plus), la prime fond.', stages: [{ x: a.x, z: a.z, label: `Prendre le colis (${a.nom})`, kind: 'prise', r: 10 }, { x: b.x, z: b.z, label: `Livrer le colis (${b.nom})`, kind: 'depot', r: 10 }], limit: timeFor(d + dist(c.at, a), 90), pay: Math.round((140 + d * 0.11) * rm), rep: 6, risky: true, needsCar: true }); } }
  out.push({ id: 'taxi', kind: 'taxi', titre: 'Taxi : un habitant attend', desc: 'Un habitant à pied cherche un chauffeur. Il est près de toi.', stages: [], limit: null, pay: 0, rep: 2, risky: false, needsCar: true });
  return out;
}

/** Lieux neutres pour les missions « colis » : bouts de voie sans bâtiment à moins de 35 m, loin de toute école. Noms inventés. */
export function neutralSpots(deadEnds: { x: number; z: number }[], blocked: (x: number, z: number) => boolean, schools: { x: number; z: number }[], seed = 3): Spot[] {
  const r = rng(seed); const names = ['Entrepôt', 'Parking de la zone', 'Hangar', 'Aire de service', 'Dépôt']; const out: Spot[] = [];
  for (const p of deadEnds) { if (blocked(p.x, p.z)) continue; if (schools.some(s => dist(s, p) < 250)) continue; out.push({ x: p.x, z: p.z, nom: `${names[Math.floor(r() * names.length)]} ${String.fromCharCode(65 + Math.floor(r() * 8))}${1 + Math.floor(r() * 9)}` }); }
  return out;
}
