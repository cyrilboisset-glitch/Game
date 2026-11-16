// Capture d'une page de labo : node tools/labshot.cjs <url> <sortie.png>
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1400, height: 600 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await p.goto(process.argv[2]); await p.waitForFunction('window.__ready', null, { timeout: 120000 }); await p.waitForTimeout(2500); await p.screenshot({ path: process.argv[3] }); await b.close(); })();
