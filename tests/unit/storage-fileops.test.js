// FileOperations (STO-005): borrado/copia recursivos y escritura atómica sobre cualquier backend,
// con inyección de fallos (un fallo puntual y un «cuelgue» a partir de la llamada k).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryBackend } from '../../src/storage/MemoryBackend.js';
import { StorageBackend, BACKEND_METHODS } from '../../src/storage/StorageBackend.js';
import { IoError, NotFoundError, AlreadyExistsError, InvalidPathError } from '../../src/storage/errors.js';
import { deleteTree, copyTree, writeFileAtomic, recoverAtomicWrites } from '../../src/storage/FileOperations.js';

const rej = (p, C) => assert.rejects(p, (e) => e instanceof C, `esperaba ${C.name}`);

/** Envoltorio con fallos: cuenta llamadas (excepto initialize) y puede fallar una vez o «colgarse» desde la k-ésima. */
class FaultyBackend extends StorageBackend {
  inner = new MemoryBackend();
  calls = 0; failAt = 0; crashAt = 0; crashed = false; noRecursive = false;
  get kind() { return 'faulty'; }
  heal() { this.crashed = false; this.crashAt = 0; this.failAt = 0; }
}
for (const m of BACKEND_METHODS) {
  FaultyBackend.prototype[m] = async function (...args) {
    if (m !== 'initialize') {
      this.calls += 1;
      if (this.crashAt && this.calls >= this.crashAt) this.crashed = true;
      if (this.crashed || this.calls === this.failAt) throw new IoError(`fallo inyectado en ${m} (#${this.calls})`);
      if (m === 'delete' && this.noRecursive && args[1]?.recursive) throw new IoError('sin delete recursivo');
    }
    return this.inner[m](...args);
  };
}

const read = (b, p) => b.inner.readFile(p).catch(() => null);
const nebulonLeftovers = async (b, dir = '') => (await b.inner.listDirectory(dir)).map((e) => e.name).filter((n) => n.includes('.nebulon-'));

// ---------- deleteTree ----------
test('deleteTree: fichero, árbol, no existe, missingOk, raíz', async () => {
  const b = new MemoryBackend();
  await b.writeFile('d/a.txt', '1'); await b.writeFile('d/s/t/b.txt', '2'); await b.createDirectory('d/vacia');
  await deleteTree(b, 'd/a.txt');
  assert.equal(await b.exists('d/a.txt'), false);
  await deleteTree(b, 'd');
  assert.equal(await b.exists('d'), false);
  await rej(deleteTree(b, 'd'), NotFoundError);
  await deleteTree(b, 'd', { missingOk: true });
  await rej(deleteTree(b, ''), InvalidPathError);
  await rej(deleteTree(b, '../x'), InvalidPathError);
});

test('deleteTree no depende de delete({recursive}) del backend', async () => {
  const b = new FaultyBackend(); b.noRecursive = true;
  await b.inner.writeFile('d/a', '1'); await b.inner.writeFile('d/s/b', '2');
  await deleteTree(b, 'd');
  assert.equal(await b.inner.exists('d'), false);
});

// ---------- copyTree ----------
test('copyTree: árbol con binarios y vacías, independiente del origen', async () => {
  const b = new MemoryBackend();
  await b.writeFile('src/a.txt', 'A'); await b.writeFile('src/sub/b.bin', new Uint8Array([0, 255, 7]));
  await b.createDirectory('src/vacia');
  await copyTree(b, 'src', 'cp');
  assert.deepEqual((await b.listDirectory('cp')).map((e) => e.name), ['a.txt', 'sub', 'vacia']);
  assert.deepEqual([...(await b.readFile('cp/sub/b.bin', { encoding: 'binary' }))], [0, 255, 7]);
  await b.writeFile('cp/a.txt', 'X');
  assert.equal(await b.readFile('src/a.txt'), 'A');
  await copyTree(b, 'src/a.txt', 'f.txt');
  assert.equal(await b.readFile('f.txt'), 'A');
});

test('copyTree: mismos errores que backend.copy y no cambia nada al fallar', async () => {
  const b = new MemoryBackend();
  await b.writeFile('a/f', '1'); await b.writeFile('b', '2');
  await rej(copyTree(b, 'nada', 'z'), NotFoundError);
  await rej(copyTree(b, 'a/f', 'noexiste/z'), NotFoundError);
  await rej(copyTree(b, 'a/f', 'b'), AlreadyExistsError);
  await rej(copyTree(b, 'a/f', 'a/f'), AlreadyExistsError);
  await rej(copyTree(b, 'a', 'a/dentro'), InvalidPathError);
  await rej(copyTree(b, '', 'z'), InvalidPathError);
  await rej(copyTree(b, 'a/f', ''), InvalidPathError);
  await rej(copyTree(b, 'a/f', 'b/hijo'), AlreadyExistsError);
  assert.deepEqual((await b.listDirectory('')).map((e) => e.name), ['a', 'b']);
});

test('copyTree: un fallo en cualquier punto deja el destino limpio y el origen intacto', async () => {
  let probados = 0;
  for (let k = 1; k < 60; k++) {
    const b = new FaultyBackend();
    await b.inner.writeFile('src/a.txt', 'A'); await b.inner.writeFile('src/s/b.bin', new Uint8Array([1, 2]));
    await b.inner.createDirectory('src/vacia'); await b.inner.createDirectory('dest');
    b.failAt = k;
    let ok = true;
    try { await copyTree(b, 'src', 'dest/cp'); } catch (e) { ok = false; assert.ok(e instanceof IoError); }
    if (ok) { assert.equal(k > 5, true); assert.equal(await b.inner.readFile('dest/cp/a.txt'), 'A'); break; }
    probados++;
    assert.equal(await b.inner.exists('dest/cp'), false, `restos tras fallo en la llamada ${k}`);
    assert.equal(await b.inner.readFile('src/a.txt'), 'A');
    assert.equal(await b.inner.exists('src/s/b.bin'), true);
  }
  assert.ok(probados >= 8, `solo se probaron ${probados} puntos de fallo`);
});

// ---------- writeFileAtomic ----------
test('writeFileAtomic: crea, reemplaza (texto y binario) y no deja restos', async () => {
  const b = new MemoryBackend();
  await writeFileAtomic(b, 'p/project.json', '{"v":1}');
  assert.equal(await b.readFile('p/project.json'), '{"v":1}');
  await writeFileAtomic(b, 'p/project.json', '{"v":2}');
  assert.equal(await b.readFile('p/project.json'), '{"v":2}');
  await writeFileAtomic(b, 'p/img.bin', new Uint8Array([9, 0, 255]), { encoding: 'binary' });
  assert.deepEqual([...(await b.readFile('p/img.bin', { encoding: 'binary' }))], [9, 0, 255]);
  assert.deepEqual((await b.listDirectory('p')).map((e) => e.name), ['img.bin', 'project.json']);
});

test('writeFileAtomic: errores sin tocar nada', async () => {
  const b = new MemoryBackend();
  await b.createDirectory('d'); await b.writeFile('f', 'x');
  await rej(writeFileAtomic(b, 'd', 'x'), AlreadyExistsError);
  await rej(writeFileAtomic(b, '', 'x'), InvalidPathError);
  await rej(writeFileAtomic(b, '../x', 'x'), InvalidPathError);
  await rej(writeFileAtomic(b, `${'n'.repeat(250)}.json`, 'x'), InvalidPathError);   // el temporal no cabría
  await rej(writeFileAtomic(b, 'f/hijo', 'x'), AlreadyExistsError);
  await rej(writeFileAtomic(b, 'g', 123), IoError);
  assert.deepEqual((await b.listDirectory('')).map((e) => e.name), ['d', 'f']);
  assert.equal(await b.readFile('f'), 'x');
});

const OLD = 'ANTIGUO'; const NEW = 'NUEVO';
const setup = async (b) => { await b.inner.writeFile('p/doc.json', OLD); };

test('writeFileAtomic con fallo puntual en cada llamada: el destino es siempre el antiguo o el nuevo', async () => {
  let fallos = 0;
  for (let k = 1; k < 40; k++) {
    const b = new FaultyBackend(); await setup(b); b.failAt = k;
    let ok = true;
    try { await writeFileAtomic(b, 'p/doc.json', NEW, { id: 'x' }); } catch { ok = false; fallos++; }
    const used = b.calls;
    b.heal();
    if (!ok) assert.deepEqual(await nebulonLeftovers(b, 'p'), [], `restos sin recover tras fallo puntual (llamada ${k})`);                                                      // el fallo puntual ya ocurrió; recover corre sin fallos
    const now = await read(b, 'p/doc.json');
    assert.ok(now === OLD || now === NEW, `llamada ${k}: contenido inesperado ${now}`);
    if (ok) assert.equal(now, NEW);
    await recoverAtomicWrites(b, 'p');
    assert.deepEqual(await nebulonLeftovers(b, 'p'), [], `restos tras recover (llamada ${k})`);
    assert.ok([OLD, NEW].includes(await read(b, 'p/doc.json')));
    if (ok && used < k) break;
  }
  assert.ok(fallos >= 4, `solo ${fallos} puntos de fallo probados`);
});

test('writeFileAtomic con CUELGUE a partir de la llamada k + recover: nunca se pierde ni queda a medias', async () => {
  let cortes = 0; let terminoSinCorte = false;
  for (let k = 1; k < 40; k++) {
    for (const existia of [true, false]) {
      const b = new FaultyBackend(); if (existia) await setup(b); else await b.inner.createDirectory('p');
      b.crashAt = k;
      let ok = true;
      try { await writeFileAtomic(b, 'p/doc.json', NEW, { id: 'x' }); } catch { ok = false; }
      if (ok) { terminoSinCorte = true; continue; }
      cortes++;
      b.heal();
      await recoverAtomicWrites(b, 'p');
      const now = await read(b, 'p/doc.json');
      assert.ok(now === NEW || (existia ? now === OLD : now === null), `k=${k} existia=${existia}: ${now}`);
      assert.deepEqual(await nebulonLeftovers(b, 'p'), [], `restos (k=${k})`);
    }
  }
  assert.ok(cortes >= 8 && terminoSinCorte);
});

// ---------- recoverAtomicWrites ----------
test('recoverAtomicWrites: restaura .bak si falta el destino, limpia sobrantes, idempotente y no toca ficheros ajenos', async () => {
  const b = new MemoryBackend();
  await b.writeFile('p/a.json.nebulon-bak-1', 'viejo-a');                // destino a.json ausente ⇒ restaurar
  await b.writeFile('p/b.json', 'nuevo-b'); await b.writeFile('p/b.json.nebulon-bak-2', 'viejo-b'); // destino presente ⇒ borrar bak
  await b.writeFile('p/c.json.nebulon-tmp-3', 'parcial');                // huérfano ⇒ borrar
  await b.writeFile('p/usuario.tmp', 'mio'); await b.writeFile('p/notas.bak', 'mias');
  const r = await recoverAtomicWrites(b, 'p');
  assert.deepEqual(r.restored, ['p/a.json']);
  assert.equal(r.removed.length, 2);
  assert.equal(await b.readFile('p/a.json'), 'viejo-a');
  assert.equal(await b.readFile('p/b.json'), 'nuevo-b');
  assert.deepEqual((await b.listDirectory('p')).map((e) => e.name), ['a.json', 'b.json', 'notas.bak', 'usuario.tmp']);
  assert.deepEqual(await recoverAtomicWrites(b, 'p'), { restored: [], removed: [] });
  assert.deepEqual(await recoverAtomicWrites(b, 'noexiste'), { restored: [], removed: [] });
});
