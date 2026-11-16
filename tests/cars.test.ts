import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pattern, STATIONS } from '../src/audio/radio';
import { Debris } from '../src/vehicles/wreck';

describe('radio inventée', () => {
  it('motifs de 16 pas, déterministes, différents selon la station et le morceau', () => {
    const a = pattern(STATIONS[0], 3), b = pattern(STATIONS[0], 3), c = pattern(STATIONS[2], 3), d = pattern(STATIONS[0], 4);
    expect(a.kick.length).toBe(16); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(JSON.stringify(a)).not.toBe(JSON.stringify(c)); expect(JSON.stringify(a.lead)).not.toBe(JSON.stringify(d.lead));
    expect(a.kick.filter(Boolean).length).toBeGreaterThan(2); expect(STATIONS.every(s => !/GTA|Los Santos|Vice/i.test(s.nom))).toBe(true);
  });
});
describe('débris d\'accident', () => {
  it('une pièce arrachée retombe et s\'immobilise au sol ; les éclats de verre retombent', () => {
    const scene = new THREE.Scene(); const D = new Debris(scene, 50); const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.2));
    D.throwPiece(m, new THREE.Vector3(0, 1, 0), new THREE.Vector3(3, 4, 0)); D.shatter(new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(1, 0, 0), 30);
    let maxY = 0; for (let i = 0; i < 300; i++) { D.update(1 / 30); maxY = Math.max(maxY, m.position.y); }
    expect(maxY).toBeGreaterThan(1.3); expect(m.position.y).toBeLessThan(0.06); expect(m.position.x).toBeGreaterThan(1); expect(scene.children.includes(m)).toBe(true);
  });
});
