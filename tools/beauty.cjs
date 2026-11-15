// Captures de référence (mêmes points de vue) pour juger le rendu. Usage : node tools/beauty.cjs <dossier> <préfixe>
const { chromium } = require('playwright'); const out = process.argv[2] || '.', pre = process.argv[3] || 'b', only = process.argv[4];
const views = [
  ['rue', 't=11&s=3', '(()=>{const G=window.__game.game;G.camYaw=G.player.heading+0.35;G.camPitch=0.12;})()'],
  ['haut', 't=16.5&s=8', '(()=>{const G=window.__game.game;G.player.pos.set(G.player.pos.x,0,G.player.pos.z);G.camYaw=G.player.heading-0.9;G.camPitch=0.95;})()'],
  ['soir', 't=19.9&s=10', '(()=>{const G=window.__game.game;G.camYaw=G.player.heading;G.camPitch=0.1;})()'],
  ['nuit', 't=22.5&s=6&mode=car', '(()=>{const G=window.__game.game;G.camPitch=0.2;})()'],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  for (const [name, qs, js] of views.filter(v => !only || only.split(',').includes(v[0]))) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto(`http://127.0.0.1:5199/?${qs}&freeze&fresh&npc=1500`); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
    await p.evaluate(`window.__game.setQuality('eleve')`); await p.evaluate(js); await p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<20;i++)G.update(1/30);window.__game.sync()})()`); await p.waitForTimeout(5000);
    await p.screenshot({ path: `${out}/${pre}_${name}.png`, timeout: 150000 }); console.log(name, await p.evaluate('JSON.stringify(window.__game.stats())')); await p.close();
  }
  await b.close();
})();
