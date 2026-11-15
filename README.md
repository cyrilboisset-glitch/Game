# Pontcharra — jeu 3D en monde ouvert (prototype phase 1)
Lancement : `npm i && npm run dev` — build statique : `npm run build` (dossier `dist/`).
Régénérer les données : `python3 -I tools/convert_osm.py data/map.osm public/data/pontcharra.json`.
Captures : `CHROME_BIN=... node tools/shot.cjs <url> <sortie.png> <largeur> <hauteur>`.
Paramètres d'URL : `?t=22` (heure), `?s=6` (point de départ sur l'avenue de la Gare), `?aerial` (vue aérienne).
Limites connues : pas de collisions, pas de trafic/PNJ, 400-700 draw calls (au-dessus du budget de 150), FPS non mesurés sur mobile.

## Noyau de survie (phase 2)
Contrôles PC : ZQSD marcher · Maj courir · E monter/descendre/acheter/briser la vitrine · F voler · 1 manger · 2 boire · R dormir · X se soulager · L phares · glisser souris : regarder.
Mobile : joystick gauche, boutons à droite, glisser sur la moitié droite pour regarder.
Besoins : faim, soif, énergie, vessie, santé (src/survival/needs.ts). « Recherche » : src/survival/heat.ts. Horloge : 20 min réelles = 24 h.
Tests : `npm test` (logique pure) · `node tools/play.cjs <dossier>` (scénario Playwright, nécessite `npm run dev` et CHROME_BIN).
Hypothèses : horaires par défaut des commerces quand opening_hours est absent (src/world/poi.ts) ; le jour 1 est un mercredi.

## Intérieurs (phase 3)
Tous les bâtiments sont accessibles : E près d'un mur → entrer (ouvert), ou forcer la porte (fermé/verrouillé : recherche +, alarme possible). Les écoles ne sont jamais cambriolées (fermées hors horaires, aucune interaction criminelle).
Intérieur généré à la demande par type de lieu (src/interiors/generator.ts, déterministe par graine) ; ce n'est PAS une reproduction du lieu réel, et le jeu l'annonce.
Interactions : acheter, prendre, manger, boire, fouiller, dormir, toilettes, robinet, coffre. Tests : `npm test`, scénario : `node tools/interiors.cjs <dossier>`.
Limites : un seul niveau par bâtiment, meubles en volumes simples, pas d'occupants (PNJ) pour l'instant.

## Habitants (phase 4)
~600 habitants (paramètre `?npc=N`) : identité, domicile (bâtiment réel hors commerce), métier, lieu de travail (POI réel ou hors commune), emploi du temps quotidien déterministe (src/npc/schedule.ts), trajets A* sur le graphe routier avec trottoirs (src/roads/graph.ts).
La simulation est une fonction pure du temps (src/npc/sim.ts) : les PNJ lointains ne coûtent rien. Rendu : silhouettes instanciées + avatars animés pour les plus proches.
Mode observation : toucher/cliquer un PNJ (ou touche O), fiche + journal en direct, vitesse ×1/×10/×60 (besoins du joueur figés pendant l'observation). E près d'un PNJ : lui parler.
Élèves (mineurs) : uniquement école/domicile/parc ; non ciblables, dialogue neutre.
Limites : un seul modèle de corps/visage (variations de vêtements et de cheveux), PNJ non visibles dans les intérieurs, voitures de PNJ simplifiées (boîtes), pas de collisions PNJ.
