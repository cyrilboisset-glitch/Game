import * as THREE from 'three';

export interface Poi { id: string; nom: string; categorie: string; sous_type: string; x: number; y: number; rue: string; numero: string; horaires: string; }

export async function loadPoi(): Promise<Poi[]> { return (await fetch(import.meta.env.BASE_URL + 'data/poi.json')).json(); }

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
/** Horaires par défaut (hypothèse documentée dans docs/hypotheses.md) quand opening_hours est absent. */
const DEFAULTS: Record<string, string> = {
  supermarket: 'Mo-Sa 08:30-19:30', bakery: 'Tu-Sa 06:30-12:30,15:00-19:00; Su 07:00-12:30', butcher: 'Tu-Sa 07:30-12:30,15:00-19:00', pastry: 'Tu-Su 07:00-12:30,15:00-19:00', greengrocer: 'Tu-Sa 08:00-12:30,15:30-19:00',
  restaurant: 'Tu-Sa 11:30-14:00,18:30-22:00', fast_food: 'Mo-Su 11:00-22:00', bank: 'Tu-Sa 09:00-12:00,14:00-17:30', pharmacy: 'Mo-Sa 09:00-12:30,14:30-19:00', hairdresser: 'Tu-Sa 09:00-18:30', variety_store: 'Mo-Sa 09:00-19:00',
  gas: '24/7', school: 'Mo-Fr 08:00-17:00', _: 'Mo-Sa 09:00-12:30,14:30-19:00',
};
/** Parse minimal d'opening_hours OSM ("Mo-Sa 09:30-19:00", "Tu-Sa 07:30-12:30,15:00-19:00; Su 07:00-12:00", "24/7"). dow : 0 = lundi. */
export function isOpen(hours: string, subtype: string, hour: number, dow: number): boolean {
  const spec = hours || DEFAULTS[subtype] || DEFAULTS._; if (spec.includes('24/7')) return true;
  for (const rule of spec.split(';')) {
    const m = rule.trim().match(/^([A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*([\d:,\-\s]+)?$/); if (!m || !m[2]) continue;
    let dayOk = !m[1];
    if (m[1]) for (const part of m[1].split(',')) { const [a, b] = part.split('-'); const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i; if (i < 0) continue; dayOk ||= i <= j ? dow >= i && dow <= j : dow >= i || dow <= j; }
    if (!dayOk) continue;
    for (const iv of m[2].split(',')) { const t = iv.trim().match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/); if (!t) continue; const s = +t[1] + +t[2] / 60, e = +t[3] + +t[4] / 60; if (hour >= s && hour < e) return true; }
  }
  return false;
}
export const FOOD_TYPES = new Set(['supermarket', 'bakery', 'butcher', 'pastry', 'greengrocer', 'variety_store', 'convenience', 'fast_food', 'restaurant', 'gas']);

/** Enseignes flottantes (sprites) pour les POI proches du joueur. */
export class Signs {
  group = new THREE.Group(); private map = new Map<string, THREE.Sprite>();
  constructor(private pois: Poi[], scene: THREE.Scene) { scene.add(this.group); }
  private make(p: Poi) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(14,18,26,0.72)'; g.beginPath(); g.roundRect(4, 4, 504, 88, 18); g.fill(); g.fillStyle = '#fff'; g.font = '600 38px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.nom.length > 28 ? p.nom.slice(0, 27) + '…' : p.nom, 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }));
    s.scale.set(9, 1.7, 1); s.position.set(p.x, 9, p.y); return s;
  }
  update(px: number, pz: number) {
    for (const p of this.pois) { const d = Math.hypot(p.x - px, p.y - pz); const has = this.map.get(p.id); if (d < 140 && !has) { const s = this.make(p); this.map.set(p.id, s); this.group.add(s); } else if (d > 190 && has) { this.group.remove(has); has.material.map?.dispose(); has.material.dispose(); this.map.delete(p.id); } }
  }
}
