// Caractéristiques des véhicules (génériques, sans marque). Vitesses en m/s (×3,6 = km/h).
export type VehicleType = 'depart' | 'citadine' | 'berline' | 'utilitaire' | 'break' | 'gendarmerie_berline' | 'gendarmerie_fourgon';
export interface VehicleSpec {
  type: VehicleType; nom: string; maxSpeed: number; accel: number; brake: number; steer: number; grip: number; mass: number; hp: number; prix: number;
  L: number; W: number; wheelR: number; wheelbase: number; police?: boolean;
}
export const SPECS: Record<VehicleType, VehicleSpec> = {
  depart:     { type: 'depart', nom: 'Vieille berline', maxSpeed: 31, accel: 7.5, brake: 17, steer: 0.55, grip: 5.2, mass: 1.0, hp: 70, prix: 800, L: 4.3, W: 1.7, wheelR: 0.31, wheelbase: 2.55 },
  citadine:   { type: 'citadine', nom: 'Citadine', maxSpeed: 36, accel: 10, brake: 20, steer: 0.68, grip: 6.2, mass: 0.8, hp: 60, prix: 4500, L: 3.8, W: 1.68, wheelR: 0.29, wheelbase: 2.4 },
  berline:    { type: 'berline', nom: 'Berline', maxSpeed: 46, accel: 11.5, brake: 23, steer: 0.58, grip: 6.8, mass: 1.2, hp: 95, prix: 14000, L: 4.7, W: 1.8, wheelR: 0.33, wheelbase: 2.8 },
  utilitaire: { type: 'utilitaire', nom: 'Utilitaire', maxSpeed: 33, accel: 6.5, brake: 15, steer: 0.5, grip: 4.8, mass: 1.7, hp: 130, prix: 9000, L: 5.1, W: 1.95, wheelR: 0.36, wheelbase: 3.2 },
  break:      { type: 'break', nom: 'Break', maxSpeed: 40, accel: 9, brake: 20, steer: 0.6, grip: 6.0, mass: 1.3, hp: 85, prix: 7000, L: 4.6, W: 1.77, wheelR: 0.32, wheelbase: 2.75 },
  gendarmerie_berline: { type: 'gendarmerie_berline', nom: 'Berline de gendarmerie', maxSpeed: 52, accel: 13.5, brake: 26, steer: 0.62, grip: 7.4, mass: 1.25, hp: 130, prix: 0, L: 4.7, W: 1.8, wheelR: 0.33, wheelbase: 2.8, police: true },
  gendarmerie_fourgon: { type: 'gendarmerie_fourgon', nom: 'Fourgon de gendarmerie', maxSpeed: 40, accel: 8, brake: 17, steer: 0.5, grip: 5.2, mass: 1.8, hp: 160, prix: 0, L: 5.1, W: 1.95, wheelR: 0.36, wheelbase: 3.2, police: true },
};
export const CIVIL_TYPES: VehicleType[] = ['depart', 'citadine', 'berline', 'utilitaire', 'break'];
export const PAINTS = [0xe8e8e8, 0x1c1c1f, 0x8a1c1c, 0x1f3f78, 0x4f5358, 0xb9bcc0, 0x2f5a3d, 0xc9b06a, 0x7a4a2a, 0xd0d0d0, 0x2a2a60, 0xa04a1a];
