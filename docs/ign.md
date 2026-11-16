# Tutoriel : récupérer les données IGN pour rendre Pontcharra plus réaliste

Aujourd'hui, la ville du jeu vient d'OpenStreetMap. Les contours des bâtiments sont justes, mais il manque presque tout le reste : sur 4 918 bâtiments, seuls 2 ont une hauteur et 88 un nombre d'étages. Le jeu devine donc la hauteur, le type de bâtiment et le nombre de logements.

La **BD TOPO de l'IGN** contient ces informations pour chaque bâtiment de France. Elle est gratuite, sous licence ouverte Etalab 2.0, qui autorise un usage personnel :

| Champ IGN | Ce que ça change dans le jeu |
|---|---|
| `hauteur` | vraie hauteur des façades (maisons, immeubles, hangars) |
| `nombre_d_etages` | bon nombre de rangées de fenêtres |
| `usage_1` | résidentiel, commerce, industriel, agricole, annexe, sportif, religieux : un hangar a un toit plat et personne n'y habite |
| `nombre_de_logements` | vrai nombre d'appartements par immeuble, donc des habitants répartis comme dans la réalité |
| bâtiments absents d'OSM | ajoutés à la carte (garages, maisons récentes, bâtiments agricoles) |

> Mon environnement de travail ne peut pas joindre les serveurs de l'IGN (accès réseau bloqué, vérifié). Il y a donc deux options : tu télécharges les fichiers (5 minutes, option A), ou tu autorises le site `data.geopf.fr` dans les réglages de l'environnement et je m'occupe de tout (option B).

---

## Option A : télécharger 4 fichiers depuis ton navigateur (PC conseillé, le téléphone marche aussi)

Le serveur public de l'IGN (la Géoplateforme) renvoie au maximum 5 000 bâtiments par demande. La carte du jeu est donc découpée en 4 carrés. Ouvre chaque lien ci-dessous. Chacun télécharge un fichier GeoJSON de quelques Mo : l'enregistrer peut prendre 10 à 30 secondes.

1. **Nord-Ouest**
   `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5000&BBOX=45.43529,5.99665,45.44809,6.02519,urn:ogc:def:crs:EPSG::4326`
2. **Nord-Est**
   `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5000&BBOX=45.43529,6.02519,45.44809,6.05372,urn:ogc:def:crs:EPSG::4326`
3. **Sud-Ouest**
   `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5000&BBOX=45.42249,5.99665,45.43529,6.02519,urn:ogc:def:crs:EPSG::4326`
4. **Sud-Est**
   `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5000&BBOX=45.42249,6.02519,45.43529,6.05372,urn:ogc:def:crs:EPSG::4326`

Renomme-les `ign-1.json`, `ign-2.json`, `ign-3.json` et `ign-4.json`. Le navigateur les appelle parfois `ows` ou `ows.json`.

**Vérification rapide :** chaque fichier doit commencer par `{"type":"FeatureCollection"`. Si un fichier contient un message d'erreur en XML (`ExceptionReport`), le serveur était peut-être surchargé : réessaie quelques minutes plus tard.

### Me les envoyer

Le plus simple est de passer par GitHub, depuis le PC ou le téléphone :

1. Va sur `https://github.com/cyrilboisset-glitch/Game/tree/ccr-c7453cd0-io0jbm/data`
2. Clique sur **Add file → Upload files**
3. Glisse les 4 fichiers (ou appuie sur *choose your files* sur téléphone)
4. En bas, laisse **Commit directly to the `ccr-c7453cd0-io0jbm` branch** coché, puis clique sur **Commit changes**
5. Écris-moi « les fichiers IGN sont sur GitHub ». Je m'occupe du reste.

### Si les liens ne marchent pas : passer par QGIS (PC)

1. Installe QGIS (gratuit, qgis.org)
2. Menu **Couche → Ajouter une couche → Ajouter une couche WFS**, puis **Nouveau** avec l'URL `https://data.geopf.fr/wfs/ows`
3. Connecte-toi, puis choisis la couche **BDTOPO_V3:batiment**
4. Zoome sur Pontcharra, puis clic droit sur la couche → **Exporter → Sauvegarder les entités sous**
5. Format **GeoJSON**, SCR **EPSG:4326**, *Emprise* = carte actuelle
6. Envoie le fichier comme ci-dessus. Un seul fichier suffit dans ce cas.

On peut aussi télécharger la BD TOPO complète de l'Isère (département 38, format GeoPackage) sur `cartes.gouv.fr`, rubrique Téléchargement. Mais le fichier fait plus d'1 Go et il faut ensuite le découper dans QGIS. Les liens ci-dessus sont bien plus simples.

---

## Option B : me laisser télécharger moi-même

Dans l'application Claude, ouvre le menu de l'environnement cloud dans la barre de titre de la session, puis **Edit**. Dans **Network access**, ajoute `data.geopf.fr` aux **Allowed domains** et laisse cochée la case *Allow package managers*. Écris-moi ensuite « c'est autorisé ». Je téléchargerai les 4 zones, puis je ferai l'import, les tests et la publication sans rien te demander d'autre. Instructions officielles : https://code.claude.com/docs/en/cloud-environments#network-access

---

## Ce que je fais ensuite

> ✅ Fait le 16 novembre 2026 : 4 565 bâtiments enrichis, 271 ajoutés, 3 237 logements.

```
python3 -I tools/import_ign.py data/ign-*.json
```

Le script :

- reconnaît tout seul la projection (WGS84 ou Lambert-93) et l'ordre des coordonnées
- supprime les doublons entre les 4 carrés (identifiant `cleabs`)
- associe chaque bâtiment OSM au bâtiment IGN qui le contient, puis copie sa hauteur, ses étages, son usage et son nombre de logements
- ajoute les bâtiments IGN absents d'OSM, sauf les constructions légères et ceux de moins de 12 m² (option `--sans-ajout` pour ne pas les ajouter)
- signale un fichier qui atteint la limite de 5 000 bâtiments, c'est-à-dire une zone incomplète

Côté jeu, c'est déjà branché :

- **façades** : la vraie hauteur et le vrai nombre d'étages sont utilisés en priorité
- **toits** : les bâtiments industriels, agricoles, commerciaux ou sportifs ont un toit plat, d'un seul niveau si l'IGN ne donne pas la hauteur
- **habitants** : on utilise le vrai nombre de logements par immeuble, et personne n'habite dans un hangar, un commerce ou un garage. Le total reste calé sur les 7 350 habitants de l'INSEE.

Je reconstruis ensuite le jeu, je relance les tests, je publie sur GitHub Pages et je t'envoie un nouveau fichier `Pontcharra.html`.

## Pour aller plus loin, plus tard

- **RGE ALTI / BD ALTI (relief)** : la pente vers le Bréda et les coteaux. Le jeu est plat pour l'instant, c'est un plus gros chantier.
- **BD TOPO `troncon_de_route`** : largeur réelle des chaussées et nombre de voies.
- **BD TOPO `zone_de_vegetation`** : haies, bois et vergers plus précis qu'OSM.

## Règles qui restent valables

Les données IGN ne servent qu'à la forme des bâtiments, à leur hauteur, leur usage et leur nombre de logements. Elles ne changent rien aux règles du jeu : les lieux de trafic restent fictifs et placés sur des emplacements neutres, aucun vrai immeuble ni aucune vraie résidence ne devient un lieu criminel, et la gendarmerie garde sa vraie position.

*Source des données : IGN – BD TOPO®, licence ouverte Etalab 2.0.*
