# Pontcharra — jeu 3D en monde ouvert (prototype phase 1)
Lancement : `npm i && npm run dev` — build statique : `npm run build` (dossier `dist/`).
Régénérer les données : `python3 -I tools/convert_osm.py data/map.osm public/data/pontcharra.json`.
Captures : `CHROME_BIN=... node tools/shot.cjs <url> <sortie.png> <largeur> <hauteur>`.
Paramètres d'URL : `?t=22` (heure), `?s=6` (point de départ sur l'avenue de la Gare), `?aerial` (vue aérienne).
Limites connues : pas de collisions, pas de trafic/PNJ, 400-700 draw calls (au-dessus du budget de 150), FPS non mesurés sur mobile.
