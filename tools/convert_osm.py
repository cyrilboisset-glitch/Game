"""Convertit data/map.osm en data/pontcharra.json (mètres locaux).
Usage : python3 -I tools/convert_osm.py data/map.osm public/data/pontcharra.json
x = (lon - lon0) * 111320 * cos(lat0) ; y = -(lat - lat0) * 110540 (y positif = sud)."""
import sys, json, math
import xml.etree.ElementTree as ET

LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))

def proj(lat, lon):
    return [round((lon - LON0) * KX, 1), round(-(lat - LAT0) * 110540, 1)]

def num(v):
    try: return float(str(v).replace('m', '').strip())
    except Exception: return 0

def main(src, out):
    nodes, ways, poi_nodes = {}, [], []
    for _, el in ET.iterparse(src, events=("end",)):
        if el.tag == "node":
            nodes[el.get("id")] = proj(float(el.get("lat")), float(el.get("lon")))
        elif el.tag == "way":
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            ways.append((tags, [n.get("ref") for n in el.findall("nd")]))
        if el.tag in ("node", "way", "relation"):
            el.clear()
    res = {"origin": [LAT0, LON0], "roads": [], "builds": [], "rails": [], "waters": [], "greens": []}
    for tags, ref in ways:
        p = [nodes[r] for r in ref if r in nodes]
        if len(p) < 2: continue
        if "building" in tags and len(p) >= 4:
            lv = int(num(tags.get("building:levels", 0)))
            res["builds"].append({"l": lv, "h": num(tags.get("height", 0)), "n": tags.get("name", ""), "p": p})
        elif "highway" in tags:
            res["roads"].append({"t": tags["highway"], "n": tags.get("name", ""), "o": 1 if tags.get("oneway") == "yes" else 0, "p": p})
        elif tags.get("railway") in ("rail", "light_rail"):
            res["rails"].append(p)
        elif tags.get("natural") == "water" or tags.get("waterway") in ("river", "stream", "canal", "riverbank"):
            res["waters"].append({"a": 1 if tags.get("natural") == "water" or tags.get("waterway") == "riverbank" else 0, "p": p})
        elif tags.get("landuse") in ("forest", "grass", "meadow", "recreation_ground", "farmland", "orchard", "vineyard") \
                or tags.get("leisure") in ("park", "garden", "pitch") or tags.get("natural") in ("wood", "scrub", "grassland"):
            res["greens"].append({"k": tags.get("landuse") or tags.get("leisure") or tags.get("natural"), "p": p})
    json.dump(res, open(out, "w"), separators=(",", ":"))
    print({k: len(v) for k, v in res.items() if isinstance(v, list)})

main(sys.argv[1], sys.argv[2])
