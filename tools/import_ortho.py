"""Photo aérienne IGN (BD ORTHO®, licence ouverte Etalab 2.0) → couleurs réelles du jeu.

Usage : python3 -I tools/import_ortho.py data/src
Entrée : data/src/ortho-1.jpg … ortho-4.jpg (NO, NE, SO, SE), WMS Géoplateforme HR.ORTHOIMAGERY.ORTHOPHOTOS en EPSG:4326,
         4096 × 2600 px chacune, emprises données dans QUADS (≈ 0,55 m par pixel).
Sorties :
  - public/data/pontcharra.json : « rc » = couleur du toit (hex) de chaque bâtiment, mesurée sur la photo
  - public/data/sol.jpg + « sol » = [x0, z0, x1, z1] : carte de couleur du sol (≈ 2,2 m par pixel), qui teinte l'herbe du jeu
    (champs moissonnés, prés, bois, cours goudronnées, parkings, gravier)."""
import sys, json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
LA0, LO0, LA1, LO1 = 45.42249, 5.99665, 45.44809, 6.05372
QW, QH = 4096, 2600

def mosaic(src):
    full = Image.new("RGB", (QW * 2, QH * 2))
    for i, (cx, cy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
        full.paste(Image.open(os.path.join(src, f"ortho-{i + 1}.jpg")).convert("RGB"), (cx * QW, cy * QH))
    return full

def to_px(x, z, W, H):
    lon, lat = LON0 + x / KX, LAT0 - z / 110540
    return (lon - LO0) / (LO1 - LO0) * W, (LA1 - lat) / (LA1 - LA0) * H

def roof_colors(img, builds):
    a = np.asarray(img).astype(np.int16); H, W = a.shape[:2]; n = 0
    for b in builds:
        pts = [to_px(x, z, W, H) for x, z in b["p"]]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, y0, x1, y1 = int(min(xs)) - 2, int(min(ys)) - 2, int(max(xs)) + 3, int(max(ys)) + 3
        if x0 < 0 or y0 < 0 or x1 >= W or y1 >= H: continue
        m = Image.new("L", (x1 - x0, y1 - y0)); ImageDraw.Draw(m).polygon([(p[0] - x0, p[1] - y0) for p in pts], fill=255)
        m = m.filter(ImageFilter.MinFilter(3))   # on évite les bords (gouttières, ombres portées, décalage de la photo)
        k = np.asarray(m) > 0
        px = a[y0:y1, x0:x1][k]
        if len(px) < 8: continue
        r, g, bl = px[:, 0], px[:, 1], px[:, 2]; lum = (r * 3 + g * 6 + bl) / 10
        ok = (lum > 28) & (lum < 248) & ~((g > r + 10) & (g > bl + 4))   # ni ombre profonde, ni reflet, ni arbre qui déborde
        if ok.sum() < 6: continue
        c = np.median(px[ok], axis=0)
        b["rc"] = "%02x%02x%02x" % tuple(int(v) for v in c); n += 1
    return n

ROAD_W = {"motorway": 12, "motorway_link": 7, "trunk": 10, "primary": 9, "secondary": 8, "tertiary": 7, "unclassified": 6, "residential": 6, "living_street": 5, "service": 4, "track": 3}
URBAN = {"primary", "secondary", "tertiary", "residential", "unclassified", "living_street"}

def blur(a, r):
    """Flou boîte séparable (rayon r pixels) sur un tableau 2D ou 3D."""
    k = 2 * r + 1
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(a.ndim)], mode="edge"), axis=ax)
        a = (np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)) / k
    return a

def ground_map(img, w, out):
    """Couleur du sol sans les routes ni les toits (le jeu les dessine déjà) : on les masque, puis on bouche les trous avec la couleur des jardins voisins."""
    W, H = img.size; f = 4; gw, gh = W // f, H // f
    m = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m); mpp = (LO1 - LO0) * KX / W   # mètres par pixel
    for r in w["roads"]:
        ww = ROAD_W.get(r["t"]);
        if not ww: continue
        ww += 4.6 if r["t"] in URBAN else 1.2
        d.line([to_px(x, z, W, H) for x, z in r["p"]], fill=255, width=max(1, int(ww / mpp)))
    for b in w["builds"]: d.polygon([to_px(x, z, W, H) for x, z in b["p"]], fill=255)
    m = m.filter(ImageFilter.MaxFilter(5))
    a = np.asarray(img.resize((gw, gh), Image.BOX)).astype(np.float32) / 255
    keep = 1 - np.asarray(m.resize((gw, gh), Image.BOX)).astype(np.float32) / 255
    keep = (keep > 0.6).astype(np.float32)
    col = a * keep[..., None]; wt = keep.copy()
    for r in (2, 4, 8, 16, 32):   # remplissage par convolution normalisée, du plus fin au plus large
        hole = wt < 0.5
        if not hole.any(): break
        bc, bw = blur(col, r), blur(wt, r)
        fill = hole & (bw > 0.02)
        col[fill] = bc[fill] / bw[fill][:, None]; wt[fill] = 1
    a = col / np.maximum(wt, 1e-3)[..., None]
    lum = a.mean(axis=2, keepdims=True); lift = np.clip((0.32 - lum) / 0.32, 0, 1) * 0.45   # ombres portées de la photo relevées
    a = a * (1 + lift)
    lum = a.mean(axis=2, keepdims=True); a = a * np.where(lum > 0.45, (0.45 + (lum - 0.45) * 0.45) / np.maximum(lum, 1e-3), 1)   # parkings, champs secs : moins éblouissants
    a[..., 2] *= 0.94; mm = a.mean(axis=2, keepdims=True); a = mm + (a - mm) * 1.2   # voile bleuté retiré, légère resaturation
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(out, quality=82, optimize=True)
    return gw, gh

def main(src):
    img = mosaic(src)
    path = "public/data/pontcharra.json"; w = json.load(open(path, encoding="utf-8"))
    n = roof_colors(img, w["builds"])
    print(f"Toits : {n}/{len(w['builds'])} couleurs mesurées")
    gw, gh = ground_map(img, w, "public/data/sol.jpg")
    x0, z0 = (LO0 - LON0) * KX, -(LA1 - LAT0) * 110540; x1, z1 = (LO1 - LON0) * KX, -(LA0 - LAT0) * 110540
    w["sol"] = [round(x0, 1), round(z0, 1), round(x1, 1), round(z1, 1)]
    json.dump(w, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Sol : public/data/sol.jpg {gw}×{gh} ({os.path.getsize('public/data/sol.jpg') // 1024} Ko), emprise {w['sol']}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/src")
