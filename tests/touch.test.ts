import { describe, it, expect } from 'vitest';
import { touchContext, verb, keyText, type CtxState } from '../src/ui/touchctx';

const base: CtxState = { mode: 'foot', inside: false, sleeping: false, observing: false, weapon: 'poings', ammo: 0, weapons: 1, night: false, faim: 80, soif: 80, vessie: 10, energie: 90, sante: 100, food: 1, water: 1, kits: 0, bleeding: false, wanted: false, hooded: false };

describe('boutons tactiles contextuels', () => {
  it('verbe et consigne extraits du texte d\'aide', () => {
    expect(verb('la forcer à monter dans la voiture')).toBe('Forcer'); expect(verb('voler cet utilitaire')).toBe('Voler');
    expect(keyText('Famille X · tout est éteint — E : crocheter (sans bruit) · G : mettre le feu', 'E')).toBe('crocheter (sans bruit)');
    expect(keyText('Receleur — Pistolet — 450 € · N : suivant · B/E : valider', 'B')).toBe('valider');
  });
  it('à pied : action principale, frapper/tirer, boutons utiles seulement', () => {
    const c = touchContext('E : voler cet utilitaire · G : mettre le feu à cette voiture', base);
    expect(c.primary).toBe('Voler'); expect(c.attack).toBe('Frapper'); expect(c.chips.map(x => x[1])).toEqual(['Feu']);
    expect(touchContext('', { ...base, weapon: 'pistolet', ammo: 3 }).attack).toBe('Tirer');
    expect(touchContext('', base).primary).toBeNull(); expect(touchContext('', base).chips).toEqual([]);
  });
  it('menus, intérieur, voiture, sommeil', () => {
    const m = touchContext('Receleur — Gants — 10 € · N : suivant · B/E : valider', base); expect(m.primary).toBe('Valider'); expect(m.chips.map(x => x[0])).toEqual(['next']);
    const i = touchContext('E : Passer en caisse (5 €) · F : braquer la caisse', { ...base, inside: true }); expect(i.primary).toBe('Passer'); expect(i.attack).toBe('Braquer');
    expect(touchContext('E : Fouiller l\'armoire', { ...base, inside: true }).attack).toBeNull();
    const c = touchContext('E : descendre · L : phares · G : garage', { ...base, mode: 'car', night: true }); expect(c.primary).toBe('Descendre'); expect(c.attack).toBeNull(); expect(c.car).toBe(true); expect(c.chips.map(x => x[0])).toEqual(['garage', 'lights', 'radio']);
    expect(touchContext('', { ...base, sleeping: true })).toMatchObject({ primary: 'Réveil', act: 'sleep' });
  });
  it('besoins urgents et situations : manger, soin, capuche, objet', () => {
    const c = touchContext('', { ...base, faim: 20, bleeding: true, kits: 1, wanted: true, weapons: 3 });
    expect(c.chips.map(x => x[0])).toEqual(['eat', 'heal', 'hood', 'weapon']);
    expect(touchContext('', { ...base, faim: 20, food: 0 }).chips).toEqual([]);
  });
});
