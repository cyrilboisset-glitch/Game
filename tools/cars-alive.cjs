// Scénario voitures vivantes : tonneau contre un obstacle bas, pièces arrachées, éclats, conducteur percuté, klaxon quand on bloque, radio. Usage : node tools/cars-alive.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js);
const shot = async (p, name) => { await ev(p, 'window.__game.sync()'); await p.waitForTimeout(2500); await p.screenshot({ path: out + '/' + name, timeout: 120000 }); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=13&freeze&s=3&fresh&r=180&mode=car'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{window.G=window.__game.game;G.clock.scale=0;G.car.setVehicle('berline',0x8a1c1c,95,0);window.__r=Math.random;})()`);
  // 1. tonneau forcé : choc latéral violent (tirage aléatoire fixé pour le test)
  await ev(p, `(()=>{Math.random=()=>0.1;G.car.speed=20;G.hitAt={x:G.car.pos.x+Math.cos(G.car.heading)*1,z:G.car.pos.z-Math.sin(G.car.heading)*1};G['crash'](32,true);Math.random=window.__r;})()`);
  console.log('1. choc violent →', await p.textContent('#toast'), '| tonneau', await ev(p, '!!G.car.roll'), '| pièces arrachées', await ev(p, 'JSON.stringify([...G.car.lost])'));
  await step(p, 12); await ev(p, `G.carOff=Math.PI*0.5;G.camPitch=0.3`); await shot(p, 'tonneau.png'); for (let i = 0; i < 4; i++) await step(p, 15);
  console.log('   après :', await ev(p, `G.car.flipped ? 'sur le toit' : 'sur les roues'`), '| prompt', await p.textContent('#prompt')); await shot(p, 'tonneau-fin.png');
  // 2. conducteur percuté
  await ev(p, `(()=>{G.car.repair();const c=G.traffic.cars.find(c=>!c.patrol);window.__tc=c.v;G.reports=[];G.hud.toast('',0);G['trafficAngry'](c.v,8);})()`); await step(p, 2);
  console.log('2. conducteur percuté fort →', await p.textContent('#toast'), '| appels en attente', await ev(p, 'G.reports.length'));
  // 3. radio
  await p.keyboard.press('KeyM'); await step(p, 2); console.log('3. radio :', await p.textContent('#toast')); await p.keyboard.press('KeyM'); await step(p, 2); console.log('   suivante :', await p.textContent('#toast'));
  await b.close();
})();
