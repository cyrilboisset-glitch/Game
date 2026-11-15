// Scénario véhicules : stationnés, circulation, vol, conduite, dégâts, garage. Usage : node tools/vehicles.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const st = p => p.evaluate('(()=>{const g=window.__game.game,c=g.car;return JSON.stringify({mode:g.mode,vehicule:c.spec.nom,hp:Math.round(c.hp),kmh:Math.round(Math.abs(c.speed)*3.6),heat:Math.round(g.heat.value),argent:g.money,x:Math.round(c.pos.x),z:Math.round(c.pos.z)})})()');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 680 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:5199/?t=15&freeze&s=3&r=200&fresh&npc=600'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  console.log('départ', await st(p));
  // fait avancer la circulation autour du joueur pendant 60 s de jeu
  await p.evaluate('(()=>{const G=window.__game.game;G.player.pos.set(G.car.pos.x+3,0,G.car.pos.z);})()'); await step(p, 1800);
  console.log('stats', await p.evaluate('JSON.stringify(window.__game.npcStats())'));
  const tr = await p.evaluate(`(()=>{const T=window.__game.traffic;return JSON.stringify({voitures:T.cars.length,patrouilles:T.cars.filter(c=>c.patrol).length,apparitions:T.stats.spawns,attentesCarrefour:T.stats.attente,vitessesMoy:+(T.cars.reduce((s,c)=>s+c.v.speed,0)/Math.max(1,T.cars.length)).toFixed(1)})})()`); console.log('circulation', tr);
  // plus gros embouteillage : distance minimale entre deux voitures de la circulation
  console.log('distance mini entre voitures :', await p.evaluate(`(()=>{const T=window.__game.traffic;let m=1e9;for(const a of T.cars)for(const c of T.cars){if(a!==c)m=Math.min(m,Math.hypot(a.v.x-c.v.x,a.v.z-c.v.z))}return +m.toFixed(2)})()`));
  // se place près d'une voiture garée : vol
  await p.evaluate(`(()=>{const G=window.__game.game;const v=G.vehicles.list.find(x=>x.kind==='gare'&&x.type==='berline')||G.vehicles.list.find(x=>x.kind==='gare'&&x.type!=='depart'&&!x.type.startsWith('gend'));G.player.pos.set(v.x+2.2,0,v.z);G.camYaw=Math.atan2(-2.2,0);window.__tv=v;G.clock.scale=0;window.__game.sync()})()`); await step(p, 3);
  console.log('invite :', await p.textContent('#prompt')); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/veh_parked.png', timeout: 150000 });
  await p.keyboard.press('KeyE'); await step(p, 3); console.log('vol', await st(p), await p.textContent('#toast'));
  await p.keyboard.down('KeyW'); await step(p, 150); await p.keyboard.up('KeyW'); console.log('roule 5 s', await st(p));
  // choc contre un bâtiment à pleine vitesse
  await p.evaluate(`(()=>{const G=window.__game.game,c=G.car;const b=G.world.builds.find(x=>x.p.length===5&&Math.hypot(x.p[0][0]-c.pos.x,x.p[0][1]-c.pos.z)<300);const q=b.p[0],r=b.p[1];const mx=(q[0]+r[0])/2,mz=(q[1]+r[1])/2;const dx=r[1]-q[1],dz=-(r[0]-q[0]),l=Math.hypot(dx,dz);const ins=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!==(p[j][1]>y))&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c}return c};let sg=1;if(ins(mx+dx/l*25,mz+dz/l*25,b.p))sg=-1;c.pos.set(mx+sg*dx/l*25,0,mz+sg*dz/l*25);c.heading=Math.atan2(-sg*dx,-sg*dz);c.speed=c.spec.maxSpeed*0.8;})()`);
  const hp0 = await p.evaluate('window.__game.car.hp'); await step(p, 60); console.log('choc : pv', hp0.toFixed ? hp0.toFixed(1) : hp0, '→', await st(p));
  // panne puis garage
  await p.evaluate(`(()=>{const G=window.__game.game;const c=G.car;c.hp=c.spec.hp*0.3;c.refreshPaint();const poi=G.pois.find(x=>x.sous_type==='car_repair'||x.sous_type==='gas');c.pos.set(poi.x+4,0,poi.y+4);c.speed=0;G.money=400;window.__game.sync()})()`); await step(p, 3);
  console.log('invite :', await p.textContent('#prompt')); await p.keyboard.press('KeyG'); await step(p, 2); console.log('garage', await st(p), await p.textContent('#toast'));
  await p.evaluate(`(()=>{const G=window.__game.game;G.car.heading=0.6;G.camYaw=0;})()`); await p.keyboard.down('KeyW'); await step(p, 40); await p.keyboard.up('KeyW'); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + '/veh_drive.png', timeout: 150000 });
  await b.close();
})();
