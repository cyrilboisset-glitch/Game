import * as THREE from 'three';
import type { Game } from '../game';
import { buildInterior } from './builder';
import { generate, collide, kindFor, rng, type Layout, type Spot } from './generator';
import { BuildingIndex, type Entry } from './entry';
import { isOpen, type Poi } from '../world/poi';
import type { Npc } from '../npc/identity';
import type { AvatarInstance } from '../player/avatar';
import { rollLoot, BULKY, ITEMS } from '../crime/loot';
import { SPECS } from '../vehicles/specs';
import { alarmK } from '../crime/skills';

/** Habitant présent lors d'une intrusion (toujours adulte : on n'entre jamais là où des enfants sont à la maison). */
interface Occupant { npc: Npc; state: 'dort' | 'eveille' | 'soumis' | 'ko'; callT: number; called: boolean; robbed: boolean; x: number; z: number; av?: AvatarInstance; }

const rr = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
/** Entrée/sortie des bâtiments (fondu), intérieur généré à la demande, interactions avec les lieux et objets. */
export class InteriorManager {
  inside = false; occ: Occupant | null = null; layout?: Layout; scene?: THREE.Scene; entry?: Entry; forced = false; poi?: Poi; bi = -1;
  index!: BuildingIndex; private fade: { t: number; fn: () => void } | null = null; private cache = new Map<number, { layout: Layout; scene: THREE.Scene }>();
  constructor(private g: Game, index: BuildingIndex, private mainScene: THREE.Scene) { this.index = index; }
  get busy() { return this.fade !== null; }

  /** Retourne le texte à afficher si un bâtiment est à portée de porte. */
  nearDoorPrompt(): string {
    const e = this.index.find(this.g.player.pos.x, this.g.player.pos.z); if (!e) return '';
    const poi = this.index.poi(e.bi); const state = this.access(e.bi, poi);
    const info = poi ? '' : this.g.uw.doorInfo(e.bi); const pre = poi ? poi.nom + ' — ' : info ? info + ' — ' : '';
    return state === 'ouvert' ? `${pre}E : entrer` : state === 'ferme' ? `${poi?.nom ?? 'Établissement'} — fermé` : `${pre}E : ${this.g.uw.tools.has('crochet') ? 'crocheter (sans bruit)' : 'forcer la porte'}`;
  }
  private access(bi: number, poi?: Poi): 'ouvert' | 'ferme' | 'verrouille' {
    const open = poi ? isOpen(poi.horaires, poi.sous_type, this.g.clock.hour, this.g.dow()) : false;
    const kind = kindFor(poi?.sous_type, this.index.dims(bi).area, rng(bi * 7919 + 13));
    if (kind === 'ecole') return open ? 'ouvert' : 'ferme';            // les écoles ne sont jamais cambriolées
    if (poi && open) return 'ouvert';
    if (!poi && rng(bi * 31 + 5)() < 0.15) return 'ouvert';              // quelques logements laissés ouverts
    return 'verrouille';
  }
  tryEnter() {
    const e = this.index.find(this.g.player.pos.x, this.g.player.pos.z); if (!e || this.fade) return false;
    const poi = this.index.poi(e.bi); const st = this.access(e.bi, poi);
    if (st === 'ferme') { this.g.hud.toast('C\'est fermé.'); return true; }
    const o = this.g.uw.occ(e.bi); if (o && o.minors.length) { this.g.hud.toast('Des enfants sont à la maison : vous renoncez.', 3); return true; }
    if (st === 'verrouille' && this.g.uw.tools.has('crochet')) { this.g.uw.startPick(e); return true; }
    this.forced = st === 'verrouille'; this.poi = poi;
    if (this.forced) { this.g.crime(20, 25); const hk = this.homeKey(e.bi, poi); const alarm = hk && this.g.memory.alarmed(hk, this.g.clock.day) ? Math.random() < 0.8 : poi ? Math.random() < 0.35 : Math.random() < 0.15; if (hk) this.g.memory.burgled(hk, this.g.clock.day); if (alarm) { this.g.crime(20, 70); this.g.sfx('alarm'); this.g.hud.toast('Porte forcée… ALARME !'); } else { this.g.sfx('glass'); this.g.hud.toast('Vous forcez la porte.'); } }
    this.noisy = this.forced; this.transition(() => this.enter(e)); return true;
  }
  private noisy = false; refused = false;
  /** Clé d'un logement (bâtiment + appartement) pour la mémoire du voisinage ; null pour un commerce. */
  homeKey(bi: number, poi?: Poi) { return poi ? null : `${bi}/${this.g.uw.units(bi) > 1 ? this.g.uw.aptNo(bi) : 0}`; }
  /** Entrée après crochetage : discrète, alarme rare. */
  enterQuiet(e: Entry) {
    const poi = this.index.poi(e.bi); const o = this.g.uw.occ(e.bi); if (o && o.minors.length) { this.g.hud.toast('Des enfants sont à la maison : vous renoncez.', 3); return; }
    this.forced = true; this.noisy = false; this.poi = poi; this.g.crime(12, 3);
    const hk = this.homeKey(e.bi, poi); const alarmed = !!hk && this.g.memory.alarmed(hk, this.g.clock.day); if (hk) this.g.memory.burgled(hk, this.g.clock.day);
    if (Math.random() < (alarmed ? 0.6 : poi ? 0.2 : 0.06) * alarmK(this.g.skills.level('crochetage'))) { this.g.crime(20, 70); this.g.sfx('alarm'); this.g.hud.toast('La serrure cède… mais une ALARME se déclenche !'); } else { this.g.sfx('unlock'); this.g.hud.toast('La serrure cède sans bruit.'); }
    this.transition(() => this.enter(e));
  }
  private transition(fn: () => void) { this.fade = { t: 0.5, fn }; this.g.hud.veil(1); this.g.sfx('door'); }
  private enter(e: Entry) {
    this.entry = e; this.bi = e.bi; this.apt = !this.poi && this.g.uw.units(e.bi) > 1 ? this.g.uw.aptNo(e.bi) : -1; const ck = e.bi * 1000 + this.apt + 1; let c = this.cache.get(ck);
    if (!c) { const d = this.index.dims(e.bi); const flat = this.apt >= 0; const kind = flat ? 'logement' : kindFor(this.poi?.sous_type, d.area, rng(e.bi * 7919 + 13)); const layout = flat ? generate(kind, 10 + (this.apt % 3), 8.5 + (this.apt % 2), e.bi * 7919 + 1 + this.apt * 31) : generate(kind, d.w * 0.95, d.d * 0.95, e.bi * 7919 + 1); c = { layout, scene: buildInterior(layout) }; this.cache.set(ck, c); if (this.cache.size > 6) { const k = this.cache.keys().next().value!; this.cache.delete(k); } }
    this.layout = c.layout; this.scene = c.scene; this.inside = true;
    this.mainScene.remove(this.g.player.root); this.scene.add(this.g.player.root); this.g.player.root.visible = true;
    this.g.player.pos.set(c.layout.spawn.x, 0, c.layout.spawn.z); this.g.player.heading = Math.PI; this.g.camYaw = Math.PI; this.g.camPitch = 0.3;
    this.g.hud.toast(`${this.poi?.nom ?? 'Intérieur'} · lieu généré (pas une reproduction réelle)`, 4); this.refused = false;
    // un commerçant déjà braqué reconnaît votre visage : il refuse de vous servir et appelle
    if (this.poi && !this.forced && this.g.memory.recognizes(this.poi.id, this.g.clock.day, this.g.hooded, this.g.outfitId(), Math.random())) { this.refused = true; this.g.sfx('voice', 1); this.g.report(-7000 - e.bi, 5, 25, { outfit: this.g.outfitId(), vehicle: null, face: true }); this.g.hud.toast('« C\'est lui ! C\'est lui qui m\'a braqué ! » — le commerçant vous reconnaît et décroche son téléphone.', 5); } this.refresh(); this.spawnOccupant(e);
  }
  /** Cache les objets déjà emportés et les repères des meubles déjà fouillés. */
  private refresh() { this.scene?.traverse(o => { const b = o.userData.bulky as string | undefined, sp = o.userData.spot as string | undefined; const s = this.layout!.spots.find(q => q.id === (b ?? sp)); if (s && (b || sp)) o.visible = !this.used(s); }); }
  private spawnOccupant(e: Entry) {
    if (this.occ?.av) this.scene?.remove(this.occ.av.root); this.occ = null; const g = this.g, l = this.layout!; if (l.kind !== 'logement') return;
    const o = g.uw.occ(e.bi); if (!o || !o.adults.length) return; const npc = o.adults[0];
    const sofa = l.boxes.find(b => b.tag === 'canape'), bed = l.boxes.find(b => b.tag === 'lit');
    const asleep = o.asleep && !this.noisy; const at = asleep && bed ? { x: bed.x, z: bed.z } : sofa ? { x: sofa.x, z: sofa.z + 1.0 } : { x: l.W / 2, z: l.D / 2 };
    this.occ = { npc, state: asleep ? 'dort' : 'eveille', callT: this.noisy ? 7 : 10, called: false, robbed: false, x: at.x, z: at.z };
    if (g.avatars) { const av = g.avatars.create(npc.outfit, npc.look); av.root.position.set(at.x, asleep ? 0.62 : 0, at.z); if (asleep) { av.root.rotation.set(Math.PI / 2, 0, 0, 'YXZ'); } else av.root.rotation.y = Math.atan2(l.W / 2 - at.x, l.D - at.z); this.scene!.add(av.root); this.occ.av = av; }
    const who = `${npc.prenom} ${npc.nom}`; const more = o.adults.length > 1 ? ` (et ${o.adults.length - 1} autre${o.adults.length > 2 ? 's' : ''})` : '';
    g.hud.toast(asleep ? `${who}${more} dort. Pas un bruit…` : this.noisy ? `${who}${more} vous a entendu et attrape son téléphone !` : `« Qui est là ?! » — ${who}${more} vous a vu.`, 4);
  }
  /** Habitant : appel à la gendarmerie, menace, vol des clés, assommer. */
  private occupantUpdate(dt: number) {
    const c = this.occ; if (!c) return; const g = this.g; c.av?.update(dt);
    if (c.state === 'eveille' && !c.called && (c.callT -= dt) <= 0) { c.called = true; g.heat.add(30); g.profile = { outfit: g.outfitId(), vehicle: null, face: !g.hooded }; g.sfx('alarm', 0.4); g.hud.toast(`📞 ${c.npc.prenom} a appelé la gendarmerie et vous décrit !`, 4); }
  }
  private occupantPrompt(): string | null {
    const c = this.occ; if (!c || c.state === 'ko') return null; const p = this.g.player.pos; if (Math.hypot(c.x - p.x, c.z - p.z) > 2.2) return null; const armed = this.g.weapon !== 'poings';
    if (c.state === 'dort') return c.robbed ? `${c.npc.prenom} dort toujours · sortez sans bruit` : `${c.npc.prenom} dort — E : prendre clés et portefeuille sur la table de nuit · F : assommer`;
    if (c.state === 'soumis') return `${c.npc.prenom} ne bouge plus${c.robbed ? '' : ' — E : prendre clés et argent'}`;
    return `${c.npc.prenom} (${c.npc.age} ans) — E : ${armed ? 'menacer : les clés et l\'argent' : 'exiger les clés (sans arme…)'} · F : frapper`;
  }
  private occupantAct(key: 'E' | 'F') {
    const c = this.occ!, g = this.g, armed = g.weapon !== 'poings'; const she = c.npc.genre === 'F';
    if (key === 'F') { g.player.punch(); g.sfx('crash', 0.25); if (c.state === 'dort' || armed || Math.random() < 0.45) { c.state = 'ko'; if (c.av) { c.av.root.rotation.set(-Math.PI / 2, c.av.root.rotation.y, 0, 'YXZ'); c.av.root.position.y = c.av.root.position.y > 0.3 ? 0.62 : 0.18; } g.hud.toast(`${c.npc.prenom} est assommé${she ? 'e' : ''}.`, 2.5); } else { g.uw.hurt(8); c.callT = Math.min(c.callT, 3); g.hud.toast(`${c.npc.prenom} se débat et vous frappe !`, 2); } g.crime(20, 8); return; }
    if (c.state === 'dort') { if (c.robbed) return; if (Math.random() < 0.7) { this.rob(); } else { c.state = 'eveille'; c.callT = 5; if (c.av) { c.av.root.rotation.set(0, 0, 0); c.av.root.position.y = 0; } g.hud.toast(`${c.npc.prenom} se réveille en sursaut !`, 3); } return; }
    if (c.state === 'soumis') { if (!c.robbed) this.rob(); return; }
    if (armed) { c.state = 'soumis'; c.callT = 1e9; c.av?.pose('handsup', 1); g.crime(40, 8); g.crimeFile('homejacking', 1); g.hud.toast(`${c.npc.prenom} lève les mains et vous tend ce que vous demandez.`, 3); this.rob(); }
    else { c.callT = Math.min(c.callT, 2); g.hud.toast(`${c.npc.prenom} refuse et crie au secours !`, 2.5); g.crime(15, 30); }
  }
  /** Hold-up : commerce ouvert, arme en main, à la caisse ou au guichet (jamais une école, jamais déjà braqué aujourd'hui). */
  private holdupable(s: Spot) { return !this.forced && this.g.weapon !== 'poings' && (s.kind === 'acheter' || s.kind === 'coffre') && this.layout!.kind !== 'ecole' && !this.g.looted.has(`holdup:${this.bi}:${this.g.clock.day}`); }
  private holdup(s: Spot) {
    const g = this.g, bank = this.layout!.kind === 'banque'; if (this.poi && !g.hooded) g.memory.saw(this.poi.id, g.clock.day, g.outfitId()); g.looted.add(`holdup:${this.bi}:${g.clock.day}`); g.player.punch();
    const m = bank ? rr(1800, 4200) : this.layout!.kind === 'supermarche' ? rr(300, 900) : rr(120, 450); g.money += m; g.sfx('alarm');
    g.heat.value = Math.max(g.heat.value, bank ? 62 : 42); g.crimeFile('holdup', bank ? 1.3 : 1); g.repUp(bank ? 6 : 3); g.report(-1 - this.bi, 4, 10, { outfit: g.hooded && g.heists.cagoule ? null : g.outfitId(), vehicle: null, face: !g.hooded });
    g.hud.toast(`« La caisse, vite ! » — ${s.kind === 'coffre' ? 'le guichetier' : 'le personnel'} vous tend ${m} €. L'alarme silencieuse est déclenchée.`, 5); void s;
  }
  /** Argent du foyer + clés de voiture : le véhicule du foyer vous attend devant (home-jacking). */
  private rob() {
    const c = this.occ!, g = this.g; c.robbed = true; const cash = Math.min(300, c.npc.argent); g.money += cash; g.sfx('coin');
    const hasCar = g.uw.residentsOf(this.bi).some(n => n.hasCar) && !g.looted.has(`cles:${this.bi}/${this.apt}:${g.clock.day}`); let msg = `+${cash} €`;
    if (hasCar) { g.looted.add(`cles:${this.bi}/${this.apt}:${g.clock.day}`); const e = this.entry!; const types = ['citadine', 'break', 'berline'] as const; const t = types[c.npc.seed % 3]; const paint = [0xe8e8e8, 0x1c1c1f, 0x8a1c1c, 0x1f3f78, 0xb9bcc0][c.npc.seed % 5];
      g.vehicles.add({ type: t, paint, hp: SPECS[t].hp, x: e.px + e.nx * 5, z: e.pz + e.nz * 5, h: Math.atan2(-e.nz, e.nx), speed: 0, kind: 'gare', mine: true, upgrade: 0, stun: 0 }); msg += ` et les clés de sa ${SPECS[t].nom.toLowerCase()} (garée devant)`; }
    g.hud.toast(`Vous prenez ${msg}.`, 4);
  }
  exit() { if (this.fade) return; const c = this.occ; if (c && !c.called && c.state !== 'dort') this.g.report(c.npc.id, c.state === 'ko' ? 60 : 15, 35, { outfit: this.g.outfitId(), vehicle: null, face: !this.g.hooded }); if (c?.av) this.scene?.remove(c.av.root); this.occ = null; this.transition(() => { const e = this.entry!; this.scene?.remove(this.g.player.root); this.mainScene.add(this.g.player.root); this.inside = false; this.g.player.pos.set(e.px + e.nx * 1.3, 0, e.pz + e.nz * 1.3); this.g.player.heading = Math.atan2(e.nx, e.nz); this.g.camYaw = this.g.player.heading + Math.PI; }); }
  tick(dt: number) { if (!this.fade) return; this.fade.t -= dt; if (this.fade.t <= 0) { const f = this.fade.fn; this.fade = null; f(); this.g.hud.veil(0); } }

  update(dt: number) {
    const g = this.g, l = this.layout!, p = g.player, inp = g.input;
    if (!this.fade) { p.update(dt, inp.x, inp.y, g.camYaw, inp.run, g.needs.speedFactor * 0.9 * g.uw.speedFactor); collide(l, p.pos, p.radius); if (this.occ) { const c = this.occ, dx = p.pos.x - c.x, dz = p.pos.z - c.z, d = Math.hypot(dx, dz); if (c.state !== 'dort' && d < 0.6 && d > 1e-4) { p.pos.x = c.x + dx / d * 0.6; p.pos.z = c.z + dz / d * 0.6; } } } else p.update(dt, 0, 0, g.camYaw, false, 1);
    p.root.position.copy(p.pos);
    // sortir : en franchissant la porte, ou avec le bouton « Sortir » (Échap) depuis n'importe où dans la pièce
    if (!this.fade && !g.sleeping && (inp.hit('Escape', 'exit') || (p.pos.z > l.D + 0.35 && Math.abs(p.pos.x - l.door.x) < 1.2))) { this.exit(); return; }
    this.occupantUpdate(dt); const op = this.occupantPrompt();
    if (op && !g.sleeping) { if (inp.hit('KeyE', 'action')) this.occupantAct('E'); else if (inp.hit('KeyF', 'hit')) this.occupantAct('F'); }
    else if (!g.sleeping && inp.hit('KeyE', 'action')) { const s = this.nearSpot(); if (s) this.act(s); }
    else if (!g.sleeping && inp.hit('KeyF', 'hit')) { const s = this.nearSpot(); if (s && this.holdupable(s)) this.holdup(s); }
    const sp = this.nearSpot(); g.hud.prompt(g.sleeping ? 'R : se réveiller' : op ?? (sp ? `E : ${sp.label}${this.holdupable(sp) ? ' · F : braquer la caisse' : ''}` : ''));
  }
  private nearSpot(): Spot | null {
    const p = this.g.player.pos; let best: Spot | null = null, bd = this.g.input.touch ? 2.4 : 1.7;
    for (const s of this.layout!.spots) { if (s.kind !== 'sortie' && this.used(s)) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  apt = -1;
  private key(s: Spot) { return `${this.bi}${this.apt >= 0 ? '/' + this.apt : ''}:${s.id}:${s.kind === 'prendre' ? this.g.clock.day : 0}`; }
  private used(s: Spot) { return ['fouiller', 'prendre', 'coffre', 'emporter'].includes(s.kind) && this.g.looted.has(this.key(s)); }
  camera(d = 2.6) {
    const g = this.g, l = this.layout!, y = g.camYaw, pch = Math.min(Math.max(g.camPitch, 0.25), 0.7);
    const cx = Math.sin(y) * Math.cos(pch), cz = Math.cos(y) * Math.cos(pch); const t = { x: g.player.pos.x - cx * d, z: g.player.pos.z - cz * d };
    collide(l, t, 0.25); t.x = Math.max(0.3, Math.min(l.W - 0.3, t.x)); t.z = Math.max(0.3, Math.min(l.D - 0.3, t.z));   // la caméra reste dans la pièce
    const ty = Math.min(l.H - 0.3, 1.5 + Math.sin(pch) * d);
    return { pos: new THREE.Vector3(t.x, ty, t.z), look: new THREE.Vector3(g.player.pos.x, 1.2, g.player.pos.z) };
  }
  private act(s: Spot) {
    const sfxOk = () => this.g.sfx('loot');
    const g = this.g, l = this.layout!, hud = g.hud, open = !this.forced, key = this.key(s);
    const once = () => { g.looted.add(key); };
    switch (s.kind) {
      case 'sortie': this.exit(); break;
      case 'acheter': if (open && this.refused) return hud.toast('« Sortez d\'ici ! On ne vous servira pas. »', 3);
        if (!open) { if (g.looted.has(key)) return; once(); const m = rr(20, 80); g.money += m; g.crime(10); hud.toast(`Vous vidant la caisse : +${m} €`); break; }
        if (l.kind === 'coiffeur') { if (g.money < 15) return hud.toast('Il vous faut 15 €.'); g.money -= 15; g.heat.value = Math.max(0, g.heat.value - 30); hud.toast('Nouveau look : on vous reconnaîtra moins (−15 €).'); }
        else if (l.kind === 'pharmacie') { if (g.money < 5) return hud.toast('Il vous faut 5 €.'); g.money -= 5; g.needs.s.sante = Math.min(100, g.needs.s.sante + 20); g.uw.bleeding = false; g.uw.kits++; hud.toast('Soins et une trousse de secours (−5 €).'); }
        else if (['clothes', 'shoes', 'second_hand', 'sports'].includes(this.poi?.sous_type ?? '')) { if (g.money < 25) return hud.toast('Une tenue coûte 25 €.'); g.money -= 25; g.newOutfit(); hud.toast('Nouvelle tenue (−25 €) : on vous reconnaîtra moins.'); }
        else { if (g.money < 5) return hud.toast('Il vous faut 5 €.'); g.money -= 5; g.inv.nourriture++; g.inv.eau++; hud.toast('Achat : 1 repas + 1 eau (−5 €).'); } break;
      case 'prendre': if (g.looted.has(key)) return; once(); if (['clothes', 'shoes', 'second_hand', 'sports'].includes(this.poi?.sous_type ?? '')) { g.newOutfit(); if (open) g.crime(12, 10); return hud.toast(open ? 'Vous filez avec des vêtements volés sur le dos.' : 'Vous vous servez en vêtements.'); } g.inv.nourriture++; if (Math.random() < 0.6) g.inv.eau++;
        if (open) { g.crime(14); if (Math.random() < 0.4) { g.crime(18); hud.toast('On vous a vu prendre ça !'); } else hud.toast('Vous empochez discrètement.'); } else hud.toast('Vous vous servez.'); break;
      case 'manger': if (!open) { if (g.looted.has(key)) return; once(); g.needs.eat(25); g.crime(5); return hud.toast('Vous grignotez en cuisine.'); } if (g.money < 12) return hud.toast('Il vous faut 12 €.'); g.money -= 12; g.needs.eat(60); g.needs.drink(15); hud.toast('Bon repas (−12 €).'); break;
      case 'boire': if (!open) { if (g.looted.has(key)) return; once(); g.needs.drink(25); g.crime(5); return hud.toast('Vous buvez derrière le bar.'); } if (g.money < 4) return hud.toast('Il vous faut 4 €.'); g.money -= 4; g.needs.drink(35); hud.toast('Une boisson (−4 €).'); break;
      case 'fouiller': { once();
        // objets contondants et vêtements selon le lieu
        const wchance: Record<string, [string, number][]> = { atelier: [['barre', 0.35], ['cle', 0.35]], logement: [['batte', 0.1], ['bouteille', 0.15]], bureau: [['cle', 0.05]], restaurant: [['bouteille', 0.4]], bar: [['bouteille', 0.5]] };
        for (const [w, p] of wchance[l.kind] ?? []) if (Math.random() < p) { const nouveau = g.giveWeapon(w as never); sfxOk(); return hud.toast(nouveau ? `Vous trouvez : ${w === 'cle' ? 'une clé à molette' : w === 'barre' ? 'une barre de fer' : w === 'batte' ? 'une batte' : 'une bouteille'} (T pour changer d'objet en main).` : 'Rien de plus que ce que vous avez déjà.'); }
        if (l.kind === 'atelier' && !g.uw.tools.has('crochet') && Math.random() < 0.2) { g.uw.tools.add('crochet'); sfxOk(); return hud.toast('Vous trouvez un crochet de serrurier : les portes verrouillées s\'ouvrent sans bruit.', 4); }
        { const it = rollLoot(l.kind, s.id, Math.random); if (it && g.uw.take(it)) { sfxOk(); return hud.toast(`Vous trouvez : ${ITEMS[it].nom.toLowerCase()} (${ITEMS[it].kg} kg, sac ${g.uw.carried.toFixed(1)} kg).`, 3); } }
        if (l.kind === 'logement' && s.id === 'arm' && Math.random() < 0.6) { g.newOutfit(); return hud.toast('Vous enfilez d\'autres vêtements : votre signalement ne colle plus.'); }
        const r = Math.random(); if (r < 0.4) { const m = rr(5, 35); g.money += m; hud.toast(`Vous trouvez ${m} €.`); } else if (r < 0.65) { g.inv.nourriture++; hud.toast('Vous trouvez de quoi manger.'); } else if (r < 0.85) { g.inv.eau++; hud.toast('Vous trouvez une bouteille d\'eau.'); } else hud.toast('Rien d\'intéressant.'); break; }
      case 'emporter': { const it = BULKY[s.id]; if (!it || !g.uw.take(it)) return; once(); this.refresh(); g.sfx('door'); hud.toast(`Vous embarquez : ${ITEMS[it].nom.toLowerCase()} (sac ${g.uw.carried.toFixed(1)} kg${g.uw.carried > 6 ? ', vous êtes ralenti' : ''}).`, 3); break; }
      case 'coffre': g.sfx('alarm'); if (g.looted.has(key)) return; once(); { const m = rr(250, 700); g.money += m; g.crime(60); if (Math.random() < 0.6) g.crime(30); hud.toast(`Coffre forcé : +${m} € — la gendarmerie sera prévenue.`); } break;
      case 'dormir': g.sleeping = true; hud.toast('Vous vous couchez… (R pour vous réveiller)'); break;
      case 'toilettes': g.needs.relieve(); g.sfx('flush'); hud.toast('Soulagé, en toute discrétion.'); break;
      case 'robinet': g.needs.drink(30); hud.toast('Vous buvez au robinet.'); break;
    }
  }
}
