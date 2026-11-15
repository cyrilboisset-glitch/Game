import { describe, it, expect } from 'vitest';
import { engineRpm, rpmToFreq, sirenFreq, distGain, stepInterval } from '../src/audio/mapping';

describe('Audio : correspondances', () => {
  it('le régime monte avec la vitesse dans un rapport puis retombe au changement de rapport', () => { expect(engineRpm(0, 0)).toBe(900); expect(engineRpm(6, 0)).toBeGreaterThan(engineRpm(2, 0)); expect(engineRpm(6.9, 0)).toBeGreaterThan(engineRpm(7.1, 0)); });
  it('l\'accélérateur ajoute du régime, borné', () => { expect(engineRpm(10, 1)).toBeGreaterThan(engineRpm(10, 0)); expect(engineRpm(100, 1)).toBeLessThanOrEqual(6800); });
  it('la fréquence suit le régime (4 cylindres)', () => { expect(rpmToFreq(3000)).toBe(100); });
  it('la sirène alterne deux tons', () => { expect(sirenFreq(0.1)).not.toBe(sirenFreq(0.7)); expect(sirenFreq(0.1)).toBe(sirenFreq(1.2)); });
  it('le gain décroît avec la distance et s\'annule au loin', () => { expect(distGain(10)).toBeGreaterThan(distGain(100)); expect(distGain(300)).toBe(0); expect(distGain(0)).toBeLessThanOrEqual(1); });
  it('les pas sont plus rapprochés en courant, absents à l\'arrêt', () => { expect(stepInterval(5.6)).toBeLessThan(stepInterval(1.5)); expect(stepInterval(0)).toBe(Infinity); });
});
