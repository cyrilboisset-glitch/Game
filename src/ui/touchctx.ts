// Boutons tactiles contextuels : déduits du texte d'aide affiché (« E : voler… · G : … ») et de l'état du joueur. Logique pure, testable.
import type { TouchCtx } from './input';

export interface CtxState { mode: 'foot' | 'car'; inside: boolean; sleeping: boolean; observing: boolean; weapon: string; ammo: number; weapons: number; night: boolean;
  faim: number; soif: number; vessie: number; energie: number; sante: number; food: number; water: number; kits: number; bleeding: boolean; wanted: boolean; hooded: boolean; }
const SKIP = new Set(['le', 'la', 'les', "l'", 'un', 'une', 'votre', 'vos']);
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** Premier verbe d'une consigne (« la forcer à monter… » → « Forcer »). */
export function verb(t: string) { const w = t.trim().replace(/[.:]$/, '').split(/\s+/).filter(x => !SKIP.has(x.toLowerCase())); return w.length ? cap(w[0].replace(/^l'/, '')) : null; }
/** Extrait la consigne associée à une touche (« E : … » ou « B/E : … »). */
export function keyText(prompt: string, key: string) { const m = prompt.match(new RegExp(`(?:^|[·—]\\s*)(?:[A-Z]/)?${key}(?:/[A-Z])? : ([^·—]+)`)); return m ? m[1].trim() : null; }

export function touchContext(prompt: string, s: CtxState): TouchCtx {
  const chips: [string, string][] = [];
  if (s.observing) return { primary: 'Quitter', act: 'quit', attack: null, car: false, chips: [] };
  if (s.sleeping) return { primary: 'Réveil', act: 'sleep', attack: null, car: false, chips: [] };
  const e = keyText(prompt, 'E'); let primary = e ? verb(e) : null; if (primary === 'Valider' || /^valider/i.test(e ?? '')) primary = 'Valider';
  // en voiture : E = descendre (toujours possible)
  if (s.mode === 'car' && !s.inside) primary = primary ?? 'Descendre';
  if (primary === 'E') primary = null;
  // attaque : consigne explicite (« F : braquer la caisse ») sinon selon l'arme ; jamais en voiture
  const f = keyText(prompt, 'F'); let attack: string | null = null;
  if (s.mode === 'foot') attack = f ? verb(f) : s.inside ? null : s.weapon === 'pistolet' && s.ammo > 0 ? 'Tirer' : 'Frapper';
  // boutons contextuels
  if (keyText(prompt, 'N')) chips.push(['next', 'Suivant']);
  const b = keyText(prompt, 'B'); if (b && !/^valider/i.test(b)) chips.push(['buy', verb(b) ?? 'Valider']); else if (/B\/E : valider/.test(prompt) && primary !== 'Valider') chips.push(['buy', 'Valider']);
  const g = keyText(prompt, 'G'); if (g) chips.push(s.mode === 'car' ? ['garage', 'Garage'] : ['fire', 'Feu']);
  if (s.mode === 'car' && s.night) chips.push(['lights', 'Phares']);
  // besoins urgents
  if (s.faim < 35 && s.food > 0) chips.push(['eat', 'Manger']);
  if (s.soif < 35 && s.water > 0) chips.push(['drink', 'Boire']);
  if ((s.bleeding || s.sante < 50) && s.kits > 0) chips.push(['heal', 'Soin']);
  if (s.vessie > 80 && s.mode === 'foot') chips.push(['pee', 'Besoin']);
  if (s.energie < 15 && s.mode === 'foot') chips.push(['sleep', 'Dormir']);
  if (s.mode === 'foot' && !s.inside && s.wanted && !s.hooded) chips.push(['hood', 'Capuche']);
  if (s.mode === 'foot' && s.weapons > 1) chips.push(['weapon', 'Objet']);
  return { primary, attack, car: s.mode === 'car', chips };
}
