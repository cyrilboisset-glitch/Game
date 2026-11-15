import * as THREE from 'three';
import type { Game } from '../game';
import { buildInterior } from './builder';
import { generate, collide, kindFor, rng, type Layout, type Spot } from './generator';
import { BuildingIndex, type Entry } from './entry';
import { isOpen, type Poi } from '../world/poi';

const rr = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
/** Entrée/sortie des bâtiments (fondu), intérieur généré à la demande, interactions avec les lieux et objets. */
export class InteriorManager {
  inside = false; layout?: Layout; scene?: THREE.Scene; entry?: Entry; forced = false; poi?: Poi; bi = -1;
  index!: BuildingIndex; private fade: { t: number; fn: () => void } | null = null; private cache = new Map<number, { layout: Layout; scene: THREE.Scene }>();
  constructor(private g: Game, index: BuildingIndex, private mainScene: THREE.Scene) { this.index = index; }
  get busy() { return this.fade !== null; }

  /** Retourne le texte à afficher si un bâtiment est à portée de porte. */
  nearDoorPrompt(): string {
    const e = this.index.find(this.g.player.pos.x, this.g.player.pos.z); if (!e) return '';
    const poi = this.index.poi(e.bi); const state = this.access(e.bi, poi);
    return state === 'ouvert' ? `${poi ? poi.nom + ' — ' : ''}E : entrer` : state === 'ferme' ? `${poi?.nom ?? 'Établissement'} — fermé` : `${poi ? poi.nom + ' — ' : ''}E : forcer la porte`;
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
    this.forced = st === 'verrouille'; this.poi = poi;
    if (this.forced) { this.g.heat.add(20); const alarm = poi ? Math.random() < 0.35 : Math.random() < 0.15; if (alarm) { this.g.heat.add(20); this.g.hud.toast('Porte forcée… ALARME !'); } else this.g.hud.toast('Vous forcez la porte.'); }
    this.transition(() => this.enter(e)); return true;
  }
  private transition(fn: () => void) { this.fade = { t: 0.5, fn }; this.g.hud.veil(1); }
  private enter(e: Entry) {
    this.entry = e; this.bi = e.bi; let c = this.cache.get(e.bi);
    if (!c) { const d = this.index.dims(e.bi); const kind = kindFor(this.poi?.sous_type, d.area, rng(e.bi * 7919 + 13)); const layout = generate(kind, d.w * 0.95, d.d * 0.95, e.bi * 7919 + 1); c = { layout, scene: buildInterior(layout) }; this.cache.set(e.bi, c); if (this.cache.size > 6) { const k = this.cache.keys().next().value!; this.cache.delete(k); } }
    this.layout = c.layout; this.scene = c.scene; this.inside = true;
    this.mainScene.remove(this.g.player.root); this.scene.add(this.g.player.root); this.g.player.root.visible = true;
    this.g.player.pos.set(c.layout.spawn.x, 0, c.layout.spawn.z); this.g.player.heading = Math.PI; this.g.camYaw = Math.PI; this.g.camPitch = 0.3;
    this.g.hud.toast(`${this.poi?.nom ?? 'Intérieur'} · lieu généré (pas une reproduction réelle)`, 4);
  }
  exit() { if (this.fade) return; this.transition(() => { const e = this.entry!; this.scene?.remove(this.g.player.root); this.mainScene.add(this.g.player.root); this.inside = false; this.g.player.pos.set(e.px + e.nx * 1.3, 0, e.pz + e.nz * 1.3); this.g.player.heading = Math.atan2(e.nx, e.nz); this.g.camYaw = this.g.player.heading + Math.PI; }); }
  tick(dt: number) { if (!this.fade) return; this.fade.t -= dt; if (this.fade.t <= 0) { const f = this.fade.fn; this.fade = null; f(); this.g.hud.veil(0); } }

  update(dt: number) {
    const g = this.g, l = this.layout!, p = g.player, inp = g.input;
    if (!this.fade) { p.update(dt, inp.x, inp.y, g.camYaw, inp.run, g.needs.speedFactor * 0.9); collide(l, p.pos, p.radius); } else p.update(dt, 0, 0, g.camYaw, false, 1);
    p.root.position.copy(p.pos);
    if (!g.sleeping && inp.hit('KeyE', 'action')) { const s = this.nearSpot(); if (s) this.act(s); }
    const sp = this.nearSpot(); g.hud.prompt(g.sleeping ? 'R : se réveiller' : sp ? `E : ${sp.label}` : '');
  }
  private nearSpot(): Spot | null {
    const p = this.g.player.pos; let best: Spot | null = null, bd = 1.7;
    for (const s of this.layout!.spots) { if (s.kind !== 'sortie' && this.used(s)) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  private key(s: Spot) { return `${this.bi}:${s.id}:${s.kind === 'prendre' ? this.g.clock.day : 0}`; }
  private used(s: Spot) { return ['fouiller', 'prendre', 'coffre'].includes(s.kind) && this.g.looted.has(this.key(s)); }
  camera(d = 2.6) {
    const g = this.g, l = this.layout!, y = g.camYaw, pch = Math.min(Math.max(g.camPitch, 0.25), 0.7);
    const cx = Math.sin(y) * Math.cos(pch), cz = Math.cos(y) * Math.cos(pch); const t = { x: g.player.pos.x - cx * d, z: g.player.pos.z - cz * d };
    collide(l, t, 0.25); t.x = Math.max(0.3, Math.min(l.W - 0.3, t.x)); t.z = Math.max(0.3, Math.min(l.D - 0.3, t.z));   // la caméra reste dans la pièce
    const ty = Math.min(l.H - 0.3, 1.5 + Math.sin(pch) * d);
    return { pos: new THREE.Vector3(t.x, ty, t.z), look: new THREE.Vector3(g.player.pos.x, 1.2, g.player.pos.z) };
  }
  private act(s: Spot) {
    const g = this.g, l = this.layout!, hud = g.hud, open = !this.forced, key = this.key(s);
    const once = () => { g.looted.add(key); };
    switch (s.kind) {
      case 'sortie': this.exit(); break;
      case 'acheter':
        if (!open) { if (g.looted.has(key)) return; once(); const m = rr(20, 80); g.money += m; g.heat.add(10); hud.toast(`Vous vidant la caisse : +${m} €`); break; }
        if (l.kind === 'coiffeur') { if (g.money < 15) return hud.toast('Il vous faut 15 €.'); g.money -= 15; g.heat.value = Math.max(0, g.heat.value - 30); hud.toast('Nouveau look : on vous reconnaîtra moins (−15 €).'); }
        else if (l.kind === 'pharmacie') { if (g.money < 5) return hud.toast('Il vous faut 5 €.'); g.money -= 5; g.needs.s.sante = Math.min(100, g.needs.s.sante + 20); hud.toast('Vous soignez vos blessures (−5 €).'); }
        else { if (g.money < 5) return hud.toast('Il vous faut 5 €.'); g.money -= 5; g.inv.nourriture++; g.inv.eau++; hud.toast('Achat : 1 repas + 1 eau (−5 €).'); } break;
      case 'prendre': if (g.looted.has(key)) return; once(); g.inv.nourriture++; if (Math.random() < 0.6) g.inv.eau++;
        if (open) { g.heat.add(14); if (Math.random() < 0.4) { g.heat.add(18); hud.toast('On vous a vu prendre ça !'); } else hud.toast('Vous empochez discrètement.'); } else hud.toast('Vous vous servez.'); break;
      case 'manger': if (!open) { if (g.looted.has(key)) return; once(); g.needs.eat(25); g.heat.add(5); return hud.toast('Vous grignotez en cuisine.'); } if (g.money < 12) return hud.toast('Il vous faut 12 €.'); g.money -= 12; g.needs.eat(60); g.needs.drink(15); hud.toast('Bon repas (−12 €).'); break;
      case 'boire': if (!open) { if (g.looted.has(key)) return; once(); g.needs.drink(25); g.heat.add(5); return hud.toast('Vous buvez derrière le bar.'); } if (g.money < 4) return hud.toast('Il vous faut 4 €.'); g.money -= 4; g.needs.drink(35); hud.toast('Une boisson (−4 €).'); break;
      case 'fouiller': { once(); const r = Math.random(); if (r < 0.4) { const m = rr(5, 35); g.money += m; hud.toast(`Vous trouvez ${m} €.`); } else if (r < 0.65) { g.inv.nourriture++; hud.toast('Vous trouvez de quoi manger.'); } else if (r < 0.85) { g.inv.eau++; hud.toast('Vous trouvez une bouteille d\'eau.'); } else hud.toast('Rien d\'intéressant.'); break; }
      case 'coffre': if (g.looted.has(key)) return; once(); { const m = rr(250, 700); g.money += m; g.heat.add(60); if (Math.random() < 0.6) g.heat.add(30); hud.toast(`Coffre forcé : +${m} € — la gendarmerie sera prévenue.`); } break;
      case 'dormir': g.sleeping = true; hud.toast('Vous vous couchez… (R pour vous réveiller)'); break;
      case 'toilettes': g.needs.relieve(); hud.toast('Soulagé, en toute discrétion.'); break;
      case 'robinet': g.needs.drink(30); hud.toast('Vous buvez au robinet.'); break;
    }
  }
}
