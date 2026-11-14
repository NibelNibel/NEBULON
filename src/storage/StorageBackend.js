// Contrato de backend de almacenamiento (STO-001). Ver docs/ARCHITECTURE.md §4.
// Todas las rutas son relativas a la raíz de NEBULON, con '/' como separador, sin '..' ni rutas absolutas.
// Este fichero NO importa Capacitor, Phaser ni el DOM.
import { UnsupportedError } from './errors.js';

/**
 * @typedef {'file'|'directory'} EntryType
 * @typedef {{name: string, type: EntryType, size: number, mtime: number}} DirEntry  mtime: ms desde epoch (0 si se desconoce)
 * @typedef {{type: EntryType, size: number, mtime: number}} StatResult
 * @typedef {{root: string, persistent: boolean, kind: string}} InitResult
 * @typedef {'utf8'|'binary'} Encoding  'utf8' ⇒ string; 'binary' ⇒ Uint8Array
 */

/** Nombres de las operaciones que todo backend debe implementar. */
export const BACKEND_METHODS = Object.freeze([
  'initialize', 'createDirectory', 'readFile', 'writeFile', 'listDirectory',
  'rename', 'copy', 'delete', 'exists', 'stat',
]);

/**
 * Clase base opcional: cada operación lanza UnsupportedError hasta que el backend la sobrescriba.
 * Semántica obligatoria para las implementaciones:
 *  - createDirectory: recursivo; tolera que ya exista.
 *  - writeFile: crea directorios padre; reemplaza si existe.
 *  - readFile: NotFoundError si no existe.
 *  - listDirectory: no recursivo; NotFoundError si no existe.
 *  - rename/copy: NotFoundError si el origen o el DIRECTORIO PADRE del destino no existen (no crean padres);
 *    AlreadyExistsError si el destino existe; InvalidPathError si se mueve/copia la raíz o un directorio
 *    dentro de sí mismo; copy admite directorios (copia profunda).
 *  - delete: NotFoundError si no existe; InvalidPathError para la raíz; un directorio no vacío requiere
 *    {recursive: true} (si no, IoError).
 *  - readFile 'utf8' sobre bytes no UTF-8 y operaciones de fichero sobre directorios (o al revés): IoError.
 *  - Un fichero usado como directorio intermedio: en lecturas ⇒ NotFoundError; en escrituras ⇒ AlreadyExistsError.
 *  - exists: nunca lanza por inexistencia; devuelve false.
 */
export class StorageBackend {
  /** @returns {string} identificador del backend (p. ej. 'memory', 'browser-idb', 'android-documents') */
  get kind() { return 'abstract'; }

  /** @returns {Promise<InitResult>} */
  async initialize() { throw this.#no('initialize'); }
  /** @param {string} path @returns {Promise<void>} */
  async createDirectory(path) { throw this.#no('createDirectory', path); }
  /** @param {string} path @param {{encoding?: Encoding}} [options] @returns {Promise<string|Uint8Array>} */
  async readFile(path, options) { throw this.#no('readFile', path); }
  /** @param {string} path @param {string|Uint8Array} data @param {{encoding?: Encoding}} [options] @returns {Promise<void>} */
  async writeFile(path, data, options) { throw this.#no('writeFile', path); }
  /** @param {string} path @returns {Promise<DirEntry[]>} */
  async listDirectory(path) { throw this.#no('listDirectory', path); }
  /** @param {string} from @param {string} to @returns {Promise<void>} */
  async rename(from, to) { throw this.#no('rename', from); }
  /** @param {string} from @param {string} to @returns {Promise<void>} */
  async copy(from, to) { throw this.#no('copy', from); }
  /** @param {string} path @param {{recursive?: boolean}} [options] @returns {Promise<void>} */
  async delete(path, options) { throw this.#no('delete', path); }
  /** @param {string} path @returns {Promise<boolean>} */
  async exists(path) { throw this.#no('exists', path); }
  /** @param {string} path @returns {Promise<StatResult>} */
  async stat(path) { throw this.#no('stat', path); }

  #no(op, path) {
    return new UnsupportedError(`${this.kind}: la operación '${op}' no está implementada`, { path });
  }
}

/**
 * Comprueba que un objeto expone todas las operaciones del contrato como funciones.
 * @returns {string[]} nombres de métodos que faltan (vacío ⇒ forma correcta)
 */
export function missingBackendMethods(backend) {
  return BACKEND_METHODS.filter((m) => typeof backend?.[m] !== 'function');
}
