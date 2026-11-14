// Prueba de humo en Chromium SIN Vite: sirve index.html + src/ + public/ como estático y
// comprueba que carga sin errores de consola. NO valida el empaquetado de Vite (eso es CI).
// Uso: NODE_PATH=$(npm root -g) node tests/browser/static-smoke.mjs
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { copyVendor } from '../../tools/copy-vendor.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const pub = mkdtempSync(join(tmpdir(), 'nebulon-pub-'));
copyVendor(pub, root);
const types = { '.html': 'text/html', '.js': 'text/javascript' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const candidates = url === '/' ? [join(root, 'index.html')] : [join(root, url), join(pub, url)];
  const f = candidates.find((c) => existsSync(c) && !c.endsWith('/'));
  if (!f) { res.writeHead(404); return res.end('no encontrado: ' + url); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0);

const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__nebulon && window.__nebulon.status === 'loaded', null, { timeout: 5000 });
const state = await page.evaluate(() => ({ n: window.__nebulon, text: document.getElementById('status').textContent, v: window.Phaser && Phaser.VERSION }));
await browser.close(); server.close();
console.log(JSON.stringify({ state, problems }));
const ok = problems.length === 0 && state.n.phaserLoaded && state.v === '4.2.1';
console.log(ok ? 'OK' : 'FALLA');
process.exit(ok ? 0 : 1);
