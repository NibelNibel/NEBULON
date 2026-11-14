import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, join, split, parent, basename, extname, isDescendant, assertValidName,
  MAX_SEGMENT_BYTES, MAX_PATH_BYTES,
} from '../../src/storage/paths.js';
import { InvalidPathError } from '../../src/storage/errors.js';

const bad = (p) => assert.throws(() => normalize(p), (e) => e instanceof InvalidPathError && e.code === 'INVALID_PATH');

test('normalize: casos válidos y canonicalización', () => {
  const cases = [
    ['', ''], ['.', ''], ['./', ''], ['a', 'a'], ['a/b', 'a/b'], ['a/b/', 'a/b'], ['a//b', 'a/b'],
    ['./a/./b', 'a/b'], ['Nebulon/Proyectos/Mi Juego', 'Nebulon/Proyectos/Mi Juego'],
    ['Niño/canción.json', 'Niño/canción.json'], ['日本語/ファイル.txt', '日本語/ファイル.txt'],
    ['.gitignore', '.gitignore'], ['a.b.c', 'a.b.c'], ['mi-juego_1 (copia)', 'mi-juego_1 (copia)'],
  ];
  for (const [i, o] of cases) assert.equal(normalize(i), o, JSON.stringify(i));
});

test('normalize: Unicode se unifica a NFC', () => {
  const nfd = 'cafe\u0301';      // e + acento combinado
  const nfc = 'caf\u00e9';
  assert.equal(normalize(nfd), nfc);
  assert.equal(normalize(`x/${nfd}`), `x/${nfc}`);
});

test('normalize: rechaza ..', () => {
  for (const p of ['..', '../a', 'a/..', 'a/../b', 'a/b/../../c', '..//a']) bad(p);
});

test('normalize: rechaza rutas absolutas, unidades y barras invertidas', () => {
  for (const p of ['/', '/a', '/Nebulon', 'C:/x', 'c:x', 'C:\\x', 'a\\b', '\\a']) bad(p);
});

test('normalize: rechaza caracteres de control y reservados', () => {
  for (const c of ['\0', '\n', '\t', '\x1f', '\x7f', '<', '>', ':', '"', '|', '?', '*']) {
    bad(`a${c}b`);
  }
});

test('normalize: rechaza segmentos que terminan en punto o espacio, pero admite ocultos', () => {
  for (const p of ['a.', 'a /b', 'a/b ', 'a/b.', '...']) bad(p);
  assert.equal(normalize('.hidden'), '.hidden');
});

test('normalize: rechaza tipos que no son texto', () => {
  for (const p of [undefined, null, 5, {}, [], true]) bad(p);
});

test('normalize: límites de longitud (bytes UTF-8)', () => {
  assert.equal(normalize('a'.repeat(MAX_SEGMENT_BYTES)), 'a'.repeat(MAX_SEGMENT_BYTES));
  bad('a'.repeat(MAX_SEGMENT_BYTES + 1));
  bad('ñ'.repeat(128));                     // 256 bytes en un solo segmento
  assert.equal(normalize('ñ'.repeat(127)).length, 127);
  const seg = 'a'.repeat(200);
  assert.equal(normalize([seg, seg, seg, seg].join('/')).length, 803);
  bad(Array(6).fill(seg).join('/'));        // 1 205 bytes > MAX_PATH_BYTES
  assert.ok(MAX_PATH_BYTES >= 1024);
});

test('normalize es idempotente', () => {
  for (const p of ['', 'a', './a//b/', 'cafe\u0301/x']) assert.equal(normalize(normalize(p)), normalize(p));
});

test('el mensaje de error incluye la ruta y el campo path', () => {
  try { normalize('a/../b'); assert.fail('debía lanzar'); }
  catch (e) { assert.equal(e.path, 'a/../b'); assert.match(e.message, /\.\./); }
});

test('join', () => {
  assert.equal(join('Nebulon', 'Proyectos', 'Juego'), 'Nebulon/Proyectos/Juego');
  assert.equal(join('', 'a'), 'a');
  assert.equal(join('a/', './b'), 'a/b');
  assert.equal(join(), '');
  assert.throws(() => join('a', '..', 'b'), InvalidPathError);
  assert.throws(() => join('a', '/b'), InvalidPathError);   // un segmento absoluto no puede reemplazar la ruta
  assert.throws(() => join('a', undefined), InvalidPathError);  // Array.join convertiría undefined/null en '' sin avisar
  assert.throws(() => join('a', null), InvalidPathError);
});

test('split / parent / basename / extname', () => {
  assert.deepEqual(split(''), []);
  assert.deepEqual(split('a/b/c'), ['a', 'b', 'c']);
  assert.equal(parent('a/b/c'), 'a/b');
  assert.equal(parent('a'), '');
  assert.equal(parent(''), '');
  assert.equal(basename('a/b/c.png'), 'c.png');
  assert.equal(basename(''), '');
  assert.equal(extname('a/b/Sprite.PNG'), '.png');
  assert.equal(extname('a/archivo'), '');
  assert.equal(extname('a/.gitignore'), '');
  assert.equal(extname('a/b.tar.gz'), '.gz');
});

test('isDescendant', () => {
  assert.equal(isDescendant('a', 'a/b'), true);
  assert.equal(isDescendant('a', 'a/b/c'), true);
  assert.equal(isDescendant('a', 'a'), false);
  assert.equal(isDescendant('a', 'ab'), false);       // no confundir prefijo de texto con ancestro
  assert.equal(isDescendant('a/b', 'a'), false);
  assert.equal(isDescendant('', 'a'), true);
  assert.equal(isDescendant('', ''), false);
  assert.equal(isDescendant('./a/', 'a//b'), true);
});

test('assertValidName', () => {
  assert.equal(assertValidName('MiPrimerJuego'), 'MiPrimerJuego');
  assert.equal(assertValidName('Mi juego ñ'), 'Mi juego ñ');
  for (const n of ['', '.', '..', 'a/b', '/a', 'a:b', 'a.', undefined, null, 3]) {
    assert.throws(() => assertValidName(n), InvalidPathError, JSON.stringify(n));
  }
});
