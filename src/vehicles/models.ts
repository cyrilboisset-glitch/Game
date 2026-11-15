import * as THREE from 'three';
import { MeshBuilder } from '../world/meshbuilder';
import type { VehicleType } from './specs';
import { SPECS } from './specs';

/** Génération procédurale de carrosseries : caisse inférieure (lissage entre sections) + habitacle vitré + roues, feux, calandre, plaques. */
interface St { z: number; yb: number; yt: number; hw: number; }       // section de caisse (z : arrière négatif → avant positif)
interface Cb { z: number; yr: number; hr: number; glass: boolean; }   // section d'habitacle (toit) : glass = segment vitré depuis la section précédente
interface Shape { low: St[]; cab: Cb[]; cabBase: number; van?: boolean; }

const SHAPES: Record<string, Shape> = {
  citadine: { cabBase: 0.76, low: [{ z: -1.9, yb: .34, yt: .86, hw: .74 }, { z: -1.72, yb: .28, yt: .93, hw: .82 }, { z: -1.0, yb: .26, yt: .95, hw: .84 }, { z: .9, yb: .26, yt: .94, hw: .84 }, { z: 1.32, yb: .27, yt: .85, hw: .83 }, { z: 1.76, yb: .30, yt: .72, hw: .79 }, { z: 1.9, yb: .36, yt: .62, hw: .72 }],
    cab: [{ z: -1.42, yr: .95, hr: .66, glass: false }, { z: -1.18, yr: 1.5, hr: .62, glass: true }, { z: .3, yr: 1.52, hr: .62, glass: false }, { z: 1.0, yr: .96, hr: .72, glass: true }] },
  depart: { cabBase: 0.78, low: [{ z: -2.15, yb: .36, yt: .9, hw: .76 }, { z: -2.0, yb: .3, yt: .95, hw: .84 }, { z: -1.2, yb: .28, yt: .97, hw: .86 }, { z: 1.1, yb: .28, yt: .96, hw: .86 }, { z: 1.6, yb: .29, yt: .88, hw: .85 }, { z: 2.05, yb: .32, yt: .76, hw: .8 }, { z: 2.15, yb: .38, yt: .66, hw: .74 }],
    cab: [{ z: -1.2, yr: .97, hr: .7, glass: false }, { z: -.95, yr: 1.46, hr: .66, glass: true }, { z: .45, yr: 1.48, hr: .66, glass: false }, { z: 1.2, yr: .98, hr: .76, glass: true }] },
  berline: { cabBase: 0.8, low: [{ z: -2.35, yb: .38, yt: .92, hw: .78 }, { z: -2.2, yb: .3, yt: .98, hw: .86 }, { z: -1.5, yb: .28, yt: 1.0, hw: .89 }, { z: 1.2, yb: .28, yt: .98, hw: .89 }, { z: 1.75, yb: .29, yt: .9, hw: .88 }, { z: 2.25, yb: .32, yt: .78, hw: .83 }, { z: 2.35, yb: .38, yt: .68, hw: .76 }],
    cab: [{ z: -1.12, yr: 1.0, hr: .72, glass: false }, { z: -.82, yr: 1.43, hr: .68, glass: true }, { z: .55, yr: 1.45, hr: .68, glass: false }, { z: 1.25, yr: 1.0, hr: .78, glass: true }] },
  break: { cabBase: 0.8, low: [{ z: -2.3, yb: .38, yt: .95, hw: .76 }, { z: -2.15, yb: .3, yt: 1.0, hw: .85 }, { z: -1.4, yb: .28, yt: 1.0, hw: .88 }, { z: 1.15, yb: .28, yt: .98, hw: .88 }, { z: 1.7, yb: .29, yt: .9, hw: .87 }, { z: 2.2, yb: .32, yt: .78, hw: .82 }, { z: 2.3, yb: .38, yt: .68, hw: .75 }],
    cab: [{ z: -2.1, yr: 1.0, hr: .7, glass: false }, { z: -2.0, yr: 1.5, hr: .68, glass: true }, { z: .5, yr: 1.52, hr: .68, glass: false }, { z: 1.2, yr: 1.0, hr: .78, glass: true }] },
  utilitaire: { cabBase: 1.0, van: true, low: [{ z: -2.55, yb: .42, yt: 1.7, hw: .9 }, { z: -2.5, yb: .4, yt: 2.0, hw: .95 }, { z: .6, yb: .38, yt: 2.05, hw: .97 }, { z: .75, yb: .36, yt: 1.12, hw: .95 }, { z: 1.7, yb: .36, yt: 1.08, hw: .93 }, { z: 2.4, yb: .38, yt: .9, hw: .86 }, { z: 2.55, yb: .44, yt: .76, hw: .8 }],
    cab: [{ z: .78, yr: 1.12, hr: .9, glass: false }, { z: .95, yr: 1.95, hr: .86, glass: true }, { z: 1.0, yr: 1.98, hr: .84, glass: false }, { z: 1.85, yr: 1.35, hr: .8, glass: true }] },
};
SHAPES.gendarmerie_berline = SHAPES.berline; SHAPES.gendarmerie_fourgon = SHAPES.utilitaire;

const C = (h: number) => new THREE.Color(h);
const WHITE = new THREE.Color(1, 1, 1), GLASS = C(0x0e141b), TRIM = C(0x0b0b0c), BUMP = C(0x1a1b1d), TIRE = C(0x0a0a0a), RIM = C(0x9aa0a8), PLATE = C(0xe8e8e0), ARCH = C(0x050505);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (st: St[], z: number) => { for (let i = 0; i < st.length - 1; i++) if (z <= st[i + 1].z) { const t = (z - st[i].z) / (st[i + 1].z - st[i].z); return { yb: lerp(st[i].yb, st[i + 1].yb, t), yt: lerp(st[i].yt, st[i + 1].yt, t), hw: lerp(st[i].hw, st[i + 1].hw, t) }; } return st[st.length - 1]; };

/** Section de la caisse : octogone arrondi → 12 points, de dessous gauche à dessous droit. */
function section(s: { yb: number; yt: number; hw: number }): [number, number][] {
  const { yb, yt, hw } = s, r = Math.min(0.14, (yt - yb) * 0.25), c = hw * 0.93;
  return [[-c, yb], [-hw, yb + r * 0.7], [-hw, yt - r * 1.8], [-hw + r * 0.4, yt - r * 0.5], [-c + r * 0.4, yt], [c - r * 0.4, yt], [hw - r * 0.4, yt - r * 0.5], [hw, yt - r * 1.8], [hw, yb + r * 0.7], [c, yb]];
}

export interface VehicleGeo { body: THREE.BufferGeometry; lights: THREE.BufferGeometry; wheelL: THREE.BufferGeometry; wheelR: THREE.BufferGeometry; wheels: { x: number; y: number; z: number; front: boolean }[]; }
const cache = new Map<string, VehicleGeo>();

export function vehicleGeometry(type: VehicleType, bakeWheels: boolean): VehicleGeo {
  const key = type + (bakeWheels ? '1' : '0'); const hit = cache.get(key); if (hit) return hit;
  const sp = SPECS[type], sh = SHAPES[type === 'gendarmerie_berline' ? 'berline' : type === 'gendarmerie_fourgon' ? 'utilitaire' : type];
  const B = new MeshBuilder(), Lg = new MeshBuilder(), WhL = new MeshBuilder(), WhR = new MeshBuilder();
  const quad = (b: MeshBuilder, a: number[], bb: number[], c: number[], d: number[], col: THREE.Color) => b.planar([d, c, bb, a], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
  const police = !!sp.police;
  // caisse inférieure : lissage entre sections successives
  const secs = sh.low.map(s => section(s)); const n = secs[0].length;
  for (let i = 0; i < sh.low.length - 1; i++) for (let k = 0; k < n - 1; k++) {
    const a = secs[i][k], b = secs[i][k + 1], c = secs[i + 1][k + 1], d = secs[i + 1][k]; const z0 = sh.low[i].z, z1 = sh.low[i + 1].z;
    const under = k === 0 || k === n - 2; const col = under ? TRIM : WHITE;
    quad(B, [a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z1], [d[0], d[1], z1], col);
  }
  // fond + pare-chocs/calandre
  const front = sh.low[sh.low.length - 1], rear = sh.low[0];
  const cap = (z: number, st: St, col: THREE.Color, flip: boolean) => { const s = section(st); const m = B.vert(0, (st.yb + st.yt) / 2, z, 0, 0, flip ? 1 : -1, .5, .5, col); const ids = s.map(p => B.vert(p[0], p[1], z, 0, 0, flip ? 1 : -1, .5, .5, col)); for (let k = 0; k < ids.length - 1; k++) flip ? B.tri(m, ids[k + 1], ids[k]) : B.tri(m, ids[k], ids[k + 1]); };
  cap(front.z, front, WHITE, true); cap(rear.z, rear, WHITE, false);
  // pare-chocs : bandes sombres à l'avant et à l'arrière
  const bump = (z: number, st: St, sgn: number) => { const hw = st.hw + 0.012; B.box(0, z + sgn * 0.02, hw * 2 - 0.1, 0.06, 0.2, st.yb + 0.02, BUMP); };
  bump(front.z - 0.03, sh.low[sh.low.length - 2], 1); bump(rear.z + 0.05, sh.low[1], -1);
  // habitacle vitré
  for (let i = 0; i < sh.cab.length - 1; i++) {
    const A = sh.cab[i], Bc = sh.cab[i + 1]; const aBase = at(sh.low, A.z), bBase = at(sh.low, Bc.z);
    const hbA = aBase.hw * 0.94, hbB = bBase.hw * 0.94, yA = Math.max(sh.cabBase, aBase.yt - 0.02), yB = Math.max(sh.cabBase, bBase.yt - 0.02);
    const glass = Bc.glass; const sideCol = glass && Math.abs(A.z - Bc.z) < 0.3 ? GLASS : GLASS;
    if (sh.van && !glass) { /* toit de cabine : peint */ }
    // flancs (vitres) gauche/droite
    quad(B, [-A.hr, A.yr, A.z], [-Bc.hr, Bc.yr, Bc.z], [-hbB, yB, Bc.z], [-hbA, yA, A.z], sideCol);
    quad(B, [A.hr, A.yr, A.z], [Bc.hr, Bc.yr, Bc.z], [hbB, yB, Bc.z], [hbA, yA, A.z], sideCol);
    // dessus : pare-brise/lunette (verre) ou toit (peint)
    quad(B, [-A.hr, A.yr, A.z], [-Bc.hr, Bc.yr, Bc.z], [Bc.hr, Bc.yr, Bc.z], [A.hr, A.yr, A.z], glass ? GLASS : WHITE);
  }
  // montants (A, B, C) : fines bandes peintes
  const pil = (z0: number, z1: number) => { const a = at(sh.low, z0), b = at(sh.low, z1); const ca = sh.cab.reduce((p, c) => (Math.abs(c.z - z0) < Math.abs(p.z - z0) ? c : p)); const cb = sh.cab.reduce((p, c) => (Math.abs(c.z - z1) < Math.abs(p.z - z1) ? c : p)); for (const sg of [-1, 1]) quad(B, [sg * a.hw * .94, Math.max(sh.cabBase, a.yt - .02), z0], [sg * ca.hr, ca.yr + .005, z0], [sg * cb.hr, cb.yr + .005, z1], [sg * b.hw * .94, Math.max(sh.cabBase, b.yt - .02), z1], WHITE); };
  if (!sh.van) { const cz = sh.cab.map(c => c.z); const m = (cz[1] + cz[2]) / 2; pil(m - 0.04, m + 0.04); }
  // lignes de portes, poignées, rétroviseurs
  const door0 = sh.van ? 0.05 : sh.cab[1].z + 0.15, door1 = sh.van ? 0.62 : sh.cab[2].z + 0.45;
  for (const sg of [-1, 1]) {
    const hw = at(sh.low, (door0 + door1) / 2).hw + 0.004; const y0 = at(sh.low, (door0 + door1) / 2).yb + 0.12, y1 = at(sh.low, door0).yt - 0.04;
    for (const z of [door0, door1]) quad(B, [sg * hw, y0, z - .008], [sg * hw, y0, z + .008], [sg * hw, y1, z + .008], [sg * hw, y1, z - .008], TRIM);
    B.box(sg * (hw + .02), door0 + 0.13, .04, .14, .03, y1 - .1, TRIM);
    const mz = sh.van ? 0.82 : sh.cab[2].z + 0.55, my = (sh.van ? 1.2 : sh.cabBase + 0.12); B.box(sg * (at(sh.low, mz).hw + .1), mz, .12, .1, .1, my, WHITE);
  }
  // roues : arches noires, pneus, jantes
  const wy = sp.wheelR, wz = sp.wheelbase / 2; const wheels: VehicleGeo['wheels'] = []; const track = (at(sh.low, 0).hw - 0.07);
  for (const [z, fr] of [[wz + (sp.L > 4.5 ? 0.05 : 0.1), true], [-wz + 0.05, false]] as const) for (const sg of [-1, 1]) wheels.push({ x: sg * track, y: wy, z, front: fr });
  for (const w of wheels) { const hw = at(sh.low, w.z).hw; for (let k = 0; k < 1; k++) quad(B, [Math.sign(w.x) * (hw + .006), wy - .02, w.z - wy * 1.15], [Math.sign(w.x) * (hw + .006), wy - .02, w.z + wy * 1.15], [Math.sign(w.x) * (hw + .006), wy + wy * 1.2, w.z + wy * 0.95], [Math.sign(w.x) * (hw + .006), wy + wy * 1.2, w.z - wy * 0.95], ARCH); }
  const wheelGeo = (bld: MeshBuilder, ox: number, oy: number, oz: number, out: number) => {
    const seg = 14, r = wy, wd = 0.22;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; const p = (a: number, rr: number, x: number) => [ox + x, oy + Math.sin(a) * rr, oz + Math.cos(a) * rr];
      const xi = -out * wd / 2, xo = out * wd / 2;   // face intérieure / extérieure
      bld.planar([p(a0, r, xi), p(a1, r, xi), p(a1, r, xo), p(a0, r, xo)], [[0, 0], [1, 0], [1, 1], [0, 1]], TIRE);
      bld.planar([p(a0, r * 0.62, xo + out * 0.004), p(a0, r, xo), p(a1, r, xo), p(a1, r * 0.62, xo + out * 0.004)], [[0, 0], [1, 0], [1, 1], [0, 1]], BUMP);
      bld.planar([p(a0, r * 0.12, xo + out * 0.012), p(a0, r * 0.62, xo + out * 0.004), p(a1, r * 0.62, xo + out * 0.004), p(a1, r * 0.12, xo + out * 0.012)], [[0, 0], [1, 0], [1, 1], [0, 1]], RIM);
    }
  };
  if (bakeWheels) for (const w of wheels) wheelGeo(B, w.x, w.y, w.z, Math.sign(w.x));
  else { wheelGeo(WhL, 0, 0, 0, -1); wheelGeo(WhR, 0, 0, 0, 1); }
  // feux (géométrie séparée, matériau émissif)
  const fz = front.z + 0.004, rz = rear.z - 0.004; const fy = front.yt - 0.17, ry = at(sh.low, rear.z + 0.15).yt - 0.15;
  for (const sg of [-1, 1]) { const x = sg * (front.hw - 0.3); quad(Lg, [x - .2 * sg, fy - .05, fz + .02], [x + .2 * sg, fy - .05, fz + .02], [x + .2 * sg, fy + .06, fz + .02], [x - .2 * sg, fy + .06, fz + .02], C(0xfff6d8)); const xr = sg * (rear.hw - 0.12); quad(Lg, [xr + .02 * sg, ry - .06, rz - .01], [xr - .24 * sg, ry - .06, rz - .01], [xr - .24 * sg, ry + .06, rz - .01], [xr + .02 * sg, ry + .06, rz - .01], C(0xd01818)); }
  // calandre et plaques
  B.box(0, fz - 0.006, front.hw * 1.0, 0.02, 0.1, front.yb + 0.12, TRIM); quad(B, [-.26, front.yb + .08, fz + .01], [.26, front.yb + .08, fz + .01], [.26, front.yb + .19, fz + .01], [-.26, front.yb + .19, fz + .01], PLATE); quad(B, [.26, rear.yb + .26, rz - .012], [-.26, rear.yb + .26, rz - .012], [-.26, rear.yb + .37, rz - .012], [.26, rear.yb + .37, rz - .012], PLATE);
  // gendarmerie : bandes bleues, gyrophare
  if (police) {
    const BL = C(0x1b3f9a); const z0 = door0 - 0.35, z1 = door1 + 0.45; for (const sg of [-1, 1]) { const hw = at(sh.low, (z0 + z1) / 2).hw + 0.006; const yb = at(sh.low, z0).yb + 0.22; if (sg > 0) quad(B, [sg * hw, yb, z0], [sg * hw, yb, z1], [sg * hw, yb + .2, z1], [sg * hw, yb + .2, z0], BL); else quad(B, [sg * hw, yb, z1], [sg * hw, yb, z0], [sg * hw, yb + .2, z0], [sg * hw, yb + .2, z1], BL); }
    const roofY = Math.max(...sh.cab.map(c => c.yr)); const rz2 = sh.van ? 1.4 : (sh.cab[1].z + sh.cab[2].z) / 2;
    B.box(0, rz2, 1.05, .22, .09, roofY + 0.005, BUMP); Lg.box(-.34, rz2, .38, .16, .07, roofY + 0.1, C(0x2a5cff)); Lg.box(.34, rz2, .38, .16, .07, roofY + 0.1, C(0xe8f0ff));
  }
  const body = B.build()!, lights = Lg.build()!, wheelL = WhL.build() ?? new THREE.BufferGeometry(), wheelR = WhR.build() ?? new THREE.BufferGeometry();
  const res = { body, lights, wheelL, wheelR, wheels }; cache.set(key, res); return res;
}

/** Matériaux partagés : carrosserie (teinte par instance/propre), feux émissifs. */
export function bodyMaterial() { return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.35, envMapIntensity: 1.1 }); }
export function lightMaterial() { return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); }
