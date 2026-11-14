// MemoryBackend (STO-003). La semántica común del contrato vive en tests/contract/storageContract.js (STO-004)
// y se ejecuta aquí; este fichero solo contiene lo propio de MemoryBackend (no se duplican casos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryBackend } from '../../src/storage/MemoryBackend.js';
import { runStorageContract } from '../contract/storageContract.js';

const mk = () => { let t = 1000; return new MemoryBackend({ now: () => ++t }); };

runStorageContract('memory', mk, { test, assert });

test('memory: kind e initialize informan que NO es persistente', async () => {
  const b = mk();
  assert.equal(b.kind, 'memory');
  assert.deepEqual(await b.initialize(), { root: '', persistent: false, kind: 'memory' });
});

test('memory: mtime avanza al escribir (reloj inyectado)', async () => {
  const b = mk();
  await b.writeFile('f', '1');
  const t1 = (await b.stat('f')).mtime;
  await b.writeFile('f', '2');
  assert.ok((await b.stat('f')).mtime > t1);
});

test('memory: instancias aisladas entre sí', async () => {
  const a = mk(); const b = mk();
  await a.writeFile('x', '1');
  assert.equal(await b.exists('x'), false);
});
