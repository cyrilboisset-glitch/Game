import * as THREE from 'three';
import { loadWorld } from './world/data';
import { createMaterials } from './world/materials';
import { Chunks } from './world/chunks';
import { Environment } from './world/environment';
import { Car, type Controls } from './vehicles/car';

const q = new URLSearchParams(location.search);
let hour = parseFloat(q.get('t') ?? '15');
const auto = q.has('auto');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2600);
const mats = createMaterials(); const env = new Environment(renderer, scene, mats);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), mats.ground); ground.receiveShadow = true; scene.add(ground);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const world = await loadWorld();
const chunks = new Chunks(world, mats, scene);
const car = new Car(); await car.load(import.meta.env.BASE_URL + 'assets/car.glb'); scene.add(car.root);

// départ : avenue de la Gare (tronçon le plus long)
const av = world.roads.filter(r => r.n === 'Avenue de la Gare' && r.t === 'secondary').sort((a, b) => b.p.length - a.p.length)[0];
const startIdx = parseInt(q.get('s') ?? '2');
const a = av.p[startIdx], b = av.p[startIdx + 1];
car.pos.set(a[0], 0, a[1]); car.heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
const route = av.p.slice(startIdx + 1); let routeI = 0;

const keys = new Set<string>(); addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyH') hour = (hour + 3) % 24; if (e.code === 'KeyL') car.setLights(!car.lightsOn); }); addEventListener('keyup', e => keys.delete(e.code));
const ctl: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
function readControls() {
  if (auto) {
    const t = route[Math.min(routeI, route.length - 1)]; const dx = t[0] - car.pos.x, dz = t[1] - car.pos.z;
    if (Math.hypot(dx, dz) < 8 && routeI < route.length - 1) routeI++;
    let da = Math.atan2(dx, dz) - car.heading; da = Math.atan2(Math.sin(da), Math.cos(da));
    ctl.steer = THREE.MathUtils.clamp(-da * 1.6, -1, 1) * -1 * -1; ctl.throttle = car.speed < 11 ? 0.8 : 0; ctl.brake = 0; ctl.handbrake = false; return;
  }
  ctl.throttle = keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0; ctl.brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
  ctl.steer = (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0); ctl.handbrake = keys.has('Space');
}

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const aerial = q.has('aerial');
function followCam(dt: number, snap = false) {
  if (aerial) { camera.position.set(car.pos.x - 120, 170, car.pos.z + 170); camera.lookAt(car.pos.x + 40, 0, car.pos.z - 20); return; }
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading); const back = 7.2 + Math.abs(car.speed) * 0.08;
  const target = new THREE.Vector3(car.pos.x - fx * back, 2.9 + Math.abs(car.speed) * 0.01, car.pos.z - fz * back);
  const look = new THREE.Vector3(car.pos.x + fx * 6, 1.3, car.pos.z + fz * 6);
  if (snap) { camPos.copy(target); camLook.copy(look); } else { camPos.lerp(target, 1 - Math.exp(-dt * 5)); camLook.lerp(look, 1 - Math.exp(-dt * 8)); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

const lampLights: THREE.PointLight[] = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffd6a0, 0, 28, 1.6); scene.add(l); lampLights.push(l); }
const $ = (id: string) => document.getElementById(id)!;
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
chunks.update(car.pos.x, car.pos.z, 520); followCam(0, true);
(window as any).__ready = true; $('loading').remove();
(window as any).__game = { car, camera, setHour: (h: number) => (hour = h), renderer, stats: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: chunks.loaded.size }) };

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
  for (; acc >= 1 / 60; acc -= 1 / 60) { readControls(); car.update(1 / 60, ctl); }
  chunks.update(car.pos.x, car.pos.z, 520);
  followCam(dt);
  const { night } = env.set(hour, car.pos); if (night > 0.2 && !car.lightsOn && !car.headlights[0].intensity) car.setLights(true); if (night <= 0.2 && car.lightsOn) car.setLights(false);
  // lampadaires les plus proches : vrais éclairages ponctuels
  if (night > 0.2) { const near = chunks.lamps.filter(l => Math.hypot(l.x - car.pos.x, l.z - car.pos.z) < 90).sort((p, q) => p.distanceToSquared(car.pos) - q.distanceToSquared(car.pos)); lampLights.forEach((l, i) => { const p = near[i]; l.intensity = p ? 450 : 0; if (p) l.position.copy(p).y = 6.6; }); } else lampLights.forEach(l => (l.intensity = 0));
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  $('speed').textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`; const hh = Math.floor(hour), mm = Math.floor((hour % 1) * 60);
  $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; $('place').textContent = 'Pontcharra, Isère';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
