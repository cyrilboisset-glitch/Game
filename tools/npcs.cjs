// Scénario habitants : population, états à plusieurs heures, observation, captures. Usage : node tools/npcs.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)); });
  const t0 = Date.now(); await p.goto('http://127.0.0.1:5199/?t=8&freeze&s=3&r=200&fresh'); await p.waitForFunction('window.__ready', null, { timeout: 150000 }); console.log('chargement (s):', (Date.now() - t0) / 1000);
  console.log(await p.evaluate(`(()=>{const G=window.__game.game;const ns=[...G.npcs.values()];const c={};ns.forEach(n=>c[n.metier]=(c[n.metier]||0)+1);return JSON.stringify({total:ns.length,mineurs:ns.filter(n=>n.minor).length,avecVoiture:ns.filter(n=>n.hasCar).length,metiers:c})})()`));
  for (const h of [3, 8, 12.5, 18, 21]) {
    const r = await p.evaluate(`(()=>{const G=window.__game.game;G.clock.hour=${h};G.clock.scale=0;const ns=[...G.npcs.values()];const k={dedans:0,marche:0,conduit:0,dehors:0,absent:0};ns.forEach(n=>{const s=G.sim.stateAt(n,G.clock.day,${h},false);k[s.kind]++});return JSON.stringify(k)})()`); console.log(h + ' h', r);
  }
  // téléporte le joueur au milieu d'une rue animée à 8 h 30 et attend des piétons
  const spot = await p.evaluate(`(()=>{const G=window.__game.game;G.clock.hour=8.4;let best=null,bc=0;for(const n of G.npcs.values()){const s=G.sim.stateAt(n,G.clock.day,8.4,true);if(s.kind!=='marche')continue;let c=0;for(const m of G.npcs.values()){const t=G.sim.stateAt(m,G.clock.day,8.4,false);if(t.kind==='marche'&&Math.hypot(t.x-s.x,t.z-s.z)<150)c++}if(c>bc){bc=c;best=s}}if(!best)return 'aucun';G.player.pos.set(best.x+3,0,best.z+3);G.camYaw=0.7;window.__game.sync();return JSON.stringify({x:Math.round(best.x),z:Math.round(best.z),autour:bc})})()`);
  console.log('zone animée :', spot); await step(p, 20); await p.waitForTimeout(2500); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(2500);
  console.log('rendu PNJ :', await p.evaluate('JSON.stringify(window.__game.npcStats())')); await p.screenshot({ path: out + '/npc_street.png', timeout: 150000 });
  // observation
  const id = await p.evaluate('(()=>{const v=window.__game.npcRender.visible[0];return v?v.id:null})()'); console.log('observe', id);
  if (id !== null) { await p.evaluate(`(()=>{const G=window.__game;G.game.observe(${id});document.getElementById('observe').style.display='block';})()`); await step(p, 5); await p.waitForTimeout(2500); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(2500); await p.screenshot({ path: out + '/npc_observe.png', timeout: 150000 });
    console.log(await p.evaluate('document.getElementById("observe").innerText')); }
  await b.close();
})();
