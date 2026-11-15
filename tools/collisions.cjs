// Scénario collisions : piéton/voitures, voiture qui s'arrête devant le piéton, mobilier, piétons percutés. Usage : node tools/collisions.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=9&freeze&s=3&r=200&fresh&npc=1500'); await p.waitForFunction('window.__ready', null, { timeout: 150000 }); await step(p, 5);
  // 1. marcher droit dans une voiture garée
  const r1 = await ev(p, `(()=>{const G=window.__game.game;const v=G.vehicles.list.find(x=>x.kind==='gare'&&!x.type.startsWith('gend'));const fx=Math.sin(v.h+Math.PI/2),fz=Math.cos(v.h+Math.PI/2);G.player.pos.set(v.x+fx*3,0,v.z+fz*3);G.camYaw=Math.atan2(-fx,-fz);window.__v=v;return 'ok'})()`);
  await p.keyboard.down('KeyW'); await step(p, 90); await p.keyboard.up('KeyW');
  console.log('1. piéton vs voiture garée → distance au centre :', await ev(p, `(()=>{const G=window.__game.game,v=window.__v;const dx=G.player.pos.x-v.x,dz=G.player.pos.z-v.z;return Math.abs(dx*Math.cos(v.h)-dz*Math.sin(v.h)).toFixed(2)+' m sur le côté (demi-largeur + rayon ≈ 1,25)'})()`));
  // 2. se planter sur la voie devant une voiture de la circulation
  const r2 = await ev(p, `(()=>{const G=window.__game.game,T=window.__game.traffic;const c=T.cars.find(c=>!c.patrol&&c.v.speed>4&&c.s+40<c.cum[c.cum.length-1]);if(!c)return 'aucune voiture en mouvement';const pa=(s)=>{let i=0;while(i<c.cum.length-2&&c.cum[i+1]<s)i++;const t=(s-c.cum[i])/(c.cum[i+1]-c.cum[i]||1);return [c.pts[i][0]+(c.pts[i+1][0]-c.pts[i][0])*t,c.pts[i][1]+(c.pts[i+1][1]-c.pts[i][1])*t]};const q=pa(c.s+28);G.player.pos.set(q[0],0,q[1]);window.__c=c;return 'piéton placé 28 m devant une voiture à '+(c.v.speed*3.6).toFixed(0)+' km/h'})()`); console.log('2.', r2);
  if (!r2.startsWith('aucune')) { let minD = 99, down = false; for (let i = 0; i < 12; i++) { await step(p, 15); const s = await ev(p, `(()=>{const G=window.__game.game,c=window.__c;return {d:Math.hypot(c.v.x-G.player.pos.x,c.v.z-G.player.pos.z),sp:c.v.speed,down:G.downT>0}})()`); minD = Math.min(minD, s.d); down = down || s.down; }
    console.log('   → distance minimale voiture/piéton :', minD.toFixed(1), 'm · renversé :', down, '· vitesse finale :', await ev(p, '(window.__c.v.speed*3.6).toFixed(0)+" km/h"'));
    await ev(p, `(()=>{const G=window.__game.game,c=window.__c;const fx=Math.sin(c.v.h),fz=Math.cos(c.v.h);G.player.pos.set(c.v.x+Math.cos(c.v.h)*2.2,0,c.v.z-Math.sin(c.v.h)*2.2)})()`); await step(p, 2); await p.keyboard.press('KeyE'); await step(p, 3); console.log('   → E à côté de la voiture arrêtée :', await p.textContent('#toast'), '· mode', await ev(p, 'window.__game.game.mode'));
    await ev(p, `(()=>{const G=window.__game.game;G.mode='foot';G.player.root.visible=true})()`); }
  // 3. marcher dans un tronc / lampadaire
  const r3 = await ev(p, `(()=>{const G=window.__game.game,P=G.props;const ch=[...window.__game.game.props['chunks'].entries()].find(([k,s])=>s.c.length>6);if(!ch)return 'aucun obstacle';const s=ch[1];const x=s.c[0],z=s.c[1],r=s.c[2];G.player.pos.set(x+3,0,z);G.camYaw=-Math.PI/2;window.__o=[x,z,r];return 'obstacle r='+r.toFixed(2)})()`);
  await p.keyboard.down('KeyW'); await step(p, 60); await p.keyboard.up('KeyW'); console.log('3. piéton vs', r3, '→ distance :', await ev(p, `(()=>{const G=window.__game.game,o=window.__o;return Math.hypot(G.player.pos.x-o[0],G.player.pos.z-o[1]).toFixed(2)+' m (minimum attendu '+(o[2]+0.4).toFixed(2)+')'})()`));
  // 4. voiture lancée contre le même obstacle
  await ev(p, `(()=>{const G=window.__game.game,o=window.__o;G.mode='car';G.player.root.visible=false;G.car.repair();G.car.pos.set(o[0]+14,0,o[1]);G.car.heading=-Math.PI/2;G.car.speed=14})()`); await step(p, 60);
  console.log('4. voiture vs obstacle →', await ev(p, `(()=>{const G=window.__game.game,o=window.__o;return 'distance '+Math.hypot(G.car.pos.x-o[0],G.car.pos.z-o[1]).toFixed(2)+' m, état '+Math.round(G.car.hp/G.car.spec.hp*100)+' %, vitesse '+(G.car.speed*3.6).toFixed(0)+' km/h'})()`));
  // 5. voiture lancée sur un piéton adulte, puis un mineur
  for (const minor of [false, true]) {
    const r5 = await ev(p, `(()=>{const G=window.__game.game;G.clock.hour=8.2;let w=null;for(const n of G.npcs.values()){if(n.minor!==${minor})continue;const s=G.sim.stateAt(n,G.clock.day,8.2,true);if(s.kind==='marche'){w=s;G.states.set(s.id,s);break}}if(!w)return null;window.__w=w.id;G.car.repair();G.car.pos.set(w.x-Math.sin(1)*12,0,w.z-Math.cos(1)*12);G.car.heading=1;G.car.speed=13;G.heat.value=0;return true})()`);
    if (!r5) { console.log('5. aucun piéton', minor ? 'mineur' : 'adulte'); continue; } await step(p, 50);
    console.log(`5. voiture vs piéton ${minor ? 'MINEUR' : 'adulte'} →`, await ev(p, `(()=>{const G=window.__game.game;return 'renversé : '+G.knocked.has(window.__w)+', recherche : '+G.heat.value.toFixed(1)+', vitesse : '+(G.car.speed*3.6).toFixed(0)+' km/h'})()`));
  }
  // 6. piéton vs habitant
  const r6 = await ev(p, `(()=>{const G=window.__game.game;G.mode='foot';G.player.root.visible=true;G.knocked.clear();let w=null;for(const n of G.npcs.values()){if(n.minor)continue;const s=G.sim.stateAt(n,G.clock.day,8.2,true);if(s.kind==='marche'){w=s;G.states.set(s.id,s);break}}G.player.pos.set(w.x+1.5,0,w.z);G.camYaw=-Math.PI/2;window.__w=w.id;return true})()`);
  await p.keyboard.down('KeyW'); await step(p, 3); await p.keyboard.up('KeyW'); console.log('6. piéton vs habitant → écart :', await ev(p, `(()=>{const G=window.__game.game,s=G.states.get(window.__w);return Math.hypot(G.player.pos.x-s.x,G.player.pos.z-s.z).toFixed(2)+' m (minimum 0,72)'})()`));
  await b.close();
})();
