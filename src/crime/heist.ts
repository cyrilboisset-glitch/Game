// Braquages préparés : tuyau acheté au receleur, repérage, matériel, complices, exécution, fuite, partage du magot à la planque.
// Les cibles sont FICTIVES (entrepôt, fourgon de fonds) et placées sur des emplacements neutres. Les complices sont des personnages inventés.
import * as THREE from 'three';
import type { Game } from '../game';
import type { Spot } from '../missions/generator';
import { buildHut, siteFor } from './huts';
import { fits } from './loot';

export type Role = 'chauffeur' | 'guetteur' | 'grosbras';
export const ROLES: Record<Role, { nom: string; titre: string; part: number; prix: number; effet: string }> = {
  chauffeur: { nom: 'Fredo', titre: 'chauffeur', part: 0.2, prix: 60, effet: 'sème la première patrouille si vous fuyez en voiture' },
  guetteur: { nom: 'La Fouine', titre: 'guetteur', part: 0.15, prix: 60, effet: 'retarde l\'alarme et coupe la vidéosurveillance' },
  grosbras: { nom: 'Le Taiseux', titre: 'gros bras', part: 0.2, prix: 60, effet: 'maîtrise les gardes, remplit les sacs plus vite' },
};
export interface Target { id: 'entrepot' | 'fourgon'; nom: string; x: number; z: number; win: [number, number]; bags: number; needsGun: boolean; needsMuscle: boolean; }
export interface Plan { target: Target; repere: number; phase: 'prep' | 'action' | 'fuite'; t: number; alarm: number; complication: boolean; }
export const BAG_VALUE = 1600;
const inWin = (h: number, [a, b]: [number, number]) => (a < b ? h >= a && h < b : h >= a || h < b);
const fmt = (h: number) => `${Math.floor(h)} h`;
type Opt = { label: string; run: () => void };

export class Heists {
  crew = new Set<Role>(); plan: Plan | null = null; cagoule = false; targets: Target[] = []; private van: number | null = null; private escapeT = 0; done = 0;
  constructor(private g: Game) {}
  setup(neutres: Spot[], scene: THREE.Scene, roadDist: (x: number, z: number) => number) {
    const [a, b] = [neutres[Math.floor(neutres.length * 0.3)], neutres[Math.floor(neutres.length * 0.7)]]; if (!a || !b) return;
    const s = siteFor(a.x, a.z, roadDist, (x, z) => this.g.coll.resolve({ x, z }, 3.2).depth > 0); const h = buildHut(scene, s.x, s.z, s.h, 'box', 0x3a7bd5); this.g.uw.huts.push(h.box);
    this.targets = [{ id: 'entrepot', nom: `Entrepôt de la zone (fictif)`, x: h.door.x, z: h.door.z, win: [22, 4], bags: 2, needsGun: false, needsMuscle: false },
      { id: 'fourgon', nom: 'Fourgon de transport de fonds (fictif)', x: b.x, z: b.z, win: [10, 11.5], bags: 4, needsGun: true, needsMuscle: true }];
  }
  get share() { let s = 0; for (const r of this.crew) s += ROLES[r].part; return s; }
  /** Options ajoutées au menu du receleur. */
  fenceOpts(buy: (label: string, cost: number, fn: () => void) => Opt): Opt[] {
    const g = this.g, o: Opt[] = [];
    if (!this.plan) for (const t of this.targets) o.push(buy(`Tuyau : ${t.nom} (${fmt(t.win[0])}–${fmt(t.win[1])})`, t.id === 'fourgon' ? 250 : 100, () => { this.plan = { target: t, repere: 0, phase: 'prep', t: 0, alarm: 0, complication: false }; g.hud.toast(`Tuyau : ${t.nom}. Repérez les lieux, équipez-vous, recrutez si besoin (marqué sur la carte).`, 5); }));
    for (const r of Object.keys(ROLES) as Role[]) if (!this.crew.has(r)) { const R = ROLES[r]; o.push(buy(`Recruter ${R.nom} (${R.titre}, ${Math.round(R.part * 100)} % du magot)`, R.prix, () => { this.crew.add(r); g.hud.toast(`${R.nom} est dans le coup : il ${R.effet}.`, 4); })); }
    if (!this.cagoule) o.push(buy('Cagoule', 15, () => { this.cagoule = true; g.hud.toast('Cagoule : V pour la mettre (visage et tenue difficiles à décrire).', 3); }));
    if (!g.enquete.gants) o.push(buy('Gants', 10, () => { g.enquete.gants = true; g.hud.toast('Gants : moins de traces pour les enquêteurs.', 3); }));
    o.push(buy('Jerrican d\'essence', 20, () => { g.arson.essence++; }));
    return o;
  }
  /** Options ajoutées au menu de la planque : compter et partager le magot. */
  denOpts(carNear: boolean): Opt[] {
    const g = this.g, U = g.uw; const n = U.bag.filter(i => i === 'billets').length + (carNear ? U.trunk.filter(i => i === 'billets').length : 0) + U.stash.filter(i => i === 'billets').length; if (!n) return [];
    const total = n * BAG_VALUE, mine = Math.round(total * (1 - this.share));
    return [{ label: `Compter le magot : ${n} sac${n > 1 ? 's' : ''}, ${total} €${this.crew.size ? ` (vous gardez ${mine} €)` : ''}`, run: () => {
      const strip = (l: string[]) => l.filter(i => i !== 'billets'); U.bag = strip(U.bag); U.stash = strip(U.stash); if (carNear) U.trunk = strip(U.trunk); g.money += mine; g.sfx('win');
      g.hud.toast(`Magot compté : ${total} €.${this.crew.size ? ` Parts versées à ${[...this.crew].map(r => ROLES[r].nom).join(', ')}.` : ''} Vous gardez ${mine} €.`, 6); this.crew.clear(); this.done++; } }];
  }
  /** Cible à afficher (balise, minimap). */
  marker() { const p = this.plan; if (!p || p.phase === 'fuite') return null; return { x: p.target.x, z: p.target.z, label: p.phase === 'action' ? 'Braquage en cours' : `${p.target.nom}${p.repere >= 1 ? ' (repéré)' : ' — à repérer'}` }; }
  private near(r: number) { const p = this.plan; if (!p) return false; return Math.hypot(this.g.pos.x - p.target.x, this.g.pos.z - p.target.z) < r; }
  private missing(): string[] { const g = this.g, t = this.plan!.target, m: string[] = []; if (!inWin(g.clock.hour, t.win)) m.push(`revenir entre ${fmt(t.win[0])} et ${fmt(t.win[1])}`); if (g.weapon === 'poings') m.push('une arme en main'); if (t.needsGun && g.weapon !== 'pistolet') m.push('le pistolet en main'); if (t.needsMuscle && !this.crew.has('grosbras')) m.push('un gros bras'); if (g.mode !== 'foot') m.push('être à pied'); return m; }
  prompt(): string | null {
    const p = this.plan; if (!p) return null;
    if (p.phase === 'action') { const left = Math.max(0, this.lootTime() - p.t); return p.t < 5 ? `Braquage : maîtriser les gardes… ${Math.round(p.t / 5 * 100)} %` : `Remplir les sacs… ${Math.round((1 - left / (this.lootTime() - 5)) * 100)} % — restez sur place${p.alarm > 0 && p.t > p.alarm ? ' · ALARME !' : ''}`; }
    if (p.phase !== 'prep' || !this.near(14)) return null;
    if (p.repere < 1) return `${p.target.nom} — repérage en cours… ${Math.round(p.repere * 100)} % (restez discret à proximité)`;
    const m = this.missing(); return m.length ? `${p.target.nom} — il manque : ${m.join(', ')}` : `${p.target.nom} — E : lancer le braquage${this.cagoule && !this.g.hooded ? ' (mettez la cagoule : V)' : ''}`;
  }
  private lootTime() { return 5 + (this.crew.has('grosbras') ? 7 : 11); }
  action(): boolean {
    const g = this.g, p = this.plan; if (!p || p.phase !== 'prep' || !this.near(14) || p.repere < 1) return false; if (g.nearSchool(250)) { g.hud.toast('Trop près d\'une école : on annule.', 3); return true; }
    const m = this.missing(); if (m.length) { g.hud.toast(`Pas encore : ${m.join(', ')}.`, 3); return true; }
    p.phase = 'action'; p.t = 0; p.alarm = 7 + (this.crew.has('guetteur') ? 12 : 0) + (p.repere >= 1 ? 3 : 0); p.complication = !this.crew.has('grosbras') && Math.random() < 0.35;
    g.sfx('alarm', 0.2); g.hud.toast(`« Personne ne bouge ! » — braquage lancé${this.crew.size ? ` avec ${[...this.crew].map(r => ROLES[r].nom).join(', ')}` : ''}.`, 3); return true;
  }
  update(dt: number) {
    const g = this.g, p = this.plan; if (!p) return;
    this.vanUpdate();
    if (p.phase === 'prep' && this.near(30) && p.repere < 1) { p.repere = Math.min(1, p.repere + dt / 6); if (p.repere >= 1) g.hud.toast(`Repérage fait : ${p.target.id === 'fourgon' ? '2 convoyeurs, arrêt de 10 h à 11 h 30' : '1 gardien, alarme reliée'}. Vous connaissez les lieux.`, 4); }
    if (p.phase === 'action') {
      if (!this.near(16)) { p.phase = 'prep'; g.hud.toast('Vous lâchez l\'affaire : braquage avorté.', 3); g.heat.add(25); return; }
      const t0 = p.t; p.t += dt;
      if (p.complication && t0 < 3 && p.t >= 3) { g.uw.hurt(14); g.hud.toast('Un garde résiste et vous frappe !', 2); }
      if (t0 < p.alarm && p.t >= p.alarm) { g.heat.value = Math.max(g.heat.value, 55); g.sfx('alarm'); g.hud.toast('ALARME : la gendarmerie arrive !', 3); }
      if (p.t >= this.lootTime()) { this.finish(); }
    }
    if (this.escapeT > 0) { this.escapeT -= dt; if (g.mode === 'car' && this.crew.has('chauffeur')) { this.escapeT = 0; g.heat.value = Math.max(0, g.heat.value - 18); g.police?.clearAll(); g.hud.toast('Fredo prend le volant de la fuite : première patrouille semée.', 3); } }
  }
  private finish() {
    const g = this.g, p = this.plan!; let added = 0; for (let i = 0; i < p.target.bags; i++) if (fits(g.uw.bag, 'billets')) { g.uw.bag.push('billets'); added++; }
    const extra = p.target.bags - added; if (extra > 0) { const carNear = Math.hypot(g.car.pos.x - g.pos.x, g.car.pos.z - g.pos.z) < 30; if (carNear) for (let i = 0; i < extra; i++) g.uw.trunk.push('billets'); }
    g.heat.value = Math.max(g.heat.value, 55); g.crimeFile('braquage', (g.hooded && this.cagoule ? 0.5 : 1.3) * (this.crew.has('guetteur') ? 0.7 : 1));
    g.hud.toast(`${added + (extra > 0 ? extra : 0)} sacs de billets ! Filez à la planque pour compter le magot.`, 5); this.plan = null; this.escapeT = 60;
  }
  /** Le fourgon fictif n'est là que pendant sa fenêtre horaire. */
  private vanUpdate() {
    const g = this.g, t = this.targets.find(q => q.id === 'fourgon'); if (!t || !this.plan || this.plan.target !== t) { this.removeVan(); return; }
    const here = inWin(g.clock.hour, t.win); if (here && this.van === null) this.van = g.vehicles.add({ type: 'utilitaire', paint: 0x8a9096, hp: 999, x: t.x + 3, z: t.z + 3, h: 0, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 1e6 }).id; else if (!here && (!this.plan || this.plan.phase !== 'action')) this.removeVan();
  }
  private removeVan() { if (this.van === null) return; const v = this.g.vehicles.list.find(q => q.id === this.van); if (v) this.g.vehicles.remove(v); this.van = null; }
  /** Arrestation : un complice peut balancer. */
  arrested() { if (this.crew.size && Math.random() < 0.3) { this.g.enquete.add('braquage', 25); this.g.hud.toast(`${ROLES[[...this.crew][0]].nom} a parlé aux enquêteurs…`, 4); } this.crew.clear(); this.plan = null; this.escapeT = 0; }
  save() { return { crew: [...this.crew], cagoule: this.cagoule, done: this.done }; }
  load(s: any) { if (!s) return; this.crew = new Set(s.crew ?? []); this.cagoule = !!s.cagoule; this.done = s.done ?? 0; }
}
