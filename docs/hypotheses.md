# Hypothèses et valeurs par défaut

- **Horaires des commerces** : `opening_hours` OSM quand présent, sinon horaires par défaut par type (src/world/poi.ts).
- **Calendrier** : le jour 1 du jeu est un mercredi.
- **Adresses des habitants** : adresse OSM la plus proche (≤ 90 m) ; sinon nom de la rue la plus proche avec un **numéro inventé** (déterministe). Aucune adresse n'est celle d'une personne réelle : les habitants sont fictifs.
- **Habitants** : population fictive générée par graine ; les noms, origines et morphologies sont purement cosmétiques et sans effet sur le comportement. Les proportions d'origines sont une approximation et non une donnée statistique.
- **Intérieurs** : générés procéduralement par type de lieu ; ils ne reproduisent pas les lieux réels.
- **Lieux de crime** : les intérieurs de commerces réels peuvent être cambriolés par le joueur ; les écoles, jamais.
- **Foyers** : 1 logement pour ~2,4 habitants ; familles de composition aléatoire (non vérifiée démographiquement).
