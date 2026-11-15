// Scénario gendarmerie : crime → poursuite → fuite ou arrestation. Usage : node tools/police.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const info = p => p.evaluate('(()=>{const g=window.__game.game,P=window.__game.police;return JSON.stringify({mode:g.mode,etoiles:g.heat.stars,heat:Math.round(g.heat.value),unites:P.units.length,barrages:P.blocks.length,proche:Math.round(P.nearest),arret:+P.arrestTimer.toFixed(1),argent:g.money,inv:g.inv.nourriture+g.inv.eau,x:Math.round(g.pos.x),z:Math.round(g.pos.z)})})()');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 680 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=14&freeze&s=3&r=200&fresh&npc=600&mode=car'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  console.log('1 départ', await info(p));
  await p.evaluate('(()=>{const G=window.__game.game;G.money=300;G.inv={nourriture:2,eau:1};G.heat.value=70;G.clock.scale=0})()'); console.log('2 recherche 70', await info(p));
  await step(p, 30 * 25); console.log('3 après 25 s à l\'arrêt', await info(p));
  await step(p, 30 * 25); console.log('4 après 50 s', await info(p));
  // fuite : roule vers l'avant à grande vitesse, vérifie les barrages
  await p.evaluate('(()=>{const G=window.__game.game;G.heat.value=70;G.police.clearAll();G.car.speed=20})()'); await p.keyboard.down('KeyW'); await step(p, 30 * 20); await p.keyboard.up('KeyW'); console.log('5 fuite 20 s', await info(p));
  await p.evaluate('window.__game.sync()'); await p.waitForTimeout(3500); await p.screenshot({ path: out + '/police_chase.png', timeout: 150000 });
  // fuite réussie : on téléporte loin, sans être vu, la recherche doit baisser
  await p.evaluate('(()=>{const G=window.__game.game;G.car.pos.set(G.car.pos.x+1500,0,G.car.pos.z+900);G.car.speed=0;window.__game.police.units.forEach(u=>{u.v.x+=3000});window.__game.sync()})()'); await step(p, 30 * 60); console.log('6 après 60 s hors de vue', await info(p));
  await b.close();
})();
