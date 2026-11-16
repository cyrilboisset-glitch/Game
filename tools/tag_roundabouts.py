"""Marque les routes qui forment un rond-point (OSM junction=roundabout) : « j »: 1 dans public/data/pontcharra.json.
Usage : python3 -I tools/tag_roundabouts.py data/map.osm
Les routes du jeu gardent la géométrie OSM : on les retrouve par leurs premier et dernier points projetés."""
import sys, json, math
import xml.etree.ElementTree as ET
LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
def proj(lat, lon): return (round((lon - LON0) * KX, 1), round(-(lat - LAT0) * 110540, 1))

def main(src):
    nodes, rings = {}, []
    for _, el in ET.iterparse(src, events=("end",)):
        if el.tag == "node": nodes[el.get("id")] = proj(float(el.get("lat")), float(el.get("lon")))
        elif el.tag == "way":
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if tags.get("junction") in ("roundabout", "circular") and "highway" in tags: rings.append([n.get("ref") for n in el.findall("nd")])
        if el.tag in ("node", "way", "relation"): el.clear()
    keys = set()
    for ref in rings:
        p = [nodes[r] for r in ref if r in nodes]
        if len(p) >= 2: keys.add((tuple(p[0]), tuple(p[-1]), len(p)))
    path = "public/data/pontcharra.json"; w = json.load(open(path, encoding="utf-8")); n = 0
    for r in w["roads"]:
        r.pop("j", None)
        if (tuple(r["p"][0]), tuple(r["p"][-1]), len(r["p"])) in keys: r["j"] = 1; n += 1
    json.dump(w, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Ronds-points : {len(rings)} voies OSM, {n} routes marquées")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/map.osm")
