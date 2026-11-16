// Captures des commandes tactiles (portrait 412×915 et paysage 915×412) dans plusieurs situations. Usage : node tools/touch.cjs <dossier>
const { chromium } = require('playwright'); const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  for (const [w, h, tag] of [[412, 915, 'portrait'], [915, 412, 'paysage']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto('http://127.0.0.1:5199/?t=14&freeze&s=3&fresh&touch&r=160'); await p.waitForFunction('window.__ready', null, { timeout: 150000 });
    const ev = js => p.evaluate(js); const frames = () => p.waitForTimeout(1200);
    const btns = () => ev(`JSON.stringify({A:document.querySelector('#bA').textContent+(document.querySelector('#bA').classList.contains('off')?' (grisé)':''),B:getComputedStyle(document.querySelector('#bB')).display==='none'?null:document.querySelector('#bB').textContent,C:document.querySelector('#bC').textContent,D:document.querySelector('#bD').textContent,chips:[...document.querySelectorAll('#chips .chip')].map(c=>c.textContent)})`);
    await ev(`(()=>{const G=window.__game.game;G.clock.scale=0;const v=G.vehicles.list.find(v=>v.kind==='gare'&&!v.mine);G.player.pos.set(v.x+2.6,0,v.z);G.camYaw=Math.atan2(v.x-G.player.pos.x,v.z-G.player.pos.z);window.__game.sync();})()`); await frames();
    console.log(tag, 'près d\'une voiture garée :', await btns()); await p.screenshot({ path: `${out}/tactile-${tag}-voiture.png` });
    await ev(`(()=>{const G=window.__game.game;G.mode='car';G.player.root.visible=false;G.clock.hour=22;G.night=true;})()`); await frames(); console.log(tag, 'en voiture la nuit :', await btns());
    await ev(`(()=>{const G=window.__game.game;G.mode='foot';G.player.root.visible=true;G.clock.hour=14;G.needs.s.faim=20;G.uw.kits=1;G.uw.bleeding=true;G.giveWeapon('pistolet');G.uw.ammo=5;G.heat.value=30;const f=G.uw.fence;G.clock.hour=22;G.player.pos.set(f.x,0,f.z);window.__game.sync();})()`); await frames();
    console.log(tag, 'chez le receleur, blessé, affamé, recherché, pistolet :', await btns()); await p.screenshot({ path: `${out}/tactile-${tag}-receleur.png` });
    await p.tap('#bM'); await frames(); await p.screenshot({ path: `${out}/tactile-${tag}-menu.png` }); console.log(tag, 'menu ☰ ouvert :', await ev(`getComputedStyle(document.querySelector('#tpanel')).display`));
    await p.tap('#tpanel [data-a="eat"]'); await frames(); console.log(tag, 'après « Manger » dans le menu : faim', await ev('Math.round(window.__game.game.needs.s.faim)'), '| menu', await ev(`getComputedStyle(document.querySelector('#tpanel')).display`));
    await p.close();
  }
  await b.close();
})();
