// Enlèvement contre rançon — volontairement abstrait et sobre : uniquement des adultes, aucune violence détaillée, l'otage est toujours relâché sain et sauf.
import type { Game } from '../game';
import type { Spot } from '../missions/generator';
import type { NpcState } from '../npc/sim';

export interface Kidnap { id: number; stage: 'transport' | 'detenu' | 'rancon' | 'paye'; ransom: number; drop: Spot | null; readyAt: number; until: number; trap: boolean; }
const abs = (d: number, h: number) => d * 24 + h;

export class Kidnapping {
  k: Kidnap | null = null; private drops: Spot[] = [];
  constructor(private g: Game) {}
  setup(drops: Spot[]) { this.drops = drops; }
  /** Personne qu'on peut forcer à monter : adulte, à pied, seul (personne d'autre à 25 m), voiture à moins de 12 m, arme en main, pas près d'une école. */
  candidate(): NpcState | null {
    const g = this.g; if (this.k || g.mode !== 'foot' || g.interior.inside || g.weapon === 'poings' || g.missions.active || g.nearSchool(150)) return null;
    if (Math.hypot(g.car.pos.x - g.player.pos.x, g.car.pos.z - g.player.pos.z) > 12 || g.car.hp <= 0) return null;
    const s = g.nearNpc(2.4); if (!s) return null; const n = g.npcs.get(s.id); if (!n || n.minor || g.npcCtl.get(s.id)) return null;
    for (const w of g.walkersNear(s.x, s.z, 25)) if (w.id !== s.id) return null;
    return s;
  }
  prompt(): string | null {
    const g = this.g, k = this.k; const c = this.candidate(); if (c) { const n = g.npcs.get(c.id)!; return `${n.prenom} ${n.nom} est seul${n.genre === 'F' ? 'e' : ''} — E : ${n.genre === 'F' ? 'la' : 'le'} forcer à monter dans la voiture`; }
    if (!k) return null;
    if (k.stage === 'rancon' && k.drop && Math.hypot(g.pos.x - k.drop.x, g.pos.z - k.drop.z) < 8) return `E : ramasser le sac de la rançon (${k.ransom} €)`;
    return null;
  }
  action(): boolean {
    const g = this.g, c = this.candidate();
    if (c) { const n = g.npcs.get(c.id)!; this.k = { id: n.id, stage: 'transport', ransom: Math.round(1500 + (n.argent / 320) * 4000 + (n.age > 40 ? 1500 : 0)), drop: null, readyAt: 0, until: 0, trap: false }; g.boarded = n.id; g.crimeFile('enlevement', g.hooded ? 0.8 : 1.4); g.crime(40, 10);
      g.mode = 'car'; g.player.root.visible = false; g.uw.loadTrunk(); g.hud.toast(`${n.prenom} monte à l'arrière sous la menace. Direction une planque à vous.`, 4); return true; }
    const k = this.k; if (k && k.stage === 'rancon' && k.drop && Math.hypot(g.pos.x - k.drop.x, g.pos.z - k.drop.z) < 8 && g.mode === 'foot') {
      if (!g.uw.take('billets')) return true; const extra = Math.max(0, Math.round(k.ransom / 1600) - 1); for (let i = 0; i < extra; i++) g.uw.bag.push('billets');
      k.stage = 'paye'; g.sfx('coin'); g.repUp(8); if (k.trap) { g.heat.value = Math.max(g.heat.value, 70); g.hud.toast('C\'était un piège : les gendarmes surgissent !', 4); g.sfx('alarm'); } else g.hud.toast('Rançon récupérée. Relâchez l\'otage depuis la planque, puis comptez le magot.', 5);
      return true; }
    return false;
  }
  /** Options de la planque : enfermer l'otage, envoyer la demande, relâcher. */
  denOpts(): { label: string; run: () => void }[] {
    const g = this.g, k = this.k; if (!k) return []; const n = g.npcs.get(k.id)!;
    if (k.stage === 'transport' && g.mode === 'car') return [{ label: `Installer ${n.prenom} dans la planque et envoyer la demande de rançon`, run: () => { k.stage = 'detenu'; g.boarded = null; g.uw.evacuated.set(k.id, g.clock.day); k.readyAt = abs(g.clock.day, g.clock.hour) + 2; k.until = k.readyAt + 3; const d = this.drops[Math.floor(Math.random() * this.drops.length)] ?? null; k.drop = d; k.trap = g.enquete.dossiers.some(q => !q.clos && q.kind === 'enlevement' && q.preuves > 55);
      g.hud.toast(`${n.prenom} est retenu${n.genre === 'F' ? 'e' : ''} à la planque. La famille a reçu la demande : ${k.ransom} € à déposer dans 2 h${d ? ` (${d.nom})` : ''}.`, 6); } }];
    if (k.stage !== 'transport') return [{ label: `Relâcher ${n.prenom}${k.stage === 'paye' ? '' : ' (sans la rançon)'}`, run: () => this.release(k.stage === 'paye' ? `${n.prenom} est relâché${n.genre === 'F' ? 'e saine et sauve' : ' sain et sauf'}.` : `Vous relâchez ${n.prenom} sans rien obtenir.`) }];
    return [];
  }
  private release(msg: string) { const g = this.g, k = this.k!; g.uw.evacuated.delete(k.id); if (g.boarded === k.id) g.boarded = null; this.k = null; g.hud.toast(msg, 4); }
  marker() { const k = this.k; if (!k) return null; if (k.stage === 'rancon' && k.drop) return { x: k.drop.x, z: k.drop.z, label: `Rançon : ${k.drop.nom}` }; return null; }
  update() {
    const g = this.g, k = this.k; if (!k) return; const now = abs(g.clock.day, g.clock.hour);
    if (k.stage === 'detenu' && now >= k.readyAt) { k.stage = 'rancon'; g.hud.toast(`La rançon est déposée (${k.drop?.nom ?? 'lieu convenu'}). Vous avez 3 h.`, 5); }
    if ((k.stage === 'rancon' || k.stage === 'detenu') && now > k.until) { g.crimeFile('enlevement', 0.8); this.release('Le délai est passé : l\'otage parvient à se libérer, sain et sauf, et prévient la gendarmerie.'); }
  }
  /** Arrestation : l'otage est libéré par les gendarmes. */
  arrested() { if (this.k) this.release('Les gendarmes libèrent l\'otage, sain et sauf.'); }
  save() { return this.k; }
  load(s: any) { this.k = s ?? null; if (this.k && this.k.stage === 'transport') this.k = null; }
}
