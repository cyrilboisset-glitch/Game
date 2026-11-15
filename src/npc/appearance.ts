// Diversité des habitants : origines (noms + carnation + cheveux), morphologies (taille, corpulence), âge. Purement cosmétique : aucun effet sur le comportement.
export type Origin = 'europe' | 'maghreb' | 'afrique' | 'europe_sud' | 'asie' | 'autre';
export type HairStyle = 'courts' | 'rases' | 'longs' | 'queue' | 'boucles' | 'chauve';
export interface Look { origin: Origin; skin: number; height: number; width: number; head: number; hairStyle: HairStyle; hairColor: number; stoop: number; skirt: boolean; female: boolean; }

/** Teintes de peau (multiplicateur de couleur appliqué à la texture de peau, 0 = la plus claire). */
export const SKIN_TINTS = [0xffffff, 0xf2e2d6, 0xd9bda4, 0xa88060, 0x75543f, 0x4f382c];
export const SKIN_DISPLAY = [0xf3cdb0, 0xe4b48e, 0xc68e66, 0x9a6a46, 0x6b4630, 0x4a3022];

const ORIGIN_W: [Origin, number][] = [['europe', 0.62], ['maghreb', 0.16], ['afrique', 0.09], ['europe_sud', 0.08], ['asie', 0.03], ['autre', 0.02]];
const SKIN_RANGE: Record<Origin, [number, number]> = { europe: [0, 2], maghreb: [1, 3], afrique: [4, 5], europe_sud: [1, 3], asie: [1, 3], autre: [1, 4] };
export const NAMES: Record<Origin, { M: string[]; F: string[]; N: string[] }> = {
  europe: { M: ['Lucas', 'Hugo', 'Louis', 'Nathan', 'Léo', 'Gabriel', 'Jules', 'Arthur', 'Maxime', 'Thomas', 'Antoine', 'Paul', 'Mathieu', 'Julien', 'Nicolas', 'Alain', 'Bernard', 'Michel', 'Jean', 'Pierre', 'Romain', 'Kevin', 'Olivier', 'Franck', 'Denis', 'Sébastien', 'Étienne'],
    F: ['Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Sarah', 'Inès', 'Julie', 'Marie', 'Sophie', 'Claire', 'Nathalie', 'Isabelle', 'Sylvie', 'Monique', 'Martine', 'Céline', 'Laura', 'Amélie', 'Aurélie', 'Élodie', 'Valérie', 'Christine', 'Lucie', 'Anaïs', 'Margaux', 'Océane', 'Brigitte', 'Hélène'],
    N: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Gauthier', 'Perrin', 'Blanc', 'Faure', 'Rousseau', 'Chevalier', 'Guérin', 'Boyer', 'Garnier', 'Meunier', 'Bouvier', 'Genin', 'Rey', 'Collomb', 'Gachet', 'Vial'] },
  maghreb: { M: ['Karim', 'Yanis', 'Samir', 'Mehdi', 'Nassim', 'Amine', 'Sofiane', 'Rachid', 'Omar', 'Younes', 'Mohamed', 'Ahmed', 'Bilal', 'Walid', 'Hamza'], F: ['Fatima', 'Samira', 'Nadia', 'Leïla', 'Yasmine', 'Amina', 'Meriem', 'Salma', 'Khadija', 'Soraya', 'Imane', 'Houda', 'Lina', 'Rania'], N: ['Benali', 'Haddad', 'Mansouri', 'Cherif', 'Boukhari', 'Meziane', 'Belkacem', 'Saidi', 'Amrani', 'Bouzid', 'Khelifi', 'Ouali', 'Berrada', 'Hamidi'] },
  afrique: { M: ['Moussa', 'Ibrahima', 'Mamadou', 'Kofi', 'Christian', 'Samuel', 'Cheick', 'Daouda', 'Amadou', 'Eric', 'Franck', 'Yannick'], F: ['Aïssatou', 'Fatoumata', 'Mariam', 'Grâce', 'Esther', 'Awa', 'Binta', 'Mariama', 'Bintou', 'Christelle', 'Prisca'], N: ['Diallo', 'Traoré', 'Konaté', 'Camara', 'Ndiaye', 'Diop', 'Mbaye', 'Coulibaly', 'Keita', 'Sow', 'Bah', 'Sylla'] },
  europe_sud: { M: ['Antonio', 'Marco', 'Luis', 'Carlos', 'Mario', 'Paulo', 'Rui', 'Diego', 'Enzo', 'Giovanni'], F: ['Maria', 'Carla', 'Lucia', 'Sofia', 'Ana', 'Rosa', 'Elena', 'Giulia', 'Paula', 'Teresa'], N: ['Silva', 'Ferreira', 'Rossi', 'Moreno', 'Pereira', 'Costa', 'Ricci', 'Marques', 'Lopez', 'Bianchi', 'Santos', 'Fernandes'] },
  asie: { M: ['Minh', 'Kenji', 'Wei', 'Duc', 'Hiro', 'Tuan'], F: ['Linh', 'Hana', 'Mai', 'Yuki', 'Lan', 'Anh'], N: ['Tran', 'Nguyen', 'Lê', 'Pham', 'Chen', 'Wang', 'Tanaka', 'Vo'] },
  autre: { M: ['Ali', 'Emre', 'David', 'Andrei', 'Ivan', 'Tarek'], F: ['Elif', 'Anna', 'Irina', 'Maya', 'Sara', 'Dalia'], N: ['Yilmaz', 'Petrov', 'Kowalski', 'Demir', 'Ivanov', 'Cohen', 'Novak'] },
};
const HAIR_BY: Record<Origin, number[]> = { europe: [0x2a1d14, 0x4a3320, 0x7a5a30, 0xb8a070, 0x5a2a1a, 0x14100c], maghreb: [0x14100c, 0x2a1d14, 0x1a120d], afrique: [0x0e0b09, 0x14100c], europe_sud: [0x14100c, 0x2a1d14, 0x4a3320], asie: [0x0e0b09, 0x14100c], autre: [0x2a1d14, 0x14100c, 0x7a5a30] };

export function pickOrigin(r: () => number): Origin { let x = r(); for (const [o, w] of ORIGIN_W) { if ((x -= w) <= 0) return o; } return 'europe'; }

/** Apparence d'une personne : morphologies variées (fine → forte), enfants plus petits à grosse tête, personnes âgées voûtées aux cheveux gris. */
export function makeLook(r: () => number, origin: Origin, genre: 'M' | 'F', age: number): Look {
  const [lo, hi] = SKIN_RANGE[origin]; const skin = Math.min(5, Math.max(0, lo + Math.floor(r() * (hi - lo + 1))));
  const kid = age < 14, teen = age >= 14 && age < 18, elder = age >= 70;
  let height = genre === 'M' ? 1.77 + (r() - 0.5) * 0.15 : 1.65 + (r() - 0.5) * 0.13;
  if (kid) height = 1.05 + (age - 6) * 0.058 + (r() - 0.5) * 0.06; else if (teen) height = (genre === 'M' ? 1.62 : 1.58) + (age - 14) * 0.04 + (r() - 0.5) * 0.08; if (elder) height *= 0.97 - (age - 70) * 0.001;
  const t = r(); let width = t < 0.14 ? 0.88 + r() * 0.04 : t < 0.68 ? 0.96 + r() * 0.08 : t < 0.9 ? 1.08 + r() * 0.08 : 1.2 + r() * 0.16;   // fine, normale, forte, très forte
  if (kid) width = 0.9 + r() * 0.1; if (genre === 'F') width *= 0.96;
  const head = kid ? 1.22 - (age - 6) * 0.015 : 1 + (r() - 0.5) * 0.08;
  const f = genre === 'F'; let hairStyle: HairStyle; const h = r();
  if (elder) hairStyle = h < 0.35 ? 'chauve' : f ? (h < 0.7 ? 'courts' : 'queue') : 'courts';
  else if (f) hairStyle = h < 0.35 ? 'longs' : h < 0.55 ? 'queue' : h < 0.75 ? (origin === 'afrique' ? 'boucles' : 'courts') : h < 0.9 ? 'courts' : 'longs';
  else hairStyle = h < 0.12 ? 'chauve' : h < 0.35 ? 'rases' : (h < 0.5 && origin === 'afrique') ? 'boucles' : 'courts';
  let hairColor = HAIR_BY[origin][Math.floor(r() * HAIR_BY[origin].length)];
  if (elder) hairColor = r() < 0.85 ? (r() < 0.5 ? 0xd8d8d8 : 0x9a9a9a) : hairColor; else if (age > 50 && r() < 0.45) hairColor = 0x8a8a8a;
  return { origin, skin, height, width, head, hairStyle, hairColor, stoop: elder ? 0.16 + r() * 0.12 : age > 55 ? 0.05 : 0, skirt: f && !kid && r() < 0.3, female: f };
}
