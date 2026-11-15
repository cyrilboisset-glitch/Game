// Scénario vague 3 : incendie et pompiers, braquage préparé avec complices, hold-up, enlèvement (adulte, abstrait), enquête, prison. Usage : node tools/wave3.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js); const T = p => p.textContent('#toast'); const P = p => p.textContent('#prompt'); const shot = async (p, name) => { await ev(p, 'window.__game.sync()'); await step(p, 2); await p.waitForTimeout(3500); await p.screenshot({ path: out + '/' + name }); };
const key = async (p, k, n = 2) => { await p.keyboard.press(k); await step(p, n); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=22.5&freeze&s=3&r=200&fresh&npc=3000'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{const G=window.__game.game;G.clock.scale=0;window.G=G;G.money=3000;})()`);
  // 1. voiture en feu à côté d'autres voitures garées
  const c = await ev(p, `(()=>{const L=G.vehicles.list.filter(v=>v.kind==='gare'&&!v.mine);for(const v of L){const n=L.filter(w=>w!==v&&Math.hypot(w.x-v.x,w.z-v.z)<6.5);if(n.length>=1){G.player.pos.set(v.x+2.6,0,v.z);G.car.pos.set(v.x+60,0,v.z+60);if(G.nearSchool())continue;return {id:v.id,voisines:n.length}}}return null})()`);
  await step(p, 2); console.log('1. près d\'une voiture garée :', await P(p)); await key(p, 'KeyG'); console.log('   →', await T(p), '| recherche', (await ev(p, 'G.heat.value')).toFixed(1), '| dossiers', await ev(p, 'G.enquete.open_.length'));
  await ev(p, `G.player.pos.x+=12`); for (let i = 0; i < 30; i++) await step(p, 30); console.log('   après 30 s : foyers', await ev(p, 'G.arson.sim.nodes.length'), 'actifs', await ev(p, 'G.arson.sim.active.length'));
  await ev(p, `(()=>{const n=G.arson.sim.nodes[0];G.player.pos.set(n.x+9,0,n.z+5);G.camYaw=Math.atan2(n.x-G.player.pos.x,n.z-G.player.pos.z);G.player.heading=G.camYaw;G.camPitch=0.15;})()`); await step(p, 30); await shot(p, 'vague3-feu.png');
  for (let i = 0; i < 20; i++) await step(p, 30); console.log('   +20 s :', await T(p), '| pompiers', await ev(p, '!!G.arson.crew'));
  for (let i = 0; i < 25; i++) await step(p, 30); await ev(p, `(()=>{const c=G.arson.crew;const n=G.arson.sim.active[0];if(!c||!n)return;const dx=c.tx-n.x,dz=c.tz-n.z,l=Math.hypot(dx,dz)||1;G.player.pos.set(c.tx+dx/l*6+dz/l*5,0,c.tz+dz/l*6-dx/l*5);G.camYaw=Math.atan2(n.x-G.player.pos.x,n.z-G.player.pos.z);G.player.heading=G.camYaw;G.camPitch=0.2;})()`); await step(p, 5); await shot(p, 'vague3-pompiers.png');
  for (let i = 0; i < 90 && await ev(p, 'G.arson.sim.active.length'); i++) await step(p, 30); console.log('   extinction : actifs', await ev(p, 'G.arson.sim.active.length'), '| brûlés', await ev(p, 'G.arson.sim.nodes.filter(n=>n.burnt).length'), '/', await ev(p, 'G.arson.sim.nodes.length'));
  // 2. bâtiment : refus s'il y a des enfants, sinon évacuation
  const bk = await ev(p, `(()=>{const U=G.uw;let k=null,a=null;for(const [bi,l] of U.residents){const o=U.occ(bi);if(!o)continue;if(!k&&o.minors.length)k=l[0].home;if(!a&&o.adults.length&&!o.minors.length)a=l[0].home;if(k&&a)break}return {k,a}})()`);
  await ev(p, `(()=>{G.arson.essence=2;G.heat.value=0;G.player.pos.set(${bk.k.x},0,${bk.k.z});})()`); await step(p, 2); await key(p, 'KeyG'); console.log('2. maison avec enfants →', await T(p));
  await ev(p, `G.player.pos.set(${bk.a.x},0,${bk.a.z})`); await step(p, 2); await key(p, 'KeyG'); console.log('   maison d\'adultes →', await T(p)); await ev(p, `G.player.pos.x+=25`); for (let i = 0; i < 25; i++) await step(p, 30);
  await ev(p, `(()=>{const n=G.arson.sim.nodes[G.arson.sim.nodes.length-1];G.player.pos.set(n.x+14,0,n.z+10);G.camYaw=Math.atan2(n.x-G.player.pos.x,n.z-G.player.pos.z);G.camPitch=0.25;})()`); await step(p, 3); await shot(p, 'vague3-batiment.png');
  console.log('   foyers bâtiment actifs', await ev(p, 'G.arson.sim.active.filter(n=>n.kind===\'batiment\').length'));
  await ev(p, `(()=>{for(const n of G.arson.sim.nodes){n.out=true}G.arson.crew&&G.arson['dismiss']();G.heat.value=0;G.police.clearAll();})()`);
  // 3. braquage préparé de l'entrepôt fictif
  await ev(p, `(()=>{const f=G.uw.fence;G.player.pos.set(f.x,0,f.z);G.uw.sel=0;})()`); await step(p, 2);
  const pick = async (re) => { for (let i = 0; i < 15; i++) { const t = await P(p); if (re.test(t)) { await key(p, 'KeyB'); return t; } await key(p, 'KeyN', 1); } return null; };
  console.log('3. receleur :', await pick(/Tuyau : Entrepôt/), '→', await T(p)); console.log('  ', await pick(/Recruter Le Taiseux/), '→', await T(p)); console.log('  ', await pick(/Recruter La Fouine/)); console.log('  ', await pick(/Cagoule/)); console.log('  ', await pick(/Gants/));
  await ev(p, `(()=>{const t=G.heists.plan.target;G.player.pos.set(t.x+1,0,t.z+1);G.giveWeapon('barre');G.weapon='barre';G.car.pos.set(t.x+8,0,t.z+8);G.car.hp=G.car.spec.hp;})()`); await step(p, 30 * 7); console.log('   repérage →', await T(p));
  await key(p, 'KeyV'); console.log('   sur place :', await P(p)); await key(p, 'KeyE'); console.log('   →', await T(p));
  await step(p, 30 * 6); console.log('   pendant :', await P(p)); for (let i = 0; i < 12 && await ev(p, '!!G.heists.plan'); i++) await step(p, 30);
  console.log('   fin →', await T(p), '| sac', await ev(p, 'JSON.stringify(G.uw.bag)'), '| étoiles', await ev(p, 'G.heat.stars'), '|', await ev(p, 'G.dossierText()'));
  await ev(p, `(()=>{G.heat.value=0;G.police.clearAll();const d=G.uw.dens[0];G.uw.owned.add(0);G.player.pos.set(d.x,0,d.z);G.uw.sel=0;})()`); await step(p, 2); const m0 = await ev(p, 'G.money');
  console.log('   planque :', await pick(/Compter le magot/), '→', await T(p), '| argent', m0, '→', await ev(p, 'G.money'));
  // 4. hold-up d'un commerce ouvert (jour)
  await ev(p, `(()=>{G.clock.hour=11;G.heat.value=0;const e=G.pois.filter(q=>q.sous_type==='supermarket').map(q=>G.interior.index.entryOfPoi(q)).find(Boolean);G.player.pos.set(e.px+e.nx*1.2,0,e.pz+e.nz*1.2);G.weapon='barre';})()`); await step(p, 2); await key(p, 'KeyE'); await step(p, 30);
  await ev(p, `(()=>{const s=G.interior.layout.spots.find(s=>s.kind==='acheter');G.player.pos.set(s.x,0,s.z);})()`); await step(p, 2); console.log('4. caisse :', await P(p)); const m1 = await ev(p, 'G.money'); await key(p, 'KeyF'); console.log('   →', await T(p), '| argent', m1, '→', await ev(p, 'G.money'), '| étoiles', await ev(p, 'G.heat.stars'));
  await ev(p, `G.interior.exit()`); await step(p, 30); await ev(p, `(()=>{G.heat.value=0;G.police.clearAll();})()`);
  // 5. enlèvement (adulte seul, la nuit) — abstrait
  await ev(p, `(()=>{G.clock.hour=17.6;G.reports=[];const W=[];for(const n of G.npcs.values()){const s=G.sim.stateAt(n,G.clock.day,17.6,true);if(s.kind==='marche')W.push([n,s])}for(const [n,s] of W)G.states.set(s.id,s);const lone=W.find(([n])=>!n.minor);for(const t of [...G.states.values()])if(t.id!==lone[1].id&&Math.hypot(t.x-lone[1].x,t.z-lone[1].z)<30)G.states.delete(t.id);const kid=W.find(([n])=>n.minor);window.__k=kid&&kid[1];const s=lone[1];G.player.pos.set(s.x+1.2,0,s.z);G.car.pos.set(s.x+7,0,s.z+3);G.car.hp=G.car.spec.hp;G.weapon='barre';})()`); await step(p, 2);
  console.log('5. passant seul :', await P(p)); await key(p, 'KeyE'); console.log('   →', await T(p), '| mode', await ev(p, 'G.mode'));
  await ev(p, `(()=>{const d=G.uw.dens[0];G.car.pos.set(d.x+2,0,d.z+2);})()`); await step(p, 3); console.log('   à la planque :', await P(p)); await key(p, 'KeyB'); console.log('   →', await T(p));
  await ev(p, `G.clock.hour+=2.1`); await step(p, 3); console.log('   2 h plus tard →', await T(p)); await ev(p, `(()=>{const d=G.kid.k.drop;G.mode='foot';G.player.root.visible=true;G.player.pos.set(d.x+1,0,d.z);})()`); await step(p, 2); console.log('   remise :', await P(p)); await key(p, 'KeyE'); console.log('   →', await T(p));
  await ev(p, `(()=>{const d=G.uw.dens[0];G.player.pos.set(d.x,0,d.z);G.uw.sel=0;G.heat.value=0;G.police.clearAll();})()`); await step(p, 2); console.log('   planque :', await pick(/Relâcher/), '→', await T(p));
  await ev(p, `(()=>{if(window.__k)return;for(const n of G.npcs.values())if(n.minor){const s=G.sim.stateAt(n,G.clock.day,G.clock.hour,true);window.__k={...s,kind:'marche'};break}})()`);
  if (await ev(p, '!!window.__k')) { await ev(p, `(()=>{const s=window.__k;G.states.set(s.id,s);for(const t of G.states.values())if(t.id!==s.id&&Math.hypot(t.x-s.x,t.z-s.z)<30)G.states.delete(t.id);G.player.pos.set(s.x+1.2,0,s.z);G.car.pos.set(s.x+7,0,s.z+3);})()`); await step(p, 2); console.log('   devant un enfant :', await P(p), '| enlèvement possible :', await ev(p, '!!G.kid.candidate()')); }
  // 6. enquête puis prison
  console.log('6. dossiers :', await ev(p, 'G.dossierText()'));
  await ev(p, `(()=>{const d=G.enquete.dossiers.find(q=>q.kind==='enlevement');d.preuves=40;d.vehicule='vieille berline beige';})()`);
  const r = await ev(p, `(()=>{const r=G.enquete.tick(72,G.clock.day+3,G.clock.hour);return JSON.stringify({mandat:r.mandat.map(d=>d.titre),classes:r.classes.map(d=>d.titre)})})()`); console.log('   72 h d\'enquête (piste du véhicule toujours en circulation) :', r, '| peine encourue', await ev(p, 'G.enquete.sentence(0)'), 'jours');
  const d0 = await ev(p, 'G.clock.day'); await ev(p, `G.arrest()`); await step(p, 2); console.log('   arrestation →', await T(p), '| jour', d0, '→', await ev(p, 'G.clock.day'), '| armes', await ev(p, 'JSON.stringify([...G.weapons])'));
  await b.close();
})();
