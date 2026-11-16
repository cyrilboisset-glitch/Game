# Pontcharra — jeu 3D en monde ouvert (prototype phase 1)
Lancement : `npm i && npm run dev` — build statique : `npm run build` (dossier `dist/`).
Régénérer les données : `python3 -I tools/convert_osm.py data/map.osm public/data/pontcharra.json`.
Captures : `CHROME_BIN=... node tools/shot.cjs <url> <sortie.png> <largeur> <hauteur>`.
Paramètres d'URL : `?t=22` (heure), `?s=6` (point de départ sur l'avenue de la Gare), `?aerial` (vue aérienne).
Limites connues : pas de collisions, pas de trafic/PNJ, 400-700 draw calls (au-dessus du budget de 150), FPS non mesurés sur mobile.

## Noyau de survie (phase 2)
Contrôles PC : ZQSD marcher · Maj courir · E monter/descendre/acheter/briser la vitrine · F voler · 1 manger · 2 boire · R dormir · X se soulager · L phares · glisser souris : regarder.
Mobile : joystick gauche pour bouger, second joystick (moitié droite, sous le pouce) pour orienter la caméra, boutons à droite.
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
ZQSD/flèches : bouger · Maj : courir · 3 : trousse de soins · N/B : menus (receleur, planque) · C : s’accroupir · F : frapper · T : changer d’objet · V : capuche · Espace : frein à main · H : klaxon · E : monter/descendre/entrer/parler · 1 manger · 2 boire · R : dormir · X : besoin · L : phares · G : garage · B/N : concession · J : missions · O ou toucher : observer un habitant · M : son · F2 : réglages. Mobile : joystick gauche + joystick caméra + boutons.

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

## Vague 1 : témoins, discrétion, bagarre
- **Témoins** : chaque délit (coup, vol, effraction, alarme) est vu (ligne de vue, portée 35 m de jour, 18 m de nuit) ou entendu (rayon selon le bruit) par les habitants adultes proches. Ils n'appellent pas tout de suite : signalement après un délai, icône 📞 au-dessus de ceux qui appellent. Un témoin assommé avant son appel n'appelle pas. Gendarmerie à moins de 80 m : recherche immédiate.
- **Signalement** : les appels décrivent la tenue (« sweat bleu »), le visage et le véhicule. Plus le signalement est précis, plus les patrouilles vous reconnaissent de loin. Changer de tenue (vol ou achat en boutique de vêtements, garde-robe des logements) et relever la capuche le rendent caduc.
- **Discrétion** : C pour s'accroupir (plus lent, vu de moins loin) ; accroupi contre une haie, un muret, un arbre ou une voiture garée = caché.
- **Bagarre** : F pour frapper. La personne s'enfuit, se défend (environ 4 sur 10, si elle est en forme) ou tombe. Un objet contondant dans le dos d'une personne qui ne se méfie pas l'assomme net (≈ 20 s). Objets trouvés en fouillant : bouteille, clé à molette, barre, batte (T pour changer).
- **Limites** : jamais de mineur visé, ni témoin, ni dans une bagarre ; pas d'animation de coup (élan du corps seulement) ; pas d'arme à feu ; quand un habitant se relève ou cesse de fuir, il reprend son emploi du temps à sa position prévue.
- Scénario de vérification : `node tools/wave1.cjs <dossier>` (serveur de dev sur le port 5199).

## Vague 2 : cambriolages, butin, receleur, planques, armes
- **Repérage** : devant un logement, la porte indique la famille et ce qu'on voit de la rue (lumière allumée ou non la nuit). Accroupi 2 s contre la porte : on écoute (personne, quelqu'un dort, adultes réveillés, voix d'enfants) et on apprend quand la maison sera vide (« vide de 9 h 00 à 16 h 00 »), d'après l'emploi du temps réel des habitants du foyer.
- **Crochetage** : avec un crochet (atelier, cache, receleur), E sur une porte verrouillée = 4,5 s sans bouger, presque sans bruit, alarme rare. Sans crochet, on force la porte (bruyant).
- **Habitants à la maison (home-jacking)** : s'ils dorment, on peut prendre clés et portefeuille sur la table de nuit (risque de réveil). Réveillés, ils appellent la gendarmerie en quelques secondes : on peut menacer avec un objet ou une arme (argent + clés), ou assommer. Les clés donnent la voiture du foyer, garée devant. Une fois sorti, la personne appelle et vous décrit. **Jamais d'intrusion quand des enfants sont à la maison** : le personnage renonce.
- **Butin** : bijoux, montres, téléphones, tablettes, ordinateurs, consoles, télévision (14 kg), outillage… Sac à dos limité à 20 kg, ralentissement au-delà de 6 kg, plus de course au-delà de 12 kg. En montant dans sa voiture, le sac va dans le coffre (220 kg) ; chaque voiture garde son coffre.
- **Receleur** (lieu fictif : un box de garage sur un emplacement neutre, néon violet sur la carte) : ouvert de 20 h à 6 h, rachète environ un tiers de la valeur (moins si vous êtes recherché, refuse au-delà de 2 étoiles), vend crochet, trousses, balles, pistolet. N : option suivante, B ou E : valider.
- **Planques** (lieux fictifs) : garage loué 150 € ou cabanon abandonné. On y cache le butin (épargné en cas d'arrestation), on y dort sans être dérangé, on s'y soigne, et la recherche y retombe trois fois plus vite.
- **Caches** : 22 sacs planqués le long des chemins (haies, fossés, derrière un coffret électrique…), jamais près d'une école : argent, trousses, balles, crochets, objets contondants, deux pistolets.
- **Pistolet** : F tire dans un cône étroit avec ligne de vue. La personne touchée s'effondre et est évacuée par les secours (pas de sang). Le coup de feu s'entend de loin et fait fuir les passants. **On ne tire jamais si un enfant est dans la ligne de mire**, et aucune violence n'est possible à moins de 70 m d'une école.
- **Blessures** : au-delà de 10 points de dégâts, on peut saigner (la santé baisse) ; 3 = trousse de soins, pharmacie, ou repos en planque. À 3 étoiles, si vous avez le pistolet en main, la gendarmerie tire ; à bout de forces, vous êtes interpellé (soigné, amende, butin porté et coffre saisis). Pas de mort du joueur.
- **Limites** : pas d'animation de tir ni de visée à l'épaule (le personnage tire droit devant lui) ; la télévision emportée disparaît du meuble mais pas d'objet porté visible ; un seul habitant est représenté dans le logement même si plusieurs sont présents ; les habitants cambriolés pendant leur sommeil ne portent pas plainte après coup.
- Scénario de vérification : `node tools/wave2.cjs <dossier>`.

## Vague 3 : incendies, braquages, enlèvement, enquête, prison
- **Incendie** (G) : avec le briquet, on met le feu à une voiture (ou à la sienne pour effacer les traces) ; avec de l'essence (station-service 15 €, receleur), à un bâtiment. Le feu monte en puissance, se propage aux voitures et bâtiments voisins, éclaire la rue, dégage de la fumée et brûle si on s'approche. Les habitants évacuent toujours sains et saufs. Les pompiers arrivent au bout d'une quarantaine de secondes et éteignent à la lance ; si on les attaque ou qu'on tire près d'eux, ils se replient et le feu gagne. **Jamais d'incendie d'école, ni d'une maison où des enfants sont présents.**
- **Braquages préparés** : le receleur vend un tuyau sur une cible **fictive** (entrepôt de la zone, la nuit ; fourgon de transport de fonds, le matin). Il faut repérer les lieux, avoir une arme (le pistolet pour le fourgon), et recruter des complices inventés : Fredo (chauffeur, sème la première patrouille), La Fouine (guetteur, retarde l'alarme), Le Taiseux (gros bras, maîtrise les gardes, obligatoire pour le fourgon). Cagoule et gants limitent les traces. Les sacs de billets (4 kg) se comptent à la planque, après le partage avec les complices.
- **Hold-up** : dans un commerce ouvert, une arme en main, F à la caisse (ou au guichet d'une banque) ; alarme silencieuse, gendarmerie et enquête.
- **Enlèvement** (volontairement abstrait) : un adulte seul, une arme, sa voiture tout près : la personne monte à l'arrière. À la planque, B pour envoyer la demande de rançon ; deux heures plus tard, le sac est déposé sur un lieu fictif (parfois un piège si l'enquête est avancée). L'otage est toujours relâché sain et sauf, au plus tard trois heures après la remise. **Jamais un mineur.**
- **Enquête différée** (I pour consulter) : chaque crime grave ouvre un dossier. Les preuves montent tant que le véhicule utilisé circule (le brûler efface la piste) et que la tenue décrite n'a pas changé ; à l'échéance (un à deux jours), dossier classé ou **mandat d'arrêt**.
- **Prison** : arrêté avec un mandat, des dossiers solides ou en flagrant délit grave, on passe des jours à la maison d'arrêt (hors de la commune) : le temps avance, armes et butin saisis, amende, planque parfois perquisitionnée. Sinon, simple amende.
- **Limites** : les complices ne sont pas représentés à l'écran ; les bâtiments incendiés ne noircissent pas une fois éteints ; le fourgon est un utilitaire gris à l'arrêt ; l'otage n'est pas visible pendant le trajet.
- Scénario de vérification : `node tools/wave3.cjs <dossier>`.

## Vague 4 : animations d'action, visages, corpulences, population réelle
- **Population** : 7 350 habitants, la population municipale de Pontcharra (INSEE, 2023), soit 3 063 foyers. Les maisons accueillent un foyer, les petits collectifs un logement pour 90 m² au sol, les grands immeubles du centre trois niveaux de logements de 75 m². Résultat : 263 immeubles habités par plusieurs foyers. Devant un immeuble, N choisit l'appartement visé ; le repérage, le crochetage et le cambriolage portent sur cet appartement, avec un intérieur plus petit qu'une maison.
- **Animations d'action** : des poses superposées aux animations de marche et de course, en orientant les os vers des directions voulues.
  - Joueur : coup de poing, armer puis abattre un objet, bras tendus pour tirer, accroupi (bassin abaissé, genoux pliés), crochetage à genoux mains sur la serrure, butin lourd porté devant soi.
  - Habitants : témoin qui téléphone, garde levée en bagarre, bras protégeant la tête en fuite, mains en l'air devant un pistolet braqué (puis fuite), occupant qui lève les mains, pompiers à la lance.
- **Visages** : 16 variantes de visage obtenues en déformant le maillage de la tête (largeur, mâchoire, menton, nez, pommettes, arcade, longueur, lèvres). S'y ajoutent des moustaches (un tiers des hommes adultes), des lunettes (près de la moitié des plus de 50 ans) et des cheveux à texture de mèches, avec la calotte inclinée vers l'arrière.
- **Corpulences** : ventre, poitrine, cuisses et bras réglés os par os, chaque os enfant compensant l'échelle de son parent. Les personnes fortes ont du ventre vers l'avant et des cuisses plus larges, au lieu d'être simplement étirées en largeur.
- **Performances** : le calcul des états des 7 350 habitants est réparti sur les images (tous recalculés en 0,3 s), au lieu d'un bloc d'environ 13 ms toutes les 0,3 s.
- **Limites** :
  - Les poses sont procédurales et figées : un vrai coup de poing animé image par image demanderait des fichiers d'animation supplémentaires.
  - Une seule base de modèle, et la barbe est la moustache du modèle d'origine.
  - Les cheveux restent des volumes simples.
  - Les habitants ne s'assoient pas.
- Scénario de vérification : `node tools/wave4.cjs <dossier>` ; labos `tools/lab/poses.html` et `tools/lab/faces.html`.

## Commandes tactiles (refonte)
- Joystick à gauche ; à droite, quatre gros boutons ronds sous le pouce :
  - **A** (bleu) : l'action du moment, avec son nom (Voler, Entrer, Crocheter, Parler, Monter, Descendre, Fouiller, Valider, Réveil…), grisé quand il n'y a rien à faire ;
  - **B** (rouge) : Frapper, Tirer (pistolet chargé), Braquer, Assommer ; caché en voiture ;
  - **C** : Courir (à pied) / Frein (en voiture) ;
  - **D** : Accroupi (à pied) / Klaxon (en voiture).
- Une rangée de **boutons contextuels** n'apparaît que lorsqu'ils servent : Feu, Suivant, Valider/Acheter, Garage, Phares (de nuit), Manger ou Boire (faim ou soif), Soin (blessé, avec une trousse), Besoin, Dormir, Capuche (si vous êtes recherché), Objet (si vous avez plusieurs armes).
- Le **menu ☰** regroupe le reste : manger, boire, soin, dormir, besoin, capuche, objet, feu, missions, dossiers, phares, klaxon.
- Vibration légère à chaque appui ; en paysage, le pavé est réduit.
- Captures de contrôle : `node tools/touch.cjs <dossier>`.

## Animations et chocs
- **Personnages** :
  - quand ils sont renversés par une voiture, les habitants sont projetés et tombent en un demi-seconde ; assommés, ils s'écroulent de la même façon ;
  - ils se relèvent (0,7 s) avant de s'enfuir, ont un sursaut de recul quand on les frappe et arment leurs coups en bagarre ;
  - ton personnage est visible au volant, assis, les mains sur le volant, et suit le roulis de la voiture.
- **Voiture du joueur** :
  - la tôle s'enfonce à l'endroit exact du choc (avant, arrière, flanc), plus fort à hauteur de pare-chocs ;
  - le pare-brise se fissure au-delà d'un gros choc, et le phare du côté touché se casse et n'éclaire plus ;
  - des étincelles jaillissent au point de contact, et en continu quand on frotte un mur au-dessus de 20 km/h ;
  - tout est réparé au garage.
- **Voitures du trafic et garées** : une fois percutées, elles apparaissent cabossées du côté touché (avant, arrière ou flanc).
- **Caméra en voiture** : glisser le doigt (ou la souris) fait tourner la caméra autour du véhicule ; elle revient derrière quand on roule.
- Vérification : `node tools/crash.cjs <dossier>` et le labo `tools/lab/crash.html`.

## Animations enregistrées, voitures vivantes, téléphone, progression, ambiance, mémoire du voisinage
- **Animations** : bibliothèque d'animations universelle de Quaternius (CC0), réduite à 29 animations et recalée sur nos personnages.
  - Joueur : enchaînement direct, crochet puis coup de pied ; coup de batte ; pistolet (repos, visée, tir) ; accroupi au repos et en marche ; à genoux pour crocheter ; coups reçus ; chute et relevé ; sprint.
  - Espace (ou bouton « Sauter ») pour sauter une haie ou escalader un muret ; E pour s'asseoir sur un banc ; ouverture de la portière avant de monter ; conduite mains sur le volant.
  - Habitants : chute tenue au sol, relevé, coups et impacts, course.
  - La version gratuite de la bibliothèque n'a pas de coup de pied : il est fait par une pose calculée.
- **Voitures** :
  - accidents : tonneaux (la voiture retombe sur les roues ou finit sur le toit), capot et portière arrachés qui volent puis retombent, éclats de vitres ;
  - conducteurs : ils klaxonnent et protestent quand on les percute, relèvent la plaque et appellent la gendarmerie après un choc franc, et klaxonnent quand on les bloque ;
  - radio inventée générée en direct (4 stations, M ou bouton « Radio »).
- **Téléphone** (📱 ou P, jeu en pause) :
  - carte plein écran déplaçable et zoomable avec tous les repères ; toucher la carte pose un repère suivi par la balise ;
  - messages du milieu : tuyaux, bonus du receleur, alertes, coin tranquille ;
  - onglet « Moi » (réputation, compétences, planques, bilan), dossiers d'enquête, contacts, accès aux missions, 3 emplacements de sauvegarde.
- **Progression** :
  - réputation de 0 à 100, avec des rangs de « Inconnu » à « Caïd de la vallée » ;
  - compétences sur 5 niveaux : crochetage, conduite, discrétion, endurance ;
  - planques équipables : lit, coffre-fort, garage fermé ;
  - **grand coup** final : salle des coffres d'une société fictive, réputation 50, toute l'équipe, crochetage niveau 3.
- **Ambiance** :
  - saisons de 7 jours (feuillage, herbe, neige l'hiver) et météo par tranches de 6 h ;
  - routes mouillées et brillantes avec moins d'adhérence ; brouillard du matin dans la vallée ;
  - la pluie et le brouillard gênent les témoins ;
  - sons : pluie, rumeur de la circulation, chiens, cloches de l'église de 8 h à 21 h, voix des passants bousculés.
- **Mémoire du voisinage** :
  - une maison cambriolée fait poser une alarme dès le lendemain (indiquée à la porte) ;
  - un commerçant braqué reconnaît votre visage pendant 10 jours (capuche ou cagoule pour l'éviter) : il refuse de vous servir et appelle ;
  - les quartiers où vous frappez deviennent méfiants : témoins plus attentifs, patrouilles plus nombreuses et plus vigilantes. La méfiance retombe de moitié chaque jour.
- Vérifications : `tools/anims-game.cjs`, `tools/cars-alive.cjs`, `tools/weather.cjs`, labos `tools/lab/anims.html` et `tools/lab/crash.html`.

## Fichier unique (à envoyer ou copier)
`npm run single` fabrique `release/Pontcharra.html` (≈ 8 Mo) : le jeu complet dans un seul fichier (code, carte, données, personnages, animations), qui s'ouvre directement dans Chrome (double-clic, pièce jointe, clé USB), sans serveur ni connexion. La sauvegarde reste dans le navigateur qui l'a ouvert.

## Sons et jouabilité sur téléphone (refonte)
- **Bande son entièrement refaite avec de vrais enregistrements** (Meta, CC0) :
  - pas sur béton, herbe ou parquet, en marchant ou en courant ;
  - coups de poing et de pied, souffles des ratés, cris et voix de douleur ;
  - portes, portières, démarrage, moteur enregistré qui monte dans les tours ;
  - ambiance de ville le jour, nature et oiseaux, nuit, pluie, intérieur feutré ; chiens, verre brisé, tôle, crochetage, fouille, chasse d'eau, notifications ;
  - le tout passe dans un compresseur (pas de saturation), avec une réverbération de rue.
- **Bâtiments** : on ressort en franchissant la porte, ou avec le bouton jaune « Sortir » (Échap au clavier), affiché en permanence à l'intérieur.
- **Plein écran** : la barre d'adresse disparaît dès le premier appui (et revient au suivant si on en sort) ; bouton « Plein écran » dans ☰.
- **Commandes** :
  - joystick flottant, qui apparaît sous le pouce gauche ; course en le poussant à fond ;
  - caméra qui se replace derrière le personnage quand il avance ;
  - aide à la visée pour les coups et le tir ;
  - zones d'interaction plus larges ;
  - en voiture : Gaz, Frein/arrière, Frein à main et Klaxon sous le pouce droit, le joystick servant de volant, « Descendre » en jaune.
- Conseils de prise en main au premier lancement. Test : `node tools/mobile.cjs`.

## Données IGN (plus réaliste)

Tutoriel : [docs/ign.md](docs/ign.md). Fichiers BD TOPO dans `data/ign-*.json`, import : `git checkout public/data/pontcharra.json && python3 -I tools/import_ign.py data/ign-*.json` (repartir du fichier OSM d'origine avant de relancer).

Résultat actuel : 4 565 bâtiments enrichis (vraie hauteur, étages, usage, toit plat ou en pente avec sa hauteur réelle, murs en pierre, meulière, béton, brique ou bois, toits en tuiles, ardoise ou zinc), 271 bâtiments ajoutés, 3 237 logements réels qui répartissent les 7 350 habitants.
