// Utilidades de rutas de almacenamiento (STO-002). Puras: sin Capacitor, Phaser ni DOM.
//
// Una ruta válida es relativa a la raíz de NEBULON, usa '/' como separador y se devuelve
// ya canónica: sin '/' inicial ni final, sin '//' ni segmentos '.', normalizada a Unicode NFC.
// La raíz se representa con la cadena vacía ''.
//
// Se RECHAZAN (InvalidPathError), no se "arreglan": '..', rutas absolutas ('/x', 'C:/x'),
// '\', caracteres de control y los reservados  < > : " | ? *  (válidos en Linux pero no en
// FAT/exFAT ni Windows, donde acabarán los proyectos exportados), segmentos que terminan en
// punto o espacio, segmentos de más de 255 bytes UTF-8 y rutas de más de 1024 bytes.
import { InvalidPathError } from './errors.js';

export const MAX_SEGMENT_BYTES = 255;
export const MAX_PATH_BYTES = 1024;

const bytes = (s) => new TextEncoder().encode(s).length;
const RESERVED = /[<>:"|?*]/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

function checkSegment(seg, original) {
  if (seg === '..') throw new InvalidPathError(`ruta no válida (contiene '..'): ${JSON.stringify(original)}`, { path: original });
  if (CONTROL.test(seg)) throw new InvalidPathError(`ruta no válida (carácter de control): ${JSON.stringify(original)}`, { path: original });
  if (RESERVED.test(seg)) throw new InvalidPathError(`ruta no válida (carácter reservado < > : " | ? *): ${JSON.stringify(original)}`, { path: original });
  if (/[. ]$/.test(seg)) throw new InvalidPathError(`ruta no válida (segmento termina en punto o espacio): ${JSON.stringify(original)}`, { path: original });
  if (bytes(seg) > MAX_SEGMENT_BYTES) throw new InvalidPathError(`ruta no válida (segmento de más de ${MAX_SEGMENT_BYTES} bytes)`, { path: original });
}

/** @param {string} path @returns {string} ruta canónica ('' = raíz) @throws {InvalidPathError} */
export function normalize(path) {
  if (typeof path !== 'string') throw new InvalidPathError(`la ruta debe ser texto, no ${path === null ? 'null' : typeof path}`, { path: String(path) });
  if (path.includes('\\')) throw new InvalidPathError(`ruta no válida (usa '/' como separador): ${JSON.stringify(path)}`, { path });
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new InvalidPathError(`ruta no válida (debe ser relativa): ${JSON.stringify(path)}`, { path });
  const segments = [];
  for (const raw of path.split('/')) {
    if (raw === '' || raw === '.') continue;
    const seg = raw.normalize('NFC');
    checkSegment(seg, path);
    segments.push(seg);
  }
  const result = segments.join('/');
  if (bytes(result) > MAX_PATH_BYTES) throw new InvalidPathError(`ruta no válida (más de ${MAX_PATH_BYTES} bytes)`, { path });
  return result;
}

/** Une partes y normaliza. Las partes vacías se ignoran. */
export function join(...parts) {
  for (const p of parts) {
    // Cada parte debe ser relativa por sí misma: 'a' + '/b' no puede convertirse en 'a/b' sin avisar.
    if (typeof p !== 'string' || p.startsWith('/') || p.startsWith('\\') || /^[A-Za-z]:/.test(p)) normalize(p);
  }
  return normalize(parts.filter((p) => p !== '').join('/'));
}

/** Segmentos de una ruta ('' → []). */
export function split(path) {
  const p = normalize(path);
  return p === '' ? [] : p.split('/');
}

/** Directorio padre ('' para elementos de primer nivel y para la raíz). */
export function parent(path) {
  const s = split(path);
  return s.slice(0, -1).join('/');
}

/** Último segmento ('' para la raíz). */
export function basename(path) {
  const s = split(path);
  return s.length ? s[s.length - 1] : '';
}

/** Extensión con punto, en minúsculas ('' si no tiene; los ficheros ocultos como '.gitignore' no tienen). */
export function extname(path) {
  const b = basename(path);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i).toLowerCase() : '';
}

/** true si `child` está estrictamente dentro de `ancestor` (la raíz contiene todo salvo a sí misma). */
export function isDescendant(ancestor, child) {
  const a = normalize(ancestor);
  const c = normalize(child);
  if (a === c) return false;
  return a === '' ? c !== '' : c.startsWith(a + '/');
}

/** Valida un nombre simple (un único segmento, no vacío), p. ej. el nombre de un proyecto. */
export function assertValidName(name) {
  if (typeof name !== 'string' || name === '' || name.includes('/') || name === '.' ) {
    throw new InvalidPathError(`nombre no válido: ${JSON.stringify(name)}`, { path: String(name) });
  }
  normalize(name);
  return name.normalize('NFC');
}
