import * as THREE from 'three';
import type { WorldData } from './world/data';
import { Collision } from './world/collision';
import type { Poi } from './world/poi';
import { Car, type Controls } from './vehicles/car';
import { SPECS } from './vehicles/specs';
import type { VehicleWorld, WVehicle } from './vehicles/world';
import type { Traffic, Obstacle } from './vehicles/traffic';
import type { Smoke } from './vehicles/smoke';
import type { Effects } from './vehicles/effects';
import type { Police } from './police/police';
import { witnessFactor, fineFor } from './police/rules';
import { Player } from './player/player';
import { Needs } from './survival/needs';
import { Heat } from './survival/heat';
import { Clock } from './core/clock';
import { Input } from './ui/input';
import { Hud } from './ui/hud';
import * as Save from './core/save';
import { InteriorManager } from './interiors/manager';
import { BuildingIndex } from './interiors/entry';
import type { Npc } from './npc/identity';
import { line } from './npc/dialogue';
import type { NpcSim, NpcState } from './npc/sim';

export type Mode = 'foot' | 'car';

/** Règles de jeu : déplacement, véhicule, besoins, interactions avec les commerces, sommeil, mort. */
export class Game {
  mode: Mode = 'foot'; sleeping = false; money = 40; inv = { nourriture: 1, eau: 1 }; looted = new Set<string>();
  needs = new Needs(); heat = new Heat(); clock: Clock; coll: Collision;
  vehicles!: VehicleWorld; traffic!: Traffic; smoke?: Smoke; tireSmoke?: Smoke; fx?: Effects; police?: Police; private ramT = 0; private speedMsg = 0; interior!: InteriorManager; observed: Npc | null = null; npcs = new Map<number, Npc>(); sim?: NpcSim; states = new Map<number, NpcState>(); talkCount = 0; camYaw = 0; camPitch = 0.28; private saveT = 0; private ctl: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  constructor(public world: WorldData, public pois: Poi[], public car: Car, public player: Player, public input: Input, public hud: Hud, startHour: number, private start: { x: number; z: number; h: number }, scene: THREE.Scene) {
    this.clock = new Clock(startHour); this.coll = new Collision(world.builds); this.respawn(false);
    this.interior = new InteriorManager(this, new BuildingIndex(world.builds, pois), scene);
  }
  attachVehicles(vw: VehicleWorld, tr: Traffic, smoke: Smoke, tire?: Smoke, fx?: Effects) { this.vehicles = vw; this.traffic = tr; this.smoke = smoke; this.tireSmoke = tire; this.fx = fx; }
  private obstacles(): Obstacle[] { const o: Obstacle[] = [{ x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading, speed: this.car.speed, L: this.car.spec.L }]; for (const u of this.police?.units ?? []) o.push({ x: u.v.x, z: u.v.z, h: u.v.h, speed: u.v.speed, L: SPECS[u.v.type].L }); return o; }
  /** Délit : n'est comptabilisé qu'en proportion de ce qui a été vu (gendarmerie à portée, témoin, personne). */
  crime(v: number) {
    let npcD: number | null = null; const px = this.pos.x, pz = this.pos.z;
    for (const s of this.states.values()) { if (s.kind === 'dedans' || s.kind === 'absent') continue; const d = Math.hypot(s.x - px, s.z - pz); if (d < (npcD ?? 1e9)) npcD = d; }
    const pd = this.police ? this.police.nearest : 999; this.heat.add(v * witnessFactor(pd < 999 ? pd : null, npcD));
  }
  /** Arrestation : amende, perte de la marchandise (inventaire), retour devant la gendarmerie, trois heures perdues. Pas de mort. */
  private arrest() {
    const stars = this.heat.stars; const fine = fineFor(this.money, stars); this.money -= fine; const lost = this.inv.nourriture + this.inv.eau; this.inv = { nourriture: 0, eau: 0 }; this.heat.value = 0; this.police?.clearAll();
    const gp = this.pois.find(p => p.sous_type === 'police' && /gendarmerie/i.test(p.nom)) ?? { x: -848, y: -89 }; this.mode = 'foot'; this.player.root.visible = true; this.player.pos.set(gp.x + 3, 0, gp.y + 6); this.camYaw = 0; this.car.speed = 0; this.clock.hour += 3; this.needs.tick(3, false);
    this.hud.toast(`ARRESTATION — amende ${fine} €${lost ? `, marchandise saisie (${lost})` : ''}. Vous sortez de la gendarmerie.`, 7);
  }
  attachPolice(p: Police) { this.police = p; }
  private policeUpdate(dt: number) {
    if (this.ramT > 0) this.ramT -= dt; if (!this.police) return; const inCar = this.mode === 'car'; const out = this.police.update(dt, { px: this.pos.x, pz: this.pos.z, pspeed: inCar ? Math.abs(this.car.speed) : this.player.speed, heading: this.car.heading, inCar, stars: this.heat.stars }, this.heat);
    if (out.speeding) { this.crime(8); this.hud.toast('Excès de vitesse repéré par une patrouille !', 2.5); }
    this.hud.alert(this.heat.stars, out.seen); if (out.arrested) this.arrest();
  }
  nearestVehicle(maxD = 3.6): WVehicle | null { let b: WVehicle | null = null, bd = maxD; for (const v of this.vehicles.near(this.player.pos.x, this.player.pos.z, maxD + 3)) { const d = Math.hypot(v.x - this.player.pos.x, v.z - this.player.pos.z); if (d < bd) { bd = d; b = v; } } return b; }
  /** Monter dans un véhicule du monde (garé : vol discret ; en circulation et arrêté : car-jacking). Le véhicule actuel est laissé sur place. */
  private enterWorldVehicle(v: WVehicle): boolean {
    const sp = SPECS[v.type];
    if (sp.police) { this.hud.toast('Impossible de prendre un véhicule de gendarmerie.'); return false; }
    if (v.kind !== 'gare' && Math.abs(v.speed) > 2) { this.hud.toast('Il roule trop vite pour monter.'); return false; }
    if (!v.mine) {
      if (v.kind === 'trafic') { this.crime(35); this.hud.toast(`Vous arrachez le conducteur de sa ${sp.nom.toLowerCase()} !`); }
      else { this.crime(14); if (Math.random() < 0.25) { this.crime(12); this.hud.toast('L\'alarme se déclenche !'); } else this.hud.toast(`Vous forcez la ${sp.nom.toLowerCase()}.`); }
    } else this.hud.toast(`Vous montez dans votre ${sp.nom.toLowerCase()}.`);
    if (v.kind === 'trafic') this.traffic.release(v); this.vehicles.remove(v);
    const c = this.car; this.vehicles.add({ type: c.spec.type, paint: c.paint, hp: c.hp, x: c.pos.x, z: c.pos.z, h: c.heading, speed: 0, kind: 'gare', mine: true, upgrade: c.upgrade, stun: 0 });
    c.setVehicle(v.type, v.paint, v.hp, v.upgrade); c.pos.set(v.x, 0, v.z); c.heading = v.h; c.speed = 0; c.root.position.copy(c.pos); c.root.rotation.y = c.heading; v.mine = true; return true;
  }
  /** Garage (atelier/station) : réparation puis amélioration du moteur. */
  private garage() {
    const p = this.nearestPoi(32); if (!p || !['car_repair', 'car', 'gas'].includes(p.sous_type)) { this.hud.toast('Aucun garage à proximité.'); return; }
    const c = this.car; if (Math.abs(c.speed) > 1) { this.hud.toast('Arrêtez-vous d\'abord.'); return; }
    if (c.hp < c.spec.hp - 0.5) { const cost = Math.ceil((c.spec.hp - c.hp) * 1.5); if (this.money < cost) { this.hud.toast(`Réparation : ${cost} € (il vous manque ${cost - this.money} €).`); return; } this.money -= cost; c.repair(); this.hud.toast(`Véhicule réparé chez ${p.nom} (−${cost} €).`); }
    else if (c.upgrade < 3) { const cost = 300 * (c.upgrade + 1); if (this.money < cost) { this.hud.toast(`Moteur niveau ${c.upgrade + 1} : ${cost} €.`); return; } this.money -= cost; c.upgrade++; this.hud.toast(`Moteur amélioré, niveau ${c.upgrade} (−${cost} €).`); }
    else this.hud.toast('Véhicule déjà au maximum.');
  }
  attachNpcs(list: Npc[], sim: NpcSim) { this.sim = sim; list.forEach(n => this.npcs.set(n.id, n)); }
  observe(id: number) { const n = this.npcs.get(id); if (!n) return; if (this.sleeping) this.wake(); this.observed = n; this.clock.scale = 1; this.hud.toast(`Observation : ${n.prenom} ${n.nom} (Échap pour quitter)`, 3); }
  stopObserving() { this.observed = null; this.clock.scale = 1; this.hud.prompt(''); }
  setSpeed(x: number) { this.clock.scale = x; }
  nearNpc(maxD = 2.8): NpcState | null { let b: NpcState | null = null, bd = maxD; for (const s of this.states.values()) { if (s.kind !== 'marche' && s.kind !== 'dehors') continue; const d = Math.hypot(s.x - this.player.pos.x, s.z - this.player.pos.z); if (d < bd) { bd = d; b = s; } } return b; }
  respawn(penalty: boolean) {
    this.car.pos.set(this.start.x, 0, this.start.z); this.car.heading = this.start.h; this.car.speed = 0;
    this.player.pos.set(this.start.x + Math.cos(this.start.h) * 3, 0, this.start.z - Math.sin(this.start.h) * 3); this.player.heading = this.start.h; this.camYaw = this.start.h; this.mode = 'foot';
    if (penalty) { this.needs = new Needs(); this.money = Math.floor(this.money / 2); this.heat.value = 0; this.inv = { nourriture: 0, eau: 0 }; }
  }
  restore() {
    const s = Save.load(); if (!s) return false;
    this.player.pos.set(s.px, 0, s.pz); this.player.heading = s.heading; this.mode = s.mode; this.car.pos.set(s.car.x, 0, s.car.z); this.car.heading = s.car.h; if (s.car.type) this.car.setVehicle(s.car.type, s.car.paint ?? 0xb9b2a0, s.car.hp ?? 60, s.car.up ?? 0); for (const g of s.garage ?? []) this.vehicles.add({ type: g.type, paint: g.paint, hp: g.hp, x: g.x, z: g.z, h: g.h, speed: 0, kind: 'gare', mine: true, upgrade: g.up ?? 0, stun: 0 });
    this.needs = new Needs(s.needs); this.money = s.money; this.inv = s.inv; this.heat.value = s.heat; this.clock.hour = s.hour; this.clock.day = s.day; this.looted = new Set(s.looted); this.camYaw = s.heading; return true;
  }
  persist() { Save.save({ px: this.player.pos.x, pz: this.player.pos.z, heading: this.player.heading, mode: this.mode, car: { x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading, type: this.car.spec.type, paint: this.car.paint, hp: this.car.hp, up: this.car.upgrade }, garage: this.vehicles.list.filter(v => v.mine).map(v => ({ type: v.type, paint: v.paint, hp: v.hp, x: v.x, z: v.z, h: v.h, up: v.upgrade })), needs: this.needs.s, money: this.money, inv: this.inv, heat: this.heat.value, hour: this.clock.hour, day: this.clock.day, looted: [...this.looted] }); }
  get pos() { return this.mode === 'car' ? this.car.pos : this.player.pos; }
  nearestPoi(maxD = 16) { let best: Poi | null = null, bd = maxD; for (const p of this.pois) { const d = Math.hypot(p.x - this.pos.x, p.y - this.pos.z); if (d < bd) { bd = d; best = p; } } return best; }
  dow() { return (this.clock.day - 1 + 2) % 7; } // le jour 1 est un mercredi (hypothèse)

  update(dt: number) {
    const inp = this.input; inp.poll(); const [lx, ly] = inp.takeLook();
    this.camYaw -= lx * 0.0055; this.camPitch = THREE.MathUtils.clamp(this.camPitch + ly * 0.004, -0.15, 1.1);
    if (this.observed) {   // mode observation : le joueur est spectateur (besoins figés), le temps peut être accéléré
      if (inp.hit('Escape', 'quit')) this.stopObserving(); this.clock.tick(dt); this.hud.veil(0); this.hud.tick(dt); this.hud.prompt('Échap : quitter l\'observation'); return;
    }
    this.interior.tick(dt);
    if (this.interior.inside) this.interior.update(dt); else if (this.sleeping) this.updateSleep(dt); else if (this.mode === 'car') this.updateCar(dt); else this.updateFoot(dt);
    if (this.sleeping && !this.interior.inside && Math.random() < dt * 0.02) { this.wake(); this.crime(12); this.hud.toast('Du bruit vous réveille : on vous a repéré.'); }
    if (this.sleeping && (inp.hit('KeyR', 'sleep') || this.needs.s.energie >= 98)) this.wake();
    this.traffic.update(dt, this.pos.x, this.pos.z, this.obstacles()); this.policeUpdate(dt);
    const h = this.clock.tick(dt); this.needs.tick(h, this.sleeping, this.mode === 'foot' && inp.run && this.player.speed > 3 ? 1.8 : 1);
    this.heat.tick(h, this.mode === 'foot' && this.player.speed < 1);
    if (!this.interior.busy) this.hud.veil(this.sleeping ? 0.75 : this.needs.s.energie < 8 ? 0.35 : 0); this.hud.tick(dt);
    if (this.needs.dead) { this.hud.toast('Vous êtes à bout… vous revenez à vous, sans grand-chose.', 5); this.respawn(true); }
    this.ctl.throttle = 0; if ((this.saveT += dt) > 8) { this.saveT = 0; this.persist(); }
    if (!this.interior.inside) this.contextual();
  }
  private wake() { this.sleeping = false; this.clock.scale = 1; this.hud.toast('Vous vous réveillez.'); }
  private updateSleep(dt: number) { this.clock.scale = 12; this.car.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }); }
  private updateFoot(dt: number) {
    const inp = this.input, p = this.player;
    p.update(dt, inp.x, inp.y, this.camYaw, inp.run, this.needs.speedFactor);
    this.coll.resolve(p.pos as any, p.radius);
    p.root.position.copy(p.pos); this.car.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }); this.collideCar();
    const dCar = Math.hypot(this.car.pos.x - p.pos.x, this.car.pos.z - p.pos.z);
    if (inp.hit('KeyE', 'action')) {
      if (dCar < 4.2) { this.mode = 'car'; p.root.visible = false; this.hud.toast('Vous montez dans la voiture.'); }
      else if (this.nearestVehicle()) { const v = this.nearestVehicle()!; if (this.enterWorldVehicle(v)) { this.mode = 'car'; p.root.visible = false; } }
      else { const n = this.nearNpc(); if (n) { const npc = this.npcs.get(n.id)!; this.hud.toast(line(npc, n, this.clock.hour, this.talkCount++), 5); } else this.interior.tryEnter(); }
    }
    inp.hit('KeyF', 'steal');
    this.consumables(); this.bodyActions();
  }
  private updateCar(dt: number) {
    const inp = this.input, c = this.ctl;
    c.throttle = Math.max(0, inp.y); c.brake = Math.max(0, -inp.y); c.steer = -inp.x; c.handbrake = inp.handbrake;
    this.car.update(dt, c); this.collideCar(); this.engineSmoke(dt); this.drivingEffects(dt);
    this.player.pos.copy(this.car.pos);
    if (inp.hit('KeyG', 'garage')) this.garage();
    if (inp.hit('KeyE', 'action')) {
      const f = this.car.heading, off = new THREE.Vector3(Math.cos(f) * 2.0, 0, -Math.sin(f) * 2.0); const np = this.car.pos.clone().add(off);
      this.coll.resolve(np as any, this.player.radius); this.player.pos.copy(np); this.player.heading = f; this.camYaw = f; this.mode = 'foot'; this.player.root.visible = true; this.car.speed = 0; this.hud.toast('Vous descendez.');
    }
    if (inp.hit('KeyL', 'lights')) this.car.setLights(!this.car.lightsOn);
    this.consumables(); this.bodyActions();
  }
  private collideCar() {
    const c = this.car, fx = Math.sin(c.heading), fz = Math.cos(c.heading); let hit = 0; const v0 = Math.abs(c.speed);
    for (const o of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) { const q = { x: c.pos.x + fx * o, z: c.pos.z + fz * o }; const r = this.coll.resolve(q, c.spec.W / 2 + 0.1); if (r.depth > 0) { c.pos.x += q.x - (c.pos.x + fx * o); c.pos.z += q.z - (c.pos.z + fz * o); hit = Math.max(hit, r.depth); } }
    if (hit > 0.02) { c.speed *= 1 - Math.min(0.6, hit * 3) * 0.5; if (v0 > 4) this.crash(Math.min(1, hit * 2.5) * v0 * 1.4); }
    // autres véhicules (garés ou en circulation)
    for (const v of this.vehicles.near(c.pos.x, c.pos.z, 9)) {
      const sp = SPECS[v.type]; const vx = Math.sin(v.h), vz = Math.cos(v.h); let worst = 0, nx = 0, nz = 0;
      for (const co of [-0.3, 0.3]) for (const po of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) {
        const ax = c.pos.x + fx * po, az = c.pos.z + fz * po, bx = v.x + vx * sp.L * co, bz = v.z + vz * sp.L * co; const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), r = c.spec.W / 2 + sp.W / 2 - 0.1;
        if (d < r && d > 1e-4) { const pen = r - d; if (pen > worst) { worst = pen; nx = dx / d; nz = dz / d; } }
      }
      if (worst > 0) {
        c.pos.x += nx * worst * 0.6; c.pos.z += nz * worst * 0.6; v.x -= nx * worst * 0.4; v.z -= nz * worst * 0.4;
        const rel = Math.abs(c.speed - v.speed * (vx * fx + vz * fz)); if (rel > 2.5) { this.crash(rel * 1.8); v.hp = Math.max(0, v.hp - rel * 2.2 / sp.mass); if (sp.police) { v.stun = 1.2; if ((this.ramT -= 0) <= 0 && rel > 3) { this.crime(15); this.ramT = 3; this.hud.toast('Vous percutez un véhicule de gendarmerie !', 2); } } else if (v.kind !== 'gare') { v.stun = 3; if (rel > 5) this.crime(4); } else if (rel > 6) this.crime(2); }
        c.speed *= 0.55;
      }
    }
  }
  private crash(dmg: number) { if (dmg < 1.2) return; const fx = Math.sin(this.car.heading), fz = Math.cos(this.car.heading); this.fx?.burst(this.car.pos.x + fx * this.car.spec.L * 0.45, 0.6, this.car.pos.z + fz * this.car.spec.L * 0.45, Math.min(30, Math.round(dmg))); if (this.car.damage(dmg)) this.hud.toast('Le moteur est en panne !', 4); else if (dmg > 12) this.hud.toast('Gros choc !', 1.5); }
  drivingEffects(dt: number) {
    const c = this.car, fx = Math.sin(c.heading), fz = Math.cos(c.heading), rx = fz, rz = -fx, back = -c.spec.wheelbase / 2, track = c.spec.W / 2 - 0.2;
    for (const sg of [-1, 1]) { const x = c.pos.x + fx * back + rx * track * sg, z = c.pos.z + fz * back + rz * track * sg; const id = 'w' + sg; if (c.slip) { this.fx?.skid(id, x, z, c.heading); this.tireSmoke?.emit(x, 0.25, z, 0.5, dt * 0.6, true); } else this.fx?.endSkid(id); }
    this.fx?.update(dt); this.tireSmoke?.update(dt);
  }
  engineSmoke(dt: number) { const c = this.car; const k = 1 - c.hp / c.spec.hp; if (k > 0.45 && this.smoke) { const fx = Math.sin(c.heading), fz = Math.cos(c.heading); this.smoke.emit(c.pos.x + fx * c.spec.L * 0.3, 1.1, c.pos.z + fz * c.spec.L * 0.3, Math.min(1, (k - 0.45) * 1.9), dt); } this.smoke?.update(dt); }
  private consumables() {
    const inp = this.input;
    if (inp.hit('Digit1', 'eat')) { if (this.inv.nourriture > 0) { this.inv.nourriture--; this.needs.eat(38); this.hud.toast('Vous mangez. Ça fait du bien.'); } else this.hud.toast('Vous n\'avez rien à manger.'); }
    if (inp.hit('Digit2', 'drink')) { if (this.inv.eau > 0) { this.inv.eau--; this.needs.drink(40); this.hud.toast('Vous buvez.'); } else this.hud.toast('Vous n\'avez rien à boire.'); }
  }
  private bodyActions() {
    const inp = this.input;
    if (inp.hit('KeyR', 'sleep')) { if (this.sleeping) return; if (this.mode === 'foot' && this.player.speed > 0.5) return; this.sleeping = true; this.hud.toast('Vous vous endormez… (R pour vous réveiller)'); }
    if (inp.hit('KeyX', 'pee')) {
      this.needs.relieve(); const day = this.clock.hour > 7 && this.clock.hour < 23;
      const seen = day && this.nearestPoi(40) !== null && Math.random() < 0.55; if (seen) { this.crime(18); this.hud.toast('Quelqu\'un vous a vu… on va en parler.'); } else this.hud.toast('Soulagé. Personne n\'a rien vu.');
    }
  }
  private contextual() {
    if (this.police && this.police.arrestTimer > 0.2) { this.hud.prompt(`ARRESTATION… ${Math.round(Math.min(1, this.police.arrestTimer / 2.5) * 100)} % — bougez pour fuir !`); return; }
    if (this.sleeping) { this.hud.prompt('R : se réveiller'); return; }
    if (this.interior.busy) { this.hud.prompt(''); return; }
    if (this.mode === 'car') { const gp = this.nearestPoi(32); const gar = gp && ['car_repair', 'car', 'gas'].includes(gp.sous_type) && Math.abs(this.car.speed) < 1; this.hud.prompt(`E : descendre · L : phares${gar ? ' · G : garage' : ''}`); return; }
    const dCar = Math.hypot(this.car.pos.x - this.player.pos.x, this.car.pos.z - this.player.pos.z); if (dCar < 4.2) { this.hud.prompt(`E : monter dans votre ${this.car.spec.nom.toLowerCase()}`); return; }
    const nv = this.nearestVehicle(); if (nv) { const sp = SPECS[nv.type]; this.hud.prompt(sp.police ? sp.nom : nv.mine ? `E : monter (${sp.nom.toLowerCase()})` : `E : voler cette ${sp.nom.toLowerCase()}`); return; }
    const nn = this.nearNpc(); if (nn) { const npc = this.npcs.get(nn.id)!; this.hud.prompt(npc.minor ? `${npc.prenom} (élève)` : `E : parler à ${npc.prenom} ${npc.nom} · toucher : observer`); return; }
    this.hud.prompt(this.interior.nearDoorPrompt());
  }
}
