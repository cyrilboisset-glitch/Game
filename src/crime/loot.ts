// Butin : objets volés avec poids et valeur, sac à dos limité, coffre des véhicules, prix du receleur. Logique pure.
export interface ItemDef { nom: string; kg: number; val: number; }
export const ITEMS: Record<string, ItemDef> = {
  bijoux: { nom: 'Bijoux', kg: 0.3, val: 320 }, montre: { nom: 'Montre', kg: 0.1, val: 180 }, telephone: { nom: 'Téléphone', kg: 0.2, val: 120 },
  tablette: { nom: 'Tablette', kg: 0.6, val: 150 }, portable: { nom: 'Ordinateur portable', kg: 2.5, val: 340 }, console: { nom: 'Console de jeu', kg: 3, val: 190 },
  tele: { nom: 'Télévision', kg: 14, val: 280 }, ecran: { nom: 'Écran d\'ordinateur', kg: 5, val: 110 }, outillage: { nom: 'Caisse à outils', kg: 9, val: 160 },
  perceuse: { nom: 'Perceuse', kg: 2.2, val: 90 }, enceinte: { nom: 'Enceinte', kg: 1.5, val: 70 }, vin: { nom: 'Caisse de vin', kg: 8, val: 110 },
  billets: { nom: 'Sac de billets', kg: 4, val: 1600 },
};
export type ItemId = keyof typeof ITEMS;
/** Capacité du sac à dos (kg). Au-delà de 6 kg on ralentit. */
export const BAG_MAX = 20, TRUNK_MAX = 220;
export const kgOf = (l: string[]) => l.reduce((a, i) => a + (ITEMS[i]?.kg ?? 0), 0);
export const valueOf = (l: string[]) => l.reduce((a, i) => a + (ITEMS[i]?.val ?? 0), 0);
/** Ralentissement dû au poids porté. */
export const loadFactor = (kg: number) => (kg <= 6 ? 1 : Math.max(0.55, 1 - (kg - 6) / 28));
/** Peut-on ajouter cet objet au sac ? */
export const fits = (bag: string[], id: string, max = BAG_MAX) => kgOf(bag) + (ITEMS[id]?.kg ?? 99) <= max + 1e-6;

/** Ce qu'on trouve en fouillant, selon le type de lieu et le meuble. null = rien d'emportable (argent, nourriture : gérés à part). */
const TABLES: Record<string, [string, number][]> = {
  'logement:arm': [['bijoux', 0.22], ['montre', 0.15]], 'logement:com': [['bijoux', 0.18], ['telephone', 0.2], ['tablette', 0.15]],
  'bureau': [['telephone', 0.12], ['portable', 0.18]], 'atelier': [['perceuse', 0.25], ['outillage', 0.2]], 'restaurant': [['vin', 0.15]], 'bar': [['vin', 0.25], ['enceinte', 0.12]],
};
export function rollLoot(kind: string, spot: string, rnd: () => number): string | null {
  const t = TABLES[`${kind}:${spot}`] ?? TABLES[kind]; if (!t) return null;
  for (const [id, p] of t) if (rnd() < p) return id; return null;
}
/** Objets volumineux à emporter tels quels (télé du séjour, console, écran de bureau). */
export const BULKY: Record<string, string> = { tv: 'tele', console: 'console', pc: 'ecran' };

/** Prix proposé par le receleur : environ un tiers de la valeur ; il paie moins si vous êtes recherché, et refuse au-delà de 2 étoiles. */
export function fencePrice(items: string[], stars: number): number | null {
  items = items.filter(i => i !== 'billets'); if (stars > 2) return null; const k = stars === 0 ? 0.36 : stars === 1 ? 0.3 : 0.22;
  return Math.round(valueOf(items) * k);
}
/** Résumé lisible d'une liste d'objets (« 2 × Bijoux, Télévision »). */
export function summary(l: string[]) { const c = new Map<string, number>(); for (const i of l) c.set(i, (c.get(i) ?? 0) + 1); return [...c].map(([i, n]) => (n > 1 ? `${n} × ` : '') + (ITEMS[i]?.nom ?? i)).join(', '); }
