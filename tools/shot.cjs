// Capture d'écran + mesure FPS via Playwright (Chromium headless, rendu logiciel SwiftShader : les FPS ne sont PAS représentatifs d'un mobile).
const { chromium } = require('playwright');
const [url, out, w, h, wait] = [process.argv[2], process.argv[3], +process.argv[4] || 1280, +process.argv[5] || 720, +process.argv[6] || 4000];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(m.type(), m.text().slice(0, 300)); });
  await p.goto(url); await p.waitForFunction('window.__ready', null, { timeout: 120000 }); await p.waitForTimeout(wait);
  console.log(JSON.stringify(await p.evaluate('window.__game.stats()')));
  await p.screenshot({ path: out }); await b.close();
})();
