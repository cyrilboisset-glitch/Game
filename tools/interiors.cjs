// Scénario intérieurs : entre dans plusieurs types de lieux, interagit, capture. Usage : node tools/interiors.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
const step = (p, n) => p.evaluate(`(()=>{const G=window.__game.game;for(let i=0;i<${n};i++)G.update(1/30);})()`);
const info = p => p.evaluate('(()=>{const G=window.__game.game;return JSON.stringify({inside:G.interior.inside,kind:G.interior.layout&&G.interior.layout.kind,forced:G.interior.forced,money:G.money,inv:G.inv,heat:Math.round(G.heat.value),faim:Math.round(G.needs.s.faim),soif:Math.round(G.needs.s.soif),prompt:document.getElementById("prompt").textContent,toast:document.getElementById("toast").textContent})})()');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5199/?t=10&freeze&s=3&r=120'); await p.waitForFunction('window.__ready', null, { timeout: 120000 }); await p.waitForTimeout(1500);
  const goto = (pred, hour) => p.evaluate(`(()=>{const G=window.__game.game;let poi=null,e=null;for(const c of G.pois.filter(${pred})){const k=G.interior.index.entryOfPoi(c);if(k){poi=c;e=k;break}}if(!poi)return 'POI sans bâtiment';G.clock.hour=${hour};G.clock.day=3;G.clock.scale=0;G.player.pos.set(e.px+e.nx*1.2,0,e.pz+e.nz*1.2);G.player.heading=0;return poi.nom;})()`);
  const enter = async () => { await step(p, 3); await p.keyboard.press('KeyE'); await step(p, 40); };
  const shot = async n => { await p.evaluate('window.__game.sync()'); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/int_${n}.png`, timeout: 120000 }); };
  const cases = [['supermarché', "x=>x.sous_type==='supermarket'", 10], ['boulangerie', "x=>x.sous_type==='bakery'", 10], ['restaurant', "x=>x.sous_type==='restaurant'", 12.5], ['banque fermée', "x=>x.sous_type==='bank'", 2], ['école fermée (nuit)', "x=>x.sous_type==='school'", 2]];
  for (const [n, pred, h] of cases) {
    console.log('—', n, await goto(pred, h)); console.log('  prompt dehors:', (await p.evaluate('document.getElementById("prompt").textContent'))); await enter(); console.log('  ', await info(p));
    if (await p.evaluate('window.__game.game.interior.inside')) { await shot(n.split(' ')[0]); await p.evaluate(`(()=>{const G=window.__game.game;const l=G.interior.layout;G.interior.exit();})()`); await step(p, 40); }
  }
  // logement : entrer (forcer), fouiller, dormir, toilettes, robinet
  const r = await p.evaluate(`(()=>{const G=window.__game.game;const I=G.interior;for(let i=0;i<G.world.builds.length;i++){const b=G.world.builds[i];if(I.index.poi(i))continue;const d=I.index.dims(i);if(d.area<60||d.area>300)continue;const e=I.index.find(b.p[0][0],b.p[0][1],3);if(!e||e.bi!==i)continue;G.clock.hour=23;G.clock.day=3;G.player.pos.set(e.px+e.nx*1.2,0,e.pz+e.nz*1.2);return 'bâtiment '+i;}return 'aucun'})()`);
  console.log('— logement', r); await enter(); console.log('  ', await info(p));
  const kinds = await p.evaluate('window.__game.game.interior.layout.kind'); console.log('  type', kinds);
  for (const kind of ['robinet', 'toilettes', 'fouiller', 'dormir']) {
    const ok = await p.evaluate(`(()=>{const G=window.__game.game,I=G.interior;const s=I.layout.spots.find(x=>x.kind==='${kind}');if(!s)return false;G.player.pos.set(s.x,0,s.z);return true})()`);
    if (!ok) { console.log('  (pas de', kind, 'ici)'); continue; } await step(p, 3); console.log('  prompt:', await p.textContent('#prompt')); await p.keyboard.press('KeyE'); await step(p, 3); console.log('   →', await info(p));
    if (kind === 'dormir') { await p.keyboard.press('KeyR'); await step(p, 3); }
  }
  await shot('logement'); await p.evaluate('window.__game.game.sleeping=false');
  await p.evaluate(`(()=>{const G=window.__game.game;const l=G.interior.layout;G.player.pos.set(l.door.x,0,l.door.z-0.6)})()`); await step(p, 3); await p.keyboard.press('KeyE'); await step(p, 40); console.log('— sortie', await info(p));
  await b.close();
})();
