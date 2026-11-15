// Scénario vague 1 : bagarre, assommer, témoins et appels, signalement, changer de tenue, se cacher. Usage : node tools/wave1.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=8.2&freeze&s=3&r=200&fresh&npc=3000'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  // trouve une rue avec plusieurs piétons adultes et place le joueur derrière l'un d'eux
  const setup = `(()=>{const G=window.__game.game;G.clock.hour=8.2;G.clock.scale=0;const W=[];for(const n of G.npcs.values()){if(n.minor)continue;const s=G.sim.stateAt(n,G.clock.day,8.2,true);if(s.kind==='marche')W.push(s)}let best=null,bc=-1;for(const s of W){let c=0;for(const t of W)if(Math.hypot(t.x-s.x,t.z-s.z)<30)c++;if(c>bc){bc=c;best=s}}for(const s of W)G.states.set(s.id,s);window.__t=best.id;return {best,bc}})()`;
  const s0 = await ev(p, setup); console.log('rue animée :', s0.bc, 'piétons à moins de 30 m');
  const behind = id => ev(p, `(()=>{const G=window.__game.game,s=G.states.get(${id});G.player.pos.set(s.x-Math.sin(s.h)*1.1,0,s.z-Math.cos(s.h)*1.1);G.player.heading=s.h;G.camYaw=s.h;return 'ok'})()`);
  const info = () => ev(p, `JSON.stringify({heat:+window.__game.game.heat.value.toFixed(1),etoiles:window.__game.game.heat.stars,temoins:window.__game.game.reports.length,signalement:window.__game.game.profile,vis:+window.__game.game.vis.toFixed(2),sante:Math.round(window.__game.game.needs.s.sante)})`);
  // 1. coup de poing de face
  await ev(p, `(()=>{const G=window.__game.game,s=G.states.get(window.__t);G.player.pos.set(s.x+Math.sin(s.h)*1.1,0,s.z+Math.cos(s.h)*1.1);G.player.heading=s.h+Math.PI;})()`);
  await p.keyboard.press('KeyF'); await step(p, 2); console.log('1. coup de poing de face →', await p.textContent('#toast'), '|', await info());
  for (let i = 0; i < 40 && await ev(p, 'window.__game.game.reports.length'); i++) { await step(p, 30); } console.log('   après l\'appel →', await info(), '|', await p.textContent('#toast'));
  // 2. assommer par derrière avec une batte (cible qui ne se méfie pas)
  await ev(p, `(()=>{const G=window.__game.game;G.giveWeapon('batte');G.heat.value=0;G.reports=[];G.profile={outfit:null,vehicle:null,face:false};const ids=[...G.states.values()].filter(s=>s.kind==='marche'&&!G.npcs.get(s.id).minor&&!G.npcCtl.get(s.id)&&s.id!==window.__t);window.__t2=ids[0].id;})()`);
  await behind(await ev(p, 'window.__t2')); await p.keyboard.press('KeyF'); await step(p, 2);
  console.log('2. batte dans le dos →', await p.textContent('#toast'), '| état :', await ev(p, `(window.__game.game.npcCtl.get(window.__t2)||{}).mode`), '|', await info());
  // 3. assommer le témoin avant qu'il n'appelle
  const w = await ev(p, `(()=>{const G=window.__game.game;G.heat.value=0;G.reports=[];const s=G.states.get(window.__t)||G.npcCtl.get(window.__t);G.player.pos.set(s.x+1,0,s.z);G.crime(16,22);return G.reports.length?G.reports[0].witness:null})()`);
  if (w !== null) { await ev(p, `(()=>{const G=window.__game.game;const before=G.heat.value;window.__h0=before;window.__n0=G.reports.length;const s=G.states.get(${w})||G.npcCtl.get(${w});G.npcCtl.ko(${w},s.x,s.z,0,60);})()`); await step(p, 30 * 16); console.log('3. témoin assommé avant son appel → recherche :', await ev(p, '(window.__h0).toFixed(1)'), '→', await ev(p, 'window.__game.game.heat.value.toFixed(1)'), '· témoins', await ev(p,'window.__n0'), '· appels abandonnés', await ev(p, 'window.__n0-window.__game.game.reports.length')); }
  else console.log('3. aucun témoin pour ce coup (personne ne voyait)');
  // 4. signalement puis changement de tenue
  await ev(p, `(()=>{const G=window.__game.game;G.heat.value=35;G.profile={outfit:G.outfitId(),vehicle:null,face:true};})()`); await step(p, 2); const v1 = await ev(p, 'window.__game.game.vis');
  await ev(p, `(()=>{const G=window.__game.game;G.newOutfit();G.player.setOutfit({...G.player.outfit,hoodUp:true});})()`); await step(p, 2); const v2 = await ev(p, 'window.__game.game.vis');
  console.log('4. reconnaissance par les patrouilles : même tenue', v1.toFixed(2), '→ nouvelle tenue + capuche', v2.toFixed(2), '(portée de détection ×', (v2 / v1).toFixed(2) + ')');
  // 5. se cacher accroupi contre un obstacle
  await ev(p, `(()=>{const G=window.__game.game;const s=[...G.props['chunks'].values()].find(s=>s.s.length>=5);if(!s)return;const x=(s.s[0]+s.s[2])/2,z=(s.s[1]+s.s[3])/2;const dx=s.s[3]-s.s[1],dz=-(s.s[2]-s.s[0]),l=Math.hypot(dx,dz);G.player.pos.set(x+dx/l*1.2,0,z+dz/l*1.2);})()`);
  await p.keyboard.press('KeyC'); await step(p, 3); console.log('5. accroupi contre une haie/un muret → caché :', await ev(p, 'window.__game.game.hidden'), '· reconnaissance', (await ev(p, 'window.__game.game.vis')).toFixed(2));
  await p.keyboard.press('KeyC'); await step(p, 2);
  // 6. un habitant qui se défend
  const f = await ev(p, `(()=>{const G=window.__game.game;const s=[...G.states.values()].find(s=>s.kind==='marche'&&!G.npcs.get(s.id).minor&&!G.npcCtl.get(s.id));G.npcCtl.hit(s.id,s.x,s.z,s.h,5,2,false);G.player.pos.set(s.x+1,0,s.z);G.needs.s.sante=100;window.__f=s.id;return G.npcCtl.get(s.id).mode})()`);
  await step(p, 30 * 4); console.log('6. habitant qui se défend (mode', f + ') → santé après 4 s :', await ev(p, 'Math.round(window.__game.game.needs.s.sante)'));
  // capture : joueur avec batte au milieu d'une bagarre
  await ev(p, `(()=>{const G=window.__game.game;G.weapon='batte';G.player.setOutfit({...G.player.outfit,hoodUp:true});const s=G.npcCtl.get(window.__f)||G.states.get(window.__f);G.player.pos.set(s.x+1.6,0,s.z+0.4);G.player.heading=Math.atan2(s.x-G.player.pos.x,s.z-G.player.pos.z);G.camYaw=G.player.heading+0.9;G.camPitch=0.18;G.player.setWeapon(0x9a6a3a,0.8);window.__game.sync()})()`);
  await p.keyboard.press('KeyF'); await step(p, 2); await p.waitForTimeout(3000); await p.screenshot({ path: out + '/vague1.png', timeout: 150000 });
  await b.close();
})();
