// Scénario vague 2 : repérage, crochetage, home-jacking, butin lourd, coffre, receleur, planque, cache, tir (jamais d'enfant), riposte. Usage : node tools/wave2.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js); const T = p => p.textContent('#toast'); const P = p => p.textContent('#prompt');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=2.5&freeze&s=3&r=200&fresh&npc=3000'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{const G=window.__game.game;G.clock.scale=0;window.G=G;})()`);
  // 1. un logement d'adultes endormis, et un logement avec des enfants
  const pick = await ev(p, `(()=>{const U=G.uw;let adult=null,kids=null;for(const [bi,l] of U.residents){const o=U.occ(bi);if(!o)continue;if(!adult&&o.adults.length&&!o.minors.length&&o.asleep&&l.some(n=>n.hasCar)&&!G.interior.index.poi(bi))adult=bi;if(!kids&&o.minors.length)kids=bi;if(adult&&kids)break}window.__A=adult;window.__K=kids;return {adult,kids}})()`);
  console.log('logements trouvés :', JSON.stringify(pick));
  const goDoor = bi => ev(p, `(()=>{const n=G.uw.residents.get(${bi})[0];G.player.pos.set(n.home.x,0,n.home.z);G.mode='foot';G.crouch=false;G.player.crouch=false;})()`);
  await goDoor(pick.kids); await step(p, 2); await ev(p, `G.uw.tools.add('crochet')`); await p.keyboard.press('KeyE'); await step(p, 3);
  console.log('1. porte d\'une maison avec enfants →', await T(p));
  // 2. repérage : accroupi à la porte
  await goDoor(pick.adult); await step(p, 2); console.log('2. depuis la rue :', await P(p));
  await p.keyboard.press('KeyC'); await step(p, 70); console.log('   après écoute :', await T(p));
  await p.keyboard.press('KeyC'); await step(p, 2);
  // 3. crochetage (sans bouger 4,5 s)
  await p.keyboard.press('KeyE'); await step(p, 60); console.log('3. crochetage à mi-course :', await P(p)); await step(p, 100);
  await p.waitForFunction('window.__game.game.interior.inside', null, { timeout: 5000 }).catch(() => {}); await step(p, 20);
  console.log('   à l\'intérieur :', await ev(p, 'G.interior.inside'), '|', await T(p), '| recherche', await ev(p, 'G.heat.value.toFixed(1)'));
  // 4. home-jacking : clés sur la table de nuit
  const occ = await ev(p, `(()=>{const c=G.interior.occ;if(!c)return null;G.player.pos.set(c.x-1.2,0,c.z+0.4);return {etat:c.state,nom:c.npc.prenom}})()`);
  if (occ) { await step(p, 2); console.log('4. habitant :', JSON.stringify(occ), '→', await P(p)); const m0 = await ev(p, 'G.money'), v0 = await ev(p, 'G.vehicles.list.filter(v=>v.mine).length'); await p.keyboard.press('KeyE'); await step(p, 2); console.log('   →', await T(p), '| argent', m0, '→', await ev(p, 'G.money'), '| véhicules à vous', v0, '→', await ev(p, 'G.vehicles.list.filter(v=>v.mine).length')); }
  await ev(p, `(()=>{const c=G.interior.occ;if(c){c.av&&(c.av.root.visible=true)}})()`);
  // capture intérieur
  await ev(p, `(()=>{const c=G.interior.occ,l=G.interior.layout;if(c){G.player.pos.set(c.x+0.4,0,c.z+1.6);G.player.heading=Math.PI;G.camYaw=Math.PI*0.85;G.camPitch=0.45;}})()`); await step(p, 3); await p.waitForTimeout(2000); await p.screenshot({ path: out + '/vague2-interieur.png' });
  // 5. emporter la télé (14 kg)
  const tv = await ev(p, `(()=>{const s=G.interior.layout.spots.find(s=>s.id==='tv');if(!s)return false;G.player.pos.set(s.x,0,s.z);return true})()`);
  if (tv) { await step(p, 2); await p.keyboard.press('KeyE'); await step(p, 2); console.log('5. télévision →', await T(p), '| vitesse ×', (await ev(p, 'G.uw.speedFactor')).toFixed(2)); }
  else console.log('5. pas de télévision dans ce logement');
  await ev(p, `G.interior.exit()`); await step(p, 30); const rep = await ev(p, 'G.reports.length'); console.log('   sortie : signalements en attente =', rep);
  // 6. coffre : monter dans sa voiture
  await ev(p, `(()=>{G.car.pos.set(G.player.pos.x+2,0,G.player.pos.z);})()`); await step(p, 2); await p.keyboard.press('KeyE'); await step(p, 2); console.log('6. voiture →', await T(p), '| coffre', await ev(p, 'JSON.stringify(G.uw.trunk)'));
  await p.keyboard.press('KeyE'); await step(p, 2);
  // 7. receleur (nuit)
  await ev(p, `(()=>{const f=G.uw.fence;G.heat.value=0;G.player.pos.set(f.x+1,0,f.z+1);G.car.pos.set(f.x+5,0,f.z+5);G.uw.bag.push('bijoux','montre');})()`); await step(p, 3);
  console.log('7. receleur :', await P(p)); const m1 = await ev(p, 'G.money'); await p.keyboard.press('KeyB'); await step(p, 2); console.log('   →', await T(p), '| argent', m1, '→', await ev(p, 'G.money'));
  await ev(p, `G.money+=600`); for (let i = 0; i < 2; i++) { await p.keyboard.press('KeyN'); await step(p, 1); } console.log('   menu :', await P(p)); await p.keyboard.press('KeyB'); await step(p, 2); console.log('   →', await T(p), '| armes', await ev(p, 'JSON.stringify([...G.weapons])'), 'balles', await ev(p, 'G.uw.ammo'));
  await ev(p, `(()=>{const f=G.uw.fence;G.clock.hour=21.3;const hb=G.uw.huts[0];G.player.pos.set(f.x+(f.x-hb.x)*0.3,0,f.z+(f.z-hb.z)*0.3);G.camYaw=Math.atan2(hb.x-f.x,hb.z-f.z)+0.35;G.player.heading=G.camYaw+Math.PI;G.camPitch=0.15;})()`); await step(p, 3); await p.waitForTimeout(2500); await p.screenshot({ path: out + '/vague2-receleur.png' });
  // 8. planque
  await ev(p, `(()=>{const d=G.uw.dens[1];G.player.pos.set(d.x+1,0,d.z+1);G.uw.bag.push('portable');})()`); await step(p, 2); console.log('8. planque :', await P(p)); await p.keyboard.press('KeyB'); await step(p, 2); console.log('   →', await T(p));
  await step(p, 2); console.log('   menu :', await P(p)); await p.keyboard.press('KeyN'); await step(p, 1); await p.keyboard.press('KeyB'); await step(p, 2); console.log('   →', await T(p), '| planque', await ev(p, 'JSON.stringify(G.uw.stash)'));
  const decay = async inside => { await ev(p, `(()=>{window.__pol=G.police;G.police=undefined;G.heat.value=40;const d=G.uw.dens[1];G.player.pos.set(d.x+(${inside}?1:60),0,d.z+(${inside}?1:60));G.clock.scale=1;})()`); await step(p, 30 * 20); return ev(p, `(()=>{G.clock.scale=0;G.police=window.__pol;return +(40-G.heat.value).toFixed(2)})()`); };
  const dOut = await decay(false), dIn = await decay(true); console.log('   recherche perdue en 20 s (gendarmerie hors jeu) : dehors', dOut, '· dans la planque', dIn);
  // 9. cache
  await ev(p, `(()=>{const c=G.uw.caches.find(c=>c.what==='trousse');window.__c=G.uw.caches.indexOf(c);G.player.pos.set(c.x+0.5,0,c.z);G.heat.value=0;})()`); await step(p, 2); console.log('9. cache :', await P(p)); await p.keyboard.press('KeyE'); await step(p, 2); console.log('   →', await T(p));
  // 10. tir : adulte en ligne de mire, puis enfant dans la ligne
  await ev(p, `(()=>{G.clock.hour=8.3;G.weapon='pistolet';G.uw.ammo=5;const ad=[],mi=[];for(const n of G.npcs.values()){const s=G.sim.stateAt(n,G.clock.day,8.3,true);if(s.kind!=='marche')continue;(n.minor?mi:ad).push(s)}for(const s of [...ad,...mi])G.states.set(s.id,s);window.__ad=ad[0];window.__mi=mi[0];})()`);
  await ev(p, `(()=>{const s=window.__ad;G.player.pos.set(s.x-8,0,s.z);G.player.heading=Math.PI/2;for(const t of G.states.values()){if(t.id!==s.id&&Math.hypot(t.x-s.x,t.z-s.z)<12)G.states.delete(t.id)};})()`);
  await step(p, 1); await p.keyboard.press('KeyF'); await step(p, 2); console.log('10. tir sur un adulte →', await T(p), '| évacué :', await ev(p, `G.uw.evacuated.has(window.__ad.id)`), '| recherche', (await ev(p, 'G.heat.value')).toFixed(1));
  await step(p, 20); await ev(p, `(()=>{const k=window.__mi,a=window.__ad;G.uw.evacuated.clear();G.npcCtl.map.clear();const t={...G.states.get(a.id)||a,x:k.x+6,z:k.z,kind:'marche'};G.states.set(a.id,t);G.states.set(k.id,k);G.player.pos.set(k.x-6,0,k.z+0.3);G.player.heading=Math.PI/2;})()`);
  const am = await ev(p, 'G.uw.ammo'); await p.keyboard.press('KeyF'); await step(p, 2); console.log('    enfant dans la ligne →', await T(p), '| balles', am, '→', await ev(p, 'G.uw.ammo'));
  // 11. école : pas de violence à proximité
  await ev(p, `(()=>{const s=G.pois.find(p=>p.sous_type==='school');G.player.pos.set(s.x+20,0,s.y);})()`); await step(p, 1); await p.keyboard.press('KeyF'); await step(p, 2); console.log('11. près d\'une école →', await T(p));
  // 12. riposte de la gendarmerie à 3 étoiles, pistolet en main
  await ev(p, `(()=>{const f=G.uw.dens[0];G.player.pos.set(f.x,0,f.z);G.needs.s.sante=100;window.__hits=[];const h=G.uw.hurt.bind(G.uw);G.uw.hurt=d=>{window.__hits.push(d);h(d)};})()`);
  for (let i = 0; i < 40; i++) { await ev(p, `(()=>{G.heat.value=55;const u=G.police.units[0];if(u&&i>=8){const P=G.player.pos;let a=0;for(;a<6.3;a+=0.3)if(!G.coll.blocked(P.x+Math.cos(a)*14,P.z+Math.sin(a)*14,P.x,P.z))break;u.v.x=P.x+Math.cos(a)*14;u.v.z=P.z+Math.sin(a)*14;u.v.speed=0;u.v.stun=1}})()`.replace('i>=8', String(i >= 8))); await step(p, 30); }
  console.log('    debug', await ev(p, `JSON.stringify({st:G.heat.stars,w:G.weapon,vis:G.vis,bl:G.coll.blocked(G.police.units[0].v.x,G.police.units[0].v.z,G.player.pos.x,G.player.pos.z),mode:G.mode,inside:G.interior.inside,down:G.downT})`));
  console.log('12. 3 étoiles, pistolet en main (40 s) → patrouilles', await ev(p, 'G.police.units.length'), '| plus proche', Math.round(await ev(p, 'G.police.nearest')), 'm | touché', await ev(p, 'window.__hits.length'), 'fois', await ev(p, 'JSON.stringify(window.__hits)'), '| santé', await ev(p, 'Math.round(G.needs.s.sante)'), '| saigne :', await ev(p, 'G.uw.bleeding'), '| arrêté :', await ev(p, 'G.heat.value===0'), '|', await T(p));
  await ev(p, `G.weapon='batte'`); const n0 = await ev(p, 'window.__hits.length'); for (let i = 0; i < 15; i++) { await ev(p, `(()=>{G.heat.value=55;const u=G.police.units[0];if(u){const P=G.player.pos;let a=0;for(;a<6.3;a+=0.3)if(!G.coll.blocked(P.x+Math.cos(a)*14,P.z+Math.sin(a)*14,P.x,P.z))break;u.v.x=P.x+Math.cos(a)*14;u.v.z=P.z+Math.sin(a)*14;u.v.speed=0;u.v.stun=1}})()`); await step(p, 30); } console.log('    batte en main (15 s) → tirs reçus', (await ev(p, 'window.__hits.length')) - n0);
  await ev(p, `G.uw.kits=1`); await p.keyboard.press('Digit3'); await step(p, 2); console.log('    soin →', await T(p));
  await b.close();
})();
