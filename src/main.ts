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
import { MissionsPanel } from './ui/missionsPanel';
import { neutralSpots } from './missions/generator';
import { AudioSys } from './audio/audio';
import { AutoQuality, levelParams, type Level } from './core/quality';
import { Settings } from './ui/settings';
import { Post } from './core/post';
import { GroundMask } from './world/mask';
import { GrassField } from './world/grass';
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

const q = new URLSearchParams(location.search); let VIEW = +(q.get('r') ?? 480); let VEH_RANGE = 280; let shadowRange = 150;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 6000);
const mats = createMaterials(); const env = new Environment(renderer, scene, mats);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), mats.ground); ground.receiveShadow = true; scene.add(ground);
const post = new Post(renderer, scene, camera);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const [world, pois, addrs] = await Promise.all([loadWorld(), loadPoi(), loadAddresses()]);
const chunks = new Chunks(world, mats, scene); const signs = new Signs(pois, scene);
const car = new Car(); car.setVehicle('depart', 0xb9b2a0, SPECS.depart.hp); scene.add(car.root);
const avatars = new AvatarFactory(); await avatars.load(import.meta.env.BASE_URL + 'assets/citizen.glb', import.meta.env.BASE_URL + 'assets/anims.glb');
const player = new Player(); player.attach(avatars); scene.add(player.root);

const av = world.roads.filter(r => r.n === 'Avenue de la Gare' && r.t === 'secondary').sort((a, b) => b.p.length - a.p.length)[0];
const si = parseInt(q.get('s') ?? '2'); const a = av.p[si], b = av.p[si + 1];
{ const t0 = performance.now(); chunks.mask = new GroundMask(world, a[0], a[1]); console.info(`carte d'occupation : ${(performance.now() - t0).toFixed(0)} ms`); }
const input = new Input(renderer.domElement); const hud = new Hud(); const minimap = new Minimap(world, pois);
const game = new Game(world, pois, car, player, input, hud, parseFloat(q.get('t') ?? '9'), { x: a[0], z: a[1], h: Math.atan2(b[0] - a[0], b[1] - a[1]) }, scene);
if (q.has('freeze')) game.clock.scale = 0;
// véhicules : stationnés, circulation, patrouilles
const graph = new RoadGraph(world.roads);
const vworld = new VehicleWorld(); vworld.populateParked(world.roads, game.coll, { x: a[0], z: a[1] }, 2600, +(q.get('parked') ?? 380));
for (const [t, dx, dz] of [['gendarmerie_berline', 0, 0], ['gendarmerie_berline', 6, 2], ['gendarmerie_fourgon', 12, 4]] as const) { const gx = -848 + dx, gz = -89 + dz; vworld.add({ type: t, paint: 0xf2f2f2, hp: SPECS[t].hp, x: gx, z: gz, h: 1.57, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 0 }); }
const traffic = new Traffic(graph, vworld, +(q.get('trafic') ?? 40), 2); const smoke = new Smoke(scene); const vrender = new VehicleRenderer(scene, 140);
game.props = chunks.props; game.attachVehicles(vworld, traffic, smoke, new Smoke(scene, 60), new Effects(scene));
const police = new Police(graph, vworld, traffic, game.coll); game.attachPolice(police);
if (q.has('fresh') || q.has('t')) Save.reset(); else if (game.restore()) hud.toast('Partie reprise.');
if (q.get('mode') === 'car') { game.mode = 'car'; player.root.visible = false; }
// habitants
const NPC_COUNT = +(q.get('npc') ?? 7350);   // population municipale INSEE 2023 (voir docs/hypotheses.md)
const npcs = buildPopulation(world, pois, game.interior.index, graph, addrs, { x: a[0], z: a[1] }, NPC_COUNT);
const sim = new NpcSim(npcs, graph); game.attachNpcs(npcs, sim); const npcRender = new NpcRenderer(scene, avatars, game.npcs); const panel = new ObservePanel();
panel.onQuit = () => { game.stopObserving(); panel.show(false); }; panel.onSpeed = x => game.setSpeed(x);
// missions : offres, journal, balise, suivi
const spotsOf = (types: string[]) => { const out: { x: number; z: number; nom: string }[] = []; for (const p of pois) { if (!types.includes(p.sous_type)) continue; const e = game.interior.index.entryOfPoi(p); if (e) out.push({ x: e.px + e.nx * 1.4, z: e.pz + e.nz * 1.4, nom: p.nom }); } return out; };
const dead: { x: number; z: number }[] = []; const nodes: { x: number; z: number }[] = []; graph.pts.forEach((p, i) => { const d = graph.degree(i); if (d === 1) dead.push({ x: p[0], z: p[1] }); if (d >= 2 && i % 9 === 0) nodes.push({ x: p[0], z: p[1] }); });
const schools = pois.filter(p => ['school', 'college', 'kindergarten'].includes(p.sous_type)).map(p => ({ x: p.x, z: p.y }));
const neutres0 = neutralSpots(dead, (x, z) => game.coll.resolve({ x, z }, 35).depth > 0, schools);
game.avatars = avatars; game.uw.setup(neutres0, graph.pts.filter((_, i) => i % 7 === 3 && graph.degree(i) >= 2).map(p => ({ x: p[0], z: p[1] })), schools, npcs); game.uw.buildMarkers(scene);
const neutres1 = neutres0.filter(s => ![game.uw.fence, ...game.uw.dens].some(d => d && d.x === s.x && d.z === s.z));
game.arson.attach(scene, (x, z) => { const i = graph.nearest(x, z, 60, true); if (i < 0) return null; const [px, pz] = graph.pts[i]; const e = graph.adj[i][0]; const q = e ? graph.pts[e.to] : [px + 1, pz]; const h = Math.atan2(q[0] - px, q[1] - pz); return { x: px + Math.cos(h) * 2.5, z: pz - Math.sin(h) * 2.5, h }; });
game.heists.setup(neutres1, scene, game.uw.roadDist); const heistSpots = game.heists.targets.map(t => t.id); void heistSpots;
const neutres = neutres1.filter((_, i) => i !== Math.floor(neutres1.length * 0.3) && i !== Math.floor(neutres1.length * 0.7)); game.kid.setup(neutres);
const mpanel = new MissionsPanel(); game.onOffers = () => mpanel.setOffers(game.offers, game.missions.rep, game.missions.active?.offer.titre ?? '');
mpanel.onAccept = o => game.startOffer(o); mpanel.onAbandon = () => { game.missions.abandon(); game.boarded = null; game.onOffers(); }; game.onMissionsKey = () => mpanel.toggle();
game.attachMissions({ commerces: spotsOf(['supermarket', 'bakery', 'butcher', 'greengrocer', 'pastry', 'variety_store', 'clothes', 'florist', 'books', 'convenience']), bureaux: spotsOf(['bank', 'estate_agent', 'employment_agency', 'insurance', 'lawyer', 'townhall', 'government', 'accountant', 'company']), neutres, nodes });
const beacon = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); beacon.add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 70, 20, 1, true).translate(0, 35, 0), m), new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 28).rotateX(-Math.PI / 2).translate(0, 0.25, 0), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.8, depthWrite: false, fog: false }))); beacon.visible = false; scene.add(beacon); }
// audio, qualité, réglages
const grass = new GrassField(scene, chunks.mask!);
const phoneTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = 'rgba(200,30,30,0.92)'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.font = '34px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📞', 32, 35); return new THREE.CanvasTexture(c); })();
const phones: THREE.Sprite[] = []; for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: phoneTex, depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.setScalar(0.045); sp.visible = false; sp.renderOrder = 10; scene.add(sp); phones.push(sp); } const audio = new AudioSys(); const settings = new Settings(); const touchDev = matchMedia('(pointer: coarse)').matches;
const quality = new AutoQuality(touchDev ? 'moyen' : 'eleve'); game.sfx = (n, v) => audio.sfx(n, v);
function applyQuality(l: Level) {
  const p = levelParams(l); renderer.setPixelRatio(p.pixelRatio); renderer.setSize(innerWidth, innerHeight); post.setLevel(l === 'bas' ? 'aucun' : l === 'moyen' ? 'moyen' : 'eleve'); post.setSize(innerWidth, innerHeight);
  env.sun.castShadow = p.shadows; if (env.sun.shadow.mapSize.x !== p.shadowSize) { env.sun.shadow.mapSize.set(p.shadowSize, p.shadowSize); env.sun.shadow.map?.dispose(); (env.sun.shadow as any).map = null; }
  if (!q.has('r')) VIEW = p.view; grass.enabled = l !== 'bas'; VEH_RANGE = p.vehicleRange; shadowRange = p.shadows ? p.shadowRange : 0; npcRender.limits = { pedMax: p.pedMax, avatars: p.avatars, range: p.npcRange }; traffic.count = p.trafficMax;
}
settings.onQuality = qv => { if (qv === 'auto') { quality.auto = true; } else { quality.auto = false; quality.set(qv); applyQuality(qv); } };
settings.onVolume = v => audio.setVolume(v); settings.onMute = m => audio.setMuted(m); audio.setVolume(settings.volume); audio.setMuted(settings.muted);
if (settings.quality !== 'auto') { quality.auto = false; quality.set(settings.quality); } if (q.has('r') || q.has('freeze')) quality.auto = false; applyQuality(quality.level);
let down: { x: number; y: number; t: number } | null = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null; if (moved < 9 && dt < 400 && !game.interior.inside) { const id = npcRender.pick(e.clientX, e.clientY, camera, innerWidth, innerHeight); if (id !== null) { game.observe(id); panel.show(true); } } });
addEventListener('keydown', e => { if (e.code === 'KeyO' && !game.observed) { const v = npcRender.visible[0]; if (v) { game.observe(v.id); panel.show(true); } } });
const statesArr: any[] = []; let statesMs = 0, rr = 0;
/** États des habitants : tous recalculés en ~0,3 s, par tranches réparties sur les images (pas d'à-coup). Chemins détaillés (A*) seulement à moins de 330 m. */
function updateStates(dt: number, fx: number, fz: number) {
  const t0 = performance.now(); const day = game.clock.day, hour = game.clock.hour; const N = npcs.length;
  const k = statesArr.length < N ? N : Math.min(N, Math.ceil(N * Math.min(1, Math.max(dt, 1 / 120) / 0.3)));
  for (let j = 0; j < k; j++) {
    const i = rr; rr = (rr + 1) % N; const n = npcs[i];
    let s = sim.stateAt(n, day, hour, false); const sel = game.observed?.id === n.id; const prev = game.states.get(n.id) ?? s;
    if (sel || Math.hypot(prev.x - fx, prev.z - fz) < 330 || Math.hypot(s.x - fx, s.z - fz) < 330) s = sim.stateAt(n, day, hour, true);
    if (game.boarded === n.id || game.uw.evacuated.has(n.id)) s = { ...s, kind: 'absent' as const }; game.states.set(n.id, s); statesArr[i] = s;
  }
  statesMs = statesMs * 0.9 + (performance.now() - t0) * 0.1;
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
let lastShadow = 0; let acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
chunks.update(game.pos.x, game.pos.z, VIEW); placeCamera(0);
document.getElementById('loading')?.remove();
// hors ligne : enregistre le service worker (uniquement en HTTPS, donc pas en développement local)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').then(reg => { const done = () => { if (!localStorage.getItem('pontcharra-offline')) { try { localStorage.setItem('pontcharra-offline', '1'); } catch { /* ignoré */ } hud.toast('Jeu enregistré sur l\'appareil : il fonctionne maintenant sans internet.', 5); } }; if (reg.active) done(); else reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', e => { if ((e.target as ServiceWorker).state === 'activated') done(); })); }).catch(() => { /* hors ligne indisponible */ }); (window as any).__ready = true;
(window as any).__game = { setQuality: (l: Level) => { quality.auto = false; quality.set(l); applyQuality(l); }, police, traffic, vworld, npcRender, npcStats: () => ({ ...npcRender.stats(), vehicules: vrender.count(), circulation: traffic.cars.length, garees: vworld.list.filter(v => v.kind === 'gare').length, habitants: npcs.length, majEtatsMs: +statesMs.toFixed(1) }), sync: () => { chunks.update(game.pos.x, game.pos.z, VIEW); signs.update(game.pos.x, game.pos.z); snap = true; placeCamera(0); }, game, car, player, camera, renderer, stats: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: chunks.loaded.size }) };

function frame(now: number) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; acc += dt;
  game.update(dt); const os = game.observed ? game.states.get(game.observed.id) : null; const fx = os ? os.x : game.pos.x, fz = os ? os.z : game.pos.z;
  chunks.update(fx, fz, VIEW); signs.update(fx, fz); updateStates(dt, fx, fz); placeCamera(dt);
  if (!game.interior.inside) npcRender.update(dt, statesArr, fx, fz, game.observed?.id ?? null, now, game.clock.scale, game.overrides()); if (game.observed && os) panel.update(game.observed, os, sim, game.clock.day, game.clock.hour, now, game.clock.scale); else if (panel.el.style.display !== 'none') panel.show(false);
  const lv = quality.update(dt); if (lv) applyQuality(lv);
  vrender.begin(); const flashOn = Math.floor(now / 280) % 2 ? 1 : 0.2;
  for (const v of vworld.list) { if (Math.abs(v.x - fx) > VEH_RANGE || Math.abs(v.z - fz) > VEH_RANGE) continue; vrender.add(v.type, v.paint, v.x, v.z, v.h, SPECS[v.type].police && (v.kind === 'patrouille' || v.kind === 'poursuite' || (v.kind === 'gare' && game.heat.stars > 0)) ? flashOn : 1, v.hp / SPECS[v.type].hp); }
  game.npcCars = []; for (const d of npcRender.drivers) { const n = game.npcs.get(d.id)!; const t = n.seed % 9 === 0 ? 'utilitaire' : CIVIL_TYPES[n.seed % CIVIL_TYPES.length]; vrender.add(t, PAINTS[(n.seed >> 3) % PAINTS.length], d.x, d.z, d.h); game.npcCars.push({ x: d.x, z: d.z, h: d.h, speed: d.speed, type: t }); }
  vrender.end(); car.setFlash(false);
  if (game.mode === 'car') hud.vehicle(car.spec.nom, Math.round(Math.abs(car.speed) * 3.6), Math.round(car.hp / car.spec.hp * 100), car.upgrade); else hud.hideVehicle();
  const { night, sunset } = env.set(game.clock.hour, os ? new THREE.Vector3(os.x, 0, os.z) : game.pos); if (game.interior.inside) renderer.toneMappingExposure = 0.95; game.night = night > 0.5;
  if (night > 0.2 && !car.lightsOn && !car.headlights[0].intensity) car.setLights(true); if (night <= 0.2 && car.lightsOn) car.setLights(false);
  if (night > 0.2) { const near = chunks.lamps.filter(l => Math.hypot(l.x - game.pos.x, l.z - game.pos.z) < 90).sort((p, q2) => p.distanceToSquared(game.pos) - q2.distanceToSquared(game.pos)); lampLights.forEach((l, i) => { const p = near[i]; l.intensity = p ? 140 : 0; if (p) l.position.set(p.x, 6.6, p.z); }); } else lampLights.forEach(l => (l.intensity = 0));
  { const ids = game.callers(); phones.forEach((sp, i) => { const id = ids[i]; const s0 = id !== undefined ? (game.npcCtl.get(id) ?? game.states.get(id)) : null; sp.visible = !!s0 && !game.interior.inside; if (s0) sp.position.set(s0.x, 2.4 + Math.sin(now * 0.008) * 0.08, s0.z); }); }
  { const st: string[] = []; if (game.mode === 'foot') { if (game.crouch) st.push(game.hidden ? '🌿 Caché' : '🧎 Accroupi'); if (game.hooded) st.push('Capuche'); if (game.weapon !== 'poings') st.push(game.weapon === 'pistolet' ? `🔫 ${game.uw.ammo} balle${game.uw.ammo > 1 ? 's' : ''}` : `🔨 ${({ bouteille: 'Bouteille', cle: 'Clé', barre: 'Barre', batte: 'Batte' } as Record<string, string>)[game.weapon]}`); }
    const U = game.uw; if (U.bag.length) st.push(`🎒 ${U.carried.toFixed(1)} kg`); if (U.trunk.length) st.push(`Coffre : ${U.trunk.length}`); if (U.bleeding) st.push('🩸 Saigne'); if (U.kits) st.push(`🩹 ${U.kits}`); if (U.tools.has('crochet')) st.push('🗝 Crochet'); if (game.arson.essence) st.push(`⛽ ${game.arson.essence}`); const E = game.enquete.open_.length; if (E) st.push(`🗂 ${E} enquête${E > 1 ? 's' : ''}${game.enquete.mandat ? ' · ⚠ MANDAT' : ''}`); if (game.kid.k) st.push('Otage'); if (game.heists.plan) st.push(`Plan : ${game.heists.plan.target.id === 'fourgon' ? 'fourgon' : 'entrepôt'}${game.heists.crew.size ? ` (${game.heists.crew.size} complice${game.heists.crew.size > 1 ? 's' : ''})` : ''}`);
    const p = game.profile; const sig = [p.outfit, p.vehicle, p.face ? 'visage' : null].filter(Boolean).join(' · '); if (game.heat.value > 0 && sig) st.push(`Signalement : ${sig}`); if (game.reports.length) st.push(`📞 ${game.reports.length} témoin${game.reports.length > 1 ? 's' : ''}`); hud.status(st.join(' · ')); }
  grass.update(dt, fx, fz); if (mats.water.normalMap) { mats.water.normalMap.offset.x += dt * 0.012; mats.water.normalMap.offset.y += dt * 0.007; }
  if (now - lastShadow > 700) { lastShadow = now; chunks.setShadowRange(fx, fz, shadowRange); }
  renderer.info.autoReset = false; renderer.info.reset();
  post.render(game.interior.inside ? game.interior.scene! : scene, camera, dt, game.interior.inside ? 0 : night, game.interior.inside ? 0 : sunset);
  audio.update(dt, { inCar: game.mode === 'car' && !game.interior.inside, speed: car.speed, throttle: Math.max(0, input.y), slip: car.slip, dead: car.dead, footSpeed: player.speed, inside: game.interior.inside, night: night > 0.4, policeDist: police.nearest, alert: game.heat.stars > 0, horn: input.horn });
  settings.setStats(`FPS ${Math.round(quality.fps)} · niveau ${quality.level}${quality.auto ? ' (auto)' : ''}<br>appels ${renderer.info.render.calls} · triangles ${(renderer.info.render.triangles / 1000).toFixed(0)} k · chunks ${chunks.loaded.size}`);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.update(game.needs, game.heat, game.money, game.inv, game.clock.label, game.clock.day);
  const mt = game.missionTarget() ?? game.crimeTarget(); minimap.draw(game.pos.x, game.pos.z, game.mode === 'car' ? car.heading : player.heading, now, mt, game.uw.markers());
  if (mt) { const d = Math.round(Math.hypot(mt.x - game.pos.x, mt.z - game.pos.z)); beacon.visible = true; beacon.position.set(mt.x, 0, mt.z); (beacon.children[0] as THREE.Mesh).scale.setScalar(1 + Math.sin(now * 0.004) * 0.08); const rem = game.missions.remaining(); hud.tracker(`🎯 ${mt.label}<br><span style="font-weight:400;opacity:.85">${d} m${rem !== null ? ' · ⏱ ' + Math.floor(rem / 60) + ':' + String(rem % 60).padStart(2, '0') : ''}</span>`); } else { beacon.visible = false; hud.tracker(null); }
  requestAnimationFrame(frame);
}
void acc; requestAnimationFrame(frame);
