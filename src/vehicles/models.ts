import * as THREE from 'three';
import { MeshBuilder } from '../world/meshbuilder';
import type { VehicleType } from './specs';
import { SPECS } from './specs';

/**
 * Carrosseries procédurales détaillées.
 *  - caisse : sections lissées (Hermite) avec épaules arrondies, capot/coffre légèrement bombés ;
 *  - habitacle : vitres (matériau transparent), montants, pavillon, joint de ceinture, intérieur visible (sièges, tableau de bord, volant) ;
 *  - détails : passages de roue, calandre, phares/feux, pare-chocs, poignées, rétroviseurs, plaques, échappement ;
 *  - roues : pneus à flancs galbés, jantes à 5 branches, disques de frein.
 * Quatre géométries (peinture teintée par instance, vitres, finitions, feux émissifs) pour pouvoir les instancier.
 */
type Row = number[];
interface Design {
  low: Row[];            // [z, yBas, yCeinture, demi-largeur]  (arrière → avant)
  cab: Row[];            // [z, yToit, demi-largeur de toit]    (de la base arrière à la base avant du pare-brise)
  roofFlat: [number, number]; pillars: [number, number][]; belt: number; crown: number; van?: boolean; wagon?: boolean; frontGlassTop?: number;
}
const D: Record<string, Design> = {
  citadine: { belt: 0.8, crown: 0.025, roofFlat: [-1.0, 0.1], pillars: [[-1.22, -1.1], [0.05, 0.2], [0.88, 1.0]],
    low: [[-1.9, .40, .78, .70], [-1.82, .32, .86, .78], [-1.55, .27, .93, .83], [-0.6, .25, .95, .85], [0.9, .25, .93, .85], [1.3, .26, .86, .84], [1.62, .28, .76, .81], [1.82, .31, .66, .76], [1.9, .38, .58, .68]],
    cab: [[-1.45, .93, .60], [-1.2, 1.40, .64], [-0.9, 1.47, .66], [0.2, 1.48, .66], [0.62, 1.38, .67], [1.05, .96, .72]] },
  depart: { belt: 0.82, crown: 0.02, roofFlat: [-0.85, 0.35], pillars: [[-1.0, -0.9], [0.2, 0.34], [1.12, 1.24]],
    low: [[-2.15, .40, .83, .74], [-2.05, .32, .92, .83], [-1.7, .28, .97, .87], [-0.8, .26, .98, .88], [1.1, .26, .97, .88], [1.55, .27, .9, .87], [1.9, .30, .8, .84], [2.08, .34, .7, .79], [2.15, .40, .62, .72]],
    cab: [[-1.3, .97, .66], [-1.0, 1.42, .68], [-0.7, 1.48, .69], [0.5, 1.49, .69], [0.85, 1.4, .70], [1.22, 1.0, .76]] },
  berline: { belt: 0.86, crown: 0.025, roofFlat: [-0.8, 0.45], pillars: [[-1.0, -0.9], [0.05, 0.2], [1.12, 1.24]],
    low: [[-2.35, .42, .88, .78], [-2.25, .33, .98, .86], [-1.9, .29, 1.02, .9], [-1.0, .27, 1.02, .9], [1.2, .27, .99, .9], [1.7, .28, .92, .89], [2.1, .31, .82, .86], [2.3, .35, .72, .81], [2.35, .42, .64, .74]],
    cab: [[-1.15, 1.02, .70], [-0.82, 1.4, .70], [-0.5, 1.45, .70], [0.7, 1.46, .70], [1.0, 1.38, .72], [1.3, 1.02, .78]] },
  break: { belt: 0.86, crown: 0.02, roofFlat: [-1.7, 0.35], pillars: [[-2.15, -2.05], [-0.35, -0.25], [0.5, 0.6], [1.1, 1.22]],
    low: [[-2.3, .42, .93, .76], [-2.2, .33, .99, .86], [-1.8, .29, 1.0, .89], [-1.0, .27, 1.0, .89], [1.15, .27, .99, .89], [1.65, .28, .92, .88], [2.05, .31, .82, .85], [2.25, .35, .72, .8], [2.3, .42, .64, .74]],
    cab: [[-2.1, 1.0, .68], [-1.95, 1.45, .69], [-1.6, 1.5, .70], [0.45, 1.5, .70], [0.78, 1.4, .71], [1.2, 1.02, .78]] },
  utilitaire: { belt: 1.12, crown: 0.01, van: true, roofFlat: [0.95, 1.55], pillars: [[0.72, 0.84], [1.62, 1.75]],
    low: [[-2.55, .45, 1.9, .86], [-2.5, .38, 2.12, .93], [-2.3, .36, 2.18, .97], [0.55, .35, 2.2, .98], [0.72, .35, 1.15, .96], [1.7, .36, 1.1, .94], [2.25, .38, .98, .9], [2.48, .42, .86, .85], [2.55, .5, .76, .78]],
    cab: [[0.8, 1.12, .88], [0.95, 1.9, .88], [1.3, 2.0, .88], [1.55, 2.0, .86], [1.75, 1.38, .84], [1.9, 1.15, .86]] },
};
D.gendarmerie_berline = D.berline; D.gendarmerie_fourgon = D.utilitaire;

const C = (h: number) => new THREE.Color(h); const WHITE = new THREE.Color(1, 1, 1);
const BLK = C(0x0b0b0c), DARK = C(0x16171a), RUB = C(0x1d1e20), CHR = C(0xb9bec4), CHR2 = C(0x7c828a), TIRE = C(0x0b0b0c), PLATE = C(0xeeeee6), SEAT = C(0x15171a), SEAT2 = C(0x24221f), ORG = C(0xff8a1a), RED = C(0xd01616), LENS = C(0xfff4d8);
const hs = (a: number, b: number, t: number) => a + (b - a) * t;
/** Interpolation de Catmull-Rom d'une colonne de la table. */
function samp(rows: Row[], z: number, k: number) {
  let i = 0; while (i < rows.length - 2 && z > rows[i + 1][0]) i++;
  const p0 = rows[Math.max(0, i - 1)], p1 = rows[i], p2 = rows[i + 1], p3 = rows[Math.min(rows.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (z - p1[0]) / (p2[0] - p1[0] || 1))); const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
}

export interface VehicleGeo { paint: THREE.BufferGeometry; glass: THREE.BufferGeometry; trim: THREE.BufferGeometry; lights: THREE.BufferGeometry; wheelL: THREE.BufferGeometry; wheelR: THREE.BufferGeometry; wheels: { x: number; y: number; z: number; front: boolean }[]; }
const cache = new Map<string, VehicleGeo>();

export function vehicleGeometry(type: VehicleType, bakeWheels: boolean): VehicleGeo {
  const key = type + (bakeWheels ? '1' : '0'); const hit = cache.get(key); if (hit) return hit;
  const sp = SPECS[type], d = D[type]; const P = new MeshBuilder(), G = new MeshBuilder(), T = new MeshBuilder(), Lg = new MeshBuilder(), WL = new MeshBuilder(), WR = new MeshBuilder();
  const quad = (b: MeshBuilder, a: number[], bb: number[], c: number[], dd: number[], col: THREE.Color) => b.planar([dd, c, bb, a], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
  const quadF = (b: MeshBuilder, a: number[], bb: number[], c: number[], dd: number[], col: THREE.Color) => quad(b, dd, c, bb, a, col);   // face opposée (lofts parcourus dans l'autre sens)
  const police = !!sp.police;
  const z0 = d.low[0][0], z1 = d.low[d.low.length - 1][0];
  const lowAt = (z: number) => ({ yb: samp(d.low, z, 1), ys: samp(d.low, z, 2), hw: samp(d.low, z, 3) });
  // ---------- caisse ----------
  const sec = (z: number): number[][] => { const { yb, ys, hw } = lowAt(z); const h = ys - yb, cr = d.crown;
    const half: number[][] = [[0.78 * hw, yb], [0.94 * hw, yb + 0.03], [hw, yb + 0.12], [hw * 1.005, yb + h * 0.5], [hw * 0.995, ys - 0.11], [hw * 0.95, ys - 0.04], [hw * 0.83, ys - 0.004], [hw * 0.45, ys + cr * 0.7], [0, ys + cr]];
    return [...half.slice(1).reverse().map(p => [-p[0], p[1]]), ...half.map(p => [p[0], p[1]])].reverse().slice().reverse(); };
  const N = 34; const zs: number[] = []; for (let i = 0; i <= N; i++) zs.push(hs(z0, z1, i / N));
  const secs = zs.map(z => sec(z)); const M = secs[0].length;
  for (let i = 0; i < N; i++) for (let k = 0; k < M - 1; k++) { const a = secs[i][k], b = secs[i][k + 1], c = secs[i + 1][k + 1], e = secs[i + 1][k]; const under = k < 2 || k >= M - 3 && false; quadF(P, [a[0], a[1], zs[i]], [b[0], b[1], zs[i]], [c[0], c[1], zs[i + 1]], [e[0], e[1], zs[i + 1]], WHITE); void under; }
  // dessous
  { const a = secs[0][0], b = secs[0][M - 1], c = secs[N][M - 1], e = secs[N][0]; quad(T, [a[0], a[1] + 0.01, z0], [b[0], b[1] + 0.01, z0], [c[0], c[1] + 0.01, z1], [e[0], e[1] + 0.01, z1], BLK); }
  // bas de caisse (jupes latérales) : bandes sombres
  for (const sg of [-1, 1]) { const za = d.low[2][0] + 0.45, zb = d.low[d.low.length - 3][0] - 0.45; const A = lowAt(za), B = lowAt(zb); const x = (h: number) => sg * (h + 0.006); if (sg > 0) quad(T, [x(A.hw), A.yb + 0.04, za], [x(B.hw), B.yb + 0.04, zb], [x(B.hw), B.yb + 0.2, zb], [x(A.hw), A.yb + 0.2, za], DARK); else quad(T, [x(B.hw), B.yb + 0.04, zb], [x(A.hw), A.yb + 0.04, za], [x(A.hw), A.yb + 0.2, za], [x(B.hw), B.yb + 0.2, zb], DARK); }
  // façades avant/arrière : cône vers un point central
  const cap = (i: number, flip: boolean) => { const s = secs[i]; const cz = zs[i]; const cy = (lowAt(zs[i]).yb + lowAt(zs[i]).ys) / 2; const c = P.vert(0, cy, cz, 0, 0, flip ? 1 : -1, .5, .5, WHITE); const ids = s.map(p => P.vert(p[0], p[1], zs[i], 0, 0, flip ? 1 : -1, .5, .5, WHITE)); for (let k = 0; k < ids.length - 1; k++) flip ? P.tri(c, ids[k + 1], ids[k]) : P.tri(c, ids[k], ids[k + 1]); };
  cap(N, false); cap(0, true);
  // ---------- habitacle ----------
  const cz = d.cab.map(r => r[0]); const cz0 = cz[0], cz1 = cz[cz.length - 1];
  const bounds = new Set<number>(); for (let i = 0; i <= 26; i++) bounds.add(+hs(cz0, cz1, i / 26).toFixed(4)); for (const [a, b] of d.pillars) { bounds.add(+a.toFixed(4)); bounds.add(+b.toFixed(4)); } bounds.add(+d.roofFlat[0].toFixed(4)); bounds.add(+d.roofFlat[1].toFixed(4));
  const cs = [...bounds].filter(z => z >= cz0 - 1e-6 && z <= cz1 + 1e-6).sort((a, b) => a - b);
  const cabSec = (z: number) => { const ys = lowAt(z).ys, hw = lowAt(z).hw; const yr = Math.max(ys + 0.02, samp(d.cab, z, 1)), hr = samp(d.cab, z, 2); const hb = hw * 0.9;
    const half = [[hb, ys + 0.01], [hb - 0.03 - (hb - hr) * 0.25, ys + (yr - ys) * 0.5], [hr + 0.012, yr - 0.1], [hr - 0.1, yr - 0.012], [0, yr + 0.02]];   // base → centre du toit
    return [...half.map(p => [-p[0], p[1]]).reverse(), ...half.map(p => [p[0], p[1]])]; };   // centre-gauche → base gauche | base droite → centre
  const inPil = (z: number) => d.pillars.some(([a, b]) => z >= a - 1e-6 && z <= b + 1e-6);
  const roofZone = (z: number) => z >= d.roofFlat[0] - 1e-6 && z <= d.roofFlat[1] + 1e-6;
  const cabs = cs.map(z => cabSec(z)); const K = cabs[0].length;
  // segments : 0 toit gauche · 1 arête gauche · 2-3 flanc gauche · 4 plancher (ignoré) · 5-6 flanc droit · 7 arête droite · 8 toit droit
  for (let i = 0; i < cs.length - 1; i++) {
    const zm = (cs[i] + cs[i + 1]) / 2; const pil = inPil(zm); const roof = roofZone(zm);
    for (let k = 0; k < K - 1; k++) {
      if (k === 4) continue; const a = cabs[i][k], b = cabs[i][k + 1], c = cabs[i + 1][k + 1], e = cabs[i + 1][k];
      const A = [a[0], a[1], cs[i]], B = [b[0], b[1], cs[i]], Cc = [c[0], c[1], cs[i + 1]], E = [e[0], e[1], cs[i + 1]];
      const side = k === 2 || k === 3 || k === 5 || k === 6, top = k === 0 || k === 8;
      if (side) quadF(pil ? P : G, A, B, Cc, E, WHITE); else if (top) quadF(roof ? P : G, A, B, Cc, E, WHITE); else quadF(P, A, B, Cc, E, WHITE);
    }
  }
  // joints de ceinture chromés (base des vitres) + cadre sombre
  for (const sg of [-1, 1]) for (let i = 0; i < cs.length - 1; i++) { const za = cs[i], zb = cs[i + 1]; const A = lowAt(za), B = lowAt(zb); const ya = A.ys + 0.01, yb = B.ys + 0.01; const hba = A.hw * 0.9, hbb = B.hw * 0.9; if (sg > 0) quad(T, [hba + 0.004, ya - 0.025, za], [hbb + 0.004, yb - 0.025, zb], [hbb + 0.004, yb + 0.02, zb], [hba + 0.004, ya + 0.02, za], CHR2); else quad(T, [-hbb - 0.004, yb - 0.025, zb], [-hba - 0.004, ya - 0.025, za], [-hba - 0.004, ya + 0.02, za], [-hbb - 0.004, yb + 0.02, zb], CHR2); }
  // essuie-glaces (pare-brise)
  { const zf = cs[cs.length - 1], zp = cs[cs.length - 2]; const yb = lowAt(zf).ys + 0.03; const yr = samp(d.cab, zp, 1); const t = 0.06; for (const sx of [-0.1, 0.4]) { quad(T, [sx - 0.3, yb + (yr - yb) * 0.0 + 0.0, zf - 0.003], [sx + 0.28, yb + (yr - yb) * 0.07, zf - 0.003], [sx + 0.28, yb + (yr - yb) * 0.07 + 0.012, zf - 0.003], [sx - 0.3, yb + 0.012, zf - 0.003], BLK); void t; } }
  // intérieur : sièges, tableau de bord, volant, console
  { const zf = d.van ? 1.1 : (cz1 - 0.55), zb = d.van ? 0.95 : (cz0 + 0.85); const yS = lowAt(0).yb + 0.28, hwI = lowAt(0).hw * 0.8;
    const dash = (cz1 - (d.van ? 0.35 : 0.3)); T.box(0, dash, hwI * 2 - 0.1, 0.34, 0.2, lowAt(dash).ys - 0.18, SEAT);
    for (const sx of [-0.4, 0.4]) { T.box(sx, zf - 0.9, 0.5, 0.5, 0.12, yS, SEAT2); T.box(sx, zf - 1.12, 0.5, 0.12, 0.55, yS + 0.05, SEAT2); T.box(sx, zf - 1.15, 0.28, 0.1, 0.18, yS + 0.55, SEAT2); }
    if (!d.van && sp.L > 3.9) { T.box(0, zb - 0.1, hwI * 1.5, 0.45, 0.12, yS, SEAT2); T.box(0, zb - 0.38, hwI * 1.5, 0.12, 0.5, yS + 0.05, SEAT2); }
    T.box(0, zf - 0.2, 0.3, 0.7, 0.16, yS + 0.02, SEAT);   // console
    const wy = lowAt(dash).ys + 0.02, wz = dash - 0.28; for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2; const p = (a: number, r: number) => [-0.4 + Math.cos(a) * r, wy + Math.sin(a) * r * 0.9, wz - Math.sin(a) * r * 0.3]; quad(T, p(a0, 0.17), p(a1, 0.17), p(a1, 0.145), p(a0, 0.145), BLK); } }
  // ---------- passages de roue ----------
  const wr = sp.wheelR, wz = sp.wheelbase / 2; const wheels: VehicleGeo['wheels'] = []; const trackHW = (z: number) => lowAt(z).hw - 0.085;
  const zf = (d.low[d.low.length - 3][0] > 1.6 ? wz + 0.18 : wz + 0.1), zr = -wz + (type === 'utilitaire' || type === 'gendarmerie_fourgon' ? 0.0 : 0.05);
  for (const [z, fr] of [[Math.min(zf, d.low[d.low.length - 3][0] - 0.25), true], [Math.max(zr, d.low[2][0] + 0.55), false]] as const) for (const sg of [-1, 1]) wheels.push({ x: sg * trackHW(z), y: wr, z, front: fr });
  for (const w of wheels) {
    const sg = Math.sign(w.x), ra = wr * 1.17 + 0.035, seg = 14;
    for (let i = 0; i < seg; i++) { const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg; const pt = (a: number, r: number) => { const zz = w.z - Math.cos(a) * r; return [sg * (lowAt(zz).hw * 1.004 + 0.004), w.y + Math.sin(a) * r * 0.98, zz]; };
      if (sg > 0) { quad(T, pt(a0, ra), pt(a1, ra), pt(a1, 0.01), pt(a0, 0.01), BLK); quad(T, pt(a0, ra + 0.055), pt(a1, ra + 0.055), pt(a1, ra), pt(a0, ra), DARK); }
      else { quad(T, pt(a1, ra), pt(a0, ra), pt(a0, 0.01), pt(a1, 0.01), BLK); quad(T, pt(a1, ra + 0.055), pt(a0, ra + 0.055), pt(a0, ra), pt(a1, ra), DARK); } }
  }
  // ---------- roues : pneu galbé, jante à 5 branches, disque ----------
  const tireW = 0.22, rr = wr, rimR = rr * 0.66;
  const wheelGeo = (b: MeshBuilder, ox: number, oy: number, oz: number, out: number) => {
    const seg = 24; const prof: [number, number][] = [[rimR, -0.05], [rr * 0.82, -0.085], [rr * 0.96, -0.1], [rr, -0.07], [rr, 0.07], [rr * 0.96, 0.1], [rr * 0.82, 0.085], [rimR, 0.05]];   // (rayon, décalage axial)
    const P3 = (a: number, r: number, ax: number) => [ox + out * ax * (tireW / 0.2), oy + Math.sin(a) * r, oz + Math.cos(a) * r];
    for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; for (let k = 0; k < prof.length - 1; k++) { const [r0, x0] = prof[k], [r1, x1] = prof[k + 1]; const A = P3(a0, r0, x0), B = P3(a1, r0, x0), Cc = P3(a1, r1, x1), E = P3(a0, r1, x1); if (out > 0) quad(b, A, B, Cc, E, TIRE); else quad(b, B, A, E, Cc, TIRE); }
      // face de jante (dished) et lèvre
      const rimA = P3(a0, rimR * 0.98, 0.06), rimB = P3(a1, rimR * 0.98, 0.06), inA = P3(a0, rimR * 0.2, 0.03), inB = P3(a1, rimR * 0.2, 0.03);
      const spoke = (i % (seg / 5)) < 2; const colr = spoke ? CHR : (i % (seg / 5)) === 2 ? CHR2 : DARK;   // 5 branches
      if (out > 0) quad(b, rimA, rimB, inB, inA, colr); else quad(b, rimB, rimA, inA, inB, colr);
      const lipA = P3(a0, rimR, 0.05), lipB = P3(a1, rimR, 0.05), lip2A = P3(a0, rimR * 0.98, 0.06), lip2B = P3(a1, rimR * 0.98, 0.06); if (out > 0) quad(b, lipA, lipB, lip2B, lip2A, CHR2); else quad(b, lipB, lipA, lip2A, lip2B, CHR2);
      // disque de frein (visible entre les branches)
      const dA = P3(a0, rimR * 0.9, -0.01), dB = P3(a1, rimR * 0.9, -0.01), dcA = P3(a0, rimR * 0.3, -0.01), dcB = P3(a1, rimR * 0.3, -0.01); if (out > 0) quad(b, dA, dB, dcB, dcA, C(0x555a60)); else quad(b, dB, dA, dcA, dcB, C(0x555a60));
      const hA = P3(a0, rimR * 0.22, 0.045), hB = P3(a1, rimR * 0.22, 0.045), hc = P3(a0, 0, 0.05), hd = P3(a1, 0, 0.05); if (out > 0) quad(b, hA, hB, hd, hc, CHR); else quad(b, hB, hA, hc, hd, CHR);
    }
  };
  if (bakeWheels) for (const w of wheels) wheelGeo(T, w.x, w.y, w.z, Math.sign(w.x)); else { wheelGeo(WL, 0, 0, 0, -1); wheelGeo(WR, 0, 0, 0, 1); }
  // ---------- avant : calandre, phares, pare-chocs (faces tournées vers +z) ----------
  const front = lowAt(z1 - 0.01), fz = z1 + 0.012; const fyS = front.ys, fyB = front.yb; const fq = (a: number[], b: number[], c: number[], e: number[], col: THREE.Color, g: MeshBuilder = T) => quadF(g, a, b, c, e, col);
  const gw = front.hw * 0.5; fq([-gw, fyB + 0.22, fz], [gw, fyB + 0.22, fz], [gw, fyB + 0.37, fz], [-gw, fyB + 0.37, fz], BLK);
  for (let i = 0; i < 4; i++) { const y = fyB + 0.235 + i * 0.036; fq([-gw * 0.94, y, fz + 0.004], [gw * 0.94, y, fz + 0.004], [gw * 0.94, y + 0.012, fz + 0.004], [-gw * 0.94, y + 0.012, fz + 0.004], CHR2); }
  fq([-0.05, fyB + 0.28, fz + 0.008], [0.05, fyB + 0.28, fz + 0.008], [0.05, fyB + 0.34, fz + 0.008], [-0.05, fyB + 0.34, fz + 0.008], CHR);
  fq([-front.hw * 0.46, fyB + 0.07, fz + 0.002], [front.hw * 0.46, fyB + 0.07, fz + 0.002], [front.hw * 0.46, fyB + 0.17, fz + 0.002], [-front.hw * 0.46, fyB + 0.17, fz + 0.002], DARK);
  fq([-.2, fyB + .385, fz + .006], [.2, fyB + .385, fz + .006], [.2, fyB + .43, fz + .006], [-.2, fyB + .43, fz + .006], PLATE);
  for (const sg of [-1, 1]) {
    const hx = sg * front.hw * 0.66, hy = fyS - 0.15, w = 0.19, h = 0.075;
    fq([hx - w - 0.02, hy - h - 0.02, fz + 0.002], [hx + w + 0.02, hy - h - 0.02, fz + 0.002], [hx + w + 0.02, hy + h + 0.02, fz + 0.002], [hx - w - 0.02, hy + h + 0.02, fz + 0.002], CHR2);
    fq([hx - w, hy - h, fz + 0.006], [hx + w, hy - h, fz + 0.006], [hx + w, hy + h, fz + 0.006], [hx - w, hy + h, fz + 0.006], LENS, Lg);
    fq([hx - w * 0.4, hy - 0.012, fz + 0.012], [hx + w * 0.7, hy - 0.012, fz + 0.012], [hx + w * 0.7, hy + 0.012, fz + 0.012], [hx - w * 0.4, hy + 0.012, fz + 0.012], C(0xffffff), Lg);
    fq([hx - 0.05, fyB + 0.1, fz + 0.01], [hx + 0.05, fyB + 0.1, fz + 0.01], [hx + 0.05, fyB + 0.15, fz + 0.01], [hx - 0.05, fyB + 0.15, fz + 0.01], C(0xffe6a0), Lg);
    fq([hx + sg * w * 0.55 - 0.05, hy - h - 0.0, fz + 0.008], [hx + sg * w * 0.55 + 0.05, hy - h, fz + 0.008], [hx + sg * w * 0.55 + 0.05, hy - h + 0.03, fz + 0.008], [hx + sg * w * 0.55 - 0.05, hy - h + 0.03, fz + 0.008], ORG, Lg);
  }
  // ---------- arrière : feux, plaque, pare-chocs, échappement (faces tournées vers -z) ----------
  const rear = lowAt(z0 + 0.01), rz = z0 - 0.012; const ryS = rear.ys, ryB = rear.yb; const rq = (a: number[], b: number[], c: number[], e: number[], col: THREE.Color, g: MeshBuilder = T) => quadF(g, a, b, c, e, col);
  rq([rear.hw * 0.3, ryB + 0.28, rz], [-rear.hw * 0.3, ryB + 0.28, rz], [-rear.hw * 0.3, ryB + 0.4, rz], [rear.hw * 0.3, ryB + 0.4, rz], C(0xe6c84a));
  rq([rear.hw * 0.28, ryB + 0.3, rz - 0.004], [-rear.hw * 0.28, ryB + 0.3, rz - 0.004], [-rear.hw * 0.28, ryB + 0.315, rz - 0.004], [rear.hw * 0.28, ryB + 0.315, rz - 0.004], C(0x2a4a9a));
  for (const sg of [-1, 1]) {
    const x = sg * rear.hw * 0.66, y = ryS - 0.14, w = 0.2, h = 0.075;
    rq([x + w + 0.02, y - h - 0.02, rz], [x - w - 0.02, y - h - 0.02, rz], [x - w - 0.02, y + h + 0.02, rz], [x + w + 0.02, y + h + 0.02, rz], BLK);
    rq([x + w, y - h, rz - 0.006], [x - w, y - h, rz - 0.006], [x - w, y + h, rz - 0.006], [x + w, y + h, rz - 0.006], RED, Lg);
    rq([x + w * 0.2, y - 0.02, rz - 0.012], [x - w * 0.5, y - 0.02, rz - 0.012], [x - w * 0.5, y + 0.02, rz - 0.012], [x + w * 0.2, y + 0.02, rz - 0.012], C(0xffffff), Lg);
    T.box(sg * rear.hw * 0.45, z0 + 0.015, 0.1, 0.06, 0.1, ryB + 0.045, CHR2);
    rq([x + 0.1, ryB + 0.16, rz - 0.01], [x - 0.1, ryB + 0.16, rz - 0.01], [x - 0.1, ryB + 0.2, rz - 0.01], [x + 0.1, ryB + 0.2, rz - 0.01], C(0xa01010), Lg);
  }
  T.box(0, z0 + 0.05, rear.hw * 1.6, 0.1, 0.15, ryB + 0.02, DARK);
  // ---------- portes, poignées, rétroviseurs, bouchon ----------
  { const dz0 = d.van ? 0.45 : cs[2] - 0.05, dz1 = d.van ? 1.0 : (d.wagon ? -0.55 : cs[cs.length - 4] + 0.05); const front0 = d.van ? 0.7 : cz1 - 0.55;
    for (const sg of [-1, 1]) { const mid = (dz0 + dz1) / 2; const hw = lowAt(mid).hw * 1.005 + 0.003; const y0 = lowAt(mid).yb + 0.16, y1 = lowAt(mid).ys + 0.01; const zA = d.van ? 0.35 : -0.55, zB = d.van ? 0.7 : 0.55, zC = d.van ? -1.0 : -1.55;
      for (const z of d.van ? [zA, zB] : [zC, zA - 0.0, zB, front0 + 0.15]) { const w = lowAt(z).hw * 1.003 + 0.002; if (sg > 0) quad(T, [sg * w, y0, z - .006], [sg * w, y0, z + .006], [sg * w, lowAt(z).ys + 0.005, z + .006], [sg * w, lowAt(z).ys + 0.005, z - .006], BLK); else quad(T, [sg * w, y0, z + .006], [sg * w, y0, z - .006], [sg * w, lowAt(z).ys + 0.005, z - .006], [sg * w, lowAt(z).ys + 0.005, z + .006], BLK); }
      for (const z of d.van ? [zB - 0.15] : [zA + 0.35, zC + 0.38]) T.box(sg * (lowAt(z).hw + 0.012), z, 0.14, 0.022, 0.028, lowAt(z).ys - 0.09, CHR);
      void hw; void y1;
      const mz = d.van ? 0.88 : cs[cs.length - 4] + 0.18, my = d.van ? 1.55 : d.belt + 0.1, mx = lowAt(mz).hw + 0.12; T.box(sg * (mx - 0.06), mz, 0.16, 0.05, 0.05, my - 0.02, BLK); P.box(sg * mx, mz, 0.1, 0.17, 0.12, my, WHITE); quad(G, [sg * (mx - 0.05), my + 0.02, mz - 0.085], [sg * (mx - 0.05), my + 0.02, mz + 0.085], [sg * (mx - 0.05), my + 0.1, mz + 0.085], [sg * (mx - 0.05), my + 0.1, mz - 0.085], WHITE);
      const gz = d.van ? -1.9 : -1.35; T.box(sg * (lowAt(gz).hw + 0.003), gz, 0.01, 0.08, 0.08, lowAt(gz).ys - 0.35, DARK); }
    T.box(0, hs(z0, z1, 0.5), 0.02, d.van ? 0.04 : 0.5, 0.004, lowAt(hs(z0, z1, 0.5)).ys, BLK);
  }
  // sortie d'échappement
  T.box(rear.hw * 0.55, z0 + 0.02, 0.1, 0.12, 0.07, ryB + 0.07, CHR2);
  // ---------- spécificités ----------
  if (d.wagon || type === 'break') { for (const sg of [-1, 1]) T.box(sg * 0.62, -0.55, 0.04, 2.1, 0.035, d.cab[2][1] + 0.005, CHR2); }
  if (d.van) { const zz = [-0.9, -0.2]; for (const sg of [-1, 1]) { for (const z of zz) quad(T, [sg * 1.0, 0.7, z], [sg * 1.0, 0.7, z + 0.01], [sg * 1.0, 1.9, z + 0.01], [sg * 1.0, 1.9, z], BLK); } for (let i = 0; i < 3; i++) T.box(0, -1.9 + i * 0.9, 1.2, 0.05, 0.03, lowAt(0).ys + 0.005, DARK);
    quad(T, [-0.02, 0.6, z0 - 0.003], [0.02, 0.6, z0 - 0.003], [0.02, 1.9, z0 - 0.003], [-0.02, 1.9, z0 - 0.003], BLK); }
  if (police) {
    const BL = C(0x1c3f98); const za = (d.van ? -1.9 : -1.55), zb = (d.van ? 0.5 : 1.3);
    for (const sg of [-1, 1]) for (const [h0, h1, col] of [[0.52, 0.72, BL], [0.74, 0.8, C(0xc0141c)]] as const) { const w = (z: number) => lowAt(z).hw * 1.005 + 0.004; if (sg > 0) quad(T, [sg * w(za), h0, za], [sg * w(zb), h0, zb], [sg * w(zb), h1, zb], [sg * w(za), h1, za], col); else quad(T, [sg * w(zb), h0, zb], [sg * w(za), h0, za], [sg * w(za), h1, za], [sg * w(zb), h1, zb], col); }
    const roofY = Math.max(...d.cab.map(r => r[1])); const rz2 = d.van ? 1.35 : (d.roofFlat[0] + d.roofFlat[1]) / 2;
    T.box(0, rz2, 1.1, 0.26, 0.04, roofY + 0.005, BLK); P.box(0, rz2, 1.06, 0.22, 0.1, roofY + 0.04, WHITE); Lg.box(-0.31, rz2, 0.4, 0.2, 0.08, roofY + 0.045, C(0x2a5cff)); Lg.box(0.31, rz2, 0.4, 0.2, 0.08, roofY + 0.045, C(0xe8f0ff));
    // capot : bande bleue
    const hz0 = z1 - 0.85, hz1 = z1 - 0.15; quad(T, [-0.5, lowAt(hz0).ys + 0.03, hz0], [0.5, lowAt(hz0).ys + 0.03, hz0], [0.5, lowAt(hz1).ys + 0.03, hz1], [-0.5, lowAt(hz1).ys + 0.03, hz1], BL);
  }
  const res: VehicleGeo = { paint: P.build()!, glass: G.build()!, trim: T.build()!, lights: Lg.build()!, wheelL: WL.build() ?? new THREE.BufferGeometry(), wheelR: WR.build() ?? new THREE.BufferGeometry(), wheels };
  cache.set(key, res); return res;
}

/** Matériaux : peinture vernie (teintée par instance), vitres transparentes réfléchissantes, finitions (pneus, plastique, chrome), feux émissifs. */
export function vehicleMaterials() {
  return {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 0.95 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c141c, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25, envMapIntensity: 0.9 }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}
