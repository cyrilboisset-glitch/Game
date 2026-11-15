import * as THREE from 'three';
import { loadWorld } from './world/data';
import { loadPoi, Signs } from './world/poi';
import { createMaterials } from './world/materials';
import { Chunks } from './world/chunks';
import { Environment } from './world/environment';
import { Car } from './vehicles/car';
import { Player } from './player/player';
import { AvatarFactory } from './player/avatar';
import { Game } from './game';
import { Input } from './ui/input';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import * as Save from './core/save';

const q = new URLSearchParams(location.search); const VIEW = +(q.get('r') ?? 480);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 2600);
const mats = createMaterials(); const env = new Environment(renderer, scene, mats);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), mats.ground); ground.receiveShadow = true; scene.add(ground);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const [world, pois] = await Promise.all([loadWorld(), loadPoi()]);
const chunks = new Chunks(world, mats, scene); const signs = new Signs(pois, scene);
const car = new Car(); await car.load(import.meta.env.BASE_URL + 'assets/car.glb'); scene.add(car.root);
const avatars = new AvatarFactory(); await avatars.load(import.meta.env.BASE_URL + 'assets/citizen.glb', import.meta.env.BASE_URL + 'assets/anims.glb');
const player = new Player(); player.attach(avatars); scene.add(player.root);

const av = world.roads.filter(r => r.n === 'Avenue de la Gare' && r.t === 'secondary').sort((a, b) => b.p.length - a.p.length)[0];
const si = parseInt(q.get('s') ?? '2'); const a = av.p[si], b = av.p[si + 1];
const input = new Input(renderer.domElement); const hud = new Hud(); const minimap = new Minimap(world, pois);
const game = new Game(world, pois, car, player, input, hud, parseFloat(q.get('t') ?? '9'), { x: a[0], z: a[1], h: Math.atan2(b[0] - a[0], b[1] - a[1]) }, scene);
if (q.has('fresh') || q.has('t')) Save.reset(); else if (game.restore()) hud.toast('Partie reprise.');
if (q.get('mode') === 'car') { game.mode = 'car'; player.root.visible = false; }
if (q.has('freeze')) game.clock.scale = 0;
document.getElementById('reset')?.addEventListener('click', () => { Save.reset(); location.reload(); });

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let snap = true;
function placeCamera(dt: number) {
  if (game.interior.inside) { const c = game.interior.camera(); camera.position.copy(c.pos); camera.lookAt(c.look); camPos.copy(c.pos); camLook.copy(c.look); snap = true; return; }
  if (q.has('aerial')) { camera.position.set(game.pos.x - 120, 170, game.pos.z + 170); camera.lookAt(game.pos.x + 40, 0, game.pos.z - 20); return; }
  let tp: THREE.Vector3, look: THREE.Vector3;
  if (game.mode === 'car') {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), back = 7.2 + Math.abs(car.speed) * 0.08;
    tp = new THREE.Vector3(car.pos.x - fx * back, 2.9 + game.camPitch * 3 - 0.8, car.pos.z - fz * back); look = new THREE.Vector3(car.pos.x + fx * 6, 1.3, car.pos.z + fz * 6);
  } else {
    const d = 3.6, y = game.camYaw, p = game.camPitch; const cx = Math.sin(y) * Math.cos(p), cz = Math.cos(y) * Math.cos(p);
    look = new THREE.Vector3(player.pos.x, 1.5, player.pos.z); tp = new THREE.Vector3(player.pos.x - cx * d, 1.5 + Math.sin(p) * d, player.pos.z - cz * d);
    const r = { x: tp.x, z: tp.z }; game.coll.resolve(r, 0.35); tp.x = r.x; tp.z = r.z; tp.y = Math.max(tp.y, 0.4);
  }
  if (snap) { camPos.copy(tp); camLook.copy(look); snap = false; } else { const k = game.mode === 'car' ? 5 : 14; camPos.lerp(tp, 1 - Math.exp(-dt * k)); camLook.lerp(look, 1 - Math.exp(-dt * 12)); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

const lampLights: THREE.PointLight[] = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffd6a0, 0, 28, 1.6); scene.add(l); lampLights.push(l); }
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
chunks.update(game.pos.x, game.pos.z, VIEW); placeCamera(0);
document.getElementById('loading')?.remove(); (window as any).__ready = true;
(window as any).__game = { sync: () => { chunks.update(game.pos.x, game.pos.z, VIEW); signs.update(game.pos.x, game.pos.z); snap = true; placeCamera(0); }, game, car, player, camera, renderer, stats: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: chunks.loaded.size }) };

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
  game.update(dt); chunks.update(game.pos.x, game.pos.z, VIEW); signs.update(game.pos.x, game.pos.z); placeCamera(dt);
  const { night } = env.set(game.clock.hour, game.pos); if (game.interior.inside) renderer.toneMappingExposure = 0.95;
  if (night > 0.2 && !car.lightsOn && !car.headlights[0].intensity) car.setLights(true); if (night <= 0.2 && car.lightsOn) car.setLights(false);
  if (night > 0.2) { const near = chunks.lamps.filter(l => Math.hypot(l.x - game.pos.x, l.z - game.pos.z) < 90).sort((p, q2) => p.distanceToSquared(game.pos) - q2.distanceToSquared(game.pos)); lampLights.forEach((l, i) => { const p = near[i]; l.intensity = p ? 450 : 0; if (p) l.position.set(p.x, 6.6, p.z); }); } else lampLights.forEach(l => (l.intensity = 0));
  renderer.render(game.interior.inside ? game.interior.scene! : scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.update(game.needs, game.heat, game.money, game.inv, game.clock.label, game.clock.day);
  minimap.draw(game.pos.x, game.pos.z, game.mode === 'car' ? car.heading : player.heading, now);
  requestAnimationFrame(frame);
}
void acc; requestAnimationFrame(frame);
