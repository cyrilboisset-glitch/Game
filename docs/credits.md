# Crédits des assets
- `public/assets/citizen.glb` : avatar Ready Player Me (exemple three.js `readyplayer.me.glb`) — placeholder à remplacer ; licence à vérifier avant toute diffusion.
- `public/assets/anims.glb` : « Xbot » (exemple three.js, animations Mixamo idle/walk/run) — utilisé uniquement pour ses animations, recalées par `src/player/retarget.ts`.
- Données cartographiques : © contributeurs OpenStreetMap (ODbL).
- Toutes les textures sont générées procéduralement (src/world/textures.ts).
- Véhicules : modèles 100 % procéduraux (src/vehicles/models.ts), aucune licence externe.
- **Animations des personnages** : « Universal Animation Library » (version gratuite) de **Quaternius**, licence **CC0 1.0** (domaine public) — https://quaternius.com/packs/universalanimationlibrary.html (copie glTF : github.com/J-Ponzo/gltf-universal-animation-library). Réduite aux animations utilisées par `tools/build-anims.mjs`, recalée sur le personnage à l'exécution.
- **Effets sonores et ambiances** : « Oculus Audio Pack » de **Meta** (dépôt facebookincubator/Meta-open-sound), licence **CC0 1.0**. 78 sons retenus, convertis en mono 22 kHz et boucles d'ambiance raccourcies à 40 s avec fondu (dossier `public/assets/sfx`). Sirène deux tons, klaxon, tir, alarme, cloche et feu sont synthétisés (aucun enregistrement libre disponible ici).

## Données IGN (optionnel)

BD TOPO® de l'IGN, licence ouverte Etalab 2.0 : hauteurs, étages, usages et logements des bâtiments, importés avec `tools/import_ign.py` (voir `docs/ign.md`).

## Photo aérienne, cadastre et photos de rue

- **BD ORTHO® de l'IGN** (Géoplateforme, licence ouverte Etalab 2.0) : couleur de chaque toit et carte de couleur du sol (`tools/import_ortho.py`). La photo elle-même n'est pas incluse dans le jeu : seule une carte de couleur réduite (2,2 m par pixel, routes et toits effacés) l'est.
- **Plan cadastral Etalab** (licence ouverte 2.0) : tracé des limites de parcelles habitées, pour les haies, murets et grillages (`tools/import_cadastre.py`). Aucun identifiant de parcelle n'est conservé.
- **BD TOPO® « haie »** de l'IGN (Etalab 2.0) : haies champêtres.
- **Panoramax** (photos de rue libres ; instances IGN sous Etalab 2.0 et OpenStreetMap France sous CC-BY-SA 4.0, © contributeurs Panoramax) : couleur des façades, mesurée sur les panoramas 360° (`tools/import_panoramax.py`). Aucune photo n'est incluse dans le jeu : seule une couleur médiane par bâtiment l'est.
