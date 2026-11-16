// Textures PBR procédurales (canvas) : aucune dépendance réseau, tout est généré au lancement.
import * as THREE from 'three';

let seed = 1234567;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = (s: number) => { seed = s; };

function canvas(w: number, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, amount: number, step = 1) {
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** Convertit une carte de hauteur (niveaux de gris du canvas) en normal map. */
function heightToNormal(src: HTMLCanvasElement, strength: number) {
  const w = src.width, h = src.height;
  const sg = src.getContext('2d', { willReadFrequently: true })!; const sd = sg.getImageData(0, 0, w, h).data;
  const { c, g } = canvas(w, h); const out = g.createImageData(w, h);
  const H = (x: number, y: number) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); return c;
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export interface PBR { map: THREE.Texture; normalMap: THREE.Texture; }

function blotches(g: CanvasRenderingContext2D, w: number, h: number, n: number, rmin: number, rmax: number, dark: number) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rmin + rnd() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = rnd() < 0.5 ? 0 : 255;
    gr.addColorStop(0, `rgba(${v},${v},${v},${dark})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Asphalte, avec ou sans marquage. u = travers de la chaussée, v = longueur (8 m par répétition). */
export function asphalt(marked: boolean): PBR {
  const W = 512, H = 512; const { c, g } = canvas(W, H);
  g.fillStyle = '#4b4d50'; g.fillRect(0, 0, W, H);
  blotches(g, W, H, 140, 20, 80, 0.07); noise(g, W, H, 34);
  // grains plus gros
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() < .5 ? 20 : 180},${rnd() < .5 ? 20 : 180},${rnd() < .5 ? 20 : 180},0.18)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  // bandes de roulement plus sombres/lisses
  g.fillStyle = 'rgba(20,20,22,0.18)'; g.fillRect(W * .22, 0, W * .14, H); g.fillRect(W * .64, 0, W * .14, H);
  // fissures
  g.strokeStyle = 'rgba(15,15,15,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * W, y = rnd() * H; g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (rnd() - .5) * 40; y += (rnd() - .2) * 40; g.lineTo(x, y); } g.stroke(); }
  if (marked) {
    g.fillStyle = 'rgba(235,235,225,0.92)';
    g.fillRect(W * .495, 0, W * .01, H * .5);               // axe discontinu
    g.fillRect(W * .03, 0, W * .012, H); g.fillRect(W * .958, 0, W * .012, H); // rives
    noise(g, W, H, 14);
  }
  const hc = canvas(W, H); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, H); blotches(hc.g, W, H, 200, 10, 50, 0.25); noise(hc.g, W, H, 80);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 2.2), false) };
}

export function pavement(): PBR {
  const W = 512; const { c, g } = canvas(W);
  g.fillStyle = '#9a9690'; g.fillRect(0, 0, W, W);
  const hc = canvas(W); hc.g.fillStyle = '#c0c0c0'; hc.g.fillRect(0, 0, W, W);
  const n = 4, s = W / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = 138 + rnd() * 30; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
  }
  g.strokeStyle = '#6d6a65'; g.lineWidth = 5;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, W); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(W, i * s); g.stroke(); }
  hc.g.strokeStyle = '#303030'; hc.g.lineWidth = 6;
  for (let i = 0; i <= n; i++) { hc.g.beginPath(); hc.g.moveTo(i * s, 0); hc.g.lineTo(i * s, W); hc.g.stroke(); hc.g.beginPath(); hc.g.moveTo(0, i * s); hc.g.lineTo(W, i * s); hc.g.stroke(); }
  blotches(g, W, W, 80, 10, 50, 0.1); noise(g, W, W, 26); noise(hc.g, W, W, 40);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 2.5), false) };
}

export function grass(): PBR {
  const W = 512; const { c, g } = canvas(W);
  g.fillStyle = '#6c8048'; g.fillRect(0, 0, W, W);
  blotches(g, W, W, 220, 15, 70, 0.1);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W, y = rnd() * W, l = 4 + rnd() * 8; const v = 70 + rnd() * 70;
    g.strokeStyle = `rgba(${v * .85},${v + 38},${v * .5},0.35)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 4, y - l); g.stroke();
  }
  noise(g, W, W, 22);
  const hc = canvas(W); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, W); noise(hc.g, W, W, 120);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 1.2), false) };
}

export function gravel(): PBR {   // ballast + traverses (u = travers, v = 2,2 m par répétition)
  const W = 256; const { c, g } = canvas(W);
  g.fillStyle = '#74706a'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 4500; i++) { const v = 90 + rnd() * 90; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(rnd() * W, rnd() * W, 3, 3); }
  g.fillStyle = '#4a3b2e'; g.fillRect(W * .1, W * .02, W * .8, W * .2);
  noise(g, W, W, 18);
  g.fillStyle = '#9a9ea2'; g.fillRect(W * .26, 0, W * .035, W); g.fillRect(W * .705, 0, W * .035, W);
  const hc = canvas(W); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, W); noise(hc.g, W, W, 160);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 2), false) };
}

export function roofTiles(): PBR {
  const W = 512; const { c, g } = canvas(W);
  // tuiles neutres (gris clair) : la teinte vient des couleurs de sommet (couleur mesurée sur la photo aérienne, ou terre cuite par défaut)
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, W, W);
  const hc = canvas(W); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, W);
  const rows = 16, cols = 8, th = W / rows, tw = W / cols;
  for (let r = 0; r < rows; r++) for (let q = 0; q <= cols; q++) {
    const x = q * tw + (r % 2 ? tw / 2 : 0) - tw / 2, y = r * th; const v = 0.82 + rnd() * 0.3;
    g.fillStyle = `rgb(${170 * v},${170 * v},${170 * v})`; g.fillRect(x + 1, y, tw - 2, th + 1);
    const gr = g.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.08)');
    g.fillStyle = gr; g.fillRect(x + 1, y, tw - 2, th + 1);
    const hg = hc.g.createLinearGradient(0, y, 0, y + th); hg.addColorStop(0, '#202020'); hg.addColorStop(1, '#e0e0e0');
    hc.g.fillStyle = hg; hc.g.fillRect(x + 1, y, tw - 2, th);
  }
  blotches(g, W, W, 60, 10, 40, 0.1); noise(g, W, W, 20); noise(hc.g, W, W, 25);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 3), false) };
}

export function flatRoof(): PBR {
  const W = 256; const { c, g } = canvas(W);
  g.fillStyle = '#6f7073'; g.fillRect(0, 0, W, W); blotches(g, W, W, 40, 10, 50, 0.12); noise(g, W, W, 26);
  const hc = canvas(W); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, W); noise(hc.g, W, W, 60);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 1), false) };
}

/**
 * Atlas de façade 4×2 (cases de 256 px, 1 case = 1 travée de 4 m × 1 étage de 3 m), origine du canvas en haut à gauche :
 *  ligne haute : [0] fenêtre volets ouverts, [1] volets fermés, [2] fenêtre éclairée (nuit), [3] crépi plein
 *  ligne basse : [0] porte d'entrée + imposte, [1] vitrine
 * Teinte de crépi blanche : la couleur du bâtiment vient des couleurs de sommet.
 */
export interface FacadeAtlas { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture; emissiveMap: THREE.Texture; }
export function facadeAtlas(): FacadeAtlas {
  // 4×4 : lignes 0-1 enduit, lignes 2-3 brique (mêmes ouvertures). Les ouvertures sont dessinées sur un calque transparent puis posées sur les deux fonds.
  const S = 256, W = S * 4, H = S * 4; const F = canvas(W, H); const { c: layer, g } = canvas(W, S * 2); g.clearRect(0, 0, W, S * 2);
  const hc = canvas(W, H); hc.g.fillStyle = '#909090'; hc.g.fillRect(0, 0, W, H);
  const rc = canvas(W, H); rc.g.fillStyle = '#d0d0d0'; rc.g.fillRect(0, 0, W, H);
  const ec = canvas(W, H); ec.g.fillStyle = '#000'; ec.g.fillRect(0, 0, W, H);
  { const bg = F.g; for (let y = S * 2; y < H; y += 16) { const off = ((y / 16) % 2) * 17; for (let x = -off; x < W; x += 34) { const v = 0.75 + rnd() * 0.35; bg.fillStyle = `rgb(${158 * v | 0},${82 * v | 0},${58 * v | 0})`; bg.fillRect(x, y, 32, 14); } }
    bg.fillStyle = 'rgba(205,195,180,1)'; for (let y = S * 2; y < H; y += 16) bg.fillRect(0, y + 14, W, 2); for (let y = S * 2; y < H; y += 16) { const off = ((y / 16) % 2) * 17; for (let x = -off + 32; x < W; x += 34) bg.fillRect(x, y, 2, 14); } }
  for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 4; cx++) {
    const x0 = cx * S, y0 = cy * S;
    F.g.fillStyle = '#f4f1ea'; F.g.fillRect(x0, y0, S, S);
    for (let i = 0; i < 30; i++) { const x = x0 + rnd() * S, y = y0 + rnd() * S, r = 20 + rnd() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = rnd() < .5 ? 0 : 255; gr.addColorStop(0, `rgba(${v},${v},${v},0.06)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); F.g.fillStyle = gr; F.g.fillRect(x0, y0, S, S); }
  }
  const frame = '#efece6';
  const glass = (x: number, y: number, w: number, h: number, lit = false) => {
    const gr = g.createLinearGradient(x, y, x + w * .6, y + h);
    gr.addColorStop(0, '#6f8aa3'); gr.addColorStop(.5, '#2f4256'); gr.addColorStop(1, '#1b2735');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x, y + h * .5); g.lineTo(x + w * .55, y); g.lineTo(x + w * .8, y); g.lineTo(x, y + h * .8); g.fill();
    rc.g.fillStyle = '#202020'; rc.g.fillRect(x, y, w, h);
    if (lit) { ec.g.fillStyle = '#ffc878'; ec.g.fillRect(x, y, w, h); }
  };
  const depth = (x: number, y: number, w: number, h: number, v: string) => { hc.g.fillStyle = v; hc.g.fillRect(x, y, w, h); };
  const win = (x0: number, y0: number, lit: boolean) => {
    const wx = x0 + 74, wy = y0 + 52, ww = 108, wh = 150;
    depth(wx - 8, wy - 8, ww + 16, wh + 16, '#c8c8c8');
    g.fillStyle = frame; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
    glass(wx, wy, ww, wh, lit); depth(wx, wy, ww, wh, '#505050');
    g.fillStyle = frame; g.fillRect(wx + ww / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh * .38, ww, 6);
    g.fillStyle = '#d8d2c6'; g.fillRect(wx - 14, wy + wh + 4, ww + 28, 10); depth(wx - 14, wy + wh + 4, ww + 28, 10, '#f0f0f0');
    g.fillStyle = '#5e6a58'; g.fillRect(wx - 34, wy - 6, 22, wh + 12); g.fillRect(wx + ww + 12, wy - 6, 22, wh + 12);
    for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(wx - 34, wy + k * 18, 22, 2); g.fillRect(wx + ww + 12, wy + k * 18, 22, 2); }
    if (lit) { ec.g.fillStyle = '#000'; ec.g.fillRect(wx + ww / 2 - 3, wy, 6, wh); ec.g.fillRect(wx, wy + wh * .38, ww, 6); }
  };
  win(0, 0, false); win(S * 2, 0, true);
  { const x0 = S, y0 = 0; const wx = x0 + 60, wy = y0 + 48, ww = 136, wh = 158;   // volets fermés
    depth(wx - 6, wy - 6, ww + 12, wh + 12, '#c0c0c0');
    g.fillStyle = '#8a5a3a'; g.fillRect(wx, wy, ww, wh);
    for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.07)'; g.fillRect(wx, wy + k * 11.5, ww, 5); depth(wx, wy + k * 11.5, ww, 5, '#404040'); }
    g.fillStyle = '#3b2a1e'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillStyle = '#d8d2c6'; g.fillRect(wx - 10, wy + wh + 2, ww + 20, 9);
    g.fillStyle = frame; g.fillRect(wx - 6, wy - 6, ww + 12, 6); }
  { const x0 = 0, y0 = S; const dx = x0 + 78, dy = y0 + 70, dw = 100, dh = 186;   // porte
    depth(dx - 10, dy - 10, dw + 20, dh + 10, '#b0b0b0');
    g.fillStyle = '#d4cfc4'; g.fillRect(dx - 10, dy - 10, dw + 20, dh + 10);
    const gr = g.createLinearGradient(dx, dy, dx + dw, dy); gr.addColorStop(0, '#41484f'); gr.addColorStop(1, '#2b3036'); g.fillStyle = gr; g.fillRect(dx, dy, dw, dh); depth(dx, dy, dw, dh, '#606060');
    glass(dx + 14, dy + 16, dw - 28, 70); g.fillStyle = '#9aa0a4'; g.fillRect(dx + dw - 22, dy + 100, 6, 26);
    g.fillStyle = '#b9b4a8'; g.fillRect(dx - 22, y0 + 244, dw + 44, 12); glass(x0 + 74, y0 + 8, 108, 40); }
  { const x0 = S, y0 = S;   // vitrine
    depth(x0 + 20, y0 + 40, 216, 190, '#c0c0c0'); g.fillStyle = '#4a4f55'; g.fillRect(x0 + 20, y0 + 40, 216, 190);
    glass(x0 + 32, y0 + 54, 192, 160, true); g.fillStyle = '#4a4f55'; g.fillRect(x0 + 126, y0 + 54, 5, 160); depth(x0 + 32, y0 + 54, 192, 160, '#505050');
    ec.g.fillStyle = '#000'; ec.g.fillRect(x0 + 126, y0 + 54, 5, 160); g.fillStyle = '#a73a2c'; g.fillRect(x0 + 10, y0 + 10, 236, 22); }
  F.g.drawImage(layer, 0, 0); F.g.drawImage(layer, 0, S * 2);
  for (const k of [hc, rc, ec]) k.g.drawImage(k.c, 0, 0, W, S * 2, 0, S * 2, W, S * 2);
  noise(F.g, W, H, 12); noise(hc.g, W, H, 20);
  const emissive = tex(ec.c, true);
  return { map: tex(F.c, true), normalMap: tex(heightToNormal(hc.c, 3.5), false), roughnessMap: tex(rc.c, false), emissiveMap: emissive };
}

/** Feuillage (2 variantes côte à côte) : à gauche bouquet de feuilles découpé, à droite rameau d'aiguilles. Alpha pour les découpes. */
export function leaf(): THREE.Texture {
  const W = 512, H = 256; const { c, g } = canvas(W, H); g.clearRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const a = rnd() * 6.283, r = Math.pow(rnd(), 0.6) * 118; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.92; const v = 60 + rnd() * 110; g.fillStyle = `rgba(${v * .62 | 0},${v + 18 | 0},${v * .36 | 0},${0.85 + rnd() * 0.15})`; g.beginPath(); g.ellipse(x, y, 6 + rnd() * 5, 3 + rnd() * 2.5, rnd() * 3.14, 0, 7); g.fill(); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(70,50,30,0.6)'; g.lineWidth = 1.5; g.beginPath(); const a = rnd() * 6.28; g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); g.stroke(); }
  for (let k = 0; k < 9; k++) { const y0 = 20 + k * 25, x0 = 384; for (let i = 0; i < 90; i++) { const t = rnd(); const x = x0 + (t - 0.5) * 220 * (1 - k * 0.07), y = y0 + rnd() * 30; const v = 50 + rnd() * 60; g.strokeStyle = `rgba(${v * .5 | 0},${v + 15 | 0},${v * .45 | 0},0.95)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 8, y + 10 + rnd() * 8); g.stroke(); } }
  const t = tex(c, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
/** Haie taillée : feuillage dense opaque. */
export function hedgeTex(): THREE.Texture {
  const W = 256; const { c, g } = canvas(W); g.fillStyle = '#4a6a34'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 4000; i++) { const v = 50 + rnd() * 110; g.fillStyle = `rgb(${v * .6 | 0},${v + 20 | 0},${v * .35 | 0})`; g.beginPath(); g.ellipse(rnd() * W, rnd() * W, 3 + rnd() * 3, 2, rnd() * 3, 0, 7); g.fill(); }
  return tex(c, true);
}

/** Grillage soudé vert (1 répétition = 0,5 m) : fond transparent, fils diagonaux. */
export function wireTex(): THREE.Texture {
  const W = 64; const { c, g } = canvas(W); g.clearRect(0, 0, W, W); g.strokeStyle = '#2f4a2c'; g.lineWidth = 3;
  g.beginPath(); for (const o of [-W, 0, W]) { g.moveTo(o, 0); g.lineTo(o + W, W); g.moveTo(o + W, 0); g.lineTo(o, W); } g.stroke(); return tex(c, true);
}

/** Sols et murs d'intérieur (1 répétition = 2 m). */
export function floorTex(kind: 'bois' | 'carrelage' | 'beton'): PBR {
  const W = 512; const { c, g } = canvas(W); const hc = canvas(W); hc.g.fillStyle = '#909090'; hc.g.fillRect(0, 0, W, W);
  if (kind === 'bois') {
    const n = 8, h = W / n; for (let i = 0; i < n; i++) { let x = 0; while (x < W) { const l = 180 + rnd() * 240, v = 0.8 + rnd() * 0.35; g.fillStyle = `rgb(${160 * v},${112 * v},${68 * v})`; g.fillRect(x, i * h, l, h - 1.5); for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(60,35,15,0.12)'; g.fillRect(x, i * h + rnd() * h, l, 1); } hc.g.fillStyle = '#202020'; hc.g.fillRect(x + l - 1, i * h, 1.5, h); x += l; } hc.g.fillStyle = '#202020'; hc.g.fillRect(0, i * h + h - 1.5, W, 1.5); }
  } else if (kind === 'carrelage') {
    g.fillStyle = '#8a8d90'; g.fillRect(0, 0, W, W); const n = 4, s = W / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 205 + rnd() * 22; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4); hc.g.fillStyle = '#d0d0d0'; hc.g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4); }
  } else { g.fillStyle = '#74777a'; g.fillRect(0, 0, W, W); blotches(g, W, W, 90, 20, 80, 0.12); }
  noise(g, W, W, 16); noise(hc.g, W, W, 18);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 2), false) };
}
export function plaster(): PBR {
  const W = 256; const { c, g } = canvas(W); g.fillStyle = '#f2efe9'; g.fillRect(0, 0, W, W); blotches(g, W, W, 40, 20, 70, 0.05); noise(g, W, W, 14);
  const hc = canvas(W); hc.g.fillStyle = '#808080'; hc.g.fillRect(0, 0, W, W); noise(hc.g, W, W, 50);
  return { map: tex(c, true), normalMap: tex(heightToNormal(hc.c, 0.8), false) };
}

/** Normales d'eau (vaguelettes) : somme de sinus + bruit, répétable. */
export function waterNormal(): THREE.Texture {
  const W = 256; const hc = canvas(W); const d = hc.g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const u = x / W * Math.PI * 2, v = y / W * Math.PI * 2; const hgt = Math.sin(u * 3 + v) * 0.35 + Math.sin(u * 7 - v * 5) * 0.2 + Math.sin(u * 13 + v * 11) * 0.12 + Math.sin(v * 9) * 0.15; const c = (hgt * 0.5 + 0.5) * 255; const i = (y * W + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = c; d.data[i + 3] = 255; }
  hc.g.putImageData(d, 0, 0); return tex(heightToNormal(hc.c, 1.6), false);
}
/** Brins d'herbe (touffe) avec alpha. */
export function grassBlades(): THREE.Texture {
  const W = 128; const { c, g } = canvas(W); g.clearRect(0, 0, W, W);
  for (let i = 0; i < 70; i++) { const x = 10 + rnd() * 108, h = 50 + rnd() * 70, bend = (rnd() - 0.5) * 26; const v = 70 + rnd() * 70; g.strokeStyle = `rgba(${v * .7 | 0},${v + 30 | 0},${v * .4 | 0},1)`; g.lineWidth = 1.5 + rnd() * 1.5; g.beginPath(); g.moveTo(x, W); g.quadraticCurveTo(x + bend * 0.3, W - h * 0.6, x + bend, W - h); g.stroke(); }
  const t = tex(c, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
