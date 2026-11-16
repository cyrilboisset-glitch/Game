"""Fusionne les bâtiments de la BD TOPO de l'IGN (licence ouverte Etalab 2.0) dans public/data/pontcharra.json.

Usage : python3 -I tools/import_ign.py data/ign/*.json [--sans-ajout]
Entrée : un ou plusieurs GeoJSON de la couche « batiment » (BDTOPO_V3:batiment), en WGS84 (EPSG:4326)
ou en Lambert-93 (EPSG:2154) : la projection est reconnue toute seule.

Pour chaque bâtiment OSM, on cherche le bâtiment IGN qui le contient et on récupère :
  h  = hauteur (m, sol → gouttière)      l  = nombre d'étages
  u  = usage (r résidentiel, c commerce/services, i industriel, a agricole, x annexe, s sportif, g religieux)
  lg = nombre de logements (réparti au prorata de la surface si plusieurs bâtiments OSM tombent dans le même bâtiment IGN)
  t  = hauteur du toit (faîtage − gouttière ; ≈ 0 = toit plat)
  mw = matériau des murs (1 pierre, 2 meulière, 3 béton, 4 brique, 5 aggloméré, 6 bois)
  mt = matériau du toit (1 tuiles, 2 ardoises, 3 zinc/alu, 4 béton)
Les bâtiments IGN absents d'OpenStreetMap sont ajoutés (sauf avec --sans-ajout)."""
import sys, json, math

LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
BBOX = (45.42249, 5.99665, 45.44809, 6.05372)  # lat min, lon min, lat max, lon max
USAGE = {"résidentiel": "r", "commercial et services": "c", "industriel": "i", "agricole": "a", "annexe": "x", "sportif": "s", "religieux": "g"}

def proj(lat, lon):
    return [round((lon - LON0) * KX, 1), round(-(lat - LAT0) * 110540, 1)]

def lambert93(x, y):
    """Lambert-93 → (lat, lon) en degrés (formules IGN, ellipsoïde GRS80)."""
    n, c, xs, ys, e = 0.7256077650, 11754255.426, 700000.0, 12655612.050, 0.0818191910428158
    dx, dy = x - xs, ys - y
    r = math.hypot(dx, dy); g = math.atan2(dx, dy)
    lon = math.radians(3) + g / n
    L = -math.log(r / c) / n
    phi = 2 * math.atan(math.exp(L)) - math.pi / 2
    for _ in range(12):
        s = e * math.sin(phi)
        phi = 2 * math.atan(((1 + s) / (1 - s)) ** (e / 2) * math.exp(L)) - math.pi / 2
    return math.degrees(phi), math.degrees(lon)

def to_local(pt):
    a, b = pt[0], pt[1]
    if a > 1000: lat, lon = lambert93(a, b)          # Lambert-93
    elif a > 40: lat, lon = a, b                     # ordre lat, lon
    else: lat, lon = b, a                            # ordre GeoJSON lon, lat
    return proj(lat, lon), (lat, lon)

def num(v):
    try: return float(v)
    except Exception: return 0.0

def mat(code):
    """Codes à 2 chiffres des fichiers fonciers (ex. « 35 » = béton + aggloméré) : on garde le matériau principal."""
    for ch in str(code or ""):
        if ch in "123456": return int(ch)
    return 0

def enrich(b, g):
    if g["h"] > 0: b["h"] = g["h"]
    if g["l"] > 0: b["l"] = g["l"]
    for k in ("u", "mw", "mt"):
        if g[k]: b[k] = g[k]
    if g["t"] >= 0: b["t"] = g["t"]

def area(p):
    s = 0.0
    for i in range(len(p) - 1): s += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1]
    return s / 2

def centroid(p):
    q = p[:-1] if p[0] == p[-1] else p
    return [sum(x for x, _ in q) / len(q), sum(z for _, z in q) / len(q)]

def inside(pt, p):
    x, z = pt; ok = False; j = len(p) - 1
    for i in range(len(p)):
        (x1, z1), (x2, z2) = p[i], p[j]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) / (z2 - z1) * (x2 - x1): ok = not ok
        j = i
    return ok

class Grid:
    def __init__(self, cell=50): self.c, self.g = cell, {}
    def keys(self, p):
        xs = [q[0] for q in p]; zs = [q[1] for q in p]
        for i in range(int(min(xs) // self.c), int(max(xs) // self.c) + 1):
            for j in range(int(min(zs) // self.c), int(max(zs) // self.c) + 1): yield (i, j)
    def add(self, k, p):
        for key in self.keys(p): self.g.setdefault(key, []).append(k)
    def near(self, pt): return self.g.get((int(pt[0] // self.c), int(pt[1] // self.c)), [])

def load_ign(paths):
    out, seen = [], set()
    for path in paths:
        d = json.load(open(path, encoding="utf-8"))
        if len(d.get("features", [])) >= 5000: print(f"Attention : {path} contient 5000 bâtiments, la limite du serveur : il en manque sûrement (découpe la zone en plus petit).")
        for f in d.get("features", []):
            pr, gm = f.get("properties") or {}, f.get("geometry") or {}
            fid = pr.get("cleabs") or f.get("id")
            if fid in seen: continue
            seen.add(fid)
            if (pr.get("etat_de_l_objet") or "En service") not in ("En service", ""): continue
            rings = gm.get("coordinates") or []
            if gm.get("type") == "MultiPolygon": rings = [r[0] for r in rings if r]
            elif gm.get("type") == "Polygon": rings = rings[:1]
            else: continue
            for ring in rings:
                pts, ll = zip(*[to_local(c) for c in ring]) if ring else ((), ())
                if len(pts) < 4: continue
                c = centroid(list(pts)); lat, lon = ll[0]
                if not (BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]): continue
                tmin, tmax = num(pr.get("altitude_minimale_toit")), num(pr.get("altitude_maximale_toit"))
                u = USAGE.get(str(pr.get("usage_1") or "").strip().lower(), "")
                out.append({"p": [list(q) for q in pts], "c": c, "a": abs(area(pts)), "h": round(num(pr.get("hauteur")), 1),
                            "l": int(num(pr.get("nombre_d_etages"))), "u": u, "lg": int(num(pr.get("nombre_de_logements"))),
                            "leger": str(pr.get("construction_legere")).lower() in ("true", "oui", "1"),
                            "t": round(tmax - tmin, 1) if tmin > 0 and tmax >= tmin else -1, "mw": mat(pr.get("materiaux_des_murs")), "mt": mat(pr.get("materiaux_de_la_toiture"))})
    return out

def main(args):
    add = "--sans-ajout" not in args; paths = [a for a in args if not a.startswith("--")]
    if not paths: sys.exit(__doc__)
    ign = load_ign(paths)
    print(f"IGN : {len(ign)} bâtiments lus dans {len(paths)} fichier(s)")
    if not ign: sys.exit("Aucun bâtiment IGN dans l'emprise de la carte : vérifie la couche (batiment) et la zone.")
    src = "public/data/pontcharra.json"; w = json.load(open(src, encoding="utf-8"))
    grid = Grid()
    for k, b in enumerate(ign): grid.add(k, b["p"])
    used, groups = set(), {}
    for bi, b in enumerate(w["builds"]):
        c = centroid(b["p"]); best = None
        for k in grid.near(c):
            g = ign[k]
            if inside(c, g["p"]) and (best is None or g["a"] < ign[best]["a"]): best = k
        if best is None:   # forme en L ou léger décalage : on accepte un bâtiment IGN dont le centre tombe dans le contour OSM
            for k in grid.near(c):
                g = ign[k]
                if inside(g["c"], b["p"]) and (best is None or g["a"] > ign[best]["a"]): best = k
        if best is None:   # dernier recours : centres à moins de 4 m et surfaces comparables
            ba = abs(area(b["p"]))
            for k in grid.near(c):
                g = ign[k]; d = math.hypot(g["c"][0] - c[0], g["c"][1] - c[1])
                if d < 4 and 0.5 < g["a"] / max(1, ba) < 2 and (best is None or d < math.hypot(ign[best]["c"][0] - c[0], ign[best]["c"][1] - c[1])): best = k
        if best is None: continue
        used.add(best); groups.setdefault(best, []).append(bi); enrich(b, ign[best])
    matched = sum(len(v) for v in groups.values())
    # logements : un immeuble IGN découpé en plusieurs bâtiments OSM → répartition au prorata de la surface (plus grand reste)
    for k, bis in groups.items():
        g = ign[k]
        if g["lg"] <= 0:
            for i in bis: w["builds"][i]["lg"] = 0   # connu de l'IGN mais sans logement (garage, hangar, commerce…)
            continue
        ar = [abs(area(w["builds"][i]["p"])) for i in bis]; tot = sum(ar) or 1
        raw = [g["lg"] * a / tot for a in ar]; got = [int(x) for x in raw]
        for j in sorted(range(len(bis)), key=lambda j: raw[j] - got[j], reverse=True)[:g["lg"] - sum(got)]: got[j] += 1
        for i, n in zip(bis, got): w["builds"][i]["lg"] = n
    print(f"OSM : {matched}/{len(w['builds'])} bâtiments enrichis (hauteur, étages, usage, logements)")
    if add:
        osm = Grid()
        for k, b in enumerate(w["builds"]): osm.add(k, b["p"])
        added = 0
        for k, g in enumerate(ign):
            if k in used or g["a"] < 12 or g["leger"]: continue
            if any(inside(g["c"], w["builds"][j]["p"]) for j in osm.near(g["c"])): continue
            if any(inside(centroid(w["builds"][j]["p"]), g["p"]) for j in osm.near(g["c"])): continue
            nb = {"l": 0, "h": 0, "n": "", "p": g["p"]}; enrich(nb, g)
            nb["lg"] = max(0, g["lg"])
            w["builds"].append(nb); added += 1
        print(f"Ajout : {added} bâtiments présents à l'IGN mais absents d'OSM")
    json.dump(w, open(src, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Écrit : {src}")

if __name__ == "__main__":
    main(sys.argv[1:])
