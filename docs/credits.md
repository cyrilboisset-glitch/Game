# Crédits des assets
- `public/assets/citizen.glb` : avatar Ready Player Me (exemple three.js `readyplayer.me.glb`) — placeholder à remplacer ; licence à vérifier avant toute diffusion.
- `public/assets/anims.glb` : « Xbot » (exemple three.js, animations Mixamo idle/walk/run) — utilisé uniquement pour ses animations, recalées par `src/player/retarget.ts`.
- Données cartographiques : © contributeurs OpenStreetMap (ODbL).
- Toutes les textures sont générées procéduralement (src/world/textures.ts).
- Véhicules : modèles 100 % procéduraux (src/vehicles/models.ts), aucune licence externe.
- **Animations des personnages** : « Universal Animation Library » (version gratuite) de **Quaternius**, licence **CC0 1.0** (domaine public) — https://quaternius.com/packs/universalanimationlibrary.html (copie glTF : github.com/J-Ponzo/gltf-universal-animation-library). Réduite aux animations utilisées par `tools/build-anims.mjs`, recalée sur le personnage à l'exécution.
