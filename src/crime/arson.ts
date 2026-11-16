// Incendie côté jeu : mettre le feu (G), propagation aux voitures et bâtiments voisins, évacuation des habitants, pompiers, effacement des traces.
import * as THREE from 'three';
import type { Game } from '../game';
import type { AvatarInstance } from '../player/avatar';
import { FireSim, FireFx, type Fuel, type FireNode } from './fire';

const SCHOOL = ['school', 'college', 'kindergarten'];
interface Crew { truck: number; tx: number; tz: number; men: { av?: AvatarInstance; x: number; z: number }[]; arrive: number; retreat: number; leaveT: number; }

export class Arson {
  sim = new FireSim(); fx?: FireFx; essence = 0; lighter = true; crew: Crew | null = null; private dispatchT = -1; private scene?: THREE.Scene;
  roadNear: (x: number, z: number) => { x: number; z: number; h: number } | null = () => null;
  constructor(private g: Game) {}
  attach(scene: THREE.Scene, roadNear: Arson['roadNear']) { this.scene = scene; this.fx = new FireFx(scene); this.roadNear = roadNear; }
  private school(bi: number) { const p = this.g.interior.index.poi(bi); return !!p && SCHOOL.includes(p.sous_type); }
  /** Combustible « bâtiment » : points de flammes sur le pourtour (hauteurs réparties). */
  buildingFuel(bi: number): Fuel | null {
    if (this.school(bi)) return null; const b = this.g.world.builds[bi]; const p = b.p.slice(0, -1); let cx = 0, cz = 0; for (const [x, z] of p) { cx += x; cz += z; } cx /= p.length; cz /= p.length;
    const step = Math.max(1, Math.floor(p.length / 8)); const pts: [number, number, number][] = [];
    for (let i = 0; i < p.length; i += step) { const [x, z] = p[i], dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; pts.push([x + dx / l * 0.4, 0.3 + (i % 3) * Math.min(3, b.h / 3), z + dz / l * 0.4]); pts.push([x + dx / l * 0.2, Math.max(1, b.h - 0.5), z + dz / l * 0.2]); }
    return { key: 'b:' + bi, kind: 'batiment', x: cx, z: cz, pts };
  }
  private carFuel(id: number | 'own', x: number, z: number, h: number): Fuel { const fx = Math.sin(h), fz = Math.cos(h); return { key: 'v:' + id, kind: 'voiture', x, z, pts: [[x + fx * 1.2, 0.8, z + fz * 1.2], [x, 1.0, z], [x - fx * 1.2, 0.8, z - fz * 1.2]] }; }
  private neighbors(n: FireNode, r: number): Fuel[] {
    const g = this.g, out: Fuel[] = [];
    for (const v of g.vehicles.near(n.x, n.z, r)) if (!v.kind.startsWith('patrouille') && v.kind !== 'poursuite' && v.hp > 0) out.push(this.carFuel(v.id, v.x, v.z, v.h));
    if (Math.hypot(g.car.pos.x - n.x, g.car.pos.z - n.z) < r && g.car.hp > 0) out.push(this.carFuel('own', g.car.pos.x, g.car.pos.z, g.car.heading));
    const seen = new Set<number>(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const e = g.interior.index.find(n.x + Math.sin(a) * r * 0.7, n.z + Math.cos(a) * r * 0.7, r * 0.5); if (e && !seen.has(e.bi)) { seen.add(e.bi); const f = this.buildingFuel(e.bi); if (f) out.push(f); } }
    return out;
  }
  /** Cible d'un départ de feu à portée (voiture, puis bâtiment). */
  target(): { label: string; fuel: Fuel } | null {
    const g = this.g, P = g.player.pos; if (g.mode !== 'foot' || g.interior.inside) return null;
    const v = g.nearestVehicle(3.2); if (v && v.kind !== 'poursuite' && v.hp > 0 && !this.sim.done('v:' + v.id)) return { label: 'mettre le feu à cette voiture', fuel: this.carFuel(v.id, v.x, v.z, v.h) };
    if (Math.hypot(g.car.pos.x - P.x, g.car.pos.z - P.z) < 3.4 && g.car.hp > 0) return { label: 'brûler votre voiture (efface les traces)', fuel: this.carFuel('own', g.car.pos.x, g.car.pos.z, g.car.heading) };
    const e = g.interior.index.find(P.x, P.z); if (e && !this.school(e.bi) && !this.sim.done('b:' + e.bi)) { const f = this.buildingFuel(e.bi); if (f) return { label: 'mettre le feu au bâtiment (essence)', fuel: f }; }
    return null;
  }
  ignite() {
    const g = this.g, t = this.target(); if (!t) return false; if (g.nearSchool()) { g.hud.toast('Pas ici : il y a une école à côté.', 2); return true; }
    if (!this.lighter) { g.hud.toast('Il vous faut un briquet.'); return true; }
    if (t.fuel.kind === 'batiment') { if (this.essence <= 0) { g.hud.toast('Il faut de l\'essence (station-service, receleur).', 3); return true; } const bi = +t.fuel.key.slice(2); const o = g.uw.occAll(bi); if (o && o.minors.length) { g.hud.toast('Des enfants sont à l\'intérieur : vous renoncez.', 3); return true; } this.essence--; }
    const n = this.sim.ignite(t.fuel, 0.25); if (!n) return true; g.sfx('glass', 0.4); this.onBorn(n, true);
    g.crime(t.fuel.kind === 'batiment' ? 40 : t.fuel.key === 'v:own' ? 6 : 22, 25); if (t.fuel.key !== 'v:own') g.crimeFile(t.fuel.kind === 'batiment' ? 'incendie' : 'feu', 1);
    g.hud.toast(t.fuel.key === 'v:own' ? 'Votre voiture flambe : plus de traces dedans.' : t.fuel.kind === 'batiment' ? 'Le feu prend dans le bâtiment…' : 'La voiture s\'embrase.', 3); return true;
  }
  /** Nouveau foyer : voitures hors d'usage, habitants évacués (toujours sains et saufs), pompiers alertés. */
  private onBorn(n: FireNode, byPlayer: boolean) {
    const g = this.g; if (this.dispatchT < 0 && !this.crew) this.dispatchT = 40;
    if (n.key === 'v:own') { g.enquete.burnCar(g.carId()); g.car.hp = 0; }
    else if (n.kind === 'voiture') { const v = g.vehicles.list.find(q => 'v:' + q.id === n.key); if (v) { v.hp = 0; v.stun = 1e6; if (v.kind === 'trafic') { g.traffic.release(v); v.kind = 'gare'; } } }
    else { const bi = +n.key.slice(2); const l = g.uw.allResidents(bi); const o = g.uw.occAll(bi); if (o) for (const r of [...o.adults, ...o.minors]) g.uw.evacuated.set(r.id, g.clock.day); if (o && (o.adults.length || o.minors.length)) g.hud.toast(`Les habitants (${g.uw.units(bi) > 1 ? `${g.uw.units(bi)} foyers` : `famille ${l[0].nom}`}) évacuent : personne n'est blessé.`, 4); if (!byPlayer) g.hud.toast('Le feu gagne un bâtiment voisin !', 3); }
  }
  /** Coup de feu ou bagarre près des pompiers : ils se replient. */
  scare(x: number, z: number) { const c = this.crew; if (!c || c.arrive > 0 || Math.hypot(c.tx - x, c.tz - z) > 40 || c.retreat > 0) return; c.retreat = 25; this.g.crime(20, 40); this.g.hud.toast('Les pompiers se replient derrière leur camion : le feu gagne du terrain !', 4); }
  update(dt: number) {
    const g = this.g, P = g.pos;
    const { born, ended } = this.sim.step(dt, (n, r) => this.neighbors(n, r), Math.random); for (const n of born) this.onBorn(n, false);
    for (const n of ended) this.burnt(n);
    if (g.mode === 'foot' && !g.interior.inside) { const h = this.sim.heatAt(g.player.pos.x, g.player.pos.z); if (h > 0) g.needs.s.sante = Math.max(0, g.needs.s.sante - h * dt); }
    if (g.mode === 'car' && this.sim.burning('v:own')) { g.needs.s.sante = Math.max(0, g.needs.s.sante - 10 * dt); }
    // pompiers : arrivée, lances, départ
    if (this.dispatchT > 0 && (this.dispatchT -= dt) <= 0) this.dispatch();
    const c = this.crew; const jets: { x: number; z: number; tx: number; tz: number }[] = [];
    if (c) {
      const act = this.sim.active; const tgt = act.sort((a, b) => Math.hypot(a.x - c.tx, a.z - c.tz) - Math.hypot(b.x - c.tx, b.z - c.tz))[0];
      if (c.retreat > 0) c.retreat -= dt;
      c.men.forEach((m, i) => { if (!tgt) return; const a = Math.atan2(m.x - tgt.x, m.z - tgt.z) + (i - 1) * 0.5; const want = { x: tgt.x + Math.sin(a) * 9, z: tgt.z + Math.cos(a) * 9 }; const back = c.retreat > 0; const gx = back ? c.tx + (i - 1) * 1.2 : want.x, gz = back ? c.tz + 2 : want.z; const dx = gx - m.x, dz = gz - m.z, d = Math.hypot(dx, dz); if (d > 0.5) { m.x += dx / d * Math.min(d, 3.2 * dt); m.z += dz / d * Math.min(d, 3.2 * dt); }
        if (m.av) { m.av.root.position.set(m.x, 0, m.z); m.av.root.rotation.y = d > 0.5 ? Math.atan2(dx, dz) : Math.atan2(tgt.x - m.x, tgt.z - m.z); m.av.set(d > 0.5 ? 'Run' : 'Idle', 3); m.av.pose('hose', c.retreat <= 0 && d < 1.5 ? 1 : 0); m.av.update(dt); }
        if (!back && d < 1.5) { jets.push({ x: m.x, z: m.z, tx: tgt.x, tz: tgt.z }); for (const n of this.sim.water(tgt.x, tgt.z, 14, 0.05, dt)) this.burnt(n); } });
      if (!act.length && (c.leaveT -= dt) <= 0) this.dismiss();
    }
    this.fx?.update(dt, this.sim.nodes, jets, P.x, P.z);
  }
  private burnt(n: FireNode) { const g = this.g; if (n.kind === 'voiture' && n.key !== 'v:own') { const v = g.vehicles.list.find(q => 'v:' + q.id === n.key); if (v) v.paint = 0x1b1a19; } if (n.key === 'v:own') g.car.setVehicle(g.car.spec.type, 0x1b1a19, 0, 0); }
  private dispatch() {
    const g = this.g, act = this.sim.active; if (!act.length) { this.dispatchT = -1; return; } const f = act[0]; const r = this.roadNear(f.x, f.z) ?? { x: f.x + 15, z: f.z, h: 0 };
    const truck = g.vehicles.add({ type: 'utilitaire', paint: 0xb01818, hp: 999, x: r.x, z: r.z, h: r.h, speed: 0, kind: 'gare', mine: false, upgrade: 0, stun: 1e6 });
    const men = [0, 1, 2].map(i => { const m: { av?: AvatarInstance; x: number; z: number } = { x: r.x + (i - 1) * 1.5, z: r.z + 2.5 }; if (g.avatars && this.scene) { m.av = g.avatars.create({ hoodie: 0x1c2533, jeans: 0x1c2533, shoes: 0x111111, hair: null, hood: false, hoodUp: true }); this.scene.add(m.av.root); } return m; });
    this.crew = { truck: truck.id, tx: r.x, tz: r.z, men, arrive: 0, retreat: 0, leaveT: 12 }; this.dispatchT = -1; g.hud.toast('🚒 Les pompiers arrivent.', 3); g.sfx('alarm', 0.5);
  }
  private dismiss() { const g = this.g, c = this.crew!; const v = g.vehicles.list.find(q => q.id === c.truck); if (v) g.vehicles.remove(v); for (const m of c.men) if (m.av) this.scene?.remove(m.av.root); this.crew = null; }
}
