// Scénario vague 4 : population réelle, appartements, poses d'action en jeu (accroupi, frapper, viser, porter, crocheter), mains en l'air, témoin au téléphone, foule variée. Usage : node tools/wave4.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js); const T = p => p.textContent('#toast'); const P = p => p.textContent('#prompt');
const shot = async (p, name) => { await ev(p, 'window.__game.sync()'); await step(p, 2); await p.waitForTimeout(3000); await p.screenshot({ path: out + '/' + name }); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=12.3&freeze&s=3&r=220&fresh'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{window.G=window.__game.game;G.clock.scale=0;})()`);
  console.log('1. population :', await ev(p, `(()=>{const N=[...G.npcs.values()];const H=G.uw['households'];return JSON.stringify({habitants:N.length,mineurs:N.filter(n=>n.minor).length,plus_de_65:N.filter(n=>n.age>=65).length,foyers:new Set(N.map(n=>n.home.bi+'/'+n.home.apt)).size,immeubles:[...H.values()].filter(h=>h.length>1).length,barbus:N.filter(n=>n.look.beard).length,lunettes:N.filter(n=>n.look.glasses).length,forte_corpulence:N.filter(n=>n.look.width>=1.08).length})})()`));
  // 2. porte d'immeuble : choix de l'appartement
  await ev(p, `(()=>{const H=G.uw['households'];let best=null;for(const [bi,h] of H)if(h.length>=4&&!G.interior.index.poi(bi)){best=h[0][0].home;break}G.player.pos.set(best.x,0,best.z);})()`); await step(p, 2);
  console.log('2. porte d\'immeuble :', await P(p)); await p.keyboard.press('KeyN'); await step(p, 2); console.log('   N →', await P(p));
  // 3. poses du joueur
  const pose = async (label, js, name) => { await ev(p, js); await step(p, 12); const w = await ev(p, `JSON.stringify([...G.player['av'].poseW].map(([k,v])=>k+':'+v.toFixed(2)))`); console.log(`3. ${label} → poses actives`, w); if (name) await shot(p, name); };
  await ev(p, `(()=>{const s=G.pois.find(q=>q.sous_type==='bakery');G.player.pos.set(s.x+6,0,s.y+6);G.coll.resolve(G.player.pos,0.6);G.camYaw=G.player.heading+2.4;G.camPitch=0.12;})()`);
  await pose('accroupi', `(()=>{G.crouch=true;G.player.crouch=true;})()`, 'vague4-accroupi.png');
  await pose('crochetage', `(()=>{G.crouch=false;G.player.crouch=false;G.uw.pick={e:{bi:0,px:0,pz:0,nx:0,nz:1,dist:0},t:0,x:G.player.pos.x,z:G.player.pos.z};})()`, 'vague4-crochetage.png');
  await ev(p, `G.uw.pick=null`); await pose('sac lourd (porter)', `(()=>{G.uw.bag=['tele','bijoux'];})()`, 'vague4-porter.png');
  await ev(p, `G.uw.bag=[]`); await step(p, 10);
  await ev(p, `(()=>{G.giveWeapon('batte');G.weapon='batte';G['applyWeapon']();G.player.punch();})()`); await step(p, 4); console.log('3. coup de batte (armer) →', await ev(p, `JSON.stringify([...G.player['av'].poseW].filter(([k,v])=>v>0.05).map(([k,v])=>k+':'+v.toFixed(2)))`)); await step(p, 4); console.log('   (frapper) →', await ev(p, `JSON.stringify([...G.player['av'].poseW].filter(([k,v])=>v>0.05).map(([k,v])=>k+':'+v.toFixed(2)))`));
  // 4. pistolet braqué : les passants lèvent les mains ; témoin au téléphone
  await ev(p, `(()=>{G.clock.hour=8.3;const W=[];for(const n of G.npcs.values()){if(n.minor)continue;const s=G.sim.stateAt(n,G.clock.day,8.3,true);if(s.kind==='marche')W.push(s)}for(const s of W)G.states.set(s.id,s);const s=W[3];window.__s=s;G.giveWeapon('pistolet');G.weapon='pistolet';G['applyWeapon']();G.uw.ammo=3;G.player.pos.set(s.x-Math.sin(s.h)*-4,0,s.z-Math.cos(s.h)*-4);G.player.heading=Math.atan2(s.x-G.player.pos.x,s.z-G.player.pos.z);G.camYaw=G.player.heading+0.5;G.camPitch=0.1;G.player.aim(5);})()`);
  await step(p, 3); console.log('4. pistolet braqué →', await ev(p, `JSON.stringify([...G.npcCtl.map.values()].map(c=>c.mode))`)); await ev(p, `G.player.aim(5)`); await shot(p, 'vague4-mains-en-l-air.png');
  await ev(p, `(()=>{G.npcCtl.map.clear();const s=window.__s;G.reports.push({witness:s.id,due:G['t']+60,v:5,desc:{outfit:null,vehicle:null,face:false}});G.weapon='poings';G['applyWeapon']();G.player.pos.set(s.x+3,0,s.z+2);G.camYaw=Math.atan2(s.x-G.player.pos.x,s.z-G.player.pos.z);G.camPitch=0.05;})()`); await step(p, 3);
  console.log('   témoin : pose', await ev(p, `JSON.stringify(G.overrides().get(window.__s.id))`)); await shot(p, 'vague4-temoin.png');
  // 5. foule variée en centre-ville
  await ev(p, `(()=>{G.reports=[];G.clock.hour=17.4;const W=[];for(const n of G.npcs.values()){const s=G.sim.stateAt(n,G.clock.day,17.4,true);if(s.kind==='marche'||s.kind==='dehors')W.push(s)}for(const s of W)G.states.set(s.id,s);let best=null,bc=0;for(const s of W){let c=0;for(const t of W)if(Math.hypot(t.x-s.x,t.z-s.z)<20)c++;if(c>bc){bc=c;best=s}}G.player.pos.set(best.x+6,0,best.z+6);G.camYaw=Math.atan2(best.x-G.player.pos.x,best.z-G.player.pos.z);G.camPitch=0.08;window.__bc=bc;})()`);
  console.log('5. foule :', await ev(p, 'window.__bc'), 'personnes à moins de 20 m'); await shot(p, 'vague4-foule.png');
  await b.close();
})();
