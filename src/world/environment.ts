import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Materials } from './materials';
import { Landscape } from './landscape';

const NIGHT_VERT = 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }';
const NIGHT_FRAG = `varying vec3 vDir; uniform float uAlpha; uniform vec3 uMoon;
float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vDir); float t = clamp(d.y,0.0,1.0);
  vec3 col = mix(vec3(0.045,0.06,0.12), vec3(0.008,0.014,0.04), pow(t,0.55));
  vec3 g = floor(d*220.0); float s = h(g); float star = smoothstep(0.9965,1.0,s) * smoothstep(0.02,0.25,d.y);
  col += vec3(star) * (0.6 + 0.4*h(g+3.0));
  float m = dot(d, normalize(uMoon)); col += vec3(0.9,0.93,1.0) * smoothstep(0.9993,0.9997,m) + vec3(0.25,0.3,0.45) * pow(max(m,0.0),180.0);
  gl_FragColor = vec4(col, uAlpha);
}`;

/** Ciel physique, soleil/lune, éclairage hémisphérique et brouillard pilotés par l'heure (0-24). */
export class Environment {
  sky = new Sky(); sun = new THREE.DirectionalLight(0xffffff, 3); hemi = new THREE.HemisphereLight(0xaac8ff, 0x556044, 0.6);
  nightDome: THREE.Mesh; private pm: THREE.PMREMGenerator; private envRT?: THREE.WebGLRenderTarget; private lastEnvHour = -99;
  fog = new THREE.FogExp2(0xbcd0e0, 0.0011); land: Landscape; private lastT = performance.now();
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private mats: Materials) {
    this.sky.scale.setScalar(5000); scene.add(this.sky);
    this.nightDome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({ vertexShader: NIGHT_VERT, fragmentShader: NIGHT_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, uniforms: { uAlpha: { value: 0 }, uMoon: { value: new THREE.Vector3(-0.4, 0.6, 0.5) } } }));
    this.nightDome.renderOrder = -2; scene.add(this.nightDome); this.land = new Landscape(scene);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera; c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 500; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target, this.hemi); scene.fog = this.fog; this.pm = new THREE.PMREMGenerator(renderer);
    const u = this.sky.material.uniforms; u.turbidity.value = 5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  }
  /** Modèle simple : jour de 6h30 à 20h30 (été), élévation sinusoïdale, nuit symétrique pour la lune. */
  static elevation(hour: number) {
    const day = (hour - 6.5) / 14; if (day >= 0 && day <= 1) return { e: Math.sin(Math.PI * day), f: day };
    const n = ((hour - 20.5 + 24) % 24) / 10; return { e: -Math.sin(Math.PI * Math.min(1, n)) * 0.6, f: n };
  }
  set(hour: number, focus: THREE.Vector3) {
    const { e, f } = Environment.elevation(hour); const isDay = hour >= 6.5 && hour <= 20.5;
    const az = (isDay ? 1 - f : 1 - f) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(az) * 0.8, Math.max(e, -0.5) * (e > 0 ? 0.95 : 1) + (e > 0 ? 0.05 : 0), -0.45 + Math.sin(az) * 0.2).normalize();
    const day = THREE.MathUtils.smoothstep(e, -0.05, 0.22), night = 1 - THREE.MathUtils.smoothstep(e, -0.2, -0.04);
    const su = this.sky.material.uniforms; su.sunPosition.value.copy(dir.y < -0.03 ? new THREE.Vector3(dir.x, -0.03, dir.z).normalize() : dir);
    su.rayleigh.value = THREE.MathUtils.lerp(0.6, 1.6, day);
    (this.nightDome.material as THREE.ShaderMaterial).uniforms.uAlpha.value = night; this.nightDome.visible = night > 0.01; this.nightDome.position.copy(focus);
    (this.nightDome.material as THREE.ShaderMaterial).uniforms.uMoon.value.set(-dir.x, Math.max(0.35, -dir.y), -dir.z * 0.4 + 0.3); this.sky.visible = night < 0.99; this.sky.position.copy(focus);
    const lightDir = e > -0.02 ? dir : new THREE.Vector3(-0.3, 0.55, 0.45).normalize();
    this.sun.position.copy(focus).addScaledVector(lightDir, 220); this.sun.target.position.copy(focus);
    const warm = new THREE.Color().lerpColors(new THREE.Color(1, 0.6, 0.32), new THREE.Color(1, 0.96, 0.9), THREE.MathUtils.smoothstep(e, 0.02, 0.5));
    this.sun.color.copy(e > -0.04 ? warm : new THREE.Color(0.5, 0.6, 1));
    this.sun.intensity = e > -0.02 ? THREE.MathUtils.lerp(0.25, 3.4, THREE.MathUtils.smoothstep(e, 0, 0.35)) : 0.16 * night;
    this.hemi.intensity = THREE.MathUtils.lerp(0.22, 0.75, day); this.hemi.color.set(day > 0.5 ? 0xb4cff2 : 0x4a5fa0);
    const fogC = new THREE.Color().lerpColors(new THREE.Color(0x070b18), new THREE.Color(0xc9d8e6), day); if (day < 1 && night < 0.5) fogC.lerp(new THREE.Color(0xd9a87c), 0.35 * (1 - day));
    this.fog.color.copy(fogC); this.fog.density = THREE.MathUtils.lerp(0.0016, 0.0010, day);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.85, 0.65, day);
    this.mats.lampHead.emissiveIntensity = night > 0.25 ? 4 : 0; this.mats.wall.emissiveIntensity = THREE.MathUtils.lerp(0, 0.75, night);
    if (Math.abs(hour - this.lastEnvHour) > 0.4) {
      this.lastEnvHour = hour; const s = new THREE.Scene(); const sk = new Sky(); sk.scale.setScalar(5000); sk.material.uniforms = THREE.UniformsUtils.clone(this.sky.material.uniforms); s.add(sk);
      this.envRT?.dispose(); this.envRT = this.pm.fromScene(s, 0, 0.1, 1000); this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = THREE.MathUtils.lerp(0.05, 0.5, day);
    }
    const now = performance.now(); const dt = Math.min(0.1, (now - this.lastT) / 1000); this.lastT = now;
    this.land.update(dt, focus, lightDir, this.sun.color, this.sun.intensity, this.fog.color, day, night);
    return { day, night, sunset: Math.max(0, 1 - Math.abs(e) * 4.5) * (e > -0.08 ? 1 : 0) };
  }
}
