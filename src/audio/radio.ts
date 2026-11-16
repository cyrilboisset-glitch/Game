// Radio de la voiture : stations inventées, musique générée en direct (WebAudio, aucun fichier, hors ligne). Chaque morceau change toutes les 32 mesures.
export interface Station { nom: string; bpm: number; style: 'electro' | 'chill' | 'rock' | 'funk'; root: number; }
export const STATIONS: Station[] = [
  { nom: 'Cavale FM — électro', bpm: 122, style: 'electro', root: 45 },
  { nom: 'Radio Pont-de-Nuit — lo-fi', bpm: 78, style: 'chill', root: 50 },
  { nom: 'Rocade Rock', bpm: 138, style: 'rock', root: 40 },
  { nom: 'Funky Vallée', bpm: 104, style: 'funk', root: 43 },
];
const PROG: Record<Station['style'], number[][]> = { electro: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], chill: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], rock: [[0, 7, 12], [-2, 5, 10], [-4, 3, 8], [-5, 2, 7]], funk: [[0, 4, 10], [5, 9, 15], [0, 4, 10], [7, 10, 16]] };
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Générateur pseudo-aléatoire déterministe (même station + même morceau = même musique). */
const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** Motifs d'un morceau : batterie, basse et mélodie sur 16 pas, tirés selon le style. Pur, testable. */
export function pattern(st: Station, track: number) {
  const r = rng(st.root * 1000 + track * 7 + st.bpm); const kick = Array(16).fill(0), snare = Array(16).fill(0), hat = Array(16).fill(0), bass: (number | null)[] = Array(16).fill(null), lead: (number | null)[] = Array(16).fill(null);
  for (let i = 0; i < 16; i++) {
    if (st.style === 'electro') { kick[i] = i % 4 === 0 ? 1 : 0; hat[i] = i % 4 === 2 ? 1 : r() < 0.3 ? 0.4 : 0; snare[i] = i % 8 === 4 ? 1 : 0; bass[i] = i % 2 === 1 || r() < 0.2 ? 0 : null; }
    else if (st.style === 'chill') { kick[i] = i === 0 || i === 10 ? 1 : 0; snare[i] = i === 4 || i === 12 ? 0.7 : 0; hat[i] = i % 2 === 0 ? 0.35 : 0; bass[i] = i === 0 || i === 7 || i === 10 ? 0 : null; }
    else if (st.style === 'rock') { kick[i] = i % 8 === 0 || i === 6 || i === 11 ? 1 : 0; snare[i] = i % 8 === 4 ? 1 : 0; hat[i] = i % 2 === 0 ? 0.6 : 0; bass[i] = i % 2 === 0 ? 0 : null; }
    else { kick[i] = i === 0 || i === 3 || i === 10 ? 1 : 0; snare[i] = i === 4 || i === 12 ? 1 : r() < 0.15 ? 0.3 : 0; hat[i] = 0.5; bass[i] = r() < 0.55 ? Math.floor(r() * 3) * 5 : null; }
    if (r() < (st.style === 'chill' ? 0.28 : 0.38)) lead[i] = [0, 2, 3, 5, 7, 10, 12][Math.floor(r() * 7)];
  }
  return { kick, snare, hat, bass, lead, prog: PROG[st.style], swing: st.style === 'chill' || st.style === 'funk' ? 0.12 : 0 };
}

export class Radio {
  on = false; idx = 0; private step = 0; private next = 0; private bar = 0; private track = 0; private out?: GainNode; private pat = pattern(STATIONS[0], 0);
  constructor(private ctx: () => { ctx: AudioContext; dest: AudioNode; noise: AudioBuffer } | null) {}
  get station() { return STATIONS[this.idx]; }
  /** Bouton radio : station suivante, puis éteint après la dernière. Retourne le texte à afficher. */
  cycle() { if (!this.on) { this.on = true; this.idx = 0; } else if (this.idx < STATIONS.length - 1) this.idx++; else this.on = false; this.bar = 0; this.track = Math.floor(Math.random() * 50); this.pat = pattern(this.station, this.track); return this.on ? `📻 ${this.station.nom}` : '📻 Radio éteinte'; }
  /** Planifie les notes à venir (fenêtre de 0,2 s). `active` : on est en voiture. */
  update(active: boolean, volume = 0.5) {
    const c = this.ctx(); if (!c) return; const { ctx } = c;
    if (!this.out) { this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(c.dest); }
    this.out.gain.setTargetAtTime(this.on && active ? 0.22 * volume : 0, ctx.currentTime, 0.15); if (!this.on || !active) { this.next = 0; return; }
    const st = this.station, dur = 60 / st.bpm / 4; if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.2) {
      const i = this.step % 16, t = this.next + (i % 2 ? this.pat.swing * dur : 0), chord = this.pat.prog[this.bar % this.pat.prog.length], root = st.root + chord[0];
      if (this.pat.kick[i]) this.kick(t); if (this.pat.snare[i]) this.snare(t, this.pat.snare[i]); if (this.pat.hat[i]) this.hat(t, this.pat.hat[i]);
      const b = this.pat.bass[i]; if (b !== null) this.note(t, midi(root - 12 + b), dur * 1.6, st.style === 'rock' ? 'sawtooth' : 'triangle', 0.32, 700);
      if (i === 0) for (const n of chord) this.note(t, midi(st.root + 12 + n), dur * 15, st.style === 'rock' ? 'sawtooth' : 'sine', st.style === 'rock' ? 0.05 : 0.07, st.style === 'chill' ? 1200 : 2400);
      const l = this.pat.lead[i]; if (l !== null) this.note(t, midi(st.root + 24 + chord[0] % 12 + l), dur * 1.2, st.style === 'electro' ? 'square' : 'triangle', 0.06, 3200);
      this.next += dur; this.step++; if (this.step % 16 === 0) { this.bar++; if (this.bar % 32 === 0) { this.track++; this.pat = pattern(st, this.track); } }
    }
  }
  private env(t: number, a: number, d: number, v: number) { const c = this.ctx()!.ctx, g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); g.connect(this.out!); return g; }
  private note(t: number, f: number, d: number, type: OscillatorType, v: number, cut: number) { const c = this.ctx()!.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut; o.connect(lp).connect(this.env(t, 0.01, d, v)); o.start(t); o.stop(t + d + 0.05); }
  private kick(t: number) { const c = this.ctx()!.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(this.env(t, 0.002, 0.22, 0.7)); o.start(t); o.stop(t + 0.3); }
  private noiseHit(t: number, type: BiquadFilterType, f: number, d: number, v: number) { const k = this.ctx()!, s = k.ctx.createBufferSource(), fl = k.ctx.createBiquadFilter(); s.buffer = k.noise; fl.type = type; fl.frequency.value = f; s.connect(fl).connect(this.env(t, 0.002, d, v)); s.start(t, Math.random()); s.stop(t + d + 0.05); }
  private snare(t: number, v: number) { this.noiseHit(t, 'bandpass', 1800, 0.16, 0.35 * v); }
  private hat(t: number, v: number) { this.noiseHit(t, 'highpass', 7000, 0.05, 0.12 * v); }
}
