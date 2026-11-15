import * as THREE from 'three';

/**
 * Paysage lointain : massifs autour de Pontcharra (vallée du Grésivaudan, ouverte au NE et au SO).
 *  - Belledonne à l'est/sud-est (hauts sommets enneigés), Chartreuse à l'ouest (falaise du Granier), Bauges au nord.
 *  Silhouettes stylisées (pas de relief réel), placées selon les directions réelles. Deux plans : contreforts boisés + crêtes lointaines.
 *  Ciel : couche de nuages procéduraux animés.
 */
// [azimut boussole (°, 0 = nord), élévation apparente (°)]
const RIDGE: [number, number][] = [[0, 6.5], [25, 4.5], [45, 1.4], [62, 3.5], [85, 9], [105, 12.5], [125, 11], [148, 14], [170, 12], [195, 8.5], [215, 2.2], [235, 3], [255, 7.5], [278, 10.5], [292, 13.5], [300, 9], [318, 7], [340, 8], [360, 6.5]];
const FOOT: [number, number][] = [[0, 3], [40, 1], [70, 3.5], [100, 6], [140, 6.5], [180, 5.5], [210, 1.2], [240, 2.5], [270, 5], [300, 5.5], [330, 3.5], [360, 3]];
const interp = (t: [number, number][], a: number) => { a = ((a % 360) + 360) % 360; for (let i = 0; i < t.length - 1; i++) if (a <= t[i + 1][0]) { const f = (a - t[i][0]) / (t[i + 1][0] - t[i][0]); const s = f * f * (3 - 2 * f); return t[i][1] + (t[i + 1][1] - t[i][1]) * s; } return t[0][1]; };
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const fbm = (x: number) => { let v = 0, a = 0.5, fr = 1; for (let o = 0; o < 5; o++) { v += a * vnoise(x * fr); fr *= 2.1; a *= 0.5; } return v; };
/** Crête : rides « dents de scie » (bruit absolu) + falaise du Granier. */
function ridgeElev(az: number, table: [number, number][], rough: number, seed: number) {
  const base = interp(table, az); const broad = fbm(az * 0.045 + seed), ridge = 1 - Math.abs(fbm(az * 0.16 + seed * 3) * 2 - 1), fine = fbm(az * 0.9 + seed * 7);
  let e = base * (0.86 + (broad - 0.5) * 0.35 * rough + ridge * 0.16 * rough) + (fine - 0.5) * 0.35 * rough; if (table === RIDGE && az > 286 && az < 296) e += (az - 286) * 0.35;   // Granier : montée raide vers la falaise
  return Math.max(0.3, e);
}

const VERT = `varying vec3 vN; varying vec3 vC; varying float vH; attribute vec3 color; attribute float hfrac;
void main(){ vN = normalize(mat3(modelMatrix) * normal); vC = color; vH = hfrac; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`;
const FRAG = `uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uHaze; uniform float uHazeK; uniform float uSnow; varying vec3 vN; varying vec3 vC; varying float vH;
void main(){ vec3 n = normalize(vN); float d = max(dot(n, normalize(uSun)), 0.0); vec3 alb = vC; float snow = smoothstep(uSnow - 0.06, uSnow + 0.04, vH + (n.y - 0.6) * 0.15); alb = mix(alb, vec3(0.93,0.95,1.0), snow);
  vec3 col = alb * (uAmb + uSunCol * d * 0.9); float haze = clamp(uHazeK * (1.0 - vH * 0.55), 0.0, 1.0); col = mix(col, uHaze, haze); gl_FragColor = vec4(col, 1.0); }`;

const CLOUD_FRAG = `varying vec3 vDir; uniform float uTime; uniform vec3 uSunCol; uniform vec3 uShade; uniform float uCover; uniform float uAlpha; uniform vec3 uSun;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
void main(){ vec3 d = normalize(vDir); if (d.y < 0.0) discard; vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
  float c = fbm(uv); float c2 = fbm(uv * 2.7 + 3.1); float dens = smoothstep(1.0 - uCover, 1.0 - uCover + 0.22, c * 0.8 + c2 * 0.3);
  float lit = 0.55 + 0.45 * smoothstep(0.2, 0.9, fbm(uv + normalize(uSun.xz) * 0.08) - c * 0.3 + 0.5); vec3 col = mix(uShade, uSunCol, lit);
  float fade = smoothstep(0.02, 0.22, d.y); gl_FragColor = vec4(col, dens * fade * uAlpha); }`;

export class Landscape {
  group = new THREE.Group(); private mats: THREE.ShaderMaterial[] = []; private clouds: THREE.Mesh; private t = 0;
  constructor(scene: THREE.Scene) {
    const mk = (R: number, table: [number, number][], rough: number, seed: number, low: THREE.Color, high: THREE.Color, segs = 720) => {
      const pos: number[] = [], col: number[] = [], hf: number[] = [], idx: number[] = []; const rows = 5; const maxE = Math.max(...table.map(t => t[1])) * 1.4;
      for (let i = 0; i <= segs; i++) {
        const az = i / segs * 360; const e = ridgeElev(az, table, rough, seed); const top = R * Math.tan(e * Math.PI / 180); const dx = Math.sin(az * Math.PI / 180), dz = -Math.cos(az * Math.PI / 180);
        for (let r = 0; r <= rows; r++) { const f = r / rows; const y = -80 + (top + 80) * Math.pow(f, 0.9); const rr = R * (1 + (1 - f) * 0.06); pos.push(dx * rr, y, dz * rr); const hfrac = (y / (R * Math.tan(maxE * Math.PI / 180))); const c = low.clone().lerp(high, Math.min(1, Math.max(0, hfrac * 1.5 - 0.15))); col.push(c.r, c.g, c.b); hf.push(Math.max(0, hfrac)); }
      }
      for (let i = 0; i < segs; i++) for (let r = 0; r < rows; r++) { const a = i * (rows + 1) + r, b = a + rows + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('hfrac', new THREE.Float32BufferAttribute(hf, 1)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.4, 0.45, 0.55) }, uHaze: { value: new THREE.Color(0.75, 0.82, 0.9) }, uHazeK: { value: 0.5 }, uSnow: { value: 0.55 } } });
      this.mats.push(m); const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.renderOrder = -1; return me;
    };
    const far = mk(2350, RIDGE, 1, 1.3, new THREE.Color(0x26352c), new THREE.Color(0x8a8780)); (far.material as THREE.ShaderMaterial).uniforms.uHazeK.value = 0.7; (far.material as THREE.ShaderMaterial).uniforms.uSnow.value = 0.6;
    const near = mk(1750, FOOT, 0.6, 7.7, new THREE.Color(0x1b2a1c), new THREE.Color(0x2c4129), 540); (near.material as THREE.ShaderMaterial).uniforms.uHazeK.value = 0.56; (near.material as THREE.ShaderMaterial).uniforms.uSnow.value = 9;
    this.group.add(far, near); scene.add(this.group);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }', fragmentShader: CLOUD_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.72) }, uCover: { value: 0.5 }, uAlpha: { value: 0.9 }, uSun: { value: new THREE.Vector3(0, 1, 0) } } }));
    this.clouds.renderOrder = -1.5; this.clouds.frustumCulled = false; scene.add(this.clouds);
  }
  /** Mise à jour : suit le point de vue, lumière du soleil, voile atmosphérique, nuages. */
  update(dt: number, focus: THREE.Vector3, sunDir: THREE.Vector3, sunCol: THREE.Color, sunI: number, haze: THREE.Color, day: number, night: number) {
    this.t += dt; this.group.position.set(focus.x, 0, focus.z); this.clouds.position.set(focus.x, 0, focus.z);
    const sc = sunCol.clone().multiplyScalar(Math.min(1.4, sunI / 2.4)); const amb = new THREE.Color().setRGB(0.32, 0.37, 0.46).multiplyScalar(0.25 + day * 0.75);
    for (const m of this.mats) { m.uniforms.uSun.value.copy(sunDir); m.uniforms.uSunCol.value.copy(sc); m.uniforms.uAmb.value.copy(amb); m.uniforms.uHaze.value.copy(haze); }
    const cu = (this.clouds.material as THREE.ShaderMaterial).uniforms; cu.uTime.value = this.t; cu.uSun.value.copy(sunDir);
    cu.uSunCol.value.copy(new THREE.Color(1, 0.97, 0.92).lerp(new THREE.Color(1, 0.62, 0.42), Math.max(0, 1 - Math.abs(sunDir.y) * 4) * day)).multiplyScalar(0.25 + day * 0.85);
    cu.uShade.value.copy(new THREE.Color(0.55, 0.6, 0.7).multiplyScalar(0.18 + day * 0.7)); cu.uAlpha.value = 0.35 + day * 0.55 - night * 0.1;
  }
}
