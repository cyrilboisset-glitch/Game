import { engineRpm, rpmToFreq, sirenFreq, distGain, stepInterval, clamp } from './mapping';

export interface AudioState { inCar: boolean; speed: number; throttle: number; slip: number; dead: boolean; footSpeed: number; inside: boolean; night: boolean; policeDist: number; alert: boolean; horn: boolean; rain?: number; }
/** Sons 100 % procéduraux (WebAudio, aucun fichier) : moteur, roulement, dérapage, sirène, ambiance, pas, chocs, klaxon. Démarre au premier geste de l'utilisateur. */
export class AudioSys {
  private ctx?: AudioContext; private master?: GainNode; private amb?: GainNode; private ambLP?: BiquadFilterNode; private noise?: AudioBuffer;
  private eng?: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; lp: BiquadFilterNode }; private road?: { g: GainNode; lp: BiquadFilterNode }; private skid?: GainNode; private siren?: { o: OscillatorNode; g: GainNode }; private hornG?: GainNode; private wind?: GainNode; private cric?: GainNode;
  volume = 0.7; muted = false; private stepT = 0; private birdT = 2; private t = 0;
  constructor() { const start = () => { this.init(); removeEventListener('pointerdown', start); removeEventListener('keydown', start); }; addEventListener('pointerdown', start); addEventListener('keydown', start); }
  get ready() { return !!this.ctx; }
  /** Sortie pour la radio de la voiture. */
  radioOut() { return this.ctx && this.master && this.noise ? { ctx: this.ctx, dest: this.master, noise: this.noise } : null; }
  private init() {
    if (this.ctx) return; const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return; const ctx = (this.ctx = new C()); this.master = ctx.createGain(); this.master.connect(ctx.destination); this.apply();
    const len = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noise.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3; }   // bruit rose approximatif
    const loopNoise = (cut: number, type: BiquadFilterType = 'lowpass') => { const s = ctx.createBufferSource(); s.buffer = this.noise!; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = cut; const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g); s.start(); return { g, f }; };
    // ambiance (bus filtré à l'intérieur)
    this.amb = ctx.createGain(); this.ambLP = ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000; this.amb.connect(this.ambLP).connect(this.master);
    const w = loopNoise(500); w.g.connect(this.amb); this.wind = w.g;
    const o = ctx.createOscillator(); o.frequency.value = 4300; const trem = ctx.createGain(); trem.gain.value = 0; const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(trem.gain); o.connect(trem); trem.connect(this.amb); o.start(); lfo.start(); this.cric = trem;
    // moteur
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const eg = ctx.createGain(); eg.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(eg).connect(this.master); o1.start(); o2.start(); this.eng = { o1, o2, g: eg, lp };
    const rd = loopNoise(700); rd.g.connect(this.master); this.road = { g: rd.g, lp: rd.f }; const sk = loopNoise(1900, 'bandpass'); sk.g.connect(this.master); this.skid = sk.g;
    const so = ctx.createOscillator(); so.type = 'square'; const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 1500; const sg = ctx.createGain(); sg.gain.value = 0; so.connect(sl).connect(sg).connect(this.master); so.start(); this.siren = { o: so, g: sg };
    const h1 = ctx.createOscillator(), h2 = ctx.createOscillator(); h1.type = h2.type = 'sawtooth'; h1.frequency.value = 420; h2.frequency.value = 530; const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 1800; const hg = ctx.createGain(); hg.gain.value = 0; h1.connect(hl); h2.connect(hl); hl.connect(hg).connect(this.master); h1.start(); h2.start(); this.hornG = hg;
  }
  setVolume(v: number) { this.volume = clamp(v); this.apply(); } setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05); }
  private tone(f: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0, slideTo?: number) { const c = this.ctx; if (!c || !this.master) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; const t0 = c.currentTime + when; o.frequency.setValueAtTime(f, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05); }
  private burst(cut: number, dur: number, gain: number, type: BiquadFilterType = 'lowpass') { const c = this.ctx; if (!c || !this.master || !this.noise) return; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = cut; const g = c.createGain(); g.gain.setValueAtTime(gain, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); s.connect(f).connect(g).connect(this.master); s.start(c.currentTime, Math.random()); s.stop(c.currentTime + dur + 0.05); }
  /** Effets ponctuels. v = intensité 0-1 pour les chocs. */
  sfx(name: string, v = 1) {
    if (!this.ctx) return; const k = clamp(v);
    switch (name) {
      case 'crash': this.burst(900 + 1500 * k, 0.25 + 0.3 * k, 0.35 + 0.4 * k); this.tone(70, 0.3, 'sine', 0.4 * k + 0.1, 0, 38); break;
      case 'door': this.burst(1400, 0.08, 0.25); this.tone(110, 0.1, 'sine', 0.2); break;
      case 'glass': this.burst(5200, 0.35, 0.3, 'highpass'); this.tone(3200, 0.2, 'triangle', 0.06, 0, 1800); break;
      case 'coin': this.tone(988, 0.12, 'square', 0.07); this.tone(1319, 0.22, 'square', 0.07, 0.09); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.1)); break;
      case 'fail': this.tone(300, 0.5, 'sawtooth', 0.09, 0, 110); break;
      case 'arrest': [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.35, 'square', 0.08, i * 0.18)); break;
      case 'alarm': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1500 : 1100, 0.14, 'square', 0.07, i * 0.16); break;
      case 'shot': this.burst(2400, 0.18, 0.6 * k + 0.1); this.tone(90, 0.16, 'sine', 0.35 * k, 0, 40); break;
      case 'horn': this.tone(420, 0.22, 'sawtooth', 0.05 * k + 0.01, 0, 420); this.tone(530, 0.22, 'sawtooth', 0.05 * k + 0.01, 0, 530); this.tone(420, 0.3, 'sawtooth', 0.05 * k + 0.01, 0.3, 420); this.tone(530, 0.3, 'sawtooth', 0.05 * k + 0.01, 0.3, 530); break;
      case 'ui': this.tone(660, 0.07, 'sine', 0.06); break;
    }
  }
  update(dt: number, s: AudioState) {
    const c = this.ctx; if (!c || !this.eng || !this.road || !this.skid || !this.siren || !this.hornG || !this.amb || !this.ambLP || !this.wind || !this.cric) return; this.t += dt; const now = c.currentTime; const T = 0.06;
    const rpm = engineRpm(s.speed, s.throttle); const f = rpmToFreq(rpm); const on = s.inCar && !s.dead;
    this.eng.o1.frequency.setTargetAtTime(f, now, T); this.eng.o2.frequency.setTargetAtTime(f * 0.5 + 0.7, now, T); this.eng.lp.frequency.setTargetAtTime(350 + rpm * 0.35, now, T); this.eng.g.gain.setTargetAtTime(on ? 0.05 + s.throttle * 0.06 + clamp(Math.abs(s.speed) / 40) * 0.03 : 0, now, 0.08);
    this.road.g.gain.setTargetAtTime(s.inCar ? clamp(Math.abs(s.speed) / 35) * 0.09 : 0, now, 0.1); this.road.lp.frequency.setTargetAtTime(400 + Math.abs(s.speed) * 25, now, 0.1);
    this.skid.gain.setTargetAtTime(s.inCar ? s.slip * 0.1 : 0, now, 0.05);
    const dg = distGain(s.policeDist) * (s.alert ? 1 : 0.55); this.siren.o.frequency.setTargetAtTime(sirenFreq(this.t), now, 0.015); this.siren.g.gain.setTargetAtTime(dg * 0.1, now, 0.08);
    this.hornG.gain.setTargetAtTime(s.horn && s.inCar ? 0.1 : 0, now, 0.02);
    this.ambLP.frequency.setTargetAtTime(s.inside ? 700 : 18000, now, 0.15); this.wind.gain.setTargetAtTime(0.025 + (s.inCar ? clamp(Math.abs(s.speed) / 40) * 0.05 : 0), now, 0.3); this.cric.gain.setTargetAtTime(s.night && !s.inside ? 0.006 : 0, now, 0.5);
    if (!s.inCar && !s.inside) { this.stepT -= dt; const iv = stepInterval(s.footSpeed); if (this.stepT <= 0 && iv < Infinity) { this.burst(500 + Math.random() * 300, 0.07, s.footSpeed > 3.6 ? 0.12 : 0.07); this.stepT = iv; } } else if (s.inside && s.footSpeed > 0.4) { this.stepT -= dt; if (this.stepT <= 0) { this.burst(900, 0.05, 0.06); this.stepT = stepInterval(s.footSpeed); } }
    this.birdT -= dt; if (this.birdT <= 0) { this.birdT = 2 + Math.random() * 6; if (!s.night && !s.inside && !s.inCar) { const f0 = 2400 + Math.random() * 1600; this.tone(f0, 0.08, 'sine', 0.025); this.tone(f0 * 1.25, 0.1, 'sine', 0.025, 0.1); this.tone(f0 * 0.9, 0.08, 'sine', 0.02, 0.22); } }
  }
}
