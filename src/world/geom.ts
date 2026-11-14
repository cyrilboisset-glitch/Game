// Outils géométriques 2D (mètres locaux : x → x, y → z Three.js)
export type Pt = [number, number];

export function area(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
export function centroid(p: Pt[]): Pt { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
export function dist(a: Pt, b: Pt) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

/** Rectangle orienté d'aire minimale (essai de chaque direction d'arête). */
export function obb(p: Pt[]) {
  let best = { a: Infinity, ang: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; const ang = Math.atan2(y2 - y1, x2 - x1);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of p) { const u = x * c - y * s, v = x * s + y * c; if (u < minX) minX = u; if (u > maxX) maxX = u; if (v < minY) minY = v; if (v > maxY) maxY = v; }
    const a = (maxX - minX) * (maxY - minY);
    if (a < best.a) best = { a, ang, minX, maxX, minY, maxY };
  }
  return best;
}

/** Offsets gauche/droite avec jointure en onglet (miter) pour une polyligne. */
export function ribbon(p: Pt[], half: number) {
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
    let d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = c[0] - b[0], d2y = c[1] - b[1];
    let l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6) { d1x = d2x; d1y = d2y; l1 = l2; }
    if (l2 < 1e-6) { d2x = d1x; d2y = d1y; l2 = l1; }
    d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
    let nx = -(d1y + d2y), ny = d1x + d2x; const nl = Math.hypot(nx, ny);
    if (nl < 1e-4) { nx = -d1y; ny = d1x; } else { nx /= nl; ny /= nl; }
    const dot = nx * -d1y + ny * d1x; const m = half / Math.max(0.55, dot);
    L.push([b[0] + nx * m, b[1] + ny * m]); R.push([b[0] - nx * m, b[1] - ny * m]);
  }
  return { L, R };
}

/** Sous-polyligne entre deux abscisses curvilignes. */
export function slice(p: Pt[], s0: number, s1: number): Pt[] {
  const out: Pt[] = []; let s = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1]; const l = dist(a, b);
    const lo = Math.max(s, s0), hi = Math.min(s + l, s1);
    if (hi > lo + 1e-6) {
      const f = (t: number): Pt => [a[0] + (b[0] - a[0]) * (t - s) / l, a[1] + (b[1] - a[1]) * (t - s) / l];
      if (!out.length) out.push(f(lo)); out.push(f(hi));
    }
    s += l;
  }
  return out;
}
export function length(p: Pt[]) { let s = 0; for (let i = 0; i < p.length - 1; i++) s += dist(p[i], p[i + 1]); return s; }
export function pointInPoly(x: number, y: number, p: Pt[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (((p[i][1] > y) !== (p[j][1] > y)) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  }
  return inside;
}
