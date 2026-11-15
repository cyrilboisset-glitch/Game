// Générateur d'intérieurs procéduraux (logique pure, déterministe par graine). Ce ne sont PAS des reproductions réelles.
export type Kind = 'logement' | 'supermarche' | 'commerce' | 'restaurant' | 'bar' | 'pharmacie' | 'banque' | 'coiffeur' | 'ecole' | 'bureau' | 'atelier';
export interface Box { x: number; z: number; w: number; d: number; h: number; y: number; color: number; solid: boolean; tag?: string; }
export interface Spot { id: string; kind: 'sortie' | 'acheter' | 'prendre' | 'manger' | 'boire' | 'fouiller' | 'dormir' | 'toilettes' | 'robinet' | 'coffre'; x: number; z: number; label: string; }
export interface Layout { kind: Kind; W: number; D: number; H: number; boxes: Box[]; spots: Spot[]; door: { x: number; z: number }; spawn: { x: number; z: number }; lights: { x: number; z: number }[]; floor: 'bois' | 'carrelage' | 'beton'; wall: number; protected: boolean; }

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Type d'intérieur d'après le sous-type OSM du lieu (ou logement/bureau/atelier par défaut). */
export function kindFor(subtype: string | undefined, area: number, r: () => number): Kind {
  switch (subtype) {
    case 'supermarket': case 'variety_store': case 'convenience': return 'supermarche';
    case 'bakery': case 'pastry': case 'butcher': case 'greengrocer': case 'florist': case 'clothes': case 'shoes': case 'books': case 'jewelry': case 'optician': case 'second_hand': case 'sports': return 'commerce';
    case 'restaurant': case 'fast_food': case 'cafe': return 'restaurant';
    case 'bar': case 'pub': return 'bar';
    case 'pharmacy': return 'pharmacie'; case 'bank': return 'banque';
    case 'hairdresser': case 'beauty': return 'coiffeur';
    case 'school': case 'kindergarten': case 'college': return 'ecole';
    case 'car_repair': case 'car': case 'gas': return 'atelier';
    case undefined: return area > 500 ? (r() < 0.5 ? 'atelier' : 'bureau') : (r() < 0.07 ? 'bureau' : 'logement');
    default: return 'bureau';
  }
}

const WALL = 0.2, DOOR_W = 1.3;
export function generate(kind: Kind, wRaw: number, dRaw: number, seed: number): Layout {
  const r = rng(seed); const W = Math.round(Math.min(Math.max(wRaw, 6), 28)), D = Math.round(Math.min(Math.max(dRaw, 6), 18)), H = 2.9;
  const boxes: Box[] = [], spots: Spot[] = [], lights: { x: number; z: number }[] = [];
  const door = { x: W / 2, z: D }; const spawn = { x: W / 2, z: D - 1.7 };
  const wallColor = [0xe9e3d6, 0xd8e0e6, 0xe6d7c3, 0xdfe7d8, 0xece0e0][Math.floor(r() * 5)];
  // murs extérieurs (porte au sud)
  const solid = (x: number, z: number, w: number, d: number, h: number, color: number, tag?: string, y = 0) => boxes.push({ x, z, w, d, h, y, color, solid: true, tag });
  solid(W / 2, -WALL / 2, W + WALL * 2, WALL, H, wallColor, 'mur'); solid(-WALL / 2, D / 2, WALL, D, H, wallColor, 'mur'); solid(W + WALL / 2, D / 2, WALL, D, H, wallColor, 'mur');
  const half = (W - DOOR_W) / 2; solid(half / 2, D + WALL / 2, half, WALL, H, wallColor, 'mur'); solid(W - half / 2, D + WALL / 2, half, WALL, H, wallColor, 'mur');
  solid(W / 2, D + WALL / 2, DOOR_W, WALL, H - 2.1, wallColor, 'mur', 2.1);
  spots.push({ id: 'sortie', kind: 'sortie', x: door.x, z: door.z - 0.7, label: 'Sortir' });
  const clear = (x: number, z: number, w: number, d: number) => !(x + w / 2 > W / 2 - 1.6 && x - w / 2 < W / 2 + 1.6 && z + d / 2 > D - 3.2);   // zone dégagée devant la porte
  const put = (x: number, z: number, w: number, d: number, h: number, color: number, tag?: string) => { if (x - w / 2 < 0.05 || x + w / 2 > W - 0.05 || z - d / 2 < 0.05 || z + d / 2 > D - 0.05) return false; if (!clear(x, z, w, d)) return false; solid(x, z, w, d, h, color, tag); return true; };
  const nLights = Math.max(1, Math.round(W / 8)); for (let i = 0; i < nLights; i++) lights.push({ x: (i + 0.5) * W / nLights, z: D / 2 });
  let floor: Layout['floor'] = 'bois';

  const shelfRows = (z0: number, z1: number, step: number, tag: string, color: number) => { for (let z = z0; z <= z1; z += step) for (let x = 2; x < W - 2; x += 3.2) if (put(x, z, 2.6, 0.55, 1.8, color, tag)) { if (r() < 0.25) spots.push({ id: `p${spots.length}`, kind: 'prendre', x, z: z + 0.9, label: 'Prendre sur l\'étagère' }); } };
  switch (kind) {
    case 'supermarche': floor = 'carrelage'; shelfRows(3, D - 5, 2.6, 'rayon', 0xb8c0c8);
      put(W - 2, D - 2.4, 3.2, 0.9, 1.0, 0x9a5b3a, 'caisse'); spots.push({ id: 'caisse', kind: 'acheter', x: W - 2, z: D - 3.3, label: 'Passer en caisse (5 €)' });
      for (let x = 2; x < W - 2; x += 2.4) put(x, 0.6, 2.0, 0.9, 1.9, 0xdfe9f0, 'frigo'); break;
    case 'commerce': floor = 'bois'; put(W / 2, D / 2 - 0.5, Math.min(W - 3, 7), 0.8, 1.05, 0x8b5a33, 'comptoir'); spots.push({ id: 'cptr', kind: 'acheter', x: W / 2, z: D / 2 + 0.7, label: 'Acheter au comptoir (5 €)' });
      for (let x = 1.5; x < W - 1; x += 2.4) { put(x, 0.5, 2.0, 0.5, 2.0, 0xc7a27a, 'etagere'); } spots.push({ id: 'etg', kind: 'prendre', x: W / 3, z: 1.6, label: 'Prendre dans la vitrine' }); break;
    case 'restaurant': case 'bar': floor = 'bois'; put(W / 2, 1.1, Math.min(W - 3, 9), 0.9, 1.1, 0x6b4428, 'bar'); spots.push({ id: 'bar', kind: kind === 'bar' ? 'boire' : 'manger', x: W / 2, z: 2.3, label: kind === 'bar' ? 'Commander à boire (4 €)' : 'Commander un repas (12 €)' });
      for (let z = 4; z < D - 4; z += 2.6) for (let x = 2; x < W - 2; x += 3) { if (put(x, z, 1.0, 1.0, 0.75, 0x7a5230, 'table')) { put(x - 0.9, z, 0.45, 0.45, 0.45, 0x5a3c22, 'chaise'); put(x + 0.9, z, 0.45, 0.45, 0.45, 0x5a3c22, 'chaise'); } } break;
    case 'pharmacie': floor = 'carrelage'; put(W / 2, D / 2 - 1, Math.min(W - 4, 6), 0.8, 1.05, 0xe4e9ee, 'comptoir'); spots.push({ id: 'ph', kind: 'acheter', x: W / 2, z: D / 2 + 0.2, label: 'Acheter (5 €)' }); shelfRows(1.2, 1.2, 1, 'rayon', 0xf0f4f7); put(W / 2, D / 2 - 2.6, 2.2, 0.5, 1.8, 0xf0f4f7, 'rayon'); break;
    case 'banque': floor = 'carrelage'; for (let x = 3; x < W - 2; x += 4) put(x, D / 2, 2.4, 0.7, 1.1, 0x5a6470, 'guichet'); put(W / 2, 0.8, 2.6, 1.2, 2.4, 0x3e4650, 'coffre'); spots.push({ id: 'coffre', kind: 'coffre', x: W / 2, z: 1.9, label: 'Forcer le coffre' }); break;
    case 'coiffeur': floor = 'carrelage'; for (let x = 2; x < W - 1.5; x += 2.2) { put(x, 0.5, 1.5, 0.15, 1.2, 0xbcd0dc, 'miroir'); put(x, 1.6, 0.7, 0.7, 0.55, 0x222222, 'fauteuil'); } put(W - 1.5, D - 2.6, 1.6, 0.7, 1.0, 0x9a6a44, 'caisse'); spots.push({ id: 'cois', kind: 'acheter', x: W - 1.5, z: D - 3.4, label: 'Prendre un soin (15 €)' }); break;
    case 'ecole': floor = 'carrelage'; for (let z = 3; z < D - 3; z += 2.2) for (let x = 2; x < W - 2; x += 2.4) { put(x, z, 1.1, 0.6, 0.75, 0xc9a66b, 'pupitre'); } put(W / 2, 0.5, 4, 0.2, 1.4, 0x2f4a3a, 'tableau'); break;   // école : décor neutre, aucune interaction
    case 'bureau': floor = 'carrelage'; for (let x = 2; x < W - 2; x += 3.2) for (let z = 2; z < D - 4; z += 3) { put(x, z, 1.6, 0.8, 0.75, 0xb8956a, 'bureau'); put(x, z - 0.2, 0.5, 0.05, 0.4, 0x222222, 'ecran'); if (r() < 0.45) spots.push({ id: `t${spots.length}`, kind: 'fouiller', x, z: z + 0.9, label: 'Fouiller le tiroir' }); } break;
    case 'atelier': floor = 'beton'; for (let x = 2; x < W - 2; x += 3.4) { put(x, 1.0, 2.4, 0.9, 0.95, 0x6d7a86, 'etabli'); if (r() < 0.6) spots.push({ id: `a${spots.length}`, kind: 'fouiller', x, z: 2.0, label: 'Fouiller l\'établi' }); } for (let i = 0; i < 6; i++) put(2 + r() * (W - 4), 4 + r() * (D - 9), 1.1, 1.1, 1.0 + r() * 0.8, 0x9b7a4a, 'caisse'); break;
    default: {  // logement : séjour + cuisine + chambre + salle de bain
      floor = 'bois'; const wy = Math.round(W * 0.58);
      put(wy - 0.1, D * 0.35, 0.15, D * 0.7, H, wallColor, 'cloison'); put(wy - 0.1, D * 0.35 - 0, 0.15, 0.1, H, wallColor, 'cloison');
      put(3, 1.0, 3.2, 0.7, 0.9, 0xdadada, 'cuisine'); put(0.7, 3.0, 0.7, 0.7, 1.8, 0xf5f5f5, 'frigo'); spots.push({ id: 'frigo', kind: 'fouiller', x: 1.8, z: 3.1, label: 'Ouvrir le frigo' }); spots.push({ id: 'evier', kind: 'robinet', x: 3, z: 1.9, label: 'Boire au robinet' });
      put(wy / 2, D * 0.55, 2.2, 1.0, 0.8, 0x6b7a8f, 'canape'); put(wy / 2, D * 0.55 - 2, 1.6, 0.9, 0.5, 0x7a5a3a, 'table');
      put(W - 2, 1.5, 1.9, 2.1, 0.6, 0xc9bda8, 'lit'); spots.push({ id: 'lit', kind: 'dormir', x: W - 3.4, z: 2.6, label: 'Se coucher dans le lit' });
      put(W - 0.8, D * 0.62, 0.5, 0.7, 0.45, 0xffffff, 'wc'); spots.push({ id: 'wc', kind: 'toilettes', x: W - 1.8, z: D * 0.62, label: 'Utiliser les toilettes' });
      put(W - 1.2, 3.8, 0.9, 1.4, 1.9, 0x8a6a4a, 'armoire'); spots.push({ id: 'arm', kind: 'fouiller', x: W - 2.2, z: 3.8, label: 'Fouiller l\'armoire' });
      if (r() < 0.6) spots.push({ id: 'com', kind: 'fouiller', x: wy / 2 - 2, z: D * 0.55, label: 'Fouiller la commode' }); break;
    }
  }
  return { kind, W, D, H, boxes, spots, door, spawn, lights, floor, wall: wallColor, protected: kind === 'ecole' };
}

/** Résolution cercle ↔ boîtes pleines (AABB). */
export function collide(l: Layout, pos: { x: number; z: number }, rad: number) {
  for (let it = 0; it < 2; it++) for (const b of l.boxes) {
    if (!b.solid || b.y > 0.5) continue;
    const hx = b.w / 2, hz = b.d / 2; const cx = Math.max(b.x - hx, Math.min(pos.x, b.x + hx)), cz = Math.max(b.z - hz, Math.min(pos.z, b.z + hz));
    let dx = pos.x - cx, dz = pos.z - cz; const d = Math.hypot(dx, dz);
    if (d < rad) { if (d < 1e-5) { dx = pos.x - b.x; dz = pos.z - b.z; const m = Math.hypot(dx, dz) || 1; pos.x += dx / m * rad; pos.z += dz / m * rad; } else { pos.x += dx / d * (rad - d); pos.z += dz / d * (rad - d); } }
  }
  // garde-fou : rester dans la pièce (sauf passage de la porte)
  pos.x = Math.max(rad, Math.min(l.W - rad, pos.x)); pos.z = Math.max(rad, Math.min(l.D + 1.5, pos.z));
}
