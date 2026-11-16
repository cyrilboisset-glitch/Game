// Captures météo : pluie (routes mouillées), neige d'hiver, brouillard du matin. Usage : node tools/weather.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=14&freeze&s=3&fresh&r=180'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  const { weatherAt, seasonOf } = { weatherAt: null, seasonOf: null };
  // trouve un jour de pluie (automne), un jour de neige (hiver), un matin de brouillard
  const pick = await p.evaluate(async () => { const W = await import('/src/world/weather.ts'); let rain = null, snow = null, fog = null; for (let d = 1; d < 40 && !(rain && snow && fog); d++) for (let h = 6; h < 18; h += 1) { const w = W.weatherAt(d, h); if (!rain && W.seasonOf(d) === 'automne' && w.rain > 0.6 && h > 10) rain = [d, h]; if (!snow && w.snow > 0.6) snow = [d, h]; if (!fog && w.fog > 0.9) fog = [d, h]; } return { rain, snow, fog }; });
  console.log('jours trouvés :', JSON.stringify(pick));
  for (const [k, v] of Object.entries(pick)) { if (!v) continue; await p.evaluate(([d, h]) => { const G = window.__game.game; G.clock.day = d; G.clock.hour = h; G.clock.scale = 0; G.camPitch = 0.12; }, v); await p.waitForTimeout(9000); await p.screenshot({ path: `${out}/meteo-${k}.png`, timeout: 120000 }); console.log(k, '→', await p.textContent('#stats')); }
  await b.close();
})();
