// Messages du milieu reçus sur le téléphone : tuyaux, demandes du receleur, alertes. Expéditeurs et lieux fictifs. Logique pure + génération déterministe par heure de jeu.
export type MsgKind = 'tuyau' | 'receleur' | 'alerte' | 'planque' | 'info';
export interface Msg { id: number; from: string; text: string; kind: MsgKind; day: number; hour: number; read: boolean; done?: boolean; data?: any; }
const FROM = { receleur: 'Le receleur', fredo: 'Fredo', fouine: 'La Fouine', inconnu: 'Numéro masqué' } as const;
const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Message éventuel pour une heure de jeu donnée (≈ un toutes les 3 h), selon la réputation et la recherche. */
export function messageFor(day: number, hour: number, rep: number, stars: number): Omit<Msg, 'id' | 'read'> | null {
  const r = rng(day * 97 + Math.floor(hour) * 13 + 5); if (r() > 0.33) return null; const h = Math.floor(hour), k = r();
  if (stars >= 2 && k < 0.5) return { from: FROM.fouine, kind: 'alerte', day, hour: h, text: 'Ça tourne beaucoup en bleu par chez toi. Fais-toi oublier quelques heures, change de fringues.' };
  if (k < 0.3) return { from: FROM.receleur, kind: 'receleur', day, hour: h, text: 'Ce soir je prends l\'électronique (télés, ordis, consoles) 20 % plus cher. Passe au box après 20 h.', data: { bonus: 0.2, until: { day, hour: 30 } } };
  if (k < 0.55) return { from: FROM.fredo, kind: 'tuyau', day, hour: h, text: rep >= 20 ? 'J\'ai un tuyau sur le fourgon de fonds. Gratuit pour toi, tu me prends comme chauffeur ?' : 'Un entrepôt de la zone, gardé par un seul type la nuit. Tuyau offert, je conduis si tu veux.', data: { target: rep >= 20 ? 'fourgon' : 'entrepot' } };
  if (k < 0.75) return { from: FROM.inconnu, kind: 'info', day, hour: h, text: 'Les gens rentrent tard le vendredi soir. Les maisons du quartier sont souvent vides entre 20 h et minuit.' };
  return { from: FROM.receleur, kind: 'planque', day, hour: h, text: 'Si t\'as besoin d\'un coin tranquille, le cabanon au bout de la zone est libre. Personne n\'y va.' };
}
export class Inbox {
  list: Msg[] = []; private next = 1; private lastKey = '';
  get unread() { return this.list.filter(m => !m.read).length; }
  /** Appelé régulièrement : ajoute le message de l'heure courante s'il y en a un. Retourne le nouveau message. */
  tick(day: number, hour: number, rep: number, stars: number) { const key = `${day}:${Math.floor(hour)}`; if (key === this.lastKey) return null; this.lastKey = key; const m = messageFor(day, hour, rep, stars); if (!m) return null; const msg: Msg = { ...m, id: this.next++, read: false }; this.list.unshift(msg); this.list = this.list.slice(0, 30); return msg; }
  save() { return { l: this.list, n: this.next }; }
  load(s: any) { if (!s) return; this.list = s.l ?? []; this.next = s.n ?? 1; }
}
