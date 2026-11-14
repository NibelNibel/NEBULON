// Pruebas de la PROPIA suite de contrato (STO-004): una suite que nunca falla no demuestra nada.
// Cada «mutante» es un backend roto a propósito; la suite debe fallar al menos un caso con él.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryBackend } from '../../src/storage/MemoryBackend.js';
import { StorageBackend } from '../../src/storage/StorageBackend.js';
import { IoError, NotFoundError } from '../../src/storage/errors.js';
import { STORAGE_CONTRACT_CASES, runStorageContractCases } from '../contract/storageContract.js';

const good = () => new MemoryBackend();
const failed = (results) => results.filter((r) => !r.ok).map((r) => r.name);

/** Mutante: delega en un MemoryBackend y sobrescribe lo indicado. */
const mutant = (overrides) => () => {
  const inner = new MemoryBackend();
  const b = new StorageBackend();
  const methods = ['initialize', 'createDirectory', 'readFile', 'writeFile', 'listDirectory', 'rename', 'copy', 'delete', 'exists', 'stat'];
  for (const m of methods) b[m] = (...a) => inner[m](...a);
  Object.defineProperty(b, 'kind', { get: () => inner.kind });   // coherente con initialize(): solo falla lo que se rompe a propósito
  for (const [k, f] of Object.entries(overrides)) b[k] = (...a) => f(inner, ...a);
  return b;
};

test('la suite tiene casos y nombres únicos', () => {
  assert.ok(STORAGE_CONTRACT_CASES.length >= 10);
  const names = STORAGE_CONTRACT_CASES.map((c) => c.name);
  assert.equal(new Set(names).size, names.length);
});

test('MemoryBackend pasa todos los casos', async () => {
  const res = await runStorageContractCases(good, assert);
  assert.deepEqual(failed(res), []);
  assert.equal(res.length, STORAGE_CONTRACT_CASES.length);
});

const mutants = {
  'delete ignora recursive (borra directorios no vacíos)': {
    delete: (i, p) => i.delete(p, { recursive: true }),
  },
  'delete nunca recursivo': {
    delete: (i, p) => i.delete(p),
  },
  'rename pisa el destino existente': {
    rename: async (i, f, t) => { if (await i.exists(t)) await i.delete(t, { recursive: true }); return i.rename(f, t); },
  },
  'copy pisa el destino existente': {
    copy: async (i, f, t) => { if (await i.exists(t)) await i.delete(t, { recursive: true }); return i.copy(f, t); },
  },
  'copy mueve en vez de copiar': {
    copy: async (i, f, t) => i.rename(f, t),
  },
  'rename crea el directorio padre del destino': {
    rename: async (i, f, t) => { await i.createDirectory(t.split('/').slice(0, -1).join('/')); return i.rename(f, t); },
  },
  'writeFile no crea directorios padre': {
    writeFile: async (i, p, d, o) => { if (p.includes('/') && !(await i.exists(p.split('/').slice(0, -1).join('/')))) throw new NotFoundError('sin padre', { path: p }); return i.writeFile(p, d, o); },
  },
  'readFile de un fichero inexistente lanza el error equivocado': {
    readFile: async (i, p, o) => { try { return await i.readFile(p, o); } catch (e) { if (e instanceof NotFoundError) throw new IoError('x', { path: p }); throw e; } },
  },
  'readFile utf8 tolera bytes inválidos (decodificación con pérdida)': {
    readFile: async (i, p, o) => {
      if (o?.encoding === 'binary') return i.readFile(p, o);
      return new TextDecoder().decode(await i.readFile(p, { encoding: 'binary' }));
    },
  },
  'listDirectory sin ordenar (orden inverso)': {
    listDirectory: async (i, p) => (await i.listDirectory(p)).reverse(),
  },
  'exists lanza NotFoundError en vez de devolver false': {
    exists: async (i, p) => { if (!(await i.exists(p))) throw new NotFoundError('no', { path: p }); return true; },
  },
  'readFile binario devuelve un buffer compartido mutable (no aísla)': {
    // Simula un backend que cachea el último buffer leído y lo reutiliza.
    readFile: (() => { const cache = new Map(); return async (i, p, o) => {
      if (o?.encoding !== 'binary') return i.readFile(p, o);
      if (!cache.has(p)) cache.set(p, await i.readFile(p, o));
      return cache.get(p);
    }; })(),
  },
  'rutas sin normalizar (descompuesta NFD distinta de NFC)': {
    writeFile: (i, p, d, o) => i.writeFile(p.replace(/\u0301/g, '!'), d, o),
  },
};

for (const [name, overrides] of Object.entries(mutants)) {
  test(`mutante detectado: ${name}`, async () => {
    const res = await runStorageContractCases(mutant(overrides), assert);
    assert.ok(failed(res).length > 0, 'la suite NO detectó este backend roto');
  });
}

test('un backend que solo hereda de StorageBackend falla (casi) todos los casos', async () => {
  const res = await runStorageContractCases(() => new StorageBackend(), assert);
  assert.equal(failed(res).length, res.length);
});
