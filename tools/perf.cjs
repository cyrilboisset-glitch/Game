// Mesure appels de rendu / triangles / mémoire par niveau de qualité (rendu logiciel : les FPS ne sont PAS représentatifs d'un mobile). Usage : node tools/perf.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  const t0 = Date.now(); await p.goto('http://127.0.0.1:5199/?t=15&freeze&s=3&fresh'); await p.waitForFunction('window.__ready', null, { timeout: 150000 }); console.log('chargement complet (s) :', (Date.now() - t0) / 1000);
  for (const l of ['bas', 'moyen', 'eleve']) {
    await p.evaluate(`window.__game.setQuality('${l}')`); await p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<60;i++)G.update(1/30);window.__game.sync()})()`); await p.waitForTimeout(6000);
    console.log(l, await p.evaluate(`JSON.stringify({...window.__game.stats(),pixelRatio:window.__game.renderer.getPixelRatio(),memoire:window.__game.renderer.info.memory,vehicules:window.__game.npcStats().vehicules})`));
  }
  await b.close();
})();
