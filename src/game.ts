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
import { Missions } from './missions/missions';
import { makeOffers, type Offer, type GenCtx } from './missions/generator';
import { witnessFactor, fineFor } from './police/rules';
import { circleVsBox, type PropColliders } from './world/solids';
import type { VehicleType } from './vehicles/specs';
import { NpcControl } from './crime/npcControl';
import { gatherWitnesses, describe as describeWitness, merge, recognizability, sightRange, reportDelay, type Profile } from './crime/perception';
import { findTarget, isBehind, hitDamage, WEAPONS, type WeaponId } from './crime/combat';
import { Underworld } from './crime/underworld';
import type { AvatarFactory } from './player/avatar';
const COLOR_NAMES: [number, string][] = [[0x3d4f6b, 'bleu'], [0x7a2f2f, 'bordeaux'], [0x2f5a3d, 'vert'], [0x555a63, 'gris'], [0x8a6a2f, 'moutarde'], [0x2a2a2f, 'noir'], [0x6b4a7a, 'violet'], [0x9a9a9a, 'gris clair'], [0x1f3f5f, 'marine'], [0x7f3f1f, 'marron'], [0xe8e8e8, 'blanc'], [0x1c1c1f, 'noir'], [0x8a1c1c, 'rouge'], [0x1f3f78, 'bleu'], [0x4f5358, 'gris'], [0xb9bcc0, 'argent'], [0xc9b06a, 'beige'], [0x7a4a2a, 'marron'], [0xd0d0d0, 'blanc'], [0x2a2a60, 'bleu nuit'], [0xa04a1a, 'orange'], [0xb9b2a0, 'beige'], [0xf2f2f2, 'blanc']];
const colorName = (h: number) => { let best = 'gris', bd = 1e9; const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; for (const [c, n] of COLOR_NAMES) { const d = (((c >> 16) & 255) - r) ** 2 + (((c >> 8) & 255) - g) ** 2 + ((c & 255) - b) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
const HOODIES = [0x3d4f6b, 0x7a2f2f, 0x2f5a3d, 0x555a63, 0x8a6a2f, 0x2a2a2f, 0x6b4a7a, 0x9a9a9a, 0x1f3f5f, 0x7f3f1f], JEANS = [0x2f4a7a, 0x1f2f4f, 0x3a3a40, 0x4a5a7a, 0x20242b, 0x5a4a3a];
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
  vehicles!: VehicleWorld; traffic!: Traffic; smoke?: Smoke; tireSmoke?: Smoke; fx?: Effects; police?: Police; missions = new Missions(); offers: Offer[] = []; private mbase?: Omit<GenCtx, 'day' | 'rep' | 'at' | 'seed'>; private offerDay = -1; boarded: number | null = null; props?: PropColliders; npcCars: { x: number; z: number; h: number; speed: number; type: VehicleType }[] = []; npcCtl = new NpcControl(); reports: { witness: number; due: number; v: number; desc: Profile }[] = []; profile: Profile = { outfit: null, vehicle: null, face: false };
  uw = new Underworld(this); avatars?: AvatarFactory; private schools: { x: number; z: number }[] = [];
  crouch = false; hidden = false; night = false; weapons = new Set<WeaponId>(['poings']); weapon: WeaponId = 'poings'; private attackCd = 0; downT = 0; private t = 0; vis = 1; dealerSel = 0; onMissionsKey: () => void = () => {}; sfx: (n: string, v?: number) => void = () => {}; onOffers: () => void = () => {}; private ramT = 0; private speedMsg = 0; interior!: InteriorManager; observed: Npc | null = null; npcs = new Map<number, Npc>(); sim?: NpcSim; states = new Map<number, NpcState>(); talkCount = 0; camYaw = 0; camPitch = 0.28; private saveT = 0; private ctl: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  constructor(public world: WorldData, public pois: Poi[], public car: Car, public player: Player, public input: Input, public hud: Hud, startHour: number, private start: { x: number; z: number; h: number }, scene: THREE.Scene) {
    this.clock = new Clock(startHour); this.coll = new Collision(world.builds); this.respawn(false);
    this.interior = new InteriorManager(this, new BuildingIndex(world.builds, pois), scene); this.schools = pois.filter(p => ['school', 'college', 'kindergarten'].includes(p.sous_type)).map(p => ({ x: p.x, z: p.y }));
  }
  attachVehicles(vw: VehicleWorld, tr: Traffic, smoke: Smoke, tire?: Smoke, fx?: Effects) { this.vehicles = vw; this.traffic = tr; this.smoke = smoke; this.tireSmoke = tire; this.fx = fx; }
  private obstacles(): Obstacle[] { const o: Obstacle[] = [{ x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading, speed: this.car.speed, L: this.car.spec.L }]; if (this.mode === 'foot' && !this.interior.inside) o.push({ x: this.player.pos.x, z: this.player.pos.z, h: this.player.heading, speed: 0, L: 1.2 }); for (const w of this.walkersNear(this.pos.x, this.pos.z, 160)) o.push({ x: w.x, z: w.z, h: w.h, speed: 0, L: 1.2 }); for (const u of this.police?.units ?? []) o.push({ x: u.v.x, z: u.v.z, h: u.v.h, speed: u.v.speed, L: SPECS[u.v.type].L }); return o; }
  /** Véhicules proches sous forme de boîtes orientées (garés, circulation, gendarmerie, voitures des habitants, et la sienne quand on est à pied). */
  vehicleBoxes(x: number, z: number, r: number, includeOwn: boolean) {
    const out: { x: number; z: number; h: number; hl: number; hw: number; speed: number; v?: WVehicle }[] = [];
    for (const v of this.vehicles.near(x, z, r)) { const sp = SPECS[v.type]; out.push({ x: v.x, z: v.z, h: v.h, hl: sp.L / 2, hw: sp.W / 2, speed: v.speed, v }); }
    for (const d of this.npcCars) if (Math.abs(d.x - x) < r && Math.abs(d.z - z) < r) { const sp = SPECS[d.type]; out.push({ x: d.x, z: d.z, h: d.h, hl: sp.L / 2, hw: sp.W / 2, speed: d.speed }); }
    if (includeOwn) out.push({ x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading, hl: this.car.spec.L / 2, hw: this.car.spec.W / 2, speed: this.car.speed });
    return out;
  }
  outfitId() { return `sweat ${colorName(this.player.outfit.hoodie)}`; }
  vehicleId() { return this.mode === 'car' ? `${this.car.spec.nom.toLowerCase()} ${colorName(this.car.paint)}` : null; }
  get hooded() { return !!this.player.outfit.hoodUp; }
  /** Nouvelle tenue (armoire, boutique de vêtements) : couleurs différentes = signalement périmé. */
  newOutfit(): string { const o = this.player.outfit; let h = o.hoodie; while (h === o.hoodie) h = HOODIES[Math.floor(Math.random() * HOODIES.length)]; this.player.setOutfit({ ...o, hoodie: h, jeans: JEANS[Math.floor(Math.random() * JEANS.length)] }); this.applyWeapon(); return this.outfitId(); }
  giveWeapon(w: WeaponId) { const had = this.weapons.has(w); this.weapons.add(w); if (w === 'pistolet' || WEAPONS[w].dmg[1] > WEAPONS[this.weapon].dmg[1]) { this.weapon = w; this.applyWeapon(); } return !had; }
  private applyWeapon() { const W = WEAPONS[this.weapon]; this.player.setWeapon(this.weapon === 'poings' ? null : W.color, W.len); }
  /** Habitants à pied (renversés exclus) près d'un point. */
  walkersNear(x: number, z: number, r: number) { const out: { id: number; x: number; z: number; h: number; speed: number; minor: boolean }[] = []; for (const s of this.states.values()) { const c = this.npcCtl.get(s.id); if (c) { if (c.mode === 'ko' || Math.abs(c.x - x) > r || Math.abs(c.z - z) > r) continue; out.push({ id: s.id, x: c.x, z: c.z, h: c.h, speed: c.speed, minor: false }); continue; } if (s.kind !== 'marche' && s.kind !== 'dehors') continue; if (Math.abs(s.x - x) > r || Math.abs(s.z - z) > r) continue; out.push({ id: s.id, x: s.x, z: s.z, h: s.h, speed: s.speed, minor: this.npcs.get(s.id)?.minor ?? false }); } return out; }
  /** Renverse un habitant (adulte) : il reste au sol quelques secondes, décalé dans la direction du choc. */
  knock(id: number, dx: number, dz: number, h: number) { const s = this.states.get(id); if (s) this.npcCtl.ko(id, s.x + dx, s.z + dz, h, 20); }
  /** Positions des habitants pris en main (pour le rendu). */
  overrides() { const m = new Map<number, { x: number; z: number; h: number; lying: boolean; speed: number }>(); for (const c of this.npcCtl.map.values()) m.set(c.id, { x: c.x, z: c.z, h: c.h, lying: c.mode === 'ko', speed: c.speed }); return m; }
  /** Témoins qui sont en train d'appeler (pour l'icône au-dessus de leur tête). */
  callers() { return this.reports.map(r => r.witness); }
  /** Collisions du piéton : bâtiments, mobilier/végétation, véhicules (renversé si l'un d'eux arrive vite), habitants. */
  private footCollide() {
    const p = this.player, pos = p.pos as unknown as { x: number; z: number }; if (this.props) this.props.resolve(pos, p.radius);
    for (const b of this.vehicleBoxes(p.pos.x, p.pos.z, 8, this.mode === 'foot')) {
      const hit = circleVsBox(p.pos.x, p.pos.z, p.radius, b.x, b.z, b.h, b.hl, b.hw); if (!hit) continue; p.pos.x += hit.x; p.pos.z += hit.z;
      if (Math.abs(b.speed) > 4 && this.downT <= 0) { const k = Math.min(1, Math.abs(b.speed) / 15); this.downT = 2.5; this.uw.hurt(8 + 40 * k); this.needs.s.sante = Math.max(1, this.needs.s.sante); const fx = Math.sin(b.h) * Math.sign(b.speed), fz = Math.cos(b.h) * Math.sign(b.speed); p.pos.x += fx * 1.5 * k; p.pos.z += fz * 1.5 * k; p.heading = b.h + Math.PI; this.sfx('crash', k * 0.6); this.hud.toast('Vous êtes renversé par une voiture !', 3); if (b.v) { b.v.stun = 3; b.v.speed *= 0.3; } }
    }
    for (const w of this.walkersNear(p.pos.x, p.pos.z, 3)) { const dx = p.pos.x - w.x, dz = p.pos.z - w.z, d = Math.hypot(dx, dz), m = p.radius + 0.32; if (d < m && d > 1e-4) { p.pos.x += dx / d * (m - d); p.pos.z += dz / d * (m - d); } }
    this.uw.resolve(pos, p.radius); this.coll.resolve(pos, p.radius);
  }
  /** Délit : n'est comptabilisé qu'en proportion de ce qui a été vu (gendarmerie à portée, témoin, personne). */
  /** Signalement différé (témoin, habitant cambriolé). */
  report(witness: number, delay: number, v: number, desc: Profile) { if (!this.reports.some(r => r.witness === witness)) this.reports.push({ witness, due: this.t + delay, v, desc }); }
  /** Proche d'une école : aucune violence ici. */
  nearSchool(r = 70) { return this.schools.some(s => Math.hypot(s.x - this.pos.x, s.z - this.pos.z) < r); }
  crime(v: number, noise = 15) {
    const ins = this.interior.inside && this.interior.entry; const px = ins ? this.interior.entry!.px : this.pos.x, pz = ins ? this.interior.entry!.pz : this.pos.z; const pd = this.police ? this.police.nearest : 999;
    if (pd < 80 * Math.max(0.3, this.vis)) { this.heat.add(v); this.profile = merge(this.profile, { outfit: this.mode === 'foot' ? this.outfitId() : null, vehicle: this.vehicleId(), face: !this.hooded }); return; }   // vu par la gendarmerie : immédiat
    const cands: { id: number; x: number; z: number; minor: boolean }[] = [];
    for (const s of this.states.values()) { const c = this.npcCtl.get(s.id); if (c) { if (c.mode !== 'ko') cands.push({ id: s.id, x: c.x, z: c.z, minor: false }); continue; } if (s.kind === 'dedans' || s.kind === 'absent') continue; if (Math.abs(s.x - px) > 60 || Math.abs(s.z - pz) > 60) continue; cands.push({ id: s.id, x: s.x, z: s.z, minor: this.npcs.get(s.id)?.minor ?? false }); }
    const ws = gatherWitnesses(px, pz, cands, ins ? 0 : sightRange(this.night, this.crouch, this.hidden), ins ? noise * 0.4 : noise, (a, b2, c2, d) => this.coll.blocked(a, b2, c2, d));
    if (!ws.length) { this.heat.add(v * 0.15); return; }
    ws.forEach((w, i) => { if (this.reports.some(r => r.witness === w.id)) return; this.reports.push({ witness: w.id, due: this.t + reportDelay(Math.random(), w.seen), v: i === 0 ? v * (w.seen ? 0.7 : 0.4) : v * 0.12, desc: describeWitness(w, this.outfitId(), this.vehicleId(), this.hooded) }); });
    this.hud.toast(ws.some(w => w.seen) ? `Vu par ${ws.length} témoin${ws.length > 1 ? 's' : ''}${ws.length > 1 ? ' : ils vont' : ' : il va'} appeler la gendarmerie.` : 'Quelqu\'un a entendu…', 2.5);
  }
  /** Appels des témoins arrivés à échéance (un témoin assommé n'appelle pas). */
  private processReports() {
    let called = 0; this.reports = this.reports.filter(r => { if (r.due > this.t) return true; const c = this.npcCtl.get(r.witness); if (c && c.mode === 'ko') return false; this.heat.add(r.v); this.profile = merge(this.profile, r.desc); called++; return false; });
    if (called) this.hud.toast(`📞 Un témoin a appelé la gendarmerie${this.profile.outfit || this.profile.vehicle ? ' et vous décrit' : ''}.`, 3);
    if (this.heat.value <= 0) this.profile = { outfit: null, vehicle: null, face: false };
  }
  /** Coup (F) : poings ou objet ; dans le dos d'une personne qui ne se méfie pas, un objet l'assomme net. */
  private attack() {
    if (this.attackCd > 0 || this.mode !== 'foot' || this.downT > 0) return; if (this.nearSchool()) { this.hud.toast('Pas ici : il y a une école à côté.', 2); return; }
    if (this.weapon === 'pistolet' && this.uw.ammo > 0) { this.uw.shoot(); return; } const W = WEAPONS[this.weapon]; this.attackCd = W.cd; this.player.punch();
    const p = this.player; const list = this.walkersNear(p.pos.x, p.pos.z, 3); const t = findTarget(p.pos.x, p.pos.z, p.heading, list, W.range); if (!t) { this.sfx('ui'); return; }
    const behind = isBehind(p.pos.x, p.pos.z, t), unaware = !this.npcCtl.get(t.id); const r = hitDamage(this.weapon, behind, unaware, Math.random()); const npc = this.npcs.get(t.id)!;
    const mode = this.npcCtl.hit(t.id, t.x, t.z, t.h, r.dmg, npc.seed, this.weapon !== 'poings'); this.sfx('crash', 0.25); if (this.fx) this.fx.shake = Math.min(1, this.fx.shake + 0.15);
    this.hud.toast(mode === 'ko' ? (r.ko ? `${npc.prenom} est assommé${npc.genre === 'F' ? 'e' : ''}.` : `${npc.prenom} est à terre.`) : mode === 'combat' ? `${npc.prenom} se défend !` : `${npc.prenom} s'enfuit en criant.`, 2);
    this.crime(mode === 'ko' && r.ko ? 10 : 16, mode === 'ko' && r.ko ? 6 : 22);
  }
  /** Arrestation : amende, perte de la marchandise (inventaire), retour devant la gendarmerie, trois heures perdues. Pas de mort. */
  arrest() {
    const stars = this.heat.stars; const fine = fineFor(this.money, stars); this.money -= fine; const lost = this.inv.nourriture + this.inv.eau + this.uw.seize(); this.inv = { nourriture: 0, eau: 0 }; this.heat.value = 0; this.police?.clearAll();
    const gp = this.pois.find(p => p.sous_type === 'police' && /gendarmerie/i.test(p.nom)) ?? { x: -848, y: -89 }; this.mode = 'foot'; this.player.root.visible = true; this.player.pos.set(gp.x + 3, 0, gp.y + 6); this.camYaw = 0; this.car.speed = 0; this.clock.hour += 3; this.needs.tick(3, false);
    this.boarded = null; { const e = this.missions.fail('marchandise saisie'); if (e) this.onOffers(); }
    this.sfx('arrest'); this.hud.toast(`ARRESTATION — amende ${fine} €${lost ? `, marchandise saisie (${lost})` : ''}. Vous sortez de la gendarmerie.`, 7);
  }
  attachPolice(p: Police) { this.police = p; }
  attachMissions(base: Omit<GenCtx, 'day' | 'rep' | 'at' | 'seed'>) { this.mbase = base; this.refreshOffers(); }
  refreshOffers() { if (!this.mbase) return; this.offers = makeOffers({ ...this.mbase, day: this.clock.day, seed: 5, rep: this.missions.rep, at: { x: this.pos.x, z: this.pos.z } }); this.offerDay = this.clock.day; this.onOffers(); }
  startOffer(o: Offer) {
    if (this.missions.active) { this.hud.toast('Une mission est déjà en cours (J pour la gérer).'); return; }
    if (o.kind === 'taxi') {
      let best: NpcState | null = null, bd = 450; for (const s of this.states.values()) { if (s.kind !== 'marche') continue; const n = this.npcs.get(s.id)!; if (n.minor) continue; const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z); if (d < bd) { bd = d; best = s; } }
      if (!best) { this.hud.toast('Aucun habitant ne cherche de taxi près de vous.'); return; } const n = this.npcs.get(best.id)!; const dest = best.place; const d = Math.hypot(dest.x - best.x, dest.z - best.z);
      o = { ...o, titre: `Taxi : ${n.prenom} ${n.nom}`, desc: `Emmener ${n.prenom} à ${dest.nom}.`, npcId: n.id, pay: Math.round((12 + d * 0.04) * this.missions.mult()), stages: [{ x: best.x, z: best.z, label: `Prendre ${n.prenom}`, kind: 'prise', r: 8 }, { x: dest.x, z: dest.z, label: `Déposer ${n.prenom} (${dest.nom})`, kind: 'depot', r: 10 }] };
    }
    this.missions.accept(o); this.hud.toast(`Mission : ${o.titre}`, 4); this.onOffers();
  }
  missionTarget(): { x: number; z: number; label: string } | null {
    const a = this.missions.active, s = this.missions.stage(); if (!a || !s) return null;
    if (a.offer.kind === 'taxi' && a.stage === 0 && a.offer.npcId !== undefined) { const st = this.states.get(a.offer.npcId); if (st) return { x: st.x, z: st.z, label: s.label }; }
    return { x: s.x, z: s.z, label: s.label };
  }
  private missionUpdate(dt: number) {
    const a = this.missions.active; if (!a) return; const tg = this.missionTarget();
    if (a.offer.kind === 'taxi' && a.stage === 0 && a.offer.npcId !== undefined) { const st = this.states.get(a.offer.npcId); if (st && st.kind === 'dedans') { this.missions.fail('x'); this.hud.toast('L\'habitant est entré quelque part : course annulée.'); this.onOffers(); return; } }
    const inCar = this.mode === 'car'; const ev = this.missions.update(dt, { x: this.pos.x, z: this.pos.z, speed: inCar ? Math.abs(this.car.speed) : this.player.speed, inCar, stars: this.heat.stars, target: tg });
    if (!ev) return; this.onOffers();
    if (ev.type === 'prise') { this.hud.toast(ev.label.replace(/^Prendre|^Retirer|^Récupérer/, 'Récupéré :'), 3); if (a.offer.kind === 'colis') this.crime(10); if (a.offer.kind === 'taxi') this.boarded = a.offer.npcId ?? null; }
    else if (ev.type === 'point') this.hud.toast(`${ev.label} validé (${ev.n}/${a.offer.stages.length})`, 2);
    else if (ev.type === 'fini') { this.money += ev.pay; this.boarded = null; this.sfx('win'); this.hud.toast(`Mission réussie : +${ev.pay} € · réputation +${ev.rep}${ev.note ? ' — ' + ev.note : ''}`, 6); this.refreshOffers(); }
    else if (ev.type === 'echec') { this.boarded = null; this.sfx('fail'); this.hud.toast(`Mission échouée : ${ev.why}`, 5); }
  }
  /** Concession : acheter un véhicule (B) ou changer de modèle (N) près d'un garage/concessionnaire. */
  private dealer() {
    const p = this.nearestPoi(25); if (!p || p.sous_type !== 'car') return; const models = (['citadine', 'break', 'utilitaire', 'berline'] as const); const inp = this.input;
    if (inp.hit('KeyN', 'next')) { this.dealerSel = (this.dealerSel + 1) % models.length; }
    if (inp.hit('KeyB', 'buy')) { const t = models[this.dealerSel], sp = SPECS[t]; if (this.money < sp.prix) { this.hud.toast(`Il vous faut ${sp.prix} € pour ${sp.nom.toLowerCase()}.`); return; } this.money -= sp.prix;
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw); this.vehicles.add({ type: t, paint: [0xe8e8e8, 0x1f3f78, 0x8a1c1c, 0x2f5a3d, 0x4f5358][this.dealerSel % 5], hp: sp.hp, x: this.pos.x + fx * 5, z: this.pos.z + fz * 5, h: this.camYaw, speed: 0, kind: 'gare', mine: true, upgrade: 0, stun: 0 }); this.hud.toast(`${sp.nom} achetée (−${sp.prix} €) : elle vous attend devant.`, 4); }
  }
  private policeUpdate(dt: number) {
    if (this.ramT > 0) this.ramT -= dt; if (!this.police) return; const inCar = this.mode === 'car'; const out = this.police.update(dt, { px: this.pos.x, pz: this.pos.z, pspeed: inCar ? Math.abs(this.car.speed) : this.player.speed, heading: this.car.heading, inCar, stars: this.heat.stars, vis: this.vis }, this.heat);
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
      else { this.crime(14); if (Math.random() < 0.25) { this.crime(12, 60); this.sfx('alarm'); this.hud.toast('L\'alarme se déclenche !'); } else this.hud.toast(`Vous forcez la ${sp.nom.toLowerCase()}.`); }
    } else this.hud.toast(`Vous montez dans votre ${sp.nom.toLowerCase()}.`);
    this.sfx('door'); if (v.kind === 'trafic') this.traffic.release(v); this.vehicles.remove(v);
    const c = this.car; this.vehicles.add({ type: c.spec.type, paint: c.paint, hp: c.hp, x: c.pos.x, z: c.pos.z, h: c.heading, speed: 0, kind: 'gare', mine: true, upgrade: c.upgrade, stun: 0, trunk: this.uw.trunk }); this.uw.trunk = v.trunk ?? [];
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
    this.needs = new Needs(s.needs); this.money = s.money; this.inv = s.inv; this.heat.value = s.heat; this.clock.hour = s.hour; this.clock.day = s.day; this.looted = new Set(s.looted); this.missions.rep = s.rep ?? 0; this.missions.done = s.done ?? 0; this.missions.active = (s.mission as any) ?? null; this.camYaw = s.heading; this.uw.load(s.uw); for (const w of s.weapons ?? []) this.weapons.add(w as WeaponId); return true;
  }
  persist() { Save.save({ px: this.player.pos.x, pz: this.player.pos.z, heading: this.player.heading, mode: this.mode, car: { x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading, type: this.car.spec.type, paint: this.car.paint, hp: this.car.hp, up: this.car.upgrade }, garage: this.vehicles.list.filter(v => v.mine).map(v => ({ type: v.type, paint: v.paint, hp: v.hp, x: v.x, z: v.z, h: v.h, up: v.upgrade })), needs: this.needs.s, money: this.money, inv: this.inv, heat: this.heat.value, hour: this.clock.hour, day: this.clock.day, looted: [...this.looted], rep: this.missions.rep, done: this.missions.done, mission: this.missions.active, uw: this.uw.save(), weapons: [...this.weapons] }); }
  get pos() { return this.mode === 'car' ? this.car.pos : this.player.pos; }
  nearestPoi(maxD = 16) { let best: Poi | null = null, bd = maxD; for (const p of this.pois) { const d = Math.hypot(p.x - this.pos.x, p.y - this.pos.z); if (d < bd) { bd = d; best = p; } } return best; }
  dow() { return (this.clock.day - 1 + 2) % 7; } // le jour 1 est un mercredi (hypothèse)

  update(dt: number) {
    dt = Math.max(0, dt);
    const inp = this.input; inp.poll(); const [lx, ly] = inp.takeLook();
    this.camYaw -= lx * 0.0055; this.camPitch = THREE.MathUtils.clamp(this.camPitch + ly * 0.004, -0.15, 1.1);
    if (this.observed) {   // mode observation : le joueur est spectateur (besoins figés), le temps peut être accéléré
      if (inp.hit('Escape', 'quit')) this.stopObserving(); this.clock.tick(dt); this.hud.veil(0); this.hud.tick(dt); this.hud.prompt('Échap : quitter l\'observation'); return;
    }
    this.interior.tick(dt);
    this.t += dt; this.attackCd -= dt; this.processReports(); this.uw.update(dt);
    { const r = this.npcCtl.update(dt, this.player.pos.x, this.player.pos.z, this.props ? { resolve: (q: { x: number; z: number }, rr: number) => { this.props!.resolve(q, rr); this.coll.resolve(q, rr); } } : undefined);
      if (r.dmgToPlayer && this.mode === 'foot' && !this.interior.inside) { this.uw.hurt(r.dmgToPlayer); this.sfx('crash', 0.2); if (this.fx) this.fx.shake = Math.min(1, this.fx.shake + 0.3); }
      for (const id of r.woke) { const c = this.npcCtl.get(id); if (c && !this.reports.some(q => q.witness === id)) this.reports.push({ witness: id, due: this.t + 6, v: 12, desc: { outfit: this.outfitId(), vehicle: null, face: !this.hooded } }); } }
    // discrétion : caché = accroupi contre un obstacle (haie, arbre, poubelle, voiture garée)
    this.hidden = this.mode === 'foot' && this.crouch && ((this.props?.nearDist(this.player.pos.x, this.player.pos.z) ?? 9) < 1.25 || this.vehicles.near(this.player.pos.x, this.player.pos.z, 2.6).some(v => v.kind === 'gare'));
    this.vis = recognizability({ stars: this.heat.stars, profile: this.profile, outfit: this.outfitId(), vehicle: this.vehicleId(), hooded: this.hooded, hidden: this.hidden, crouch: this.crouch && this.mode === 'foot' });
    if (this.interior.inside) this.interior.update(dt); else if (this.sleeping) this.updateSleep(dt); else if (this.mode === 'car') this.updateCar(dt); else this.updateFoot(dt);
    if (this.sleeping && !this.interior.inside && !this.uw.safeSleep && Math.random() < dt * 0.02) { this.wake(); this.crime(12); this.hud.toast('Du bruit vous réveille : on vous a repéré.'); }
    if (this.sleeping && (inp.hit('KeyR', 'sleep') || this.needs.s.energie >= 98)) this.wake();
    this.traffic.update(dt, this.pos.x, this.pos.z, this.obstacles()); this.policeUpdate(dt); if (this.clock.day !== this.offerDay) this.refreshOffers(); if (!this.interior.inside) this.missionUpdate(dt); if (inp.hit('KeyJ', 'missions')) this.onMissionsKey(); this.dealer();
    const h = this.clock.tick(dt); this.needs.tick(h, this.sleeping, this.mode === 'foot' && inp.run && this.player.speed > 3 ? 1.8 : 1);
    this.heat.tick(this.uw.inDen ? h * 3 : h, this.mode === 'foot' && this.player.speed < 1);
    if (!this.interior.busy) this.hud.veil(this.sleeping ? 0.75 : this.needs.s.energie < 8 ? 0.35 : 0); this.hud.tick(dt);
    if (this.needs.dead) { this.hud.toast('Vous êtes à bout… vous revenez à vous, sans grand-chose.', 5); this.respawn(true); }
    this.ctl.throttle = 0; if ((this.saveT += dt) > 8) { this.saveT = 0; this.persist(); }
    if (!this.interior.inside) this.contextual();
  }
  private wake() { this.sleeping = false; this.clock.scale = 1; this.hud.toast('Vous vous réveillez.'); }
  private updateSleep(dt: number) { this.clock.scale = 12; this.car.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }); }
  private updateFoot(dt: number) {
    const inp = this.input, p = this.player;
    if (this.downT > 0) { this.downT -= dt; p.update(dt, 0, 0, this.camYaw, false, 1); } else p.update(dt, inp.x, inp.y, this.camYaw, inp.run && !this.crouch && this.uw.carried < 12, this.needs.speedFactor * this.uw.speedFactor * (this.crouch ? 0.45 : 1));
    this.coll.resolve(p.pos as any, p.radius); this.footCollide();
    p.root.rotation.order = 'YXZ'; p.root.rotation.x = this.downT > 0 ? -Math.PI / 2 * Math.min(1, (2.5 - this.downT) * 6, this.downT * 3) : 0;
    p.root.position.copy(p.pos); this.car.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }); this.collideCar();
    const dCar = Math.hypot(this.car.pos.x - p.pos.x, this.car.pos.z - p.pos.z);
    if (this.uw.menuOpen()) { if (inp.hit('KeyN', 'next')) this.uw.action('N'); if (inp.hit('KeyB', 'buy')) this.uw.action('B'); }
    if (inp.hit('KeyE', 'action') && !this.uw.action('E')) {
      if (dCar < 4.2) { this.mode = 'car'; p.root.visible = false; this.sfx('door'); this.hud.toast('Vous montez dans la voiture.'); this.uw.loadTrunk(); }
      else if (this.nearestVehicle()) { const v = this.nearestVehicle()!; if (this.enterWorldVehicle(v)) { this.mode = 'car'; p.root.visible = false; this.uw.loadTrunk(); } }
      else { const n = this.nearNpc(); if (n) { const npc = this.npcs.get(n.id)!; this.hud.toast(line(npc, n, this.clock.hour, this.talkCount++), 5); } else this.interior.tryEnter(); }
    }
    if (inp.hit('KeyF', 'hit')) this.attack();
    if (inp.hit('KeyC', 'crouch')) { this.crouch = !this.crouch; this.player.crouch = this.crouch; }
    if (inp.hit('KeyV', 'hood')) { this.player.setOutfit({ ...this.player.outfit, hoodUp: !this.player.outfit.hoodUp }); this.applyWeapon(); this.hud.toast(this.hooded ? 'Capuche levée : visage caché.' : 'Capuche baissée.', 1.5); }
    if (inp.hit('KeyT', 'weapon')) { const list = [...this.weapons]; this.weapon = list[(list.indexOf(this.weapon) + 1) % list.length]; this.applyWeapon(); this.hud.toast(`En main : ${WEAPONS[this.weapon].nom}`, 1.5); }
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
      this.coll.resolve(np as any, this.player.radius); this.player.pos.copy(np); this.player.heading = f; this.camYaw = f; this.mode = 'foot'; this.player.root.visible = true; this.car.speed = 0; this.sfx('door'); this.hud.toast('Vous descendez.');
    }
    if (inp.hit('KeyL', 'lights')) this.car.setLights(!this.car.lightsOn);
    this.consumables(); this.bodyActions();
  }
  private collideCar() {
    const c = this.car, fx = Math.sin(c.heading), fz = Math.cos(c.heading); let hit = 0; const v0 = Math.abs(c.speed);
    for (const o of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) { const q = { x: c.pos.x + fx * o, z: c.pos.z + fz * o }; const r = this.coll.resolve(q, c.spec.W / 2 + 0.1); if (r.depth > 0) { c.pos.x += q.x - (c.pos.x + fx * o); c.pos.z += q.z - (c.pos.z + fz * o); hit = Math.max(hit, r.depth); } }
    if (hit > 0.02) { c.speed *= 1 - Math.min(0.6, hit * 3) * 0.5; if (v0 > 4) this.crash(Math.min(1, hit * 2.5) * v0 * 1.4); }
    for (const o of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) { const q = { x: c.pos.x + fx * o, z: c.pos.z + fz * o }; if (this.uw.resolve(q, c.spec.W / 2) > 0) { c.pos.x += q.x - (c.pos.x + fx * o); c.pos.z += q.z - (c.pos.z + fz * o); const sp0 = Math.abs(c.speed); c.speed *= 0.4; if (sp0 > 4) this.crash(sp0 * 1.6); } }
    // mobilier, arbres, poteaux
    if (this.props) for (const o of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) { const q = { x: c.pos.x + fx * o, z: c.pos.z + fz * o }; const r = this.props.resolve(q, c.spec.W / 2); if (r.depth > 0) { c.pos.x += q.x - (c.pos.x + fx * o); c.pos.z += q.z - (c.pos.z + fz * o); const sp0 = Math.abs(c.speed); c.speed *= 0.4; if (sp0 > 4) this.crash(sp0 * 1.6); } }
    // habitants à pied : adultes renversés (délit), mineurs jamais touchés (la voiture s'arrête net)
    for (const w of this.walkersNear(c.pos.x, c.pos.z, 6)) {
      const hit = circleVsBox(w.x, w.z, w.minor ? 1.1 : 0.35, c.pos.x, c.pos.z, c.heading, c.spec.L / 2, c.spec.W / 2); if (!hit) continue;
      if (w.minor || Math.abs(c.speed) < 3) { c.pos.x -= hit.x; c.pos.z -= hit.z; c.speed = 0; continue; }
      const sp0 = Math.abs(c.speed); this.knock(w.id, fx * Math.sign(c.speed) * Math.min(3, sp0 * 0.2), fz * Math.sign(c.speed) * Math.min(3, sp0 * 0.2), c.heading); c.speed *= 0.6; this.crash(sp0 * 0.6); this.crime(sp0 > 8 ? 30 : 15); this.hud.toast('Vous avez renversé un piéton !', 3);
    }
    // voitures des habitants (simulées) : solides pour la voiture du joueur
    for (const d of this.npcCars) { if (Math.abs(d.x - c.pos.x) > 7 || Math.abs(d.z - c.pos.z) > 7) continue; const sp = SPECS[d.type]; let worst: { x: number; z: number; d: number } | null = null; for (const po of [-c.spec.L * 0.3, 0, c.spec.L * 0.3]) { const hit = circleVsBox(c.pos.x + fx * po, c.pos.z + fz * po, c.spec.W / 2, d.x, d.z, d.h, sp.L / 2, sp.W / 2); if (hit && (!worst || hit.d > worst.d)) worst = hit; } if (worst) { c.pos.x += worst.x; c.pos.z += worst.z; const rel = Math.abs(c.speed - d.speed); if (rel > 2.5) { this.crash(rel * 1.8); if (rel > 5) this.crime(4); } c.speed *= 0.55; } }
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
  private crash(dmg: number) { if (dmg < 1.2) return; this.sfx('crash', dmg / 25); const fx = Math.sin(this.car.heading), fz = Math.cos(this.car.heading); this.fx?.burst(this.car.pos.x + fx * this.car.spec.L * 0.45, 0.6, this.car.pos.z + fz * this.car.spec.L * 0.45, Math.min(30, Math.round(dmg))); if (this.car.damage(dmg)) this.hud.toast('Le moteur est en panne !', 4); else if (dmg > 12) this.hud.toast('Gros choc !', 1.5); }
  drivingEffects(dt: number) {
    const c = this.car, fx = Math.sin(c.heading), fz = Math.cos(c.heading), rx = fz, rz = -fx, back = -c.spec.wheelbase / 2, track = c.spec.W / 2 - 0.2;
    for (const sg of [-1, 1]) { const x = c.pos.x + fx * back + rx * track * sg, z = c.pos.z + fz * back + rz * track * sg; const id = 'w' + sg; if (c.slip) { this.fx?.skid(id, x, z, c.heading); this.tireSmoke?.emit(x, 0.25, z, 0.5, dt * 0.6, true); } else this.fx?.endSkid(id); }
    this.fx?.update(dt); this.tireSmoke?.update(dt);
  }
  engineSmoke(dt: number) { const c = this.car; const k = 1 - c.hp / c.spec.hp; if (k > 0.45 && this.smoke) { const fx = Math.sin(c.heading), fz = Math.cos(c.heading); this.smoke.emit(c.pos.x + fx * c.spec.L * 0.3, 1.1, c.pos.z + fz * c.spec.L * 0.3, Math.min(1, (k - 0.45) * 1.9), dt); } this.smoke?.update(dt); }
  private consumables() {
    const inp = this.input;
    if (inp.hit('Digit1', 'eat')) { if (this.inv.nourriture > 0) { this.inv.nourriture--; this.needs.eat(38); this.hud.toast('Vous mangez. Ça fait du bien.'); } else this.hud.toast('Vous n\'avez rien à manger.'); }
    if (inp.hit('Digit3', 'heal')) this.uw.heal();
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
    if (this.mode === 'foot') { const up = this.uw.prompt(); if (up) { this.hud.prompt(up); return; } }
    if (this.mode === 'car') { const gp = this.nearestPoi(32); const gar = gp && ['car_repair', 'car', 'gas'].includes(gp.sous_type) && Math.abs(this.car.speed) < 1; this.hud.prompt(`E : descendre · L : phares${gar ? ' · G : garage' : ''}`); return; }
    const dCar = Math.hypot(this.car.pos.x - this.player.pos.x, this.car.pos.z - this.player.pos.z); if (dCar < 4.2) { this.hud.prompt(`E : monter dans votre ${this.car.spec.nom.toLowerCase()}`); return; }
    const dp = this.nearestPoi(25); if (dp && dp.sous_type === 'car' && !this.nearestVehicle()) { const m = (['citadine', 'break', 'utilitaire', 'berline'] as const)[this.dealerSel]; this.hud.prompt(`${dp.nom} — B : acheter ${SPECS[m].nom.toLowerCase()} (${SPECS[m].prix} €) · N : suivant`); return; }
    const nv = this.nearestVehicle(); if (nv) { const sp = SPECS[nv.type]; this.hud.prompt(sp.police ? sp.nom : nv.mine ? `E : monter (${sp.nom.toLowerCase()})` : `E : voler cette ${sp.nom.toLowerCase()}`); return; }
    const nn = this.nearNpc(); if (nn) { const npc = this.npcs.get(nn.id)!; this.hud.prompt(npc.minor ? `${npc.prenom} (élève)` : `E : parler à ${npc.prenom} ${npc.nom} · toucher : observer`); return; }
    this.hud.prompt(this.interior.nearDoorPrompt());
  }
}
