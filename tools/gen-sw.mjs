// Après `vite build` : écrit dist/sw.js, un service worker qui met en cache TOUS les fichiers du jeu → jouable hors ligne après la première ouverture.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const dist = new URL('../dist/', import.meta.url).pathname; const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== 'sw.js') files.push(relative(dist, p).split('\\').join('/')); } };
walk(dist); files.sort();
const version = createHash('sha1').update(files.map(f => f + statSync(join(dist, f)).size).join('|')).digest('hex').slice(0, 10);
const list = ['./', ...files.map(f => './' + f)];
writeFileSync(join(dist, 'sw.js'), `// Généré par tools/gen-sw.mjs — ne pas modifier.
const CACHE = 'pontcharra-${version}';
const FILES = ${JSON.stringify(list)};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
`);
const total = files.reduce((s, f) => s + statSync(join(dist, f)).size, 0);
console.log(`sw.js : ${files.length} fichiers mis en cache (${(total / 1048576).toFixed(1)} Mo), version ${version}`);
