import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Étalonnage « cinéma » léger : contraste, saturation, ombres légèrement bleutées, vignettage, grain fin. Appliqué en espace linéaire avant le tone mapping. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uSat: { value: 1.06 }, uWarm: { value: 0.0 }, uNight: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uSat, uWarm, uNight; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
  void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.2126,0.7152,0.0722));
    col = mix(vec3(l), col, uSat); col *= mix(vec3(0.97,0.99,1.05), vec3(1.0), smoothstep(0.0, 0.6, l));   // ombres froides
    col *= mix(vec3(1.0), vec3(1.06,1.0,0.92), uWarm); col = mix(col, col * vec3(0.85,0.92,1.12), uNight * 0.35);
    vec2 d = vUv - 0.5; col *= 1.0 - uVig * dot(d, d) * 2.2; col += (h(vUv * 731.0) - 0.5) * 0.012 * (0.4 + uNight);
    gl_FragColor = vec4(col, c.a); }`,
};

/** Garde-fou : valeurs infinies/NaN (lumières très intenses en demi-flottant) ramenées dans une plage sûre avant le bloom. */
const ClampShader = { uniforms: { tDiffuse: { value: null } }, vertexShader: GradeShader.vertexShader,
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 v = c.rgb; if (!(v.r >= 0.0) || !(v.g >= 0.0) || !(v.b >= 0.0) || v.r > 6e4 || v.g > 6e4 || v.b > 6e4) v = vec3(0.0); gl_FragColor = vec4(min(v, vec3(40.0)), 1.0); }' };

export type PostLevel = 'aucun' | 'moyen' | 'eleve';
/** Chaîne de post-traitement : occlusion ambiante (GTAO, niveau élevé), bloom (lumières, soleil couchant), étalonnage, sortie (tone mapping + sRGB). Rendu multi-échantillonné (MSAA). */
export class Post {
  composer: EffectComposer; private rp: RenderPass; private ao?: GTAOPass; private bloom: UnrealBloomPass; private grade: ShaderPass; level: PostLevel = 'moyen';
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt); this.rp = new RenderPass(scene, camera); this.composer.addPass(this.rp);
    this.ao = new GTAOPass(scene, camera, size.x, size.y); this.ao.output = GTAOPass.OUTPUT.Default; (this.ao as any).blendIntensity = 0.85; this.ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 }); this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); this.composer.addPass(this.ao);
    this.composer.addPass(new ShaderPass(ClampShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.55, 0.9); this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade); this.composer.addPass(new OutputPass());
  }
  setLevel(l: PostLevel) { this.level = l; if (this.ao) this.ao.enabled = l === 'eleve'; }
  setSize(w: number, h: number) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  /** night : 0-1 ; sunset : lueur chaude du soleil bas. */
  render(scene: THREE.Scene, camera: THREE.Camera, dt: number, night: number, sunset: number) {
    if (this.level === 'aucun') { this.renderer.render(scene, camera); return; }
    this.rp.scene = scene; this.rp.camera = camera; if (this.ao) { (this.ao as any).scene = scene; (this.ao as any).camera = camera; }
    this.bloom.strength = 0.15 + night * 0.38 + sunset * 0.2; this.bloom.threshold = night > 0.5 ? 0.85 : 0.95; this.bloom.radius = 0.5;
    const u = this.grade.uniforms; u.uTime.value = (u.uTime.value + dt) % 100; u.uNight.value = night; u.uWarm.value = sunset * 0.8;
    this.composer.render(dt);
  }
}
