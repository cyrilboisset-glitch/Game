import { rng } from '../interiors/generator';
import type { Outfit } from '../player/outfit';

export interface Place { x: number; z: number; nom: string; bi?: number; kind: 'maison' | 'travail' | 'ecole' | 'commerce' | 'resto' | 'parc' | 'hors'; }
export type Metier = 'boulanger' | 'vendeur' | 'serveur' | 'coiffeur' | 'pharmacien' | 'banquier' | 'enseignant' | 'agent_mairie' | 'mecanicien' | 'employe_bureau' | 'ouvrier' | 'chauffeur' | 'retraite' | 'eleve' | 'sans_emploi';
export interface Npc {
  id: number; prenom: string; nom: string; age: number; genre: 'M' | 'F'; metier: Metier; metierLabel: string; adresse: string; seed: number; minor: boolean; hasCar: boolean; outfit: Outfit;
  home: Place; work: Place; shop: Place; resto: Place; park: Place; argent: number;
}

export interface Job { m: Metier; label: string; poi: string[] | null; weight: number; age: [number, number]; shift: [number, number]; lunch: boolean; off?: boolean; }
/** Professions : sous-types de POI qui les emploient (null = hors carte ou sans lieu), horaires de poste. */
export const JOBS: Job[] = [
  { m: 'boulanger', label: 'Boulanger|Boulangère', poi: ['bakery', 'pastry'], weight: 3, age: [20, 60], shift: [5.5, 13], lunch: false },
  { m: 'vendeur', label: 'Vendeur|Vendeuse', poi: ['supermarket', 'variety_store', 'clothes', 'shoes', 'books', 'convenience', 'butcher', 'greengrocer', 'florist', 'jewelry', 'optician', 'sports'], weight: 12, age: [18, 62], shift: [9, 18.5], lunch: true },
  { m: 'serveur', label: 'Serveur|Serveuse', poi: ['restaurant', 'fast_food', 'cafe', 'bar', 'pub'], weight: 6, age: [18, 55], shift: [11, 22.5], lunch: false },
  { m: 'coiffeur', label: 'Coiffeur|Coiffeuse', poi: ['hairdresser', 'beauty'], weight: 4, age: [20, 60], shift: [9, 18], lunch: true },
  { m: 'pharmacien', label: 'Pharmacien|Pharmacienne', poi: ['pharmacy'], weight: 1.5, age: [25, 62], shift: [9, 19], lunch: true },
  { m: 'banquier', label: 'Conseiller bancaire|Conseillère bancaire', poi: ['bank'], weight: 2.5, age: [24, 62], shift: [9, 17.5], lunch: true },
  { m: 'enseignant', label: 'Enseignant|Enseignante', poi: ['school', 'college', 'kindergarten'], weight: 5, age: [25, 62], shift: [8, 16.5], lunch: true },
  { m: 'agent_mairie', label: 'Agent municipal|Agente municipale', poi: ['townhall', 'government', 'community_centre'], weight: 2, age: [22, 62], shift: [8.5, 17], lunch: true },
  { m: 'mecanicien', label: 'Mécanicien|Mécanicienne', poi: ['car_repair', 'car', 'gas'], weight: 3, age: [20, 60], shift: [8, 18], lunch: true },
  { m: 'employe_bureau', label: 'Employé de bureau|Employée de bureau', poi: ['estate_agent', 'employment_agency', 'insurance', 'lawyer', 'accountant', 'company', 'it'], weight: 6, age: [22, 62], shift: [8.5, 17.5], lunch: true },
  { m: 'ouvrier', label: 'Ouvrier (hors commune)|Ouvrière (hors commune)', poi: null, weight: 14, age: [20, 62], shift: [7.2, 17], lunch: false, off: true },
  { m: 'chauffeur', label: 'Chauffeur routier|Chauffeuse routière', poi: null, weight: 4, age: [25, 62], shift: [6.5, 18.5], lunch: false, off: true },
  { m: 'retraite', label: 'Retraité|Retraitée', poi: null, weight: 16, age: [63, 90], shift: [0, 0], lunch: false },
  { m: 'eleve', label: 'Élève|Élève', poi: ['school', 'college'], weight: 14, age: [11, 17], shift: [8, 16.5], lunch: true },
  { m: 'sans_emploi', label: 'Sans emploi|Sans emploi', poi: null, weight: 4, age: [20, 60], shift: [0, 0], lunch: false },
];
const M = ['Lucas', 'Hugo', 'Louis', 'Nathan', 'Léo', 'Gabriel', 'Jules', 'Arthur', 'Maxime', 'Thomas', 'Antoine', 'Paul', 'Mathieu', 'Julien', 'Nicolas', 'Alain', 'Bernard', 'Michel', 'Jean', 'Pierre', 'Yannick', 'Karim', 'Samuel', 'Romain', 'Kevin', 'Olivier', 'Franck', 'Denis', 'Sébastien', 'Étienne'];
const F = ['Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Sarah', 'Inès', 'Julie', 'Marie', 'Sophie', 'Claire', 'Nathalie', 'Isabelle', 'Sylvie', 'Monique', 'Martine', 'Céline', 'Laura', 'Amélie', 'Aurélie', 'Fatima', 'Élodie', 'Valérie', 'Christine', 'Lucie', 'Anaïs', 'Margaux', 'Océane', 'Brigitte', 'Hélène'];
const N = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Gauthier', 'Perrin', 'Blanc', 'Faure', 'Rousseau', 'Chevalier', 'Guérin', 'Boyer', 'Garnier', 'Chevrier', 'Meunier', 'Bouvier', 'Genin', 'Rey', 'Collomb', 'Gachet', 'Vial'];
const HOODIES = [0x3d4f6b, 0x7a2f2f, 0x2f5a3d, 0x555a63, 0x8a6a2f, 0x2a2a2f, 0x6b4a7a, 0x9a9a9a, 0x1f3f5f, 0x7f3f1f];
const JEANS = [0x2f4a7a, 0x1f2f4f, 0x3a3a40, 0x4a5a7a, 0x20242b, 0x5a4a3a];
const HAIR = [0x2a1d14, 0x14100c, 0x4a3320, 0x7a5a30, 0x8a8a8a, 0xb8a070, 0x5a2a1a];

export interface PopulationInput { homes: Place[]; poiByType: (types: string[]) => Place[]; park: Place[]; shops: Place[]; restos: Place[]; addressOf: (x: number, z: number) => string; count: number; seed: number; }

export function generatePopulation(inp: PopulationInput): Npc[] {
  const r = rng(inp.seed); const out: Npc[] = []; const total = JOBS.reduce((a, j) => a + j.weight, 0);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  for (let id = 0; id < inp.count; id++) {
    let x = r() * total, job = JOBS[0]; for (const j of JOBS) { if ((x -= j.weight) <= 0) { job = j; break; } }
    let workplaces = job.poi ? inp.poiByType(job.poi) : []; if (job.poi && !workplaces.length) { job = JOBS.find(j => j.m === 'ouvrier')!; workplaces = []; }
    const genre: 'M' | 'F' = r() < 0.5 ? 'M' : 'F'; const age = job.age[0] + Math.floor(r() * (job.age[1] - job.age[0] + 1)); const home = pick(inp.homes);
    const work: Place = job.poi ? { ...pick(workplaces), kind: job.m === 'eleve' ? 'ecole' : 'travail' } : job.off ? { x: home.x, z: home.z, nom: 'Hors de la commune', kind: 'hors' } : { ...home };
    const nearest = (l: Place[]) => l.reduce((b, p) => (Math.hypot(p.x - home.x, p.z - home.z) < Math.hypot(b.x - home.x, b.z - home.z) ? p : b), l[0]);
    out.push({
      id, prenom: pick(genre === 'M' ? M : F), nom: pick(N), age, genre, metier: job.m, metierLabel: job.label.split('|')[genre === 'F' ? 1 : 0],
      adresse: inp.addressOf(home.x, home.z), seed: Math.floor(r() * 1e9), minor: age < 18, hasCar: age >= 18 && r() < (job.off ? 0.9 : 0.55), argent: Math.round(20 + r() * 300),
      outfit: { hoodie: pick(HOODIES), jeans: pick(JEANS), shoes: pick([0xe8e8e8, 0x222222, 0x6b4a2a]), hair: r() < 0.08 ? null : pick(HAIR), hood: r() < 0.6 },
      home, work, shop: nearest(inp.shops), resto: nearest(inp.restos), park: nearest(inp.park),
    });
  }
  return out;
}
