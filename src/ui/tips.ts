// Premiers pas : quelques conseils affichés une seule fois au début de la première partie (tactile ou clavier).
import type { Hud } from './hud';
const TOUCH = ['Pose le pouce gauche n\'importe où à gauche : le joystick apparaît. Pousse-le à fond pour courir.', 'Glisse le doigt à droite de l\'écran pour regarder autour. La caméra se replace seule quand tu avances.',
  'Le gros bouton bleu fait l\'action du moment (entrer, voler, parler…). Les boutons jaunes n\'apparaissent que quand ils servent.', 'En voiture : le joystick tourne le volant, Gaz et Frein sous le pouce droit, « Descendre » en jaune.',
  '📱 en haut à droite : carte, messages, missions, sauvegardes. ☰ pour manger, dormir, plein écran…', 'Dans un bâtiment : ressors par la porte ou touche « Sortir ».'];
const KEYS = ['ZQSD pour marcher, Maj pour courir, souris (glisser) pour regarder.', 'E : action du moment (entrer, voler, parler…). F : frapper. C : s\'accroupir. Espace : sauter une clôture.', 'P : téléphone (carte, missions, sauvegardes). M : radio en voiture.', 'Dans un bâtiment : ressors par la porte ou avec Échap.'];
export function startTips(hud: Hud, touch: boolean) {
  try { if (localStorage.getItem('pontcharra-tuto') === '1') return; localStorage.setItem('pontcharra-tuto', '1'); } catch { /* stockage indisponible */ }
  (touch ? TOUCH : KEYS).forEach((t, i) => setTimeout(() => hud.toast(`💡 ${t}`, 7), 2500 + i * 9000));
}
