"""Extrait les POI nommés et les adresses de data/map.osm.
Usage : python3 -I tools/extract_poi.py data/map.osm public/data/poi.json public/data/adresses.json"""
import sys, json, math, collections
import xml.etree.ElementTree as ET
LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
def proj(lat, lon): return [round((lon - LON0) * KX, 1), round(-(lat - LAT0) * 110540, 1)]
KEYS = ("shop", "amenity", "office", "craft", "industrial", "tourism", "leisure")
def main(src, out_poi, out_adr):
    nodes, pois, adrs, ways = {}, [], [], []
    for _, el in ET.iterparse(src, events=("end",)):
        if el.tag in ("node", "way"):
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if el.tag == "node":
                p = proj(float(el.get("lat")), float(el.get("lon"))); nodes[el.get("id")] = p
                if tags: ways.append((el.get("id"), "n", tags, p, None))
            else:
                ref = [n.get("ref") for n in el.findall("nd")]
                ways.append((el.get("id"), "w", tags, None, ref))
        if el.tag in ("node", "way", "relation"): el.clear()
    cnt = collections.Counter()
    for id_, kind, tags, p, ref in ways:
        if kind == "w":
            pts = [nodes[r] for r in ref if r in nodes]
            if not pts: continue
            p = [round(sum(q[0] for q in pts) / len(pts), 1), round(sum(q[1] for q in pts) / len(pts), 1)]
        if "addr:housenumber" in tags and "addr:street" in tags:
            adrs.append({"id": id_, "numero": tags["addr:housenumber"], "rue": tags["addr:street"], "x": p[0], "y": p[1]})
        cat = next((k for k in KEYS if k in tags), None)
        if cat and tags.get("name"):
            pois.append({"id": id_, "nom": tags["name"], "categorie": cat, "sous_type": tags[cat], "x": p[0], "y": p[1],
                         "rue": tags.get("addr:street", ""), "numero": tags.get("addr:housenumber", ""), "horaires": tags.get("opening_hours", "")})
            cnt[(cat, tags[cat])] += 1
    json.dump(pois, open(out_poi, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(adrs, open(out_adr, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(pois)} POI, {len(adrs)} adresses")
    byc = collections.Counter(c for (c, _) in cnt.elements())
    print("par catégorie :", dict(byc))
    print("principaux sous-types :", cnt.most_common(25))
main(*sys.argv[1:4])
