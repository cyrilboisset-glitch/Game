import { engineRpm, sirenFreq, distGain, stepInterval, clamp } from './mapping';

export interface AudioState { inCar: boolean; speed: number; throttle: number; slip: number; dead: boolean; footSpeed: number; inside: boolean; night: boolean; policeDist: number; alert: boolean; horn: boolean; rain?: number; traffic?: number; bell?: number; surface?: 'beton' | 'herbe' | 'bois'; fire?: number; }

/** Sons enregistrés (bibliothèque « Oculus Audio Pack » de Meta, licence CC0), convertis en mono léger (voir docs/credits.md). */
const SAMPLES: Record<string, string[]> = {
  stepBeton: [1, 2, 3, 4, 5].map(i => `feethmn_shoeconcretewalk${i}`), runBeton: [1, 2, 3, 4, 5].map(i => `feethmn_shoeconcreterun${i}`),
  stepHerbe: [1, 2, 3, 4].map(i => `feethmn_shoegrasswalk${i}`), runHerbe: [1, 2, 3, 4].map(i => `feethmn_shoegrassrun${i}`), stepBois: [1, 2, 3, 4].map(i => `feethmn_shoewoodwalk${i}`), land: ['feethmn_shoeconcreteland1'],
  punch: [1, 2, 3, 4].map(i => `fghtimpt_punchregular${i}`), punchHard: ['fghtimpt_punchharder1', 'fghtimpt_punchharder2'], kick: ['fghtimpt_kick1', 'fghtimpt_kick2'], swoosh: ['swoosh1', 'swoosh2', 'swoosh3'],
  hurtM: ['voxmale_male01hurt1', 'voxmale_male01hurt2', 'voxmale_male02hurt1'], hurtF: ['voxfem_female01hurt1', 'voxfem_female01hurt2'], screamM: ['voxscrm_malescream1'], screamF: ['voxscrm_femalescream1'], effort: ['voxefrt_male01effort1'],
  dog: ['anmldog_dogbark1', 'anmldog_dogbark2'], birds: ['ambforst_forestbirds1', 'ambforst_forestbirds2', 'ambforst_forestbirds3'],
  glass: ['glasbrk_windowpanesmallbreak1'], bottle: ['glasbrk_glassbottlebreak1'], metal: ['metlimpt_metalhitsurface1', 'metlimpt_metalhitsurface2', 'metlimpt_metalhitsurface3'], metalDrop: ['metlimpt_metalobjdrop1'],
  door: ['doorwood_frontdooropen1'], doorClose: ['doorwood_frontdoorclose1'], carDoor: ['vehdoor_cardooropen1'], carDoorClose: ['vehdoor_cardoorclose1'], trunk: ['vehdoor_cartrunkclose1'], start: ['vehcar_carstartrunstop1'],
  unlock: ['mechlock_doorunlockkey1'], loot: ['objbag_knapsacknylonopen1'], coin: ['objcoin_coindrop1'], ui: ['uiclick_casualpopsconfirm1'], notify: ['uialert_notification1'], win: ['muscstngr_victoryelectronic1'], fail: ['muscstngr_losselectronic1'], level: ['uimisc_powerup1'],
  bush: ['vegeleaf_movementthroughbushes1'], cloth: ['clothmvmt_clothingmovement1'], flush: ['watrplmb_toiletflusheuropean1'],
};
const LOOPS = { city: 'amburbn_cityeurodaytime_loop', night: 'ambforst_night_loop', nature: 'windvege_lightwindtreesbirds_loop', rain: 'cityrain_loop', room: 'ambhome_roomtone_loop', engLow: 'vehcar_carengineslow_loop', engHigh: 'vehcar_carenginehigh_loop' } as const;
type LoopName = keyof typeof LOOPS;
export const SFX_FILES = [...new Set([...Object.values(SAMPLES).flat(), ...Object.values(LOOPS)])];

/** Mixage : vrais enregistrements (pas, coups, voix, portes, moteur, ambiances de ville, de nuit, pluie) ; synthèse soignée seulement pour la sirène deux tons, le klaxon, le tir, l'alarme, la cloche et le feu. */
export class AudioSys {
  private ctx?: AudioContext; private master?: GainNode; private bus = {} as Record<'sfx' | 'amb' | 'car' | 'ui', GainNode>; private ambLP?: BiquadFilterNode; private verb?: ConvolverNode; private noise?: AudioBuffer;
  private buf = new Map<string, AudioBuffer>(); private loops = new Map<LoopName, { src: AudioBufferSourceNode; g: GainNode }>();
  private siren?: { a: OscillatorNode; b: OscillatorNode; g: GainNode }; private hornG?: GainNode; private hornUntil = 0; private skid?: GainNode; private road?: GainNode; private fireG?: GainNode;
  volume = 0.7; muted = false; private stepT = 0; private birdT = 6; private dogT = 25; private t = 0; private wasCar = false; private popT = 0;
  constructor() { const start = () => { this.init(); removeEventListener('pointerdown', start); removeEventListener('keydown', start); }; addEventListener('pointerdown', start); addEventListener('keydown', start); }
  get ready() { return !!this.ctx; }
  radioOut() { return this.ctx && this.master && this.noise ? { ctx: this.ctx, dest: this.master, noise: this.noise } : null; }
  setVolume(v: number) { this.volume = clamp(v); this.apply(); } setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05); }
  private init() {
    if (this.ctx) return; const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return; const ctx = (this.ctx = new C());
    // chaîne : bus → compresseur (pas de saturation) → sortie
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2; this.master = ctx.createGain(); this.master.connect(comp).connect(ctx.destination); this.apply();
    for (const k of ['sfx', 'car', 'ui'] as const) { this.bus[k] = ctx.createGain(); this.bus[k].connect(this.master); }
    this.bus.amb = ctx.createGain(); this.ambLP = ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000; this.bus.amb.connect(this.ambLP).connect(this.master);
    const len = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // réverbération courte de rue (tirs, cloches, chocs)
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.6), ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 3.2); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg).connect(this.master);
    // sirène deux tons, klaxon, crissement, roulement, feu
    const sa = ctx.createOscillator(), sb = ctx.createOscillator(); sa.type = 'sawtooth'; sb.type = 'square'; sb.detune.value = 8; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.8; const sg = ctx.createGain(); sg.gain.value = 0; sa.connect(bp); sb.connect(bp); bp.connect(sg).connect(this.bus.sfx); sa.start(); sb.start(); this.siren = { a: sa, b: sb, g: sg };
    const h1 = ctx.createOscillator(), h2 = ctx.createOscillator(); h1.type = h2.type = 'square'; h1.frequency.value = 415; h2.frequency.value = 498; const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 2200; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; const hg = ctx.createGain(); hg.gain.value = 0; h1.connect(hl); h2.connect(hl); hl.connect(hp).connect(hg).connect(this.bus.car); h1.start(); h2.start(); this.hornG = hg;
    const noiseLoop = (type: BiquadFilterType, f: number, q: number, bus: GainNode) => { const s = ctx.createBufferSource(); s.buffer = this.noise!; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(bus); s.start(); return g; };
    this.skid = noiseLoop('bandpass', 1900, 3, this.bus.car); this.road = noiseLoop('lowpass', 350, 0.7, this.bus.car); this.fireG = noiseLoop('lowpass', 900, 0.5, this.bus.sfx);
    void this.loadAll();
  }
  private async loadAll() {
    const ctx = this.ctx!; const base = import.meta.env.BASE_URL + 'assets/sfx/';
    await Promise.all(SFX_FILES.map(async n => { try { const r = await fetch(base + n + '.ogg'); this.buf.set(n, await ctx.decodeAudioData(await r.arrayBuffer())); } catch { /* son absent : ignoré */ } }));
    for (const k of Object.keys(LOOPS) as LoopName[]) { const b = this.buf.get(LOOPS[k]); if (!b) continue; const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; const g = ctx.createGain(); g.gain.value = 0; src.connect(g).connect(k.startsWith('eng') ? this.bus.car : this.bus.amb); src.start(0, Math.random() * b.duration); this.loops.set(k, { src, g }); }
  }
  /** Joue un enregistrement (variante au hasard, légère variation de hauteur). */
  private play(group: string, v = 1, rate = 1, bus: 'sfx' | 'car' | 'ui' | 'amb' = 'sfx', wet = 0, when = 0, offset = 0, dur?: number) {
    const c = this.ctx; const list = SAMPLES[group]; if (!c || !list) return; const b = this.buf.get(list[Math.floor(Math.random() * list.length)]); if (!b) return;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12); const g = c.createGain(); g.gain.value = v; s.connect(g).connect(this.bus[bus]); if (wet && this.verb) { const w = c.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb); }
    s.start(c.currentTime + when, offset, dur);
  }
  private tone(f: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number, wet = 0) {
    const c = this.ctx; if (!c) return; const t0 = c.currentTime + when; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(this.bus.sfx); if (wet && this.verb) { const w = c.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb); } o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private crack(cut: number, dur: number, gain: number, when = 0, wet = 0, type: BiquadFilterType = 'lowpass') {
    const c = this.ctx; if (!c || !this.noise) return; const t0 = c.currentTime + when; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = cut; const g = c.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f).connect(g).connect(this.bus.sfx); if (wet && this.verb) { const w = c.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb); } s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  /** Effets ponctuels. `v` : intensité 0-1 (ou atténuation par la distance). */
  sfx(name: string, v = 1) {
    if (!this.ctx) return; const k = clamp(v);
    switch (name) {
      case 'crash': this.play('metal', 0.5 + k * 0.6, 0.85, 'sfx', 0.25); this.tone(70, 0.35, 'sine', 0.25 + k * 0.4, 0, 40); if (k > 0.6) this.play('metalDrop', 0.6, 0.8, 'sfx', 0.2, 0.08); break;
      case 'hit': this.play(k > 0.6 ? 'punchHard' : 'punch', 0.9); break;
      case 'kick': this.play('kick', 0.9); break;
      case 'swoosh': this.play('swoosh', 0.5); break;
      case 'hurt': this.play('hurtM', 0.7); break;
      case 'hurtF': this.play('hurtF', 0.7); break;
      case 'scream': this.play(Math.random() < 0.5 ? 'screamM' : 'screamF', 0.4 * k + 0.2, 1, 'sfx', 0.2); break;
      case 'voice': this.play('effort', 0.6, 1.1); break;
      case 'door': this.play('door', 0.7); break;
      case 'doorClose': this.play('doorClose', 0.7); break;
      case 'carDoor': this.play('carDoor', 0.8, 1, 'car'); break;
      case 'carDoorClose': this.play('carDoorClose', 0.8, 1, 'car'); break;
      case 'start': this.play('start', 0.7, 1, 'car', 0, 0, 0, 1.6); break;
      case 'trunk': this.play('trunk', 0.8, 1, 'car'); break;
      case 'glass': this.play(k > 0.5 ? 'glass' : 'bottle', 0.8, 1, 'sfx', 0.2); break;
      case 'coin': this.play('coin', 0.6, 1, 'ui'); break;
      case 'ui': this.play('ui', 0.5, 1, 'ui'); break;
      case 'notify': this.play('notify', 0.6, 1, 'ui'); break;
      case 'win': this.play('win', 0.6, 1, 'ui'); break;
      case 'level': this.play('level', 0.6, 1, 'ui'); break;
      case 'fail': case 'arrest': this.play('fail', 0.6, 1, 'ui'); break;
      case 'unlock': this.play('unlock', 0.8); break;
      case 'loot': this.play('loot', 0.7); break;
      case 'flush': this.play('flush', 0.6); break;
      case 'land': this.play('land', 0.7); this.play('effort', 0.4); break;
      case 'bush': this.play('bush', 0.6); break;
      case 'dog': this.play('dog', 0.35 * k + 0.1, 1, 'amb'); break;
      // synthèses soignées (pas d'enregistrement libre disponible) : tir, alarme, klaxon, cloche
      case 'shot': this.crack(5200, 0.06, 0.9 * k + 0.1, 0, 0.7, 'highpass'); this.crack(1800, 0.18, 0.7 * k + 0.1, 0, 0.6); this.tone(90, 0.22, 'sine', 0.6 * k + 0.1, 0, 38, 0.3); break;
      case 'alarm': for (let i = 0; i < 8; i++) this.tone(i % 2 ? 2900 : 2300, 0.2, 'square', 0.025, i * 0.22); break;
      case 'horn': this.hornUntil = this.t + 0.5; break;
      case 'bell': { const f0 = 392; for (const [m, g, d] of [[0.5, 0.05, 4], [1, 0.08, 3.5], [1.19, 0.04, 2.6], [1.5, 0.03, 2.2], [2, 0.035, 2], [2.52, 0.02, 1.5], [3.01, 0.015, 1.2]] as [number, number, number][]) this.tone(f0 * m, d, 'sine', g * k, 0, undefined, 0.6); break; }
    }
  }
  private loopGain(n: LoopName, v: number, tc = 0.6) { const l = this.loops.get(n); if (l && this.ctx) l.g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }
  update(dt: number, s: AudioState) {
    const c = this.ctx; if (!c || !this.siren) return; this.t += dt; const now = c.currentTime; const out = !s.inside;
    // ambiances : ville le jour (plus présente près de la circulation), nature, nuit, pluie, intérieur feutré
    const day = s.night ? 0 : 1, traffic = clamp((s.traffic ?? 0) / 10), rain = clamp(s.rain ?? 0);
    this.loopGain('city', out ? day * (0.12 + traffic * 0.3) * (s.inCar ? 0.5 : 1) : 0.03); this.loopGain('nature', out ? day * 0.16 * (1 - traffic * 0.6) * (1 - rain) : 0); this.loopGain('night', out ? (1 - day) * 0.3 * (1 - rain * 0.7) : 0);
    this.loopGain('rain', rain * (s.inside ? 0.18 : s.inCar ? 0.45 : 0.6)); this.loopGain('room', s.inside ? 0.25 : 0); this.ambLP?.frequency.setTargetAtTime(s.inside ? 900 : 18000, now, 0.2);
    // moteur : deux enregistrements fondus selon le régime ; roulement et crissements
    const rpm = engineRpm(s.speed, s.throttle), r = clamp((rpm - 800) / 6000), on = s.inCar && !s.dead;
    const lo = this.loops.get('engLow'), hi = this.loops.get('engHigh');
    if (lo && hi) { lo.src.playbackRate.setTargetAtTime(0.75 + r * 0.9, now, 0.08); hi.src.playbackRate.setTargetAtTime(0.6 + r * 0.75, now, 0.08); lo.g.gain.setTargetAtTime(on ? 0.35 * (1 - r) + 0.08 : 0, now, 0.1); hi.g.gain.setTargetAtTime(on ? (0.1 + s.throttle * 0.15) * r * 1.6 : 0, now, 0.1); }
    if (s.inCar && !this.wasCar) { this.sfx('carDoorClose'); if (!s.dead) this.sfx('start'); } if (!s.inCar && this.wasCar) this.sfx('carDoor'); this.wasCar = s.inCar;
    this.road?.gain.setTargetAtTime(s.inCar ? clamp(Math.abs(s.speed) / 30) * 0.12 * (1 + rain) : 0, now, 0.15); this.skid?.gain.setTargetAtTime(s.inCar ? s.slip * 0.08 : 0, now, 0.05);
    this.hornG?.gain.setTargetAtTime((s.horn && s.inCar) || this.t < this.hornUntil ? 0.09 : 0, now, 0.015);
    // sirène deux tons de la gendarmerie, atténuée par la distance
    const sf = sirenFreq(this.t); this.siren.a.frequency.setTargetAtTime(sf, now, 0.012); this.siren.b.frequency.setTargetAtTime(sf, now, 0.012); this.siren.g.gain.setTargetAtTime(distGain(s.policeDist) * (s.alert ? 0.09 : 0.04) * (s.inside ? 0.3 : 1), now, 0.08);
    // feu : souffle et crépitements selon la proximité
    const fire = clamp(s.fire ?? 0); this.fireG?.gain.setTargetAtTime(fire * 0.25, now, 0.2); if (fire > 0.05 && (this.popT -= dt) <= 0) { this.popT = 0.04 + Math.random() * 0.25 / (fire + 0.2); this.crack(2500 + Math.random() * 3000, 0.02 + Math.random() * 0.03, 0.15 * fire, 0, 0, 'bandpass'); }
    // pas : béton, herbe ou parquet ; marche ou course
    if (!s.inCar) { this.stepT -= dt; const iv = stepInterval(s.footSpeed); if (this.stepT <= 0 && iv < Infinity) { const run = s.footSpeed > 3.2, surf = s.surface ?? (s.inside ? 'bois' : 'beton'); this.play(surf === 'bois' ? 'stepBois' : `${run ? 'run' : 'step'}${surf === 'herbe' ? 'Herbe' : 'Beton'}`, run ? 0.5 : 0.35); this.stepT = iv; } }
    // oiseaux le jour, chiens dans les jardins
    if (out && !s.inCar && day && rain < 0.2 && (this.birdT -= dt) <= 0) { this.birdT = 8 + Math.random() * 14; this.play('birds', 0.18, 1, 'amb'); }
    if (out && (this.dogT -= dt) <= 0) { this.dogT = (s.night ? 18 : 35) + Math.random() * 40; this.play('dog', 0.12 + Math.random() * 0.15, 0.95, 'amb'); }
  }
}
