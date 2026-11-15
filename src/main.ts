import * as THREE from 'three';
import { loadWorld } from './world/data';
import { loadPoi, Signs } from './world/poi';
import { createMaterials } from './world/materials';
import { Chunks } from './world/chunks';
import { Environment } from './world/environment';
import { Car } from './vehicles/car';
import { VehicleWorld, VehicleRenderer } from './vehicles/world';
import { Traffic } from './vehicles/traffic';
import { Smoke } from './vehicles/smoke';
import { Effects } from './vehicles/effects';
import { Police } from './police/police';
import { SPECS, CIVIL_TYPES, PAINTS } from './vehicles/specs';
import { Player } from './player/player';
import { AvatarFactory } from './player/avatar';
import { Game } from './game';
import { Input } from './ui/input';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import * as Save from './core/save';
import { RoadGraph } from './roads/graph';
import { buildPopulation, loadAddresses } from './npc/population';
import { NpcSim, dowOf } from './npc/sim';
import { NpcRenderer } from './npc/render';
import { ObservePanel } from './ui/observe';

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

const [world, pois, addrs] = await Promise.all([loadWorld(), loadPoi(), loadAddresses()]);
const chunks = new Chunks(world, mats, scene); const signs = new Signs(pois, scene);
const car = new Car(); car.setVehicle('depart', 0xb9b2a0, SPECS.depart.hp); scene.add(car.root);
const avatars = new AvatarFactory(); await avatars.load(import.meta.env.BASE_URL + 'assets/citizen.glb', import.meta.env.BASE_URL + 'assets/anims.glb');
const player = new Player(); player.attach(avatars); scene.add(player.root);

const av = world.roads.filter(r => r.n === 'Avenue de la Gare' && r.t === 'secondary').sort((a, b) => b.p.length - a.p.length)[0];
const si = parseInt(q.get('s') ?? '2'); const a = av.p[si], b = av.p[si + 1];
const input = new Input(renderer.domElement); const hud = new Hud(); const minimap = new Minimap(world, pois);
const game = new Game(world, pois, car, player, input, hud, parseFloat(q.get('t') ?? '9'), { x: a[0], z: a[1], h: Math.atan2(b[0] - a[0], b[1] - a[1]) }, scene);
if (q.has('freeze')) game.clock.scale = 0;
// véhicules : stationnés, circulation, patrouilles
const graph = new RoadGraph(world.roads);
const vworld = new VehicleWorld(); vworld.populateParked(world.roads, game.coll, { x: a[0], z: a[1] }, 2600, +(q.get('parked') ?? 380));
for (const [t, dx, dz] of [['gendarmerie_berline', 0, 0], ['gendarmerie_berline', 6, 2], ['gendarmerie_fourgon', 12, 4]] as const) { const gx = -848 + dx, gz = -89 + dz; vworld.add({ type: t, paint: 0xf2f2f2, hp: SPECS[t].hp, x: gx, z: gz, h: 1.57, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 0 }); }
const traffic = new Traffic(graph, vworld, +(q.get('trafic') ?? 40), 2); const smoke = new Smoke(scene); const vrender = new VehicleRenderer(scene, 140);
game.attachVehicles(vworld, traffic, smoke, new Smoke(scene, 60), new Effects(scene));
const police = new Police(graph, vworld, traffic, game.coll); game.attachPolice(police);
if (q.has('fresh') || q.has('t')) Save.reset(); else if (game.restore()) hud.toast('Partie reprise.');
if (q.get('mode') === 'car') { game.mode = 'car'; player.root.visible = false; }
// habitants
const NPC_COUNT = +(q.get('npc') ?? 4000);
const npcs = buildPopulation(world, pois, game.interior.index, graph, addrs, { x: a[0], z: a[1] }, NPC_COUNT);
const sim = new NpcSim(npcs, graph); game.attachNpcs(npcs, sim); const npcRender = new NpcRenderer(scene, avatars, game.npcs); const panel = new ObservePanel();
panel.onQuit = () => { game.stopObserving(); panel.show(false); }; panel.onSpeed = x => game.setSpeed(x);
let down: { x: number; y: number; t: number } | null = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null; if (moved < 9 && dt < 400 && !game.interior.inside) { const id = npcRender.pick(e.clientX, e.clientY, camera, innerWidth, innerHeight); if (id !== null) { game.observe(id); panel.show(true); } } });
addEventListener('keydown', e => { if (e.code === 'KeyO' && !game.observed) { const v = npcRender.visible[0]; if (v) { game.observe(v.id); panel.show(true); } } });
let lastSim = -1; const statesArr: any[] = []; let statesMs = 0;
function updateStates(now: number, fx: number, fz: number) {
  if (now - lastSim < 300) return; lastSim = now; const t0 = performance.now(); statesArr.length = 0; const day = game.clock.day, hour = game.clock.hour;
  for (const n of npcs) {
    let s = sim.stateAt(n, day, hour, false); const sel = game.observed?.id === n.id; const prev = game.states.get(n.id) ?? s;
    if (sel || Math.hypot(prev.x - fx, prev.z - fz) < 330 || Math.hypot(s.x - fx, s.z - fz) < 330) s = sim.stateAt(n, day, hour, true);
    game.states.set(n.id, s); statesArr.push(s);
  }
  statesMs = performance.now() - t0;
}
document.getElementById('reset')?.addEventListener('click', () => { Save.reset(); location.reload(); });

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let snap = true;
function placeCamera(dt: number) {
  if (game.observed && !game.interior.inside) { const st = game.states.get(game.observed.id); if (st) { const y = game.camYaw, p = 0.32, d = 5.4; const look = new THREE.Vector3(st.x, 1.3, st.z), tp = new THREE.Vector3(st.x - Math.sin(y) * Math.cos(p) * d, 1.5 + Math.sin(p) * d, st.z - Math.cos(y) * Math.cos(p) * d); if (snap) { camPos.copy(tp); camLook.copy(look); snap = false; } else { camPos.lerp(tp, 1 - Math.exp(-dt * 8)); camLook.lerp(look, 1 - Math.exp(-dt * 10)); } camera.position.copy(camPos); camera.lookAt(camLook); return; } }
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
  const sh = game.fx?.shake ?? 0; if (sh > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh * 0.5, (Math.random() - 0.5) * sh * 0.4, (Math.random() - 0.5) * sh * 0.5));
  const fov = 62 + (game.mode === 'car' ? Math.min(14, Math.abs(car.speed) * 0.32) : 0) + (game.mode === 'foot' && player.speed > 3.6 ? 3 : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
}

const lampLights: THREE.PointLight[] = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffd6a0, 0, 28, 1.6); scene.add(l); lampLights.push(l); }
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
chunks.update(game.pos.x, game.pos.z, VIEW); placeCamera(0);
document.getElementById('loading')?.remove(); (window as any).__ready = true;
(window as any).__game = { police, traffic, vworld, npcRender, npcStats: () => ({ ...npcRender.stats(), vehicules: vrender.count(), circulation: traffic.cars.length, garees: vworld.list.filter(v => v.kind === 'gare').length, habitants: npcs.length, majEtatsMs: +statesMs.toFixed(1) }), sync: () => { chunks.update(game.pos.x, game.pos.z, VIEW); signs.update(game.pos.x, game.pos.z); snap = true; placeCamera(0); }, game, car, player, camera, renderer, stats: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: chunks.loaded.size }) };

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
  game.update(dt); const os = game.observed ? game.states.get(game.observed.id) : null; const fx = os ? os.x : game.pos.x, fz = os ? os.z : game.pos.z;
  chunks.update(fx, fz, VIEW); signs.update(fx, fz); updateStates(now, fx, fz); placeCamera(dt);
  if (!game.interior.inside) npcRender.update(dt, statesArr, fx, fz, game.observed?.id ?? null, now, game.clock.scale); if (game.observed && os) panel.update(game.observed, os, sim, game.clock.day, game.clock.hour, now, game.clock.scale); else if (panel.el.style.display !== 'none') panel.show(false);
  vrender.begin(); const flashOn = Math.floor(now / 280) % 2 ? 1 : 0.2;
  for (const v of vworld.list) { if (Math.abs(v.x - fx) > 280 || Math.abs(v.z - fz) > 280) continue; vrender.add(v.type, v.paint, v.x, v.z, v.h, SPECS[v.type].police && (v.kind === 'patrouille' || v.kind === 'poursuite' || (v.kind === 'gare' && game.heat.stars > 0)) ? flashOn : 1, v.hp / SPECS[v.type].hp); }
  for (const d of npcRender.drivers) { const n = game.npcs.get(d.id)!; const t = n.seed % 9 === 0 ? 'utilitaire' : CIVIL_TYPES[n.seed % CIVIL_TYPES.length]; vrender.add(t, PAINTS[(n.seed >> 3) % PAINTS.length], d.x, d.z, d.h); }
  vrender.end(); car.setFlash(false);
  if (game.mode === 'car') hud.vehicle(car.spec.nom, Math.round(Math.abs(car.speed) * 3.6), Math.round(car.hp / car.spec.hp * 100), car.upgrade); else hud.hideVehicle();
  const { night } = env.set(game.clock.hour, os ? new THREE.Vector3(os.x, 0, os.z) : game.pos); if (game.interior.inside) renderer.toneMappingExposure = 0.95;
  if (night > 0.2 && !car.lightsOn && !car.headlights[0].intensity) car.setLights(true); if (night <= 0.2 && car.lightsOn) car.setLights(false);
  if (night > 0.2) { const near = chunks.lamps.filter(l => Math.hypot(l.x - game.pos.x, l.z - game.pos.z) < 90).sort((p, q2) => p.distanceToSquared(game.pos) - q2.distanceToSquared(game.pos)); lampLights.forEach((l, i) => { const p = near[i]; l.intensity = p ? 450 : 0; if (p) l.position.set(p.x, 6.6, p.z); }); } else lampLights.forEach(l => (l.intensity = 0));
  renderer.render(game.interior.inside ? game.interior.scene! : scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.update(game.needs, game.heat, game.money, game.inv, game.clock.label, game.clock.day);
  minimap.draw(game.pos.x, game.pos.z, game.mode === 'car' ? car.heading : player.heading, now);
  requestAnimationFrame(frame);
}
void acc; requestAnimationFrame(frame);
