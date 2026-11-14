import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryBackend } from '../../src/storage/MemoryBackend.js';
import { missingBackendMethods, StorageBackend } from '../../src/storage/StorageBackend.js';
import { NotFoundError, AlreadyExistsError, InvalidPathError, IoError } from '../../src/storage/errors.js';

const mk = () => { let t = 1000; return new MemoryBackend({ now: () => ++t }); };
const rej = (p, C) => assert.rejects(p, (e) => e instanceof C, `esperaba ${C.name}`);

test('cumple la forma del contrato y initialize informa no persistente', async () => {
  const b = mk();
  assert.ok(b instanceof StorageBackend);
  assert.deepEqual(missingBackendMethods(b), []);
  assert.deepEqual(await b.initialize(), { root: '', persistent: false, kind: 'memory' });
});

test('createDirectory: recursivo, tolera existencia, rechaza fichero en la ruta', async () => {
  const b = mk();
  await b.createDirectory('Nebulon/Proyectos/Juego');
  await b.createDirectory('Nebulon/Proyectos/Juego');
  await b.createDirectory('');
  assert.deepEqual((await b.listDirectory('Nebulon')).map((e) => e.name), ['Proyectos']);
  await b.writeFile('f.txt', 'x');
  await rej(b.createDirectory('f.txt'), AlreadyExistsError);
  await rej(b.createDirectory('f.txt/sub'), AlreadyExistsError);
  await rej(b.createDirectory('a/../b'), InvalidPathError);
});

test('writeFile/readFile: texto UTF-8, binario, reemplazo y copias aisladas', async () => {
  const b = mk();
  await b.writeFile('a/b/c.json', '{"ñ":"日本"}');                 // crea padres
  assert.equal(await b.readFile('a/b/c.json'), '{"ñ":"日本"}');
  const src = new Uint8Array([0, 1, 2, 255]);
  await b.writeFile('bin.dat', src, { encoding: 'binary' });
  src[0] = 99;                                                     // mutar el origen no afecta al almacén
  const got = await b.readFile('bin.dat', { encoding: 'binary' });
  assert.deepEqual([...got], [0, 1, 2, 255]);
  got[1] = 77;                                                     // mutar lo leído tampoco
  assert.deepEqual([...(await b.readFile('bin.dat', { encoding: 'binary' }))], [0, 1, 2, 255]);
  await b.writeFile('a/b/c.json', 'nuevo');
  assert.equal(await b.readFile('a/b/c.json'), 'nuevo');
  await b.writeFile('vacio.txt', '');
  assert.equal(await b.readFile('vacio.txt'), '');
  assert.equal((await b.stat('vacio.txt')).size, 0);
});

test('readFile/writeFile: errores', async () => {
  const b = mk();
  await b.createDirectory('d');
  await b.writeFile('f', 'x');
  await b.writeFile('bad', new Uint8Array([0xff, 0xfe]));
  await rej(b.readFile('nada'), NotFoundError);
  await rej(b.readFile('f/hijo'), NotFoundError);                  // fichero usado como directorio
  await rej(b.readFile('d'), IoError);
  await rej(b.readFile('bad'), IoError);                           // no es UTF-8
  assert.equal((await b.readFile('bad', { encoding: 'binary' })).length, 2);
  await rej(b.readFile('f', { encoding: 'latin1' }), IoError);
  await rej(b.writeFile('', 'x'), InvalidPathError);
  await rej(b.writeFile('d', 'x'), AlreadyExistsError);            // no se pisa un directorio
  await rej(b.writeFile('f/hijo', 'x'), AlreadyExistsError);       // fichero como directorio intermedio
  await rej(b.writeFile('g', 123), IoError);
  await rej(b.writeFile('g', 'texto', { encoding: 'binary' }), IoError);
  assert.equal(await b.exists('g'), false);
});

test('listDirectory: ordenado, tipos, tamaños; errores', async () => {
  const b = mk();
  await b.writeFile('p/b.txt', 'bb');
  await b.writeFile('p/a.txt', 'a');
  await b.createDirectory('p/Z');
  const l = await b.listDirectory('p');
  assert.deepEqual(l.map((e) => [e.name, e.type, e.size]), [['Z', 'directory', 0], ['a.txt', 'file', 1], ['b.txt', 'file', 2]]);
  assert.ok(l.every((e) => Number.isFinite(e.mtime)));
  assert.deepEqual(await b.listDirectory('p/Z'), []);
  assert.equal((await b.listDirectory('')).length, 1);
  await rej(b.listDirectory('nada'), NotFoundError);
  await rej(b.listDirectory('p/a.txt'), IoError);
});

test('exists y stat', async () => {
  const b = mk();
  await b.writeFile('d/f.txt', 'hola');
  assert.equal(await b.exists('d/f.txt'), true);
  assert.equal(await b.exists('d'), true);
  assert.equal(await b.exists(''), true);
  assert.equal(await b.exists('d/nada'), false);
  assert.equal(await b.exists('d/f.txt/x'), false);
  await rej(b.exists('../x'), InvalidPathError);
  assert.deepEqual(await b.stat('d/f.txt'), { type: 'file', size: 4, mtime: (await b.stat('d/f.txt')).mtime });
  assert.equal((await b.stat('d')).type, 'directory');
  assert.equal((await b.stat('')).type, 'directory');
  await rej(b.stat('nada'), NotFoundError);
});

test('mtime avanza al escribir', async () => {
  const b = mk();
  await b.writeFile('f', '1');
  const t1 = (await b.stat('f')).mtime;
  await b.writeFile('f', '2');
  assert.ok((await b.stat('f')).mtime > t1);
});

test('rename: fichero y directorio con contenido', async () => {
  const b = mk();
  await b.writeFile('a/x.txt', 'X');
  await b.writeFile('a/sub/y.txt', 'Y');
  await b.createDirectory('dest');
  await b.rename('a/x.txt', 'dest/x2.txt');
  assert.equal(await b.exists('a/x.txt'), false);
  assert.equal(await b.readFile('dest/x2.txt'), 'X');
  await b.rename('a', 'dest/movido');
  assert.equal(await b.exists('a'), false);
  assert.equal(await b.readFile('dest/movido/sub/y.txt'), 'Y');
  await b.rename('dest/movido', 'dest/movido2');
  assert.equal(await b.readFile('dest/movido2/sub/y.txt'), 'Y');
});

test('rename/copy: errores comunes', async () => {
  for (const op of ['rename', 'copy']) {
    const b = mk();
    await b.writeFile('a/f', '1');
    await b.writeFile('b', '2');
    await b.createDirectory('d');
    await rej(b[op]('nada', 'z'), NotFoundError);
    await rej(b[op]('a/f', 'noexiste/z'), NotFoundError);            // el padre del destino debe existir
    await rej(b[op]('a/f', 'b'), AlreadyExistsError);
    await rej(b[op]('a/f', 'a/f'), AlreadyExistsError);
    await rej(b[op]('a', 'a/dentro'), InvalidPathError);             // dentro de sí mismo
    await rej(b[op]('', 'z'), InvalidPathError);
    await rej(b[op]('a/f', ''), InvalidPathError);
    await rej(b[op]('a/f', 'b/hijo'), AlreadyExistsError);           // padre destino es un fichero
    assert.equal(await b.readFile('a/f'), '1');                      // nada cambió tras los fallos
    assert.equal(await b.readFile('b'), '2');
  }
});

test('copy: profunda e independiente del origen', async () => {
  const b = mk();
  await b.writeFile('src/a.txt', 'A');
  await b.writeFile('src/sub/b.bin', new Uint8Array([1, 2, 3]));
  await b.createDirectory('src/vacia');
  await b.copy('src', 'cp');
  assert.deepEqual((await b.listDirectory('cp')).map((e) => e.name), ['a.txt', 'sub', 'vacia']);
  assert.deepEqual([...(await b.readFile('cp/sub/b.bin', { encoding: 'binary' }))], [1, 2, 3]);
  await b.writeFile('cp/a.txt', 'CAMBIADO');
  await b.delete('cp/sub', { recursive: true });
  assert.equal(await b.readFile('src/a.txt'), 'A');
  assert.equal(await b.exists('src/sub/b.bin'), true);
  await b.copy('src/a.txt', 'copia.txt');
  assert.equal(await b.readFile('copia.txt'), 'A');
});

test('delete: fichero, vacío, recursivo y errores', async () => {
  const b = mk();
  await b.writeFile('d/f', '1');
  await b.writeFile('d/s/g', '2');
  await b.createDirectory('vacio');
  await b.delete('d/f');
  assert.equal(await b.exists('d/f'), false);
  await b.delete('vacio');
  assert.equal(await b.exists('vacio'), false);
  await rej(b.delete('d'), IoError);                               // no vacío sin recursive
  assert.equal(await b.exists('d/s/g'), true);
  await b.delete('d', { recursive: true });
  assert.equal(await b.exists('d'), false);
  await rej(b.delete('d'), NotFoundError);
  await rej(b.delete(''), InvalidPathError);
});

test('instancias aisladas entre sí', async () => {
  const a = mk(); const b = mk();
  await a.writeFile('x', '1');
  assert.equal(await b.exists('x'), false);
});

test('las rutas se normalizan en todas las operaciones', async () => {
  const b = mk();
  await b.writeFile('./a//b.txt', 'hola');
  assert.equal(await b.readFile('a/b.txt'), 'hola');
  assert.equal(await b.exists('a/b.txt/'), true);
  await b.writeFile('café.txt', 'nfd');
  assert.equal(await b.readFile('café.txt'), 'nfd');
});
