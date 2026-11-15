// Habitants pris en main par le jeu (hors de leur emploi du temps) : assommés/renversés, en fuite, ou qui se battent.
export type Mode = 'ko' | 'fuite' | 'combat';
export interface Ctl { id: number; mode: Mode; x: number; z: number; h: number; until: number; hp: number; cd: number; speed: number; reported: boolean; }
export interface Solver { resolve(p: { x: number; z: number }, r: number): unknown; }

export class NpcControl {
  map = new Map<number, Ctl>(); hp = new Map<number, number>(); t = 0;
  get(id: number) { return this.map.get(id); }
  health(id: number) { return this.hp.get(id) ?? 100; }
  /** Met un habitant au sol pour `secs` secondes (KO, renversé). */
  ko(id: number, x: number, z: number, h: number, secs: number) { this.map.set(id, { id, mode: 'ko', x, z, h, until: this.t + secs, hp: 0, cd: 0, speed: 0, reported: false }); }
  /** Coup porté : retourne le nouvel état. Personnalité (graine) : certains se défendent, la plupart fuient — tous fuient face à une arme. */
  hit(id: number, x: number, z: number, h: number, dmg: number, seed: number, armed: boolean): Mode {
    const hp = this.health(id) - dmg; this.hp.set(id, Math.max(0, hp));
    if (hp <= 0) { this.ko(id, x, z, h, 35 + (seed % 30)); return 'ko'; }
    const cur = this.map.get(id); const fight = !armed && seed % 10 < 4 && hp > 35;
    const mode: Mode = cur?.mode === 'combat' && hp > 30 ? 'combat' : fight ? 'combat' : 'fuite';
    this.map.set(id, { id, mode, x: cur?.x ?? x, z: cur?.z ?? z, h, until: this.t + (mode === 'fuite' ? 12 : 30), hp, cd: 0.8, speed: 0, reported: cur?.reported ?? false }); return mode;
  }
  /** Avance les habitants pilotés. Retourne les dégâts infligés au joueur et les habitants qui se relèvent (ils deviennent témoins). */
  update(dt: number, px: number, pz: number, solver?: Solver): { dmgToPlayer: number; woke: number[]; released: number[] } {
    this.t += dt; let dmg = 0; const woke: number[] = [], released: number[] = [];
    for (const c of this.map.values()) {
      const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz) || 1e-3;
      if (c.mode === 'ko') { if (this.t > c.until) { c.mode = 'fuite'; c.until = this.t + 12; this.hp.set(c.id, 40); woke.push(c.id); } continue; }
      if (c.mode === 'fuite') { c.speed = 4.6; c.h = Math.atan2(dx, dz); c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt; if (this.t > c.until && d > 30) { this.map.delete(c.id); released.push(c.id); } }
      else { // combat : s'approche et frappe
        c.h = Math.atan2(-dx, -dz); if (d > 1.25) { c.speed = 2.8; c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt; } else { c.speed = 0; c.cd -= dt; if (c.cd <= 0) { c.cd = 1.1; dmg += 6 + (c.id % 5); } }
        if (this.health(c.id) < 30) { c.mode = 'fuite'; c.until = this.t + 12; } if (d > 25 || this.t > c.until) { this.map.delete(c.id); released.push(c.id); }
      }
      if (solver) solver.resolve(c, 0.35);
    }
    return { dmgToPlayer: dmg, woke, released };
  }
}
