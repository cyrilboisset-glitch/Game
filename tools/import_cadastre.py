"""Clôtures et haies réelles (cadastre Etalab + BD TOPO « haie »).

Usage : python3 -I tools/import_cadastre.py data/src
Entrées : data/src/parcelles.json.gz (cadastre Etalab, commune 38314), data/src/bdt-haie.json
Sorties dans public/data/pontcharra.json :
  - « fences » : [ax, az, bx, bz, k] le long des vraies limites de parcelles habitées (k : 0 haie, 1 muret + grille, 2 grillage)
    et des haies relevées par l'IGN (k = 3 : haie champêtre). Une ouverture (portail) est laissée côté rue.
  (La largeur des chaussées de la BD TOPO n'est pas utilisée : l'appariement avec OSM confond chaussées, trottoirs et pistes cyclables.)
Seule la géométrie des parcelles sert : aucun identifiant ni propriétaire n'est conservé."""
import sys, os, json, gzip, math
import numpy as np
from PIL import Image, ImageDraw

LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
X0, Z0, X1, Z1 = -2300, -1500, 2300, 1500   # emprise du raster (m), 1 px = 1 m
ROAD_W = {"motorway": 12, "motorway_link": 7, "trunk": 10, "primary": 9, "secondary": 8, "tertiary": 7, "unclassified": 6, "residential": 6, "living_street": 5, "service": 4, "track": 3}
URBAN = {"primary", "secondary", "tertiary", "residential", "unclassified", "living_street"}
PATHS = {"footway", "path", "pedestrian", "cycleway", "steps"}

def loc(c):
    lon, lat = c[0], c[1]
    return ((lon - LON0) * KX, -(lat - LAT0) * 110540)

def px(x, z): return (x - X0, z - Z0)

def area(p): return sum(p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1] for i in range(len(p) - 1)) / 2

def inside(x, z, p):
    ok = False; j = len(p) - 1
    for i in range(len(p)):
        (x1, z1), (x2, z2) = p[i], p[j]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) / (z2 - z1) * (x2 - x1): ok = not ok
        j = i
    return ok

def h01(a, b):
    s = math.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return s - math.floor(s)

def raster(w):
    """0 libre, 1 route/trottoir, 2 bâtiment (+ 1 m), 3 eau / voie ferrée."""
    W, H = X1 - X0, Z1 - Z0; im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for r in w["roads"]:
        ww = ROAD_W.get(r["t"]); hw = ww / 2 + (2.3 if r["t"] in URBAN else 0.6) if ww else (1.2 if r["t"] in PATHS else 0)
        if hw: d.line([px(x, z) for x, z in r["p"]], fill=1, width=max(1, round(hw * 2)))
    for rl in w["rails"]: d.line([px(x, z) for x, z in rl], fill=3, width=6)
    for wa in w["waters"]:
        if wa["a"]: d.polygon([px(x, z) for x, z in wa["p"]], fill=3)
        else: d.line([px(x, z) for x, z in wa["p"]], fill=3, width=8)
    for b in w["builds"]:
        d.polygon([px(x, z) for x, z in b["p"]], fill=2, outline=2)
    a = np.asarray(im).copy()
    b = a == 2; bb = b.copy(); bb[1:] |= b[:-1]; bb[:-1] |= b[1:]; bb[:, 1:] |= b[:, :-1]; bb[:, :-1] |= b[:, 1:]   # marge d'1 m autour des murs
    a[bb & (a == 0)] = 2
    return a

def get(a, x, z):
    i, j = int(x - X0), int(z - Z0)
    return a[j, i] if 0 <= i < a.shape[1] and 0 <= j < a.shape[0] else 3

def runs(a, ax, az, bx, bz, step=1.0):
    """Morceaux libres (≥ 3 m) du segment."""
    L = math.hypot(bx - ax, bz - az); n = max(1, int(L / step)); out = []; s0 = None
    for k in range(n + 1):
        t = k / n; free = get(a, ax + (bx - ax) * t, az + (bz - az) * t) == 0
        if free and s0 is None: s0 = t
        if (not free or k == n) and s0 is not None:
            t1 = t if free else (k - 1) / n
            if (t1 - s0) * L >= 3: out.append((s0, t1))
            s0 = None
    return [(ax + (bx - ax) * u, az + (bz - az) * u, ax + (bx - ax) * v, az + (bz - az) * v) for u, v in out]

def facing_road(a, ax, az, bx, bz):
    L = math.hypot(bx - ax, bz - az) or 1; nx, nz = -(bz - az) / L, (bx - ax) / L; mx, mz = (ax + bx) / 2, (az + bz) / 2
    for s in (1, -1):
        for d in (1.5, 3, 5, 7):
            if get(a, mx + nx * d * s, mz + nz * d * s) == 1: return True
    return False

def seg_dist(px_, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az; l2 = dx * dx + dz * dz or 1; t = max(0, min(1, ((px_ - ax) * dx + (pz - az) * dz) / l2))
    return math.hypot(px_ - ax - dx * t, pz - az - dz * t)

def main(src):
    path = "public/data/pontcharra.json"; w = json.load(open(path, encoding="utf-8"))
    a = raster(w)
    # bâtiments habités (logements IGN, ou maison sans usage connu)
    homes = [b for b in w["builds"] if (b.get("lg") or 0) > 0 or (b.get("u") in (None, "r") and abs(area(b["p"])) > 50)]
    hc = {}
    for b in homes:
        q = b["p"][:-1]; c = (sum(x for x, _ in q) / len(q), sum(z for _, z in q) / len(q)); hc.setdefault((int(c[0] // 50), int(c[1] // 50)), []).append(c)
    parcels = json.load(gzip.open(os.path.join(src, "parcelles.json.gz")))["features"]
    edges = {}; nres = 0
    for f in parcels:
        g = f["geometry"]; polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            p = [loc(c) for c in poly[0]]; A = abs(area(p))
            if not (120 < A < 4000): continue   # pas les champs ni les grands terrains
            xs, zs = [q[0] for q in p], [q[1] for q in p]
            cand = [c for i in range(int(min(xs) // 50), int(max(xs) // 50) + 1) for j in range(int(min(zs) // 50), int(max(zs) // 50) + 1) for c in hc.get((i, j), [])]
            if not any(inside(cx, cz, p) for cx, cz in cand): continue   # parcelle sans logement : pas de clôture
            nres += 1
            for i in range(len(p) - 1):
                k = tuple(sorted([(round(p[i][0], 1), round(p[i][1], 1)), (round(p[i + 1][0], 1), round(p[i + 1][1], 1))]))
                if k[0] != k[1]: edges[k] = edges.get(k, 0) + 1
    fences = []
    for (pa, pb), cnt in edges.items():
        L = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
        if L < 3: continue
        front = facing_road(a, pa[0], pa[1], pb[0], pb[1]); h = h01(pa[0] + pb[0], pa[1] + pb[1])
        k = (0 if h < 0.45 else 1 if h < 0.85 else 2) if front else (0 if h < 0.5 else 2)
        for (ax, az, bx, bz) in runs(a, pa[0], pa[1], pb[0], pb[1]):
            l = math.hypot(bx - ax, bz - az)
            if front and l > 7:   # portail : ouverture de 3,5 m au milieu du côté rue
                m0, m1 = (l - 3.5) / 2 / l, (l + 3.5) / 2 / l
                for u, v in ((0, m0), (m1, 1)):
                    fences.append([ax + (bx - ax) * u, az + (bz - az) * u, ax + (bx - ax) * v, az + (bz - az) * v, k])
            else: fences.append([ax, az, bx, bz, k])
    # haies relevées par l'IGN : elles remplacent la clôture de cadastre qui les longe
    hedges = json.load(open(os.path.join(src, "bdt-haie.json")))["features"]; hs = []
    for x in hedges:
        pts = [loc(c) for c in x["geometry"]["coordinates"]]
        for i in range(len(pts) - 1):
            for (ax, az, bx, bz) in runs(a, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.0): hs.append([ax, az, bx, bz, 3])
    def near_hedge(f):
        mx, mz = (f[0] + f[2]) / 2, (f[1] + f[3]) / 2
        return any(seg_dist(mx, mz, *h[:4]) < 2.5 for h in hs if abs(h[0] - mx) < 80 and abs(h[1] - mz) < 80)
    fences = [f for f in fences if not near_hedge(f)] + hs
    w["fences"] = [[round(v, 1) for v in f[:4]] + [f[4]] for f in fences if math.hypot(f[2] - f[0], f[3] - f[1]) >= 1.5]
    json.dump(w, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print(f"Parcelles habitées : {nres} ; clôtures : {len(w['fences'])} {dict(Counter(f[4] for f in w['fences']))} ; {sum(math.hypot(f[2]-f[0], f[3]-f[1]) for f in w['fences']) / 1000:.1f} km")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/src")
