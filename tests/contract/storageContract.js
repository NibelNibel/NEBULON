// Suite de contrato de almacenamiento (STO-004). Ver docs/ARCHITECTURE.md §4 y StorageBackend.js.
//
// Es la definición ejecutable de la semántica que TODO backend debe cumplir (Memory, IndexedDB,
// carpeta del navegador, Android...). No importa nada de Node ni del DOM: el ejecutor (node:test,
// Playwright, una página de diagnóstico) le inyecta `test` y `assert`. Solo usa
// assert.equal / deepEqual / ok / rejects, con la misma firma que `node:assert`.
import {
  NotFoundError, AlreadyExistsError, InvalidPathError, IoError,
} from '../../src/storage/errors.js';
import { StorageBackend, missingBackendMethods } from '../../src/storage/StorageBackend.js';

/**
 * Cada caso recibe `{ fresh, assert, rej }`:
 *  - fresh(): backend NUEVO, vacío e inicializado (se puede llamar varias veces dentro de un caso).
 *  - rej(promesa, Clase): la promesa debe rechazar con una instancia de Clase.
 */
export const STORAGE_CONTRACT_CASES = [
  {
    name: 'forma: hereda del contrato, expone las 10 operaciones e initialize informa root/persistent/kind',
    async run({ fresh, assert }) {
      const b = await fresh();
      assert.ok(b instanceof StorageBackend);
      assert.deepEqual(missingBackendMethods(b), []);
      assert.equal(typeof b.kind, 'string');
      assert.ok(b.kind !== '' && b.kind !== 'abstract');
      const info = await b.initialize();                          // idempotente: fresh() ya lo llamó
      assert.equal(typeof info.root, 'string');
      assert.equal(typeof info.persistent, 'boolean');
      assert.equal(info.kind, b.kind);
    },
  },
  {
    name: 'createDirectory: recursivo, tolera existencia, rechaza fichero en la ruta',
    async run({ fresh, assert, rej }) {
      const b = await fresh();
      await b.createDirectory('Nebulon/Proyectos/Juego');
      await b.createDirectory('Nebulon/Proyectos/Juego');
      await b.createDirectory('');
      assert.deepEqual((await b.listDirectory('Nebulon')).map((e) => e.name), ['Proyectos']);
      await b.writeFile('f.txt', 'x');
      await rej(b.createDirectory('f.txt'), AlreadyExistsError);
      await rej(b.createDirectory('f.txt/sub'), AlreadyExistsError);
      await rej(b.createDirectory('a/../b'), InvalidPathError);
    },
  },
  {
    name: 'writeFile/readFile: texto UTF-8, binario, reemplazo y copias aisladas',
    async run({ fresh, assert }) {
      const b = await fresh();
      await b.writeFile('a/b/c.json', '{"ñ":"日本"}');               // crea padres
      assert.equal(await b.readFile('a/b/c.json'), '{"ñ":"日本"}');
      const src = new Uint8Array([0, 1, 2, 255]);
      await b.writeFile('bin.dat', src, { encoding: 'binary' });
      src[0] = 99;                                                    // mutar el origen no afecta al almacén
      const got = await b.readFile('bin.dat', { encoding: 'binary' });
      assert.deepEqual([...got], [0, 1, 2, 255]);
      got[1] = 77;                                                    // mutar lo leído tampoco
      assert.deepEqual([...(await b.readFile('bin.dat', { encoding: 'binary' }))], [0, 1, 2, 255]);
      await b.writeFile('a/b/c.json', 'nuevo');
      assert.equal(await b.readFile('a/b/c.json'), 'nuevo');
      await b.writeFile('vacio.txt', '');
      assert.equal(await b.readFile('vacio.txt'), '');
      assert.equal((await b.stat('vacio.txt')).size, 0);
    },
  },
  {
    name: 'readFile/writeFile: errores',
    async run({ fresh, assert, rej }) {
      const b = await fresh();
      await b.createDirectory('d');
      await b.writeFile('f', 'x');
      await b.writeFile('bad', new Uint8Array([0xff, 0xfe]));
      await rej(b.readFile('nada'), NotFoundError);
      await rej(b.readFile('f/hijo'), NotFoundError);                // fichero usado como directorio
      await rej(b.readFile('d'), IoError);
      await rej(b.readFile('bad'), IoError);                         // no es UTF-8
      assert.equal((await b.readFile('bad', { encoding: 'binary' })).length, 2);
      await rej(b.readFile('f', { encoding: 'latin1' }), IoError);
      await rej(b.writeFile('', 'x'), InvalidPathError);
      await rej(b.writeFile('d', 'x'), AlreadyExistsError);          // no se pisa un directorio
      await rej(b.writeFile('f/hijo', 'x'), AlreadyExistsError);     // fichero como directorio intermedio
      await rej(b.writeFile('g', 123), IoError);
      await rej(b.writeFile('g', 'texto', { encoding: 'binary' }), IoError);
      assert.equal(await b.exists('g'), false);
    },
  },
  {
    name: 'listDirectory: ordenado, tipos, tamaños; errores',
    async run({ fresh, assert, rej }) {
      const b = await fresh();
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
    },
  },
  {
    name: 'exists y stat',
    async run({ fresh, assert, rej }) {
      const b = await fresh();
      await b.writeFile('d/f.txt', 'hola');
      assert.equal(await b.exists('d/f.txt'), true);
      assert.equal(await b.exists('d'), true);
      assert.equal(await b.exists(''), true);
      assert.equal(await b.exists('d/nada'), false);
      assert.equal(await b.exists('d/f.txt/x'), false);
      await rej(b.exists('../x'), InvalidPathError);
      const s = await b.stat('d/f.txt');
      assert.equal(s.type, 'file');
      assert.equal(s.size, 4);
      assert.ok(Number.isFinite(s.mtime));
      assert.equal((await b.stat('d')).type, 'directory');
      assert.equal((await b.stat('')).type, 'directory');
      await rej(b.stat('nada'), NotFoundError);
    },
  },
  {
    name: 'rename: fichero y directorio con contenido',
    async run({ fresh, assert }) {
      const b = await fresh();
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
    },
  },
  {
    name: 'rename y copy: errores comunes (y no cambian nada tras fallar)',
    async run({ fresh, assert, rej }) {
      for (const op of ['rename', 'copy']) {
        const b = await fresh();
        await b.writeFile('a/f', '1');
        await b.writeFile('b', '2');
        await b.createDirectory('d');
        await rej(b[op]('nada', 'z'), NotFoundError);
        await rej(b[op]('a/f', 'noexiste/z'), NotFoundError);        // el padre del destino debe existir
        await rej(b[op]('a/f', 'b'), AlreadyExistsError);
        await rej(b[op]('a/f', 'a/f'), AlreadyExistsError);
        await rej(b[op]('a', 'a/dentro'), InvalidPathError);         // dentro de sí mismo
        await rej(b[op]('', 'z'), InvalidPathError);
        await rej(b[op]('a/f', ''), InvalidPathError);
        await rej(b[op]('a/f', 'b/hijo'), AlreadyExistsError);       // padre destino es un fichero
        assert.equal(await b.readFile('a/f'), '1');
        assert.equal(await b.readFile('b'), '2');
      }
    },
  },
  {
    name: 'copy: profunda e independiente del origen',
    async run({ fresh, assert }) {
      const b = await fresh();
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
      assert.equal(await b.readFile('src/a.txt'), 'A');              // copiar no mueve
    },
  },
  {
    name: 'delete: fichero, vacío, recursivo y errores',
    async run({ fresh, assert, rej }) {
      const b = await fresh();
      await b.writeFile('d/f', '1');
      await b.writeFile('d/s/g', '2');
      await b.createDirectory('vacio');
      await b.delete('d/f');
      assert.equal(await b.exists('d/f'), false);
      await b.delete('vacio');
      assert.equal(await b.exists('vacio'), false);
      await rej(b.delete('d'), IoError);                             // no vacío sin recursive
      assert.equal(await b.exists('d/s/g'), true);
      await b.delete('d', { recursive: true });
      assert.equal(await b.exists('d'), false);
      await rej(b.delete('d'), NotFoundError);
      await rej(b.delete(''), InvalidPathError);
    },
  },
  {
    name: 'las rutas se normalizan en todas las operaciones',
    async run({ fresh, assert }) {
      const b = await fresh();
      await b.writeFile('./a//b.txt', 'hola');
      assert.equal(await b.readFile('a/b.txt'), 'hola');
      assert.equal(await b.exists('a/b.txt/'), true);
      await b.writeFile('cafe\u0301.txt', 'nfd');                      // 'café' descompuesto (NFD): se normaliza a NFC
      assert.equal(await b.readFile('caf\u00e9.txt'), 'nfd');       // y se lee con la forma compuesta (NFC)
    },
  },
];

/**
 * Ejecuta todos los casos contra un backend y devuelve los resultados SIN registrar pruebas.
 * Sirve para pruebas de mutación y para una pantalla de diagnóstico (CI-004).
 * @param {() => (StorageBackend|Promise<StorageBackend>)} createBackend  devuelve un backend nuevo y vacío
 * @param {object} assert  con equal, deepEqual, ok, rejects (firma de node:assert)
 * @returns {Promise<{name: string, ok: boolean, error?: unknown}[]>}
 */
export async function runStorageContractCases(createBackend, assert) {
  const rej = (p, C) => assert.rejects(p, (e) => e instanceof C, `esperaba ${C.name}`);
  const fresh = async () => {
    const b = await createBackend();
    await b.initialize();
    return b;
  };
  const results = [];
  for (const c of STORAGE_CONTRACT_CASES) {
    try {
      await c.run({ fresh, assert, rej });
      results.push({ name: c.name, ok: true });
    } catch (error) {
      results.push({ name: c.name, ok: false, error });
    }
  }
  return results;
}

/**
 * Registra los casos con el ejecutor de pruebas indicado.
 * @param {string} name  nombre del backend (aparece en los títulos)
 * @param {() => (StorageBackend|Promise<StorageBackend>)} createBackend
 * @param {{test: (title: string, fn: () => Promise<void>) => void, assert: object}} harness
 */
export function runStorageContract(name, createBackend, { test, assert }) {
  const rej = (p, C) => assert.rejects(p, (e) => e instanceof C, `esperaba ${C.name}`);
  const fresh = async () => {
    const b = await createBackend();
    await b.initialize();
    return b;
  };
  for (const c of STORAGE_CONTRACT_CASES) {
    test(`[contrato:${name}] ${c.name}`, () => c.run({ fresh, assert, rej }));
  }
}
