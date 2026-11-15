// Scénario automatisé (Playwright). Le rendu logiciel est très lent : on fait avancer la logique à pas fixes via window.__game.game.update().
// Usage : node tools/play.cjs <dossier_sortie>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const st = p => p.evaluate('(()=>{const g=window.__game.game;return {mode:g.mode,x:+g.pos.x.toFixed(1),z:+g.pos.z.toFixed(1),sp:+window.__game.player.speed.toFixed(2),money:g.money,inv:g.inv,heat:g.heat.value,faim:Math.round(g.needs.s.faim),poi:(g.nearestPoi()||{}).nom}})()');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=10&freeze&s=3&r=300'); await p.waitForFunction('window.__ready', null, { timeout: 120000 }); await p.waitForTimeout(2000);
  console.log('1 départ', JSON.stringify(await st(p)));
  await p.keyboard.down('KeyW'); await step(p, 90); await p.keyboard.up('KeyW'); console.log('2 marche 3 s', JSON.stringify(await st(p)));
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await step(p, 60); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); console.log('3 course 2 s', JSON.stringify(await st(p)));
  // collision : le joueur marche droit dans un bâtiment
  await p.evaluate(`(()=>{const G=window.__game.game;const b=G.world.builds.find(x=>x.p.length===5&&Math.hypot(x.p[0][0]-G.pos.x,x.p[0][1]-G.pos.z)<400);window.__tb=b;const q=b.p[0],r=b.p[1];const mx=(q[0]+r[0])/2,mz=(q[1]+r[1])/2;const dx=r[1]-q[1],dz=-(r[0]-q[0]),l=Math.hypot(dx,dz);const inside=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!==(p[j][1]>y))&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c}return c};let sg=1;if(inside(mx+dx/l*4,mz+dz/l*4,b.p))sg=-1;G.player.pos.set(mx+sg*dx/l*4,0,mz+sg*dz/l*4);G.player.heading=Math.atan2(-sg*dx,-sg*dz);G.camYaw=G.player.heading;})()`);
  await p.keyboard.down('KeyW'); await step(p, 90); await p.keyboard.up('KeyW');
  console.log('4 collision', await p.evaluate(`(()=>{const G=window.__game.game,b=window.__tb;const {pointInPoly}={pointInPoly:(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!==(p[j][1]>y))&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c}return c}};return JSON.stringify({dedans:pointInPoly(G.pos.x,G.pos.z,b.p)})})()`));
  // commerce ouvert : acheter, voler ; commerce fermé : casser
  await p.evaluate(`(()=>{const G=window.__game.game;const poi=G.pois.find(x=>x.sous_type==='supermarket');G.player.pos.set(poi.x+3,0,poi.y+3);G.clock.hour=10;G.clock.day=3;G.clock.scale=0;})()`); await step(p, 3);
  console.log('5 prompt ouvert :', await p.textContent('#prompt'));
  await p.keyboard.press('KeyE'); await step(p, 2); console.log('   achat', JSON.stringify(await st(p)), await p.textContent('#toast'));
  await p.keyboard.press('KeyF'); await step(p, 2); console.log('   vol  ', JSON.stringify(await st(p)), await p.textContent('#toast'));
  await p.evaluate(`window.__game.game.clock.hour=2`); await step(p, 3); console.log('6 prompt fermé :', await p.textContent('#prompt'));
  await p.keyboard.press('KeyE'); await step(p, 2); console.log('   casse', JSON.stringify(await st(p)), await p.textContent('#toast'));
  // manger, dormir
  await p.keyboard.press('Digit1'); await step(p, 2); console.log('7 manger', JSON.stringify(await st(p)));
  await p.evaluate(`(()=>{const G=window.__game.game;G.needs.s.energie=20;G.player.speed=0;})()`); await p.keyboard.press('KeyR'); await step(p, 2); await p.evaluate(`window.__game.game.clock.scale=12`);
  await step(p, 600); console.log('8 sommeil', await p.evaluate(`JSON.stringify({sleeping:window.__game.game.sleeping,energie:Math.round(window.__game.game.needs.s.energie),heure:window.__game.game.clock.label})`));
  // voiture : monter, rouler, descendre
  await p.evaluate(`(()=>{const G=window.__game.game;G.sleeping=false;G.clock.scale=0;G.player.pos.set(G.car.pos.x+2.5,0,G.car.pos.z);})()`); await step(p, 3);
  await p.keyboard.press('KeyE'); await step(p, 2); console.log('9 monte', (await st(p)).mode);
  await p.keyboard.down('KeyW'); await step(p, 150); await p.keyboard.up('KeyW'); console.log('10 roule 5 s', JSON.stringify(await st(p)), 'vitesse', await p.evaluate('+window.__game.car.speed.toFixed(1)'));
  await p.keyboard.press('KeyE'); await step(p, 2); console.log('11 descend', (await st(p)).mode);
  await p.evaluate(`(()=>{const G=window.__game.game;G.clock.hour=10;G.clock.scale=0;})()`);
  await p.evaluate(`(()=>{const G=window.__game.game;const poi=G.pois.find(x=>x.nom.includes('Boulangerie')||x.sous_type==='bakery');G.player.pos.set(poi.x-6,0,poi.y+8);G.player.heading=0;G.camYaw=0.6;G.camPitch=0.2;})()`); await step(p, 3); await p.evaluate('window.__game.sync()'); await p.waitForTimeout(6000);
  await p.screenshot({ path: out + '/phase2_foot.png', timeout: 150000 });
  console.log('stats', JSON.stringify(await p.evaluate('window.__game.stats()')));
  await b.close();
})();
