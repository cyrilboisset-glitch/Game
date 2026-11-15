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
4000 habitants par défaut en foyers de 1 à 5 personnes (paramètre `?npc=N`, 600 si besoin de légèreté) : identité, domicile (bâtiment réel hors commerce), métier, lieu de travail (POI réel ou hors commune), emploi du temps quotidien déterministe (src/npc/schedule.ts), trajets A* sur le graphe routier avec trottoirs (src/roads/graph.ts).
La simulation est une fonction pure du temps (src/npc/sim.ts) : les PNJ lointains ne coûtent rien. Rendu : silhouettes instanciées + avatars animés pour les plus proches.
Mode observation : toucher/cliquer un PNJ (ou touche O), fiche + journal en direct, vitesse ×1/×10/×60 (besoins du joueur figés pendant l'observation). E près d'un PNJ : lui parler.
Élèves (mineurs) : uniquement école/domicile/parc ; non ciblables, dialogue neutre.
Limites : un seul modèle de corps/visage (variations de vêtements et de cheveux), PNJ non visibles dans les intérieurs, voitures de PNJ simplifiées (boîtes), pas de collisions PNJ.
Diversité (src/npc/appearance.ts) : origines (noms, carnation 6 teintes, cheveux), enfants (taille et tête plus grosse), personnes âgées (voûtées, cheveux gris/chauves), corpulences de fine à très forte, femmes (cheveux longs/queue, jupes). Purement cosmétique. Limite : un seul visage/modèle de base.

## Véhicules (phase 5)
7 modèles procéduraux (src/vehicles/models.ts, aucune ressource externe) : vieille berline (départ), citadine, berline, break, utilitaire, berline et fourgon de gendarmerie. Caractéristiques distinctes (vitesse, accélération, freinage, direction, adhérence, masse, points de vie : src/vehicles/specs.ts).
~380 véhicules stationnés le long des rues ; E près d'un véhicule : le voler (recherche +, alarme possible) ; véhicule en circulation à l'arrêt : car-jacking (recherche +35). Le véhicule quitté reste sur place et t'appartient.
Circulation : voitures sur le graphe routier (sens uniques, limites de vitesse, distance de sécurité, un véhicule à la fois par carrefour), uniquement autour du joueur ; 2 patrouilles de gendarmerie (gyrophares). Voitures des PNJ avec les mêmes modèles.
Dégâts (chocs contre bâtiments et véhicules, fumée à partir de 45 % de dégâts, moteur en panne à 0), garage (G près d'un atelier/station : réparation puis amélioration du moteur jusqu'au niveau 3). Paramètres d'URL : `?trafic=N`, `?parked=N`.
Limites : pas de collision avec les piétons, pas de feux tricolores, circulation encore lente dans les carrefours, modèles stylisés (pas photoréalistes).

## Effets de conduite et gendarmerie (phase 6)
Effets : traces de pneus au sol et fumée de pneus (frein à main, gros freinage, dérapage), étincelles et secousse de caméra aux chocs, faisceaux de phares la nuit, feux de stop plus vifs, champ de vision dynamique avec la vitesse, liseré rouge/bleu clignotant quand on est recherché.
Gendarmerie (src/police/) : un délit n'est compté qu'en proportion de ce qui est vu (gendarmerie à portée 100 %, témoin 60 %, personne 25 %). De 1 à 5 étoiles : 1, 2, 4, 6, 8 unités à la poursuite (itinéraire A* puis poursuite directe de près, fourgons à partir de 4 étoiles), barrages à partir de 3 étoiles (1, 2, 3), les patrouilles de la circulation rejoignent la poursuite. Excès de vitesse devant une patrouille, percussion d'un véhicule de gendarmerie = délit.
Arrestation : rester presque immobile à moins de 7 m d'une unité pendant 2,5 s → amende (100 € + 80 € par étoile, au plus tout l'argent), marchandise (inventaire) saisie, retour devant la gendarmerie, 3 h perdues. Pas de mort. Fuite : la recherche ne baisse qu'après 20 s sans être vu.
Limites : pas de gendarmes à pied ni d'hélicoptère, pas de sirènes sonores (audio en phase 8), les unités ne gèrent pas les poursuites hors route.

## Missions et argent (phase 7)
Journal de missions (J) : offres du jour déterministes (jour + graine). Types : livraison entre commerces, coursier entre entreprises, course chronométrée en voiture (3 points), taxi (un habitant à pied près de toi, tu l'emmènes à sa destination), colis « discret » (lieux **fictifs** et neutres : bouts de voie sans bâtiment à moins de 35 m et à plus de 250 m de toute école ; marchandise générique ; la prime est divisée par deux si tu as 2 étoiles ou plus). Balise lumineuse + repère sur la minimap + suivi du délai à l'écran.
Réputation 0-100 : majore la paie jusqu'à +50 %. Arrestation = mission échouée (marchandise saisie).
Concession (POI de type « car ») : B acheter, N changer de modèle ; le véhicule acheté t'attend devant. Garage (G) : réparer puis améliorer le moteur.
Limites : pas de location de logement, le taxi ne gère qu'un passager adulte à pied, offres générées au début de chaque jour de jeu.

## Audio, qualité et optimisation (phase 8)
Audio 100 % procédural (WebAudio, aucun fichier) : moteur à 5 rapports, roulement, dérapage, klaxon (H), sirène deux tons selon la distance des unités, ambiance (vent, oiseaux le jour, grillons la nuit), pas, chocs, portes, vitres, alarmes, jingles de mission/arrestation. Le son démarre au premier geste (règle des navigateurs). M : couper le son.
Réglages (⚙ ou F2) : qualité Auto/Bas/Moyen/Élevé, volume. Mode Auto : baisse si < 24 FPS pendant 3 s, remonte si > 54 FPS pendant 10 s et stable depuis 25 s (src/core/quality.ts). Les niveaux règlent résolution, ombres (portée limitée aux chunks proches), distance d'affichage, silhouettes/avatars, véhicules, circulation.
Mesures (tools/perf.cjs, Chromium headless, 412×915, rendu logiciel — les FPS ne sont pas représentatifs d'un téléphone) : bas 90 appels / 122 k triangles, moyen 102 / 196 k, élevé 116 / 427 k (budget visé : ≤ 150 appels, ≤ 1,5 M triangles).
Limites : aucun test sur un vrai téléphone (Xiaomi 14T) ; le son n'a pas pu être écouté dans l'environnement de développement (logique testée, rendu sonore non évalué) ; un seul modèle de corps pour les habitants ; véhicules et bâtiments stylisés.

## Contrôles (résumé)
ZQSD/flèches : bouger · Maj : courir · Espace : frein à main · H : klaxon · E : monter/descendre/entrer/parler · 1 manger · 2 boire · R : dormir · X : besoin · L : phares · G : garage · B/N : concession · J : missions · O ou toucher : observer un habitant · M : son · F2 : réglages. Mobile : joystick + boutons, glisser pour regarder.

## Graphisme (passe 2)
Horizon : massifs stylisés placés selon leurs directions réelles depuis Pontcharra (Belledonne à l'est/sud-est avec neige en altitude, Chartreuse et la falaise du Granier à l'ouest, Bauges au nord, vallée ouverte au NE et au SO), voile atmosphérique, nuages procéduraux animés.
Post-traitement (src/core/post.ts) : rendu MSAA en demi-flottant, occlusion ambiante GTAO (niveau élevé), bloom (lumières de nuit, soleil couchant), étalonnage (contraste, ombres froides, vignettage, grain), sortie ACES. Niveau bas : rendu direct sans post-traitement.
Sol : texture à deux échelles + variations de teinte (herbe grasse/sèche/sombre). Carte d'occupation au sol 2 m (src/world/mask.ts) pour placer jardins (arbustes, arbres, conifères), clôtures de propriété (haies taillées, murets + grilles), touffes d'herbe animées autour de la caméra, sans empiéter sur routes et bâtiments.
Arbres refaits (branches + cartes de feuillage, conifères), façades : soubassement en pierre, corniches, balcons sur les immeubles, cheminées, stores colorés sur les commerces, ~18 % de façades en brique. Passages piétons aux carrefours des grands axes, trottoirs continus devant les entrées de garage, bancs, poubelles, panneaux stop/cédez-le-passage, eau à vaguelettes animées.
Mesures (tools/perf.cjs, 412×915, toutes passes comprises : ombres + post-traitement) : bas 110 appels / 191 k triangles, moyen 193 / 469 k, élevé 449 / 1,88 M. Le niveau élevé dépasse le budget mobile et vise le PC ; « moyen » dépasse légèrement 150 appels à cause des passes d'ombre et de bloom.

## Installer sur le téléphone (hors ligne)
Le jeu est publié automatiquement sur GitHub Pages à chaque push sur la branche par défaut (.github/workflows/deploy.yml).
1. Une seule fois : sur GitHub, Settings → Pages → Build and deployment → Source : **GitHub Actions**.
2. Sur le téléphone, ouvrir https://cyrilboisset-glitch.github.io/Game/ dans Chrome, attendre le message « Jeu enregistré sur l'appareil ».
3. Menu ⋮ → « Ajouter à l'écran d'accueil » / « Installer l'application ». Le jeu se lance ensuite en plein écran, sans internet.
Hors ligne : service worker généré par tools/gen-sw.mjs (met en cache tous les fichiers du build, ~6,4 Mo). Pour une mise à jour, rouvrir le jeu avec internet.

## Collisions
Piéton : bâtiments, véhicules (garés, circulation, gendarmerie, voitures des habitants, la sienne), arbres, lampadaires, bancs, poubelles, panneaux, haies, murets, habitants. Renversé (santé −8 à −48, au sol 2,5 s, pas de mort) si un véhicule le touche à plus de 15 km/h.
Circulation : les voitures freinent et s'arrêtent devant le joueur à pied et devant les habitants sur la chaussée (on peut ainsi arrêter une voiture puis la voler avec E).
Voiture du joueur : bâtiments, mobilier et arbres (dégâts), véhicules, voitures des habitants, habitants (adulte renversé = délit ; un mineur n'est jamais touché, la voiture s'arrête net).
Scénario de vérification : `node tools/collisions.cjs <dossier>`. Limite : les voitures simulées des habitants ne s'évitent pas entre elles.
