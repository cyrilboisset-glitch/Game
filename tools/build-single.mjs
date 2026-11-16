// Fabrique un fichier HTML unique et autonome (jeu complet, données, personnages, animations) à partir de dist/ :
// s'ouvre directement dans Chrome (double-clic, pièce jointe, clé USB), sans serveur ni connexion. Usage : npm run build && node tools/build-single.mjs [sortie.html]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const out = process.argv[2] || 'release/Pontcharra.html';
let html = readFileSync('dist/index.html', 'utf8');
const js = readdirSync('dist/assets').find(f => f.endsWith('.js'));
const files = { 'data/pontcharra.json': 'application/json', 'data/poi.json': 'application/json', 'data/adresses.json': 'application/json', 'assets/citizen.glb': 'model/gltf-binary', 'assets/ual.glb': 'model/gltf-binary' };
const emb = Object.entries(files).map(([p, t]) => `${JSON.stringify(p)}:"data:${t};base64,${readFileSync('dist/' + p).toString('base64')}"`).join(',');
// les requêtes du jeu vers ses propres fichiers sont servies depuis le contenu embarqué
const shim = `<script>window.__EMB={${emb}};(function(){var f=window.fetch.bind(window);window.fetch=function(u,o){var s=String(u&&u.url||u);for(var k in window.__EMB){if(s.indexOf(k)>=0&&s.slice(s.indexOf(k))===k)return f(window.__EMB[k]);}return f(u,o);};})();</script>`;
const code = readFileSync('dist/assets/' + js, 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '').replace(/<link rel="(apple-touch-)?icon"[^>]*>\s*/g, '')
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => `${shim}<script type="module">${code}</script>`);
writeFileSync(out, html); console.log(`${out} : ${(html.length / 1e6).toFixed(1)} Mo`);
