const KEY = 'pontcharra-save-v2';
export interface SaveData { w3?: any; uw?: any; weapons?: string[]; px: number; pz: number; heading: number; mode: 'foot' | 'car'; car: { x: number; z: number; h: number; type?: any; paint?: number; hp?: number; up?: number }; garage?: { type: any; paint: number; hp: number; x: number; z: number; h: number; up?: number }[]; needs: any; money: number; inv: { nourriture: number; eau: number }; heat: number; hour: number; day: number; looted: string[]; rep?: number; done?: number; mission?: unknown; }
export const save = (d: SaveData) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };
export const load = (): SaveData | null => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
export const reset = () => { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } };
