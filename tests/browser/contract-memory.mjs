// Ejecuta la suite de contrato (tests/contract/storageContract.js) DENTRO de Chromium contra MemoryBackend,
// usando el mini-assert sin Node. Demuestra que la suite es importable desde el navegador (STO-004);
// los backends del navegador (STO-006/007) la reutilizarán igual.
// Uso: NODE_PATH=$(npm root -g) node tests/browser/contract-memory.mjs
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const html = '<!doctype html><meta charset="utf-8"><title>contrato</title>';
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  const f = join(root, url);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end('no encontrado'); }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0);

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
await page.goto(`http://localhost:${server.address().port}/`);
const results = await page.evaluate(async () => {
  const { runStorageContractCases } = await import('/tests/contract/storageContract.js');
  const { assert } = await import('/tests/contract/browserAssert.js');
  const { MemoryBackend } = await import('/src/storage/MemoryBackend.js');
  const res = await runStorageContractCases(() => new MemoryBackend(), assert);
  return res.map((r) => ({ name: r.name, ok: r.ok, error: r.ok ? undefined : String(r.error?.stack || r.error) }));
});
await browser.close(); server.close();
const bad = results.filter((r) => !r.ok);
console.log(JSON.stringify({ casos: results.length, fallos: bad, problems }, null, 1));
const ok = results.length >= 10 && bad.length === 0 && problems.length === 0;
console.log(ok ? 'OK' : 'FALLA');
process.exit(ok ? 0 : 1);
