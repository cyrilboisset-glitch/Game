"""Couleur réelle des façades, mesurée sur les photos 360° de Panoramax (photos libres : Etalab 2.0 / CC-BY-SA 4.0).

Usage : python3 -I tools/import_panoramax.py data/src/pano-index.json
Pour chaque panorama équirectangulaire, on projette les façades des bâtiments du jeu situés à 3–28 m (tournées vers l'appareil
et non cachées par un autre bâtiment), puis on lit les pixels du mur entre 2,3 m (au-dessus des voitures et des clôtures)
et le haut du mur. On écarte la végétation, le ciel, les fenêtres et les ombres. La couleur d'une façade est la médiane,
pondérée, de toutes les photos qui la voient. Résultat : « wc » (hex) dans public/data/pontcharra.json.
Les photos ne sont pas conservées ; seules les médianes par photo sont mises en cache (data/src/pano/cache.json).
Aucune personne ni plaque n'est exploitée : seuls des pixels de mur sont lus."""
import sys, os, json, math, io, colorsys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from pano_lib import local, bearing, to_pix, seg_hit, CAM_H

R_MAX, R_MIN = 28, 3

def load_world():
    w = json.load(open("public/data/pontcharra.json", encoding="utf-8"))
    grid = {}
    for i, b in enumerate(w["builds"]):
        for x, z in b["p"]: grid.setdefault((int(x // 40), int(z // 40)), set()).add(i)
    return w, grid

def near(grid, x, z):
    s = set()
    for i in range(int(x // 40) - 1, int(x // 40) + 2):
        for j in range(int(z // 40) - 1, int(z // 40) + 2): s |= grid.get((i, j), set())
    return s

def wall_pixels(img, p, w, grid):
    """{indice bâtiment: [médiane r, g, b, nb pixels]} pour un panorama."""
    a = np.asarray(img).astype(np.int16); H, W = a.shape[:2]
    cx, cz = local(p["lon"], p["lat"]); ids = near(grid, cx, cz)
    edges = []
    for i in ids:
        pts = w["builds"][i]["p"]
        for k in range(len(pts) - 1): edges.append((i, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]))
    out = {}
    for i in ids:
        b = w["builds"][i]; h = b["h"] if b["h"] > 0 else max(1, b["l"]) * 3.0
        top = min(h - 0.4, 9.0)
        if top < 2.9: continue
        pts = b["p"]; area2 = sum(pts[k][0] * pts[k + 1][1] - pts[k + 1][0] * pts[k][1] for k in range(len(pts) - 1))
        acc = []
        for k in range(len(pts) - 1):
            (ax, az), (bx, bz) = pts[k], pts[k + 1]; L = math.hypot(bx - ax, bz - az)
            if L < 2.5: continue
            nx, nz = (bz - az) / L, -(bx - ax) / L
            if area2 < 0: nx, nz = -nx, -nz   # normale sortante
            for t in (0.3, 0.5, 0.7):
                x, z = ax + (bx - ax) * t, az + (bz - az) * t; dx, dz = cx - x, cz - z; d = math.hypot(dx, dz)
                if not (R_MIN < d < R_MAX) or (nx * dx + nz * dz) / d < 0.35: continue   # façade de face (pas trop rasante)
                ex, ez = x + dx / d * 0.25, z + dz / d * 0.25
                if any(seg_hit(cx, cz, ex, ez, e[1], e[2], e[3], e[4]) for e in edges): continue   # caché par un bâtiment
                br = bearing(cx, cz, x, z)
                u, v0 = to_pix(W, H, p["az"], br, math.degrees(math.atan2(top - CAM_H, d)))
                _, v1 = to_pix(W, H, p["az"], br, math.degrees(math.atan2(2.3 - CAM_H, d)))
                du = max(2, int(W * math.degrees(math.atan2(min(1.5, L * 0.1), d)) / 360))
                y0, y1 = int(max(0, v0)), int(min(H, v1)); x0, x1 = int(u) - du, int(u) + du
                if y1 - y0 < 3 or x0 < 0 or x1 >= W: continue
                acc.append(a[y0:y1, x0:x1].reshape(-1, 3))
        if not acc: continue
        px = np.concatenate(acc); r, g, bl = px[:, 0], px[:, 1], px[:, 2]; lum = (r * 3 + g * 6 + bl) / 10
        ok = (lum > 60) & (lum < 245) & ~((g > r + 6) & (g > bl)) & ~((bl > r + 12) & (bl > g + 4))   # ni fenêtre/ombre, ni reflet/ciel, ni feuillage, ni ciel bleu
        if ok.sum() < 30: continue
        m = np.median(px[ok], axis=0); out[i] = [int(m[0]), int(m[1]), int(m[2]), int(ok.sum())]
    return out

def fetch(url):
    for _ in range(3):
        try: return Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert("RGB")
        except Exception: pass
    return None

def main(index):
    w, grid = load_world()
    cache_path = "data/src/pano/cache.json"; os.makedirs("data/src/pano", exist_ok=True)
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    panos = [p for p in json.load(open(index)) if p["pano"] == "equirectangular"]
    todo = [p for p in panos if p["id"] not in cache]
    print(f"{len(panos)} panoramas 360°, {len(todo)} à analyser")
    def job(p):
        img = fetch(p["sd"])
        return p, (wall_pixels(img, p, w, grid) if img else None)
    done = 0
    with ThreadPoolExecutor(10) as ex:
        for p, res in ex.map(job, todo):
            if res is not None: cache[p["id"]] = {"d": p["date"], "b": res}
            done += 1
            if done % 200 == 0:
                json.dump(cache, open(cache_path, "w")); print(f"  {done}/{len(todo)}", flush=True)
    json.dump(cache, open(cache_path, "w"))
    # fusion : médiane pondérée par bâtiment (photos récentes favorisées)
    per = {}
    for c in cache.values():
        wy = 2.0 if c["d"] >= "2023" else 1.0
        for i, (r, g, b, n) in c["b"].items(): per.setdefault(int(i), []).append((r, g, b, min(n, 400) * wy))
    lums = []
    res = {}
    for i, s in per.items():
        s = np.array(s, dtype=np.float64)
        if s[:, 3].sum() < 60: continue
        col = []
        for ch in range(3):
            o = np.argsort(s[:, ch]); cw = np.cumsum(s[o, 3]); col.append(s[o, ch][np.searchsorted(cw, cw[-1] / 2)])
        res[i] = col; lums.append(sum(col) / 3)
    # exposition : les photos sous-exposent les murs par rapport au ciel ; on ramène la médiane générale à un enduit clair typique
    gain = 200 / max(1, float(np.median(lums)))
    for b in w["builds"]: b.pop("wc", None)
    for i, (r, g, b) in res.items():
        hh, ll, ss = colorsys.rgb_to_hls(*(min(1, v * gain / 255) for v in (r, g, b)))
        ll = min(0.86, max(0.35, ll))   # ni mur « blanc pur » surexposé, ni mur noir à contre-jour
        ss = min(0.06, ss) if 0.42 < hh < 0.78 else min(0.42, ss * 1.15)   # teinte bleutée = reflet du ciel ou temps couvert : gris neutre
        r, g, b = colorsys.hls_to_rgb(hh, ll, ss)
        w["builds"][i]["wc"] = "%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))
    json.dump(w, open("public/data/pontcharra.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Façades : {len(res)} bâtiments colorés d'après {len(cache)} panoramas (gain d'exposition {gain:.2f})")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/src/pano-index.json")
