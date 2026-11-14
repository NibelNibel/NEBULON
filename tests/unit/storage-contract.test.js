import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StorageError, ErrorCodes, NotFoundError, AlreadyExistsError, PermissionDeniedError,
  InvalidPathError, UnsupportedError, IoError, isStorageError,
} from '../../src/storage/errors.js';
import { StorageBackend, BACKEND_METHODS, missingBackendMethods } from '../../src/storage/StorageBackend.js';

const table = [
  [NotFoundError, 'NotFoundError', 'NOT_FOUND'],
  [AlreadyExistsError, 'AlreadyExistsError', 'ALREADY_EXISTS'],
  [PermissionDeniedError, 'PermissionDeniedError', 'PERMISSION_DENIED'],
  [InvalidPathError, 'InvalidPathError', 'INVALID_PATH'],
  [UnsupportedError, 'UnsupportedError', 'UNSUPPORTED'],
  [IoError, 'IoError', 'IO'],
];

for (const [Cls, name, code] of table) {
  test(`${name}: código estable ${code}, herencia y metadatos`, () => {
    const cause = new Error('origen');
    const e = new Cls('fallo', { path: 'a/b', cause });
    assert.ok(e instanceof Cls && e instanceof StorageError && e instanceof Error);
    assert.equal(e.name, name);
    assert.equal(Cls.name, name);
    assert.equal(e.code, code);
    assert.equal(e.path, 'a/b');
    assert.equal(e.cause, cause);
    assert.equal(e.message, 'fallo');
    assert.ok(isStorageError(e) && isStorageError(e, code) && !isStorageError(e, 'OTRO'));
  });
}

test('ErrorCodes está congelado y tiene 6 códigos', () => {
  assert.equal(Object.keys(ErrorCodes).length, 6);
  assert.throws(() => { 'use strict'; ErrorCodes.X = 1; }, TypeError);
});

test('isStorageError es false para errores ajenos', () => {
  assert.equal(isStorageError(new Error('x')), false);
  assert.equal(isStorageError(null), false);
});

test('el contrato lista exactamente las 10 operaciones de ARCHITECTURE §4', () => {
  assert.deepEqual([...BACKEND_METHODS],
    ['initialize', 'createDirectory', 'readFile', 'writeFile', 'listDirectory', 'rename', 'copy', 'delete', 'exists', 'stat']);
  assert.throws(() => { 'use strict'; BACKEND_METHODS.push('x'); }, TypeError);
});

test('StorageBackend base expone todas las operaciones y cada una lanza UnsupportedError con la ruta', async () => {
  const b = new StorageBackend();
  assert.deepEqual(missingBackendMethods(b), []);
  const calls = {
    initialize: [], createDirectory: ['p'], readFile: ['p'], writeFile: ['p', 'x'], listDirectory: ['p'],
    rename: ['p', 'q'], copy: ['p', 'q'], delete: ['p'], exists: ['p'], stat: ['p'],
  };
  for (const m of BACKEND_METHODS) {
    await assert.rejects(() => b[m](...calls[m]), (e) => {
      assert.ok(e instanceof UnsupportedError, m);
      assert.ok(e.message.includes(`'${m}'`), m);
      return true;
    });
  }
  await assert.rejects(() => b.readFile('x/y'), (e) => e.path === 'x/y');
});

test('una subclase puede sobrescribir operaciones y el kind aparece en el mensaje', async () => {
  class Demo extends StorageBackend {
    get kind() { return 'demo'; }
    async exists() { return false; }
  }
  const d = new Demo();
  assert.equal(await d.exists('a'), false);
  await assert.rejects(() => d.stat('a'), /demo: la operación 'stat'/);
});

test('missingBackendMethods detecta métodos ausentes y valores no válidos', () => {
  assert.deepEqual(missingBackendMethods({}), BACKEND_METHODS);
  assert.deepEqual(missingBackendMethods(null), BACKEND_METHODS);
  const parcial = Object.fromEntries(BACKEND_METHODS.filter((m) => m !== 'copy').map((m) => [m, () => {}]));
  assert.deepEqual(missingBackendMethods(parcial), ['copy']);
});
