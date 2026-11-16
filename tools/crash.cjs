// Scénario chocs et animations : voiture contre un mur et contre une voiture garée (tôle, vitre, phares, étincelles), piéton renversé (chute, relevé), conducteur au volant. Usage : node tools/crash.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js);
const shot = async (p, name) => { await ev(p, 'window.__game.sync()'); await step(p, 1); await p.waitForTimeout(3000); await p.screenshot({ path: out + '/' + name }); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=13&freeze&s=3&fresh&r=200&mode=car'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{window.G=window.__game.game;G.clock.scale=0;G.car.setVehicle('berline',0x1f3f78,95,0);})()`);
  const geo = `(()=>{const m=G.car.body.children[0];const a=m.geometry.getAttribute('position').array;let s=0;for(let i=0;i<a.length;i++)s+=a[i];return s.toFixed(1)})()`;
  // 1. contre un mur : voiture face à une façade, 14 m/s
  await ev(p, `(()=>{const W=G.world.builds;for(let k=50;k<W.length;k+=37){const P=W[k].p;const mx=(P[0][0]+P[1][0])/2,mz=(P[0][1]+P[1][1])/2;const e=G.interior.index.find(mx,mz,0.5);if(!e)continue;const x=e.px+e.nx*9,z=e.pz+e.nz*9;if(G.coll.resolve({x,z},2.5).depth>0)continue;G.car.pos.set(x,0,z);G.car.heading=Math.atan2(-e.nx,-e.nz);G.car.speed=14;G.camYaw=G.car.heading;window.__w=e;return}})()`);
  const g0 = await ev(p, geo); for (let i = 0; i < 40; i++) await step(p, 1);
  console.log('1. mur à 50 km/h → état', Math.round(await ev(p, 'G.car.hp')), '/ 95 | tôle déformée :', g0 !== await ev(p, geo), '| pare-brise fissuré :', await ev(p, 'G.car.cracked'), '| phares cassés :', await ev(p, 'JSON.stringify([...G.car.broken])'));
  await ev(p, `(()=>{const c=G.car;c.speed=0;const h=c.heading;G.camYaw=h+Math.PI*0.85;G.camPitch=0.25;G.car.setLights(true);})()`); await step(p, 2); await shot(p, 'choc-mur.png');
  // 2. contre une voiture garée
  await ev(p, `(()=>{const v=G.vehicles.list.find(v=>v.kind==='gare'&&!v.mine&&!G.vehicles.near(v.x,v.z,9).some(w=>w!==v));window.__v=v;const fx=Math.sin(v.h),fz=Math.cos(v.h);G.car.repair();G.car.pos.set(v.x-fx*12,0,v.z-fz*12);G.car.heading=v.h;G.car.speed=13;})()`);
  for (let i = 0; i < 45; i++) await step(p, 1);
  console.log("2. voiture garée percutée par l'arrière → son état", (await ev(p, 'window.__v.hp/ ({citadine:60,break:75,berline:95,utilitaire:110,depart:70}[window.__v.type]||80)')).toFixed(2), '| côté abîmé :', await ev(p, 'window.__v.dent'));
  await ev(p, `(()=>{const v=window.__v;G.car.pos.set(v.x-Math.sin(v.h)*14+Math.cos(v.h)*5,0,v.z-Math.cos(v.h)*14-Math.sin(v.h)*5);G.camYaw=Math.atan2(v.x-G.car.pos.x,v.z-G.car.pos.z);G.camPitch=0.2;})()`); await step(p, 2); await shot(p, 'choc-voiture-garee.png');
  // 3. conducteur au volant
  await ev(p, `(()=>{G.car.repair();G.camYaw=G.car.heading+Math.PI*0.62;G.camPitch=0.12;})()`); await step(p, 3); console.log('3. au volant : pose', await ev(p, `JSON.stringify([...G.player['av'].poseW].filter(([k,v])=>v>0.5).map(([k])=>k))`), '| visible', await ev(p, 'G.player.root.visible')); await shot(p, 'conducteur.png');
  // 4. piéton renversé : chute puis relevé
  await ev(p, `(()=>{G.clock.hour=8.3;const W=[];for(const n of G.npcs.values()){if(n.minor)continue;const s=G.sim.stateAt(n,G.clock.day,8.3,true);if(s.kind==='marche')W.push(s)}const s=W[5];G.states.set(s.id,s);window.__p=s;G.knock(s.id,Math.sin(G.car.heading)*2,Math.cos(G.car.heading)*2,G.car.heading);})()`);
  const fall = []; for (let i = 0; i < 4; i++) { fall.push((await ev(p, `G.overrides().get(window.__p.id).fall`)).toFixed(2)); await step(p, 4); }
  console.log('4. piéton renversé : chute', fall.join(' → '), '| projeté de', (await ev(p, `(()=>{const c=G.npcCtl.get(window.__p.id);return Math.hypot(c.x-window.__p.x,c.z-window.__p.z)})()`)).toFixed(1), 'm');
  await ev(p, `(()=>{const c=G.npcCtl.get(window.__p.id);c.until=G.npcCtl.t+0.05;})()`); await step(p, 3); const r1 = await ev(p, `G.overrides().get(window.__p.id).fall`); await step(p, 25); console.log('   relevé : ', r1.toFixed(2), '→', (await ev(p, `G.overrides().get(window.__p.id)?.fall ?? 0`)).toFixed(2));
  await b.close();
})();
