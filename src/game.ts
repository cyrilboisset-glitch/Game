import * as THREE from 'three';
import type { WorldData } from './world/data';
import { Collision } from './world/collision';
import { isOpen, FOOD_TYPES, type Poi } from './world/poi';
import { Car, type Controls } from './vehicles/car';
import { Player } from './player/player';
import { Needs } from './survival/needs';
import { Heat } from './survival/heat';
import { Clock } from './core/clock';
import { Input } from './ui/input';
import { Hud } from './ui/hud';
import * as Save from './core/save';

export type Mode = 'foot' | 'car';
const rr = (a: number, b: number) => a + Math.random() * (b - a);

/** Règles de jeu : déplacement, véhicule, besoins, interactions avec les commerces, sommeil, mort. */
export class Game {
  mode: Mode = 'foot'; sleeping = false; money = 40; inv = { nourriture: 1, eau: 1 }; looted = new Set<string>();
  needs = new Needs(); heat = new Heat(); clock: Clock; coll: Collision;
  camYaw = 0; camPitch = 0.28; private saveT = 0; private ctl: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  constructor(public world: WorldData, public pois: Poi[], public car: Car, public player: Player, public input: Input, public hud: Hud, startHour: number, private start: { x: number; z: number; h: number }) {
    this.clock = new Clock(startHour); this.coll = new Collision(world.builds); this.respawn(false);
  }
  respawn(penalty: boolean) {
    this.car.pos.set(this.start.x, 0, this.start.z); this.car.heading = this.start.h; this.car.speed = 0;
    this.player.pos.set(this.start.x + Math.cos(this.start.h) * 3, 0, this.start.z - Math.sin(this.start.h) * 3); this.player.heading = this.start.h; this.camYaw = this.start.h; this.mode = 'foot';
    if (penalty) { this.needs = new Needs(); this.money = Math.floor(this.money / 2); this.heat.value = 0; this.inv = { nourriture: 0, eau: 0 }; }
  }
  restore() {
    const s = Save.load(); if (!s) return false;
    this.player.pos.set(s.px, 0, s.pz); this.player.heading = s.heading; this.mode = s.mode; this.car.pos.set(s.car.x, 0, s.car.z); this.car.heading = s.car.h;
    this.needs = new Needs(s.needs); this.money = s.money; this.inv = s.inv; this.heat.value = s.heat; this.clock.hour = s.hour; this.clock.day = s.day; this.looted = new Set(s.looted); this.camYaw = s.heading; return true;
  }
  persist() { Save.save({ px: this.player.pos.x, pz: this.player.pos.z, heading: this.player.heading, mode: this.mode, car: { x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading }, needs: this.needs.s, money: this.money, inv: this.inv, heat: this.heat.value, hour: this.clock.hour, day: this.clock.day, looted: [...this.looted] }); }
  get pos() { return this.mode === 'car' ? this.car.pos : this.player.pos; }
  nearestPoi(maxD = 16) { let best: Poi | null = null, bd = maxD; for (const p of this.pois) { const d = Math.hypot(p.x - this.pos.x, p.y - this.pos.z); if (d < bd) { bd = d; best = p; } } return best; }
  private dow() { return (this.clock.day - 1 + 2) % 7; } // le jour 1 est un mercredi (hypothèse)

  update(dt: number) {
    const inp = this.input; inp.poll(); const [lx, ly] = inp.takeLook();
    this.camYaw -= lx * 0.0055; this.camPitch = THREE.MathUtils.clamp(this.camPitch + ly * 0.004, -0.15, 1.1);
    if (this.sleeping) this.updateSleep(dt); else if (this.mode === 'car') this.updateCar(dt); else this.updateFoot(dt);
    if (this.sleeping && (inp.hit('KeyR', 'sleep') || this.needs.s.energie >= 98)) this.wake();
    const h = this.clock.tick(dt); this.needs.tick(h, this.sleeping, this.mode === 'foot' && inp.run && this.player.speed > 3 ? 1.8 : 1);
    this.heat.tick(h, this.mode === 'foot' && this.player.speed < 1);
    this.hud.veil(this.sleeping ? 0.75 : this.needs.s.energie < 8 ? 0.35 : 0); this.hud.tick(dt);
    if (this.needs.dead) { this.hud.toast('Vous êtes à bout… vous revenez à vous, sans grand-chose.', 5); this.respawn(true); }
    this.ctl.throttle = 0; if ((this.saveT += dt) > 8) { this.saveT = 0; this.persist(); }
    this.contextual();
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
      else this.interactPoi(false);
    }
    if (inp.hit('KeyF', 'steal')) this.interactPoi(true);
    this.consumables(); this.bodyActions();
  }
  private updateCar(dt: number) {
    const inp = this.input, c = this.ctl;
    c.throttle = Math.max(0, inp.y); c.brake = Math.max(0, -inp.y); c.steer = -inp.x; c.handbrake = inp.handbrake;
    this.car.update(dt, c); this.collideCar();
    this.player.pos.copy(this.car.pos);
    if (inp.hit('KeyE', 'action')) {
      const f = this.car.heading, off = new THREE.Vector3(Math.cos(f) * 2.0, 0, -Math.sin(f) * 2.0); const np = this.car.pos.clone().add(off);
      this.coll.resolve(np as any, this.player.radius); this.player.pos.copy(np); this.player.heading = f; this.camYaw = f; this.mode = 'foot'; this.player.root.visible = true; this.car.speed = 0; this.hud.toast('Vous descendez.');
    }
    if (inp.hit('KeyL', 'lights')) this.car.setLights(!this.car.lightsOn);
    this.consumables(); this.bodyActions();
  }
  private collideCar() {
    const c = this.car, fx = Math.sin(c.heading), fz = Math.cos(c.heading); let hit = 0;
    for (const o of [-1.4, 0, 1.4]) { const q = { x: c.pos.x + fx * o, z: c.pos.z + fz * o }; const r = this.coll.resolve(q, 1.05); if (r.depth > 0) { c.pos.x += q.x - (c.pos.x + fx * o); c.pos.z += q.z - (c.pos.z + fz * o); hit = Math.max(hit, r.depth); } }
    if (hit > 0.02) c.speed *= 1 - Math.min(0.6, hit * 3) * 0.5;
  }
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
      const seen = day && this.nearestPoi(40) !== null && Math.random() < 0.55; if (seen) { this.heat.add(18); this.hud.toast('Quelqu\'un vous a vu… on va en parler.'); } else this.hud.toast('Soulagé. Personne n\'a rien vu.');
    }
  }
  private interactPoi(steal: boolean) {
    const p = this.nearestPoi(); if (!p) return; const open = isOpen(p.horaires, p.sous_type, this.clock.hour, this.dow());
    if (!FOOD_TYPES.has(p.sous_type)) { this.hud.toast(`${p.nom} : rien à prendre ici pour l'instant.`); return; }
    if (open && !steal) { if (this.money < 5) { this.hud.toast('Pas assez d\'argent (5 €).'); return; } this.money -= 5; this.inv.nourriture++; this.inv.eau++; this.hud.toast(`Achat chez ${p.nom} : 1 repas + 1 eau (−5 €).`); }
    else if (open) { this.inv.nourriture++; this.inv.eau++; this.heat.add(24); this.hud.toast(Math.random() < 0.35 ? 'Le vendeur vous a vu ! Fuyez.' : 'Vol discret… pour l\'instant.'); if (Math.random() < 0.35) this.heat.add(22); }
    else { const key = p.id + ':' + this.clock.day; if (this.looted.has(key)) { this.hud.toast('Déjà vidé aujourd\'hui.'); return; } this.looted.add(key); const gain = Math.round(rr(15, 70)); this.money += gain; this.inv.nourriture++; this.inv.eau++; this.heat.add(45); const alarm = Math.random() < 0.4; if (alarm) this.heat.add(25); this.hud.toast(`Vitrine brisée chez ${p.nom} : +${gain} €${alarm ? ' — ALARME !' : ''}`); }
  }
  private contextual() {
    if (this.sleeping) { this.hud.prompt('R : se réveiller'); return; }
    if (this.mode === 'car') { this.hud.prompt('E : descendre · L : phares'); return; }
    const dCar = Math.hypot(this.car.pos.x - this.player.pos.x, this.car.pos.z - this.player.pos.z); if (dCar < 4.2) { this.hud.prompt('E : monter dans la voiture'); return; }
    const p = this.nearestPoi(); if (!p) { this.hud.prompt(''); return; }
    const open = isOpen(p.horaires, p.sous_type, this.clock.hour, this.dow());
    if (!FOOD_TYPES.has(p.sous_type)) this.hud.prompt(`${p.nom} — ${open ? 'ouvert' : 'fermé'}`);
    else this.hud.prompt(open ? `${p.nom} (ouvert) — E : acheter 5 € · F : voler` : `${p.nom} (fermé) — E : briser la vitrine`);
  }
}
