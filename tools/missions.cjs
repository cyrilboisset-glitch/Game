// Scénario missions : offres, livraison, colis fictif, taxi, concession, échec à l'arrestation. Usage : node tools/missions.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const st = p => p.evaluate('(()=>{const g=window.__game.game;return JSON.stringify({argent:g.money,rep:g.missions.rep,faites:g.missions.done,active:g.missions.active&&g.missions.active.offer.titre,etape:g.missions.active&&g.missions.active.stage,etoiles:g.heat.stars})})()');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 680 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=10&freeze&s=3&r=200&fresh&npc=600'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await step(p, 60); console.log('offres :', await p.evaluate('JSON.stringify(window.__game.game.offers.map(o=>[o.kind,o.titre.slice(0,60),o.pay,o.limit,o.stages.length]))'));
  console.log('lieux fictifs colis :', await p.evaluate(`JSON.stringify(window.__game.game.offers.filter(o=>o.kind==='colis').map(o=>o.stages.map(s=>s.label)))`));
  const go = (kind) => p.evaluate(`(()=>{const G=window.__game.game;const o=G.offers.find(x=>x.kind==='${kind}');if(!o)return 'aucune';G.startOffer(o);return G.missions.active?G.missions.active.offer.titre:'refusée'})()`);
  const doStages = async (car) => { for (let i = 0; i < 4; i++) { const r = await p.evaluate(`(()=>{const G=window.__game.game;const t=G.missionTarget();if(!t)return 'fin';G.clock.scale=0;${car ? "G.mode='car';G.player.root.visible=false;G.car.pos.set(t.x,0,t.z);G.car.speed=0;" : "G.player.pos.set(t.x,0,t.z);"}return t.label})()`); if (r === 'fin') break; await step(p, 3); } };
  console.log('livraison :', await go('livraison')); await doStages(false); console.log('  →', await st(p), await p.textContent('#toast'));
  console.log('colis :', await go('colis')); await doStages(true); console.log('  →', await st(p), await p.textContent('#toast'));
  console.log('course :', await go('course')); await doStages(true); console.log('  →', await st(p));
  // taxi : un habitant à pied près du joueur
  const t = await p.evaluate(`(()=>{const G=window.__game.game;G.clock.hour=8.3;G.clock.scale=0;let best=null;for(const n of G.npcs.values()){const s=G.sim.stateAt(n,G.clock.day,8.3,true);if(s.kind==='marche'&&!n.minor){best=s;break}}if(!best)return 'aucun piéton';G.mode='foot';G.player.root.visible=true;G.player.pos.set(best.x+3,0,best.z);G.states.set(best.id,best);window.__game.sync();return 'ok'})()`);
  console.log('taxi :', t); if (t === 'ok') { await step(p, 2); console.log('  démarre', await go('taxi')); console.log('  →', await st(p)); }
  // échec à l'arrestation
  await p.evaluate(`(()=>{const G=window.__game.game;G.missions.abandon();const o=G.offers.find(x=>x.kind==='livraison');G.startOffer(o);G.heat.value=60;G.mode='foot';G.player.speed=0;G.player.pos.set(-850,0,-80);})()`); 
  await p.evaluate(`(()=>{const G=window.__game.game;G.police.clearAll()})()`);
  // concession
  await p.evaluate(`(()=>{const G=window.__game.game;const poi=G.pois.find(x=>x.sous_type==='car');G.missions.abandon();G.heat.value=0;G.money=20000;G.mode='foot';G.player.root.visible=true;G.player.pos.set(poi.x+3,0,poi.y+3);window.__game.sync()})()`); await step(p, 3);
  console.log('concession invite :', await p.textContent('#prompt')); await p.keyboard.press('KeyN'); await step(p, 2); await p.keyboard.press('KeyB'); await step(p, 2); console.log('  achat →', await p.textContent('#toast'), await st(p));
  // journal
  await p.keyboard.press('KeyJ'); await step(p, 2); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(2500); await p.screenshot({ path: out + '/missions_panel.png', timeout: 150000 });
  await p.keyboard.press('KeyJ'); await p.evaluate(`(()=>{const G=window.__game.game;const o=G.offers.find(x=>x.kind==='colis');G.startOffer(o);const t=G.missionTarget();G.mode='car';G.player.root.visible=false;G.car.pos.set(t.x-80,0,t.z-30);G.car.heading=Math.atan2(80,30);G.car.speed=0;G.clock.hour=19.6;G.camPitch=0.25;window.__game.sync()})()`); await step(p, 3); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + '/missions_beacon.png', timeout: 150000 }); await b.close();
})();
