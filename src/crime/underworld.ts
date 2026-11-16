// Vague 2 : la vie de cambrioleur — repérage des logements, crochetage, butin et sac à dos, coffre, receleur, planques, caches d'armes, tir, blessures.
import * as THREE from 'three';
import type { Game } from '../game';
import type { Spot } from '../missions/generator';
import type { Entry } from '../interiors/entry';
import type { Npc } from '../npc/identity';
import { rng } from '../interiors/generator';
import { ITEMS, BAG_MAX, TRUNK_MAX, kgOf, fits, fencePrice, summary, loadFactor } from './loot';
import { occupancy, streetCue, listenReport, nextEmpty, type Occupancy } from './homes';
import { aimShot, policeVolley, PISTOL } from './firearms';
import { buildHut, siteFor } from './huts';
import { circleVsBox } from '../world/solids';

export interface Cache { x: number; z: number; what: string; n: number; desc: string; }
export interface Den { x: number; z: number; nom: string; prix: number; }
type Opt = { label: string; run: () => void };
const PICK_TIME = 4.5;
const CACHE_KINDS = ['argent', 'argent', 'argent', 'argent', 'argent', 'trousse', 'trousse', 'trousse', 'munitions', 'munitions', 'munitions', 'crochet', 'crochet', 'crochet', 'batte', 'barre', 'cle', 'bouteille', 'pistolet', 'pistolet', 'bijoux', 'montre'];
const HIDING = ['un sac planqué sous une haie', 'une boîte cachée derrière un coffret électrique', 'un sac au fond d\'un fossé', 'une boîte sous une dalle descellée', 'un sac coincé derrière une poubelle', 'un paquet glissé sous un buisson'];

export class Underworld {
  bonusUntil = 0; bag: string[] = []; trunk: string[] = []; stash: string[] = []; ammo = 0; tools = new Set<string>(); kits = 0; bleeding = false;
  owned = new Set<number>(); scouted = new Map<number, string>(); evacuated = new Map<number, number>();
  fence: Den | null = null; dens: Den[] = []; caches: Cache[] = []; inDen = false; safeSleep = false;
  pick: { e: Entry; t: number; x: number; z: number } | null = null; sel = 0;
  residents = new Map<number, Npc[]>(); private households = new Map<number, Npc[][]>(); private aptSel = new Map<number, number>(); private listenT = 0; private listenBi = -1; private shotCd = 0; private volleyT = 0; private evacT = new Map<number, number>();
  private cacheMeshes: THREE.Object3D[] = []; tracer?: THREE.Line; private tracerT = 0;
  constructor(private g: Game) {}

  /** Lieux : receleur et planques sur des emplacements neutres (fictifs, loin des écoles), caches le long des chemins. */
  setup(neutres: Spot[], paths: { x: number; z: number }[], schools: { x: number; z: number }[], npcs: Npc[]) {
    const r = rng(2024); const pool = [...neutres]; const take = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (pool.length) { const s = take(); this.fence = { x: s.x, z: s.z, nom: 'Box du receleur (lieu fictif)', prix: 0 }; }
    if (pool.length) { const s = take(); this.dens.push({ x: s.x, z: s.z, nom: 'Garage loué (planque)', prix: 150 }); }
    if (pool.length) { const s = take(); this.dens.push({ x: s.x, z: s.z, nom: 'Cabanon abandonné (planque)', prix: 0 }); }
    const ok = paths.filter(p => !schools.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 250));
    for (let i = 0; i < CACHE_KINDS.length && ok.length; i++) {
      const p = ok.splice(Math.floor(r() * ok.length), 1)[0]; const a = r() * Math.PI * 2; const q = { x: p.x + Math.cos(a) * 3.5, z: p.z + Math.sin(a) * 3.5 }; this.g.coll.resolve(q, 0.6);
      const what = CACHE_KINDS[i]; this.caches.push({ x: q.x, z: q.z, what, n: what === 'argent' ? 60 + Math.floor(r() * 220) : what === 'munitions' ? 12 : 1, desc: HIDING[Math.floor(r() * HIDING.length)] });
    }
    const tmp = new Map<number, Map<number, Npc[]>>(); for (const n of npcs) if (n.home.bi !== undefined) { const m = tmp.get(n.home.bi) ?? new Map<number, Npc[]>(); tmp.set(n.home.bi, m); const k = n.home.apt ?? 0; const l = m.get(k); if (l) l.push(n); else m.set(k, [n]); }
    for (const [bi, m] of tmp) { const hh = [...m.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]); this.households.set(bi, hh); this.residents.set(bi, hh[0]); }
  }
  /** Repères 3D discrets : sacs des caches, lanternes du receleur et des planques. */
  buildMarkers(scene: THREE.Scene) {
    const bagGeo = new THREE.BoxGeometry(0.5, 0.28, 0.32), bagMat = new THREE.MeshStandardMaterial({ color: 0x1d2320, roughness: 0.9 });
    this.caches.forEach((c, i) => { const m = new THREE.Mesh(bagGeo, bagMat); m.position.set(c.x, 0.14, c.z); m.rotation.y = i; m.castShadow = true; m.userData.i = i; m.visible = !this.g.looted.has('cache:' + i); scene.add(m); this.cacheMeshes.push(m); });
    const roadDist = this.roadDist;
    const hut = (d: Den, style: 'box' | 'cabanon', neon?: number) => { const s0 = siteFor(d.x, d.z, roadDist, (x, z) => this.g.coll.resolve({ x, z }, 3.2).depth > 0); const b = buildHut(scene, s0.x, s0.z, s0.h, style, neon); this.huts.push(b.box); d.x = b.door.x; d.z = b.door.z; };
    if (this.fence) hut(this.fence, 'box', 0x9a5cff); this.dens.forEach((d, i) => hut(d, i === 0 ? 'box' : 'cabanon'));
    this.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 })); this.tracer.visible = false; this.tracer.frustumCulled = false; scene.add(this.tracer);
  }
  huts: { x: number; z: number; h: number; hl: number; hw: number }[] = [];
  /** Collision avec les cabanes (piéton, voiture). */
  resolve(p: { x: number; z: number }, r: number) { let d = 0; for (const b of this.huts) { if (Math.abs(b.x - p.x) > 8 || Math.abs(b.z - p.z) > 8) continue; const k = circleVsBox(p.x, p.z, r, b.x, b.z, b.h, b.hl, b.hw); if (k) { p.x += k.x; p.z += k.z; d = Math.max(d, k.d); } } return d; }
  roadDist = (x: number, z: number) => { let m = 99; for (const r of this.g.world.roads) { const q = r.p[0]; if (Math.abs(q[0] - x) > 400 || Math.abs(q[1] - z) > 400) continue; for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } } return m; };
  residentsOf(bi: number) { return this.residents.get(bi) ?? []; }
  /** Immeubles : nombre de logements habités, appartement visé, passage au suivant (N à la porte). */
  units(bi: number) { return this.households.get(bi)?.length ?? 0; }
  apt(bi: number) { return this.aptSel.get(bi) ?? 0; }
  aptNo(bi: number) { return this.residents.get(bi)?.[0]?.home.apt ?? 0; }
  nextApt(bi: number) { const hh = this.households.get(bi); if (!hh || hh.length < 2) return false; const k = (this.apt(bi) + 1) % hh.length; this.aptSel.set(bi, k); this.residents.set(bi, hh[k]); return true; }
  allResidents(bi: number) { return (this.households.get(bi) ?? []).flat(); }
  /** Occupants de tout le bâtiment (incendie). */
  occAll(bi: number): Occupancy | null { const l = this.allResidents(bi); if (!l.length) return null; const g = this.g; return occupancy(l, n => g.sim!.stateAt(n, g.clock.day, g.clock.hour, false)); }
  private skey(bi: number) { return bi * 1000 + this.aptNo(bi); }
  occ(bi: number): Occupancy | null { const l = this.residents.get(bi); if (!l) return null; const g = this.g; return occupancy(l, n => g.sim!.stateAt(n, g.clock.day, g.clock.hour, false)); }
  /** Texte de porte d'un logement : nom du foyer, indice visible, notes de repérage. */
  doorInfo(bi: number) { const l = this.residents.get(bi); if (!l) return ''; const o = this.occ(bi)!; const note = this.scouted.get(this.skey(bi)); const u = this.units(bi); return `${u > 1 ? `Immeuble (${u} foyers) · appt ${this.aptNo(bi) + 1} : ` : ''}Famille ${l[0].nom} · ${streetCue(o, this.g.clock.hour)}${note ? ' · ' + note : ' · accroupi : écouter'}${u > 1 ? ' · N : autre appartement' : ''}`; }
  get carried() { return kgOf(this.bag); }
  get speedFactor() { return loadFactor(this.carried) * (this.g.needs.s.sante < 30 ? 0.75 : 1); }
  /** Ajoute un objet au sac (false si trop lourd). */
  take(id: string) { if (!fits(this.bag, id)) { this.g.hud.toast(`Trop lourd (${ITEMS[id].nom}, ${ITEMS[id].kg} kg) : videz d'abord votre sac dans un coffre (${this.carried.toFixed(1)}/${BAG_MAX} kg).`, 4); return false; } this.bag.push(id); return true; }
  /** En montant dans sa voiture : le sac va dans le coffre. */
  loadTrunk() { if (!this.bag.length) return; const keep: string[] = []; for (const i of this.bag) { if (kgOf(this.trunk) + ITEMS[i].kg <= TRUNK_MAX) this.trunk.push(i); else keep.push(i); } const n = this.bag.length - keep.length; this.bag = keep; if (n) this.g.hud.toast(`Butin chargé dans le coffre (${n} objet${n > 1 ? 's' : ''}).`, 2.5); }
  /** Arrestation : tout le butin porté et dans le coffre est saisi ; la planque est épargnée. */
  seize() { const n = this.bag.length + this.trunk.length; this.bag = []; this.trunk = []; this.bleeding = false; return n; }
  /** Blessure : au-delà de 10 points, on peut se mettre à saigner. */
  hurt(dmg: number) { const g = this.g; g.needs.s.sante = Math.max(0, g.needs.s.sante - dmg); if (g.mode === 'foot' && dmg >= 5) g.player.hit(dmg > 14); if (dmg >= 10 && !this.bleeding && Math.random() < 0.55) { this.bleeding = true; g.hud.toast('Vous saignez : soignez-vous (3 : trousse, pharmacie, planque).', 4); } }
  heal() { if (this.kits <= 0) { this.g.hud.toast('Pas de trousse de soins.'); return; } this.kits--; this.bleeding = false; this.g.needs.s.sante = Math.min(100, this.g.needs.s.sante + 30); this.g.hud.toast('Pansement fait : le saignement s\'arrête.', 2.5); }

  /** Tir au pistolet (F) : jamais si un enfant est dans la ligne de mire, jamais près d'une école. */
  shoot() {
    const g = this.g, p = g.player; if (this.shotCd > 0) return; if (this.ammo <= 0) { g.hud.toast('Plus de munitions : coup de crosse.', 1.5); return false; }
    const list = g.walkersNear(p.pos.x, p.pos.z, PISTOL.range + 2); const a = aimShot(p.pos.x, p.pos.z, p.heading, list, (x0, z0, x1, z1) => g.coll.blocked(x0, z0, x1, z1));
    if (a.child) { g.hud.toast('Un enfant est dans la ligne de mire : vous ne tirez pas.', 2.5); return true; }
    this.shotCd = PISTOL.cd; this.ammo--; g.sfx('shot'); p.aim(); if (g.fx) g.fx.shake = Math.min(1, g.fx.shake + 0.25);
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading); const ex = a.target ? a.target.x : p.pos.x + fx * PISTOL.range, ez = a.target ? a.target.z : p.pos.z + fz * PISTOL.range;
    if (this.tracer) { const pos = this.tracer.geometry.attributes.position as THREE.BufferAttribute; pos.setXYZ(0, p.pos.x + fx * 0.6, 1.35, p.pos.z + fz * 0.6); pos.setXYZ(1, ex, 1.2, ez); pos.needsUpdate = true; this.tracer.visible = true; this.tracerT = 0.06; }
    if (a.target) { const n = g.npcs.get(a.target.id)!; g.npcCtl.ko(n.id, a.target.x, a.target.z, p.heading, 1e6); this.evacuated.set(n.id, g.clock.day); this.evacT.set(n.id, 45); g.hud.toast(`${n.prenom} est touché${n.genre === 'F' ? 'e' : ''} et s'effondre. Les secours vont l'évacuer.`, 3); }
    for (const w of list) if (!w.minor && (!a.target || w.id !== a.target.id) && Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < 30) g.npcCtl.scare(w.id, w.x, w.z, w.h);
    g.crime(a.target ? 45 : 25, 160); return true;
  }

  /** Menu du lieu où l'on se trouve (receleur ou planque). */
  private options(): { title: string; opts: Opt[] } | null {
    const g = this.g, P = g.player.pos, near = (d: Den) => Math.hypot(d.x - P.x, d.z - P.z) < 8;
    if (this.fence && near(this.fence)) {
      const h = g.clock.hour; if (h < 20 && h >= 6) return { title: 'Box fermé — le receleur reçoit de 20 h à 6 h', opts: [] };
      const carNear = Math.hypot(g.car.pos.x - P.x, g.car.pos.z - P.z) < 15; const nb = (l: string[]) => l.filter(i => i !== 'billets'); const goods = carNear ? [...nb(this.bag), ...nb(this.trunk)] : nb(this.bag); let price = fencePrice(goods, g.heat.stars); if (price !== null && this.bonusUntil > g.clock.day * 24 + g.clock.hour && goods.some(i => ['tele', 'portable', 'console', 'ecran', 'tablette', 'telephone'].includes(i))) price = Math.round(price * 1.2);
      const buy = (label: string, cost: number, fn: () => void): Opt => ({ label: `${label} — ${cost} €`, run: () => { if (g.money < cost) return g.hud.toast(`Il vous faut ${cost} €.`); g.money -= cost; fn(); g.sfx('coin'); } });
      const opts: Opt[] = [];
      if (goods.length) opts.push({ label: price === null ? 'Vendre : « Trop chaud, reviens quand ça se sera calmé »' : `Vendre ${goods.length} objet${goods.length > 1 ? 's' : ''}${carNear && this.trunk.length ? ' (sac + coffre)' : ''} — ${price} €`, run: () => { if (price === null) return g.hud.toast('« Tu as la gendarmerie aux fesses. Dégage. »', 3); g.money += price; g.hud.toast(`Le receleur prend ${summary(goods)} : +${price} €.`, 4); this.bag = this.bag.filter(i => i === 'billets'); if (carNear) this.trunk = this.trunk.filter(i => i === 'billets'); g.sfx('coin'); } });
      if (!this.tools.has('crochet')) opts.push(buy('Crochet de serrurier', 40, () => { this.tools.add('crochet'); g.hud.toast('Crochet acheté : les portes verrouillées s\'ouvrent sans bruit (E, sans bouger).', 4); }));
      opts.push(buy('Trousse de soins', 25, () => { this.kits++; }));
      opts.push(buy('12 balles', 60, () => { this.ammo += 12; }));
      if (!g.weapons.has('pistolet')) opts.push(buy('Pistolet', 450, () => { g.giveWeapon('pistolet'); this.ammo += 6; g.hud.toast('Pistolet en main (T pour changer). F : tirer.', 3); }));
      opts.push(...g.heists.fenceOpts(buy));
      return { title: 'Receleur', opts };
    }
    for (let i = 0; i < this.dens.length; i++) { const d = this.dens[i]; if (!near(d)) continue;
      if (!this.owned.has(i)) return { title: d.nom, opts: [{ label: d.prix ? `Louer (${d.prix} €)` : 'S\'y installer (squat)', run: () => { if (g.money < d.prix) return g.hud.toast(`Il vous faut ${d.prix} €.`); g.money -= d.prix; this.owned.add(i); g.hud.toast('C\'est votre planque : butin à l\'abri, sommeil tranquille, on vous oublie plus vite.', 4); } }] };
      const opts: Opt[] = [{ label: 'Dormir à l\'abri', run: () => { g.sleeping = true; this.safeSleep = true; g.hud.toast('Vous dormez dans votre planque… (R pour vous réveiller)'); } }];
      if (this.bag.length) opts.push({ label: `Cacher le sac (${this.bag.length} objet${this.bag.length > 1 ? 's' : ''})`, run: () => { this.stash.push(...this.bag); this.bag = []; g.hud.toast('Butin caché dans la planque.'); } });
      if (this.trunk.length && Math.hypot(g.car.pos.x - P.x, g.car.pos.z - P.z) < 15) opts.push({ label: `Vider le coffre (${this.trunk.length})`, run: () => { this.stash.push(...this.trunk); this.trunk = []; g.hud.toast('Coffre vidé dans la planque.'); } });
      if (this.stash.length) opts.push({ label: `Reprendre le butin (${this.stash.length} : ${summary(this.stash).slice(0, 40)})`, run: () => { const keep: string[] = []; for (const it of this.stash) if (!this.take(it)) keep.push(it); this.stash = keep; } });
      if (this.kits && (this.bleeding || g.needs.s.sante < 80)) opts.push({ label: 'Se soigner (trousse)', run: () => this.heal() });
      opts.unshift(...g.kid.denOpts(), ...g.heists.denOpts(Math.hypot(g.car.pos.x - P.x, g.car.pos.z - P.z) < 15));
      return { title: d.nom, opts };
    }
    return null;
  }
  menuOpen() { const m = this.options(); return !!m && m.opts.length > 0; }
  /** Prompt contextuel prioritaire (cache, receleur, planque, crochetage, écoute). */
  prompt(): string | null {
    const g = this.g, P = g.player.pos;
    if (this.pick) return `Crochetage… ${Math.round(this.pick.t / PICK_TIME * 100)} % — ne bougez pas`;
    const c = this.nearCache(); if (c) return `E : fouiller ${c.desc}`;
    const m = this.options(); if (m) { if (!m.opts.length) return m.title; this.sel %= m.opts.length; return `${m.title} — ${m.opts[this.sel].label}${m.opts.length > 1 ? ' · N : suivant' : ''} · B/E : valider`; }
    if (this.listenT > 0.3 && this.listenBi >= 0) return `Vous écoutez à la porte… ${Math.min(100, Math.round(this.listenT / 2 * 100))} %`;
    void P; return null;
  }
  private nearCache() { const P = this.g.player.pos; let b: Cache | null = null; this.caches.forEach((c, i) => { if (!this.g.looted.has('cache:' + i) && Math.hypot(c.x - P.x, c.z - P.z) < 1.7) b = c; }); return b as Cache | null; }
  /** E/B/N dehors à pied : retourne true si l'action a été consommée. */
  action(key: 'E' | 'B' | 'N'): boolean {
    const g = this.g;
    if (key === 'E') { const c = this.nearCache(); if (c) { this.openCache(c); return true; } }
    const m = this.options(); if (!m || !m.opts.length) return false;
    if (key === 'N') { this.sel = (this.sel + 1) % m.opts.length; return true; }
    m.opts[this.sel % m.opts.length].run(); this.sel = 0; void g; return true;
  }
  private openCache(c: Cache) {
    const g = this.g, i = this.caches.indexOf(c); g.looted.add('cache:' + i); if (this.cacheMeshes[i]) this.cacheMeshes[i].visible = false; g.sfx('ui');
    const W: Record<string, string> = { batte: 'une batte', barre: 'une barre de fer', cle: 'une clé à molette', bouteille: 'une bouteille' };
    switch (c.what) {
      case 'argent': g.money += c.n; g.hud.toast(`Dans ${c.desc} : ${c.n} € en liquide.`, 3.5); break;
      case 'trousse': this.kits++; g.hud.toast(`Dans ${c.desc} : une trousse de soins (3 pour l'utiliser).`, 3.5); break;
      case 'munitions': this.ammo += c.n; g.hud.toast(`Dans ${c.desc} : ${c.n} balles.`, 3.5); break;
      case 'crochet': this.tools.add('crochet'); g.hud.toast(`Dans ${c.desc} : un crochet de serrurier (portes verrouillées ouvertes sans bruit).`, 4); break;
      case 'pistolet': g.giveWeapon('pistolet'); this.ammo += 6; g.hud.toast(`Dans ${c.desc} : un pistolet et 6 balles (F : tirer, T : changer).`, 4); break;
      case 'bijoux': case 'montre': if (this.take(c.what)) g.hud.toast(`Dans ${c.desc} : ${ITEMS[c.what].nom.toLowerCase()} (à revendre).`, 3.5); break;
      default: g.giveWeapon(c.what as never); g.hud.toast(`Dans ${c.desc} : ${W[c.what] ?? c.what}.`, 3.5);
    }
  }
  startPick(e: Entry) { const P = this.g.player.pos; this.pick = { e, t: 0, x: P.x, z: P.z }; this.g.sfx('ui'); }

  update(dt: number) {
    const g = this.g, P = g.player.pos; this.shotCd -= dt;
    if (this.tracer && this.tracerT > 0 && (this.tracerT -= dt) <= 0) this.tracer.visible = false;
    // crochetage : immobile pendant PICK_TIME secondes
    if (this.pick) { if (Math.hypot(P.x - this.pick.x, P.z - this.pick.z) > 0.6 || g.mode !== 'foot') { this.pick = null; g.hud.toast('Crochetage interrompu.', 1.5); } else if ((this.pick.t += dt) >= PICK_TIME) { const e = this.pick.e; this.pick = null; g.interior.enterQuiet(e); } }
    // écoute à la porte d'un logement (accroupi)
    const e = g.mode === 'foot' && g.crouch && !g.interior.inside ? g.interior.index.find(P.x, P.z) : null; const bi = e && this.residents.has(e.bi) ? e.bi : -1;
    if (bi >= 0 && bi === this.listenBi) { if (this.listenT < 2 && (this.listenT += dt) >= 2) this.scout(bi); } else { this.listenBi = bi; this.listenT = 0; }
    // blessures : saignement et soin automatique au repos dans la planque
    if (this.bleeding && !g.sleeping) g.needs.s.sante = Math.max(0, g.needs.s.sante - 0.22 * dt);
    this.inDen = this.dens.some((d, i) => this.owned.has(i) && Math.hypot(d.x - P.x, d.z - P.z) < 10);
    if (g.sleeping && this.inDen) { this.bleeding = false; g.needs.s.sante = Math.min(100, g.needs.s.sante + 0.4 * dt); }
    if (!g.sleeping) this.safeSleep = false;
    // blessés évacués par les secours au bout de quelques secondes
    for (const [id, t] of this.evacT) { if ((t - dt) <= 0) { this.evacT.delete(id); g.npcCtl.map.delete(id); } else this.evacT.set(id, t - dt); }
    for (const [id, d] of this.evacuated) if (d !== g.clock.day) this.evacuated.delete(id);
    // riposte de la gendarmerie (3 étoiles et plus, contre un joueur qui a le pistolet en main)
    if ((this.volleyT -= dt) <= 0 && g.police && g.mode === 'foot' && !g.interior.inside) { this.volleyT = 1.6;
      for (const u of g.police.units) { const d = Math.hypot(u.v.x - P.x, u.v.z - P.z); const dmg = policeVolley(d, !g.coll.blocked(u.v.x, u.v.z, P.x, P.z) && g.vis > 0.15, g.weapon === 'pistolet', g.heat.stars, Math.random(), Math.random()); if (d < 40 && g.heat.stars >= 3 && g.weapon === 'pistolet') g.sfx('shot', 0.5); if (dmg) { this.hurt(dmg); if (g.needs.s.sante <= 15) { g.needs.s.sante = 45; this.bleeding = false; g.arrest(); g.hud.toast('Touché, vous vous effondrez : la gendarmerie vous interpelle. Soigné, puis amende et butin saisi.', 7); } else g.hud.toast(`La gendarmerie tire : vous êtes touché (−${dmg}).`, 2); break; } } }
  }
  private scout(bi: number) {
    const g = this.g, l = this.residents.get(bi)!; const o = this.occ(bi)!; const f = nextEmpty(l, (n, d, h) => g.sim!.stateAt(n, d, h, false), g.clock.day, g.clock.hour);
    const note = `${listenReport(o)}${f ? ' · ' + f.text : ''}`; this.scouted.set(this.skey(bi), note); g.hud.toast(`Repérage (famille ${l[0].nom}) : ${note}.`, 5);
  }
  save() { return { bag: this.bag, trunk: this.trunk, stash: this.stash, ammo: this.ammo, tools: [...this.tools], kits: this.kits, bleeding: this.bleeding, owned: [...this.owned], scouted: [...this.scouted] }; }
  load(s: any) { if (!s) return; this.bag = s.bag ?? []; this.trunk = s.trunk ?? []; this.stash = s.stash ?? []; this.ammo = s.ammo ?? 0; this.tools = new Set(s.tools ?? []); this.kits = s.kits ?? 0; this.bleeding = !!s.bleeding; this.owned = new Set(s.owned ?? []); this.scouted = new Map(s.scouted ?? []); this.cacheMeshes.forEach((m, i) => { m.visible = !this.g.looted.has('cache:' + i); }); }
  /** Repères de la minimap. */
  markers() { const out: { x: number; z: number; c: string }[] = []; if (this.fence) out.push({ x: this.fence.x, z: this.fence.z, c: '#a66bff' }); this.dens.forEach((d, i) => out.push({ x: d.x, z: d.z, c: this.owned.has(i) ? '#3ad1ff' : '#4a8fb0' })); return out; }
}
