// Scénario animations en jeu : combo poing-poing-pied, accroupi, saut de clôture, banc, portière, chute/relevé d'un habitant. Usage : node tools/anims-game.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const ev = (p, js) => p.evaluate(js); const cur = p => ev(p, `G.player['av'].current`);
const shot = async (p, name) => { await ev(p, 'window.__game.sync()'); await p.waitForTimeout(2500); await p.screenshot({ path: out + '/' + name }); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  const t0 = Date.now(); await p.goto('http://127.0.0.1:5199/?t=11&freeze&s=3&fresh&r=160'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
  await ev(p, `(()=>{window.G=window.__game.game;G.clock.scale=0;})()`); console.log('chargement', ((Date.now() - t0) / 1000).toFixed(1), 's · recalage des animations', Math.round(await ev(p, 'window.__game.player["factory"].retargetMs')), 'ms');
  // 1. combo
  const seq = []; for (let i = 0; i < 3; i++) { await p.keyboard.press('KeyF'); await step(p, 3); seq.push(await cur(p) + (await ev(p, `G.player['kickT']>0`) ? '+coup de pied' : '')); await step(p, 14); } console.log('1. combo F F F :', seq.join(' → '));
  await ev(p, `(()=>{G.giveWeapon('batte');G.weapon='batte';G['applyWeapon']();})()`); await step(p, 20); await p.keyboard.press('KeyF'); await step(p, 3); console.log('   avec la batte :', await cur(p)); await step(p, 30);
  await ev(p, `(()=>{G.giveWeapon('pistolet');G.weapon='pistolet';G['applyWeapon']();G.uw.ammo=3;})()`); await step(p, 10); console.log('   pistolet en main au repos :', await cur(p)); await p.keyboard.press('KeyF'); await step(p, 2); console.log('   tir :', await cur(p)); await step(p, 30);
  await ev(p, `(()=>{G.weapon='poings';G['applyWeapon']();})()`);
  // 2. accroupi
  await p.keyboard.press('KeyC'); await step(p, 10); const ci = await cur(p); await p.keyboard.down('KeyW'); await step(p, 15); console.log('2. accroupi :', ci, '→ en avançant', await cur(p)); await p.keyboard.up('KeyW'); await p.keyboard.press('KeyC'); await step(p, 5);
  // 3. clôture
  const fz = await ev(p, `(()=>{const ch=[...G.props['chunks'].values()];for(const s of ch){if(!s.f)continue;for(let i=0;i<s.f.length;i+=5){const ax=s.f[i],az=s.f[i+1],bx=s.f[i+2],bz=s.f[i+3];const mx=(ax+bx)/2,mz=(az+bz)/2,l=Math.hypot(bx-ax,bz-az);const nx=-(bz-az)/l,nz=(bx-ax)/l;for(const sg of [1,-1]){const x=mx+nx*sg*0.9,z=mz+nz*sg*0.9;const o={x:mx-nx*sg*1.2,z:mz-nz*sg*1.2};if(G.coll.resolve({x,z},0.4).depth>0||G.coll.resolve(o,0.45).depth>0)continue;G.player.pos.set(x,0,z);G.player.heading=Math.atan2(-nx*sg,-nz*sg);G.camYaw=G.player.heading+0.9;G.camPitch=0.15;return {h:s.f[i+4],x,z}}}}return null})()`);
  await step(p, 3); console.log('3. devant une clôture :', await p.textContent('#prompt')); await p.keyboard.press('Space'); await step(p, 8); const mid = await cur(p); const y = await ev(p, 'G.player.root.position.y.toFixed(2)'); await shot(p, 'anim-saut.png'); await step(p, 25);
  console.log('   saut :', mid, '(hauteur', y, 'm) → passé de l\'autre côté :', (await ev(p, `Math.hypot(G.player.pos.x-${fz.x},G.player.pos.z-${fz.z})`)).toFixed(1), 'm');
  // 4. banc
  const bn = await ev(p, `(()=>{for(const s of G.props['chunks'].values()){if(s.b&&s.b.length){const x=s.b[0]+s.b[2]*1.0,z=s.b[1]+s.b[3]*1.0;G.player.pos.set(x,0,z);G.camYaw=Math.atan2(-s.b[2],-s.b[3])+0.6;G.camPitch=0.12;return true}}return false})()`);
  if (bn) { await step(p, 3); console.log('4. près d\'un banc :', await p.textContent('#prompt')); await p.keyboard.press('KeyE'); await step(p, 40); console.log('   assis :', await cur(p), '| prompt', await p.textContent('#prompt')); await shot(p, 'anim-banc.png'); await p.keyboard.press('KeyE'); await step(p, 5); console.log('   se lève :', await cur(p)); await step(p, 40); }
  // 5. monter en voiture
  await ev(p, `(()=>{G.car.pos.set(G.player.pos.x+3,0,G.player.pos.z);G.car.heading=0;G.car.speed=0;})()`); await step(p, 2); await p.keyboard.press('KeyE'); await step(p, 6); console.log('5. monter en voiture :', await cur(p), '| portière ouverte :', await ev(p, `G.car['doorCur'].toFixed(2)`)); await ev(p, `G.carOff=Math.PI*0.6;G.camYaw=G.player.heading+1.2`); await shot(p, 'anim-portiere.png'); await step(p, 20);
  console.log('   au volant :', await ev(p, 'G.mode'), await cur(p)); await p.keyboard.press('KeyE'); await step(p, 4); console.log('   descendre :', await ev(p, 'G.mode'), await cur(p)); await step(p, 30);
  // 6. habitant renversé : chute puis relevé (animations enregistrées)
  await ev(p, `(()=>{G.clock.hour=8.3;const W=[];for(const n of G.npcs.values()){if(n.minor)continue;const s=G.sim.stateAt(n,G.clock.day,8.3,true);if(s.kind==='marche')W.push(s)}const s=W[2];G.states.set(s.id,s);window.__s=s;G.player.pos.set(s.x+4,0,s.z+1);G.camYaw=Math.atan2(s.x-G.player.pos.x,s.z-G.player.pos.z);G.knock(s.id,1,0,0);})()`);
  await p.waitForTimeout(1500); const a1 = await ev(p, `(()=>{const a=window.__game.npcRender['avatars'].get(window.__s.id);return a?a.av.current+'/'+a.st:'(silhouette)'})()`); await shot(p, 'anim-chute.png');
  await ev(p, `(()=>{const c=G.npcCtl.get(window.__s.id);c.until=G.npcCtl.t;})()`); await step(p, 2); await p.waitForTimeout(800); const a2 = await ev(p, `(()=>{const a=window.__game.npcRender['avatars'].get(window.__s.id);return a?a.av.current+'/'+a.st:'(silhouette)'})()`);
  console.log('6. habitant renversé :', a1, '→ relevé :', a2);
  await b.close();
})();
