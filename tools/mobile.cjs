// Test téléphone : entrer dans un bâtiment puis en sortir (bouton « Sortir » et par la porte), sons chargés, pédales en voiture. Usage : node tools/mobile.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=11&freeze&fresh&touch&r=120'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  const ev = js => p.evaluate(js); const step = n => ev(`(()=>{for(let i=0;i<${n};i++)window.__game.game.update(1/30)})()`); await ev('window.G=window.__game.game;G.clock.scale=0');
  await p.touchscreen.tap(700, 200); await p.waitForTimeout(4000); console.log('sons chargés :', await ev(`(()=>{const a=window.__audio;return a?a['buf'].size:'?'})()`));
  // entrer dans un commerce ouvert
  await ev(`(()=>{const e=G.pois.filter(q=>q.sous_type==='bakery'||q.sous_type==='supermarket').map(q=>G.interior.index.entryOfPoi(q)).find(Boolean);G.player.pos.set(e.px+e.nx*1.2,0,e.pz+e.nz*1.2);})()`); await step(2); await p.waitForTimeout(1200);
  const A = async () => ev(`document.querySelector('#bA').textContent`); console.log('devant la porte, bouton bleu :', await A());
  await p.tap('#bA'); await step(25); console.log('après appui : à l\'intérieur =', await ev('G.interior.inside'), '| boutons jaunes :', await ev(`[...document.querySelectorAll('#chips .chip')].map(c=>c.textContent).join(',')`));
  await p.waitForTimeout(1200); console.log('   boutons jaunes (après rafraîchissement) :', await ev(`[...document.querySelectorAll('#chips .chip')].map(c=>c.textContent).join(',')`));
  await p.tap('#chips [data-a="exit"]'); await step(25); console.log('bouton Sortir → à l\'intérieur =', await ev('G.interior.inside'));
  await p.tap('#bA'); await step(25); console.log('rentré :', await ev('G.interior.inside')); await ev(`(()=>{const l=G.interior.layout;G.player.pos.set(l.door.x,0,l.D+0.6)})()`); await step(25); console.log('passé par la porte → à l\'intérieur =', await ev('G.interior.inside'));
  // voiture : pédales
  await ev(`(()=>{G.mode='car';G.car.speed=0;})()`); await step(2); await p.waitForTimeout(1200); console.log('en voiture, boutons :', await ev(`['bA','bB','bC','bD'].map(i=>document.querySelector('#'+i).textContent).join(' / ')`), '| jaunes :', await ev(`[...document.querySelectorAll('#chips .chip')].map(c=>c.textContent).join(',')`));
  const box = await p.locator('#bA').boundingBox(); await p.touchscreen.tap(box.x + 40, box.y + 40); const v0 = await ev('G.car.speed');
  await ev(`window.__game.game.input['touchBtn'].add('gas')`); await step(30); console.log('pédale Gaz 1 s → vitesse', (await ev('G.car.speed')).toFixed(1), 'm/s (avant', v0.toFixed(1) + ')'); await ev(`window.__game.game.input['touchBtn'].delete('gas')`);
  await b.close();
})();
