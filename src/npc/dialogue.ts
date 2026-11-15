import type { Npc } from './identity';
import type { NpcState } from './sim';

const BY_JOB: Record<string, string[]> = {
  boulanger: ['La fournée de ce matin est partie vite.', 'Levé à quatre heures, mais l\'odeur du pain, ça compense.'], vendeur: ['Les clients, ça va, ça vient.', 'Si vous cherchez quelque chose, demandez en magasin.'],
  serveur: ['Je finis tard ce soir, vous passerez ?', 'Le service du midi était complet.'], coiffeur: ['Il faut rafraîchir ça ! Passez au salon.', 'Les ciseaux, c\'est toute ma vie.'],
  pharmacien: ['Prenez soin de vous, hein.', 'L\'hiver, c\'est la saison des rhumes.'], banquier: ['Les taux ne sont pas terribles en ce moment.', 'Je ne parle pas d\'argent en dehors du bureau.'],
  enseignant: ['La rentrée est passée vite.', 'Les copies s\'empilent…'], agent_mairie: ['Pour tout papier, c\'est à la mairie.', 'La commune bouge, c\'est agréable.'], mecanicien: ['Une voiture, ça s\'entretient.', 'Quel bruit elle fait, la vôtre ?'],
  employe_bureau: ['Journée de réunions…', 'Vivement le week-end.'], ouvrier: ['Je fais la route tous les jours, c\'est long.', 'Le boulot est dur mais on tient.'], chauffeur: ['Toujours sur la route.', 'Les routes de la vallée, je les connais par cœur.'],
  retraite: ['De mon temps, tout ça était des champs.', 'Je prends l\'air, j\'ai tout mon temps.'], sans_emploi: ['Je cherche, je cherche…', 'Les temps sont durs.'], eleve: ['…', 'Je suis pressé(e), j\'ai cours.'],
};
/** Réplique courte selon le métier, l'heure et ce que fait la personne. */
export function line(n: Npc, s: NpcState, hour: number, pick: number): string {
  if (n.minor) return `${n.prenom} file sans s'arrêter.`;
  const hello = hour < 5 ? 'Il est bien tard…' : hour < 12 ? 'Bonjour.' : hour < 18 ? 'Bonne journée.' : hour < 22 ? 'Bonsoir.' : 'Il se fait tard.';
  const base = BY_JOB[n.metier] ?? ['…']; const l = base[pick % base.length];
  return `${n.prenom} : « ${hello} ${l} »`;
}
