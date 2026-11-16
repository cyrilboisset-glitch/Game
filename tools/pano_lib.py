"""Géométrie commune : projection des façades du jeu dans un panorama 360° (équirectangulaire) de Panoramax."""
import math
LAT0, LON0 = 45.4352, 6.0252
KX = 111320 * math.cos(math.radians(LAT0))
CAM_H = 2.4   # appareil sur le toit d'une voiture ou sur un casque/perche

def local(lon, lat): return (lon - LON0) * KX, -(lat - LAT0) * 110540

def bearing(cx, cz, x, z):
    """Cap boussole (°, 0 = nord, sens horaire) de (cx, cz) vers (x, z) ; z positif = sud."""
    return math.degrees(math.atan2(x - cx, -(z - cz))) % 360

def to_pix(W, H, heading, az, elev):
    """Pixel d'une direction (cap, élévation en °) dans l'image équirectangulaire dont le centre regarde `heading`."""
    u = 0.5 + ((az - heading + 540) % 360 - 180) / 360
    v = 0.5 - elev / 180
    return u * W, v * H

def seg_hit(ax, az_, bx, bz, cx, cz, dx, dz):
    """Intersection des segments [a,b] et [c,d] (strict)."""
    def cr(ox, oz, px, pz, qx, qz): return (px - ox) * (qz - oz) - (pz - oz) * (qx - ox)
    d1, d2 = cr(cx, cz, dx, dz, ax, az_), cr(cx, cz, dx, dz, bx, bz)
    d3, d4 = cr(ax, az_, bx, bz, cx, cz), cr(ax, az_, bx, bz, dx, dz)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)
