// Backend en memoria (STO-003). SOLO PARA PRUEBAS: nada persiste. No debe usarse como
// almacenamiento de proyectos (regla del proyecto: no guardar solo en memoria temporal).
// Es la implementación de referencia de la semántica descrita en StorageBackend.js.
import { StorageBackend } from './StorageBackend.js';
import { normalize, split, parent, isDescendant } from './paths.js';
import {
  NotFoundError, AlreadyExistsError, InvalidPathError, IoError,
} from './errors.js';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

const newDir = (mtime) => ({ type: 'directory', mtime, children: new Map() });
const newFile = (data, mtime) => ({ type: 'file', data, mtime });

export class MemoryBackend extends StorageBackend {
  #root;
  #now;

  /** @param {{now?: () => number}} [options] reloj inyectable para pruebas deterministas */
  constructor({ now = Date.now } = {}) {
    super();
    this.#now = now;
    this.#root = newDir(now());
  }

  get kind() { return 'memory'; }

  async initialize() { return { root: '', persistent: false, kind: this.kind }; }

  /** Nodo en `path` o undefined. Un fichero en mitad de la ruta ⇒ undefined. */
  #get(path) {
    let node = this.#root;
    for (const seg of split(path)) {
      if (node.type !== 'directory') return undefined;
      node = node.children.get(seg);
      if (!node) return undefined;
    }
    return node;
  }

  /** Directorio padre de `path`; NotFoundError si no existe, AlreadyExistsError si es un fichero. */
  #parentDir(path) {
    const p = parent(path);
    const node = this.#get(p);
    if (!node) throw new NotFoundError(`no existe el directorio padre: '${p}'`, { path });
    if (node.type !== 'directory') throw new AlreadyExistsError(`'${p}' es un fichero, no un directorio`, { path });
    return node;
  }

  #mkdirs(path) {
    let node = this.#root;
    let cur = '';
    for (const seg of split(path)) {
      cur = cur ? `${cur}/${seg}` : seg;
      let next = node.children.get(seg);
      if (!next) { next = newDir(this.#now()); node.children.set(seg, next); node.mtime = this.#now(); }
      else if (next.type !== 'directory') throw new AlreadyExistsError(`'${cur}' es un fichero, no un directorio`, { path });
      node = next;
    }
    return node;
  }

  async createDirectory(path) { this.#mkdirs(normalize(path)); }

  async readFile(path, { encoding = 'utf8' } = {}) {
    const p = normalize(path);
    const node = this.#get(p);
    if (!node) throw new NotFoundError(`no existe: '${p}'`, { path: p });
    if (node.type !== 'file') throw new IoError(`'${p}' es un directorio`, { path: p });
    if (encoding === 'binary') return node.data.slice();
    if (encoding !== 'utf8') throw new IoError(`codificación desconocida: ${encoding}`, { path: p });
    try { return dec.decode(node.data); }
    catch (cause) { throw new IoError(`'${p}' no es UTF-8 válido; lee con encoding 'binary'`, { path: p, cause }); }
  }

  async writeFile(path, data, { encoding } = {}) {
    const p = normalize(path);
    if (p === '') throw new InvalidPathError('no se puede escribir en la raíz', { path: p });
    let bytes;
    if (typeof data === 'string') bytes = enc.encode(data);
    else if (data instanceof Uint8Array) bytes = data.slice();
    else throw new IoError('los datos deben ser string o Uint8Array', { path: p });
    if (encoding === 'binary' && typeof data === 'string') throw new IoError("encoding 'binary' exige Uint8Array", { path: p });
    const dir = this.#mkdirs(parent(p));
    const name = split(p).at(-1);
    const existing = dir.children.get(name);
    if (existing && existing.type === 'directory') throw new AlreadyExistsError(`'${p}' es un directorio`, { path: p });
    dir.children.set(name, newFile(bytes, this.#now()));
    dir.mtime = this.#now();
  }

  async listDirectory(path) {
    const p = normalize(path);
    const node = this.#get(p);
    if (!node) throw new NotFoundError(`no existe: '${p}'`, { path: p });
    if (node.type !== 'directory') throw new IoError(`'${p}' es un fichero, no un directorio`, { path: p });
    return [...node.children.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, n]) => ({ name, type: n.type, size: n.type === 'file' ? n.data.length : 0, mtime: n.mtime }));
  }

  /** Comprobaciones comunes de rename/copy. Devuelve {src, dst, dstDir}. */
  #prepareMove(from, to) {
    const f = normalize(from);
    const t = normalize(to);
    if (f === '' || t === '') throw new InvalidPathError('la raíz no se puede mover ni copiar', { path: f === '' ? f : t });
    const src = this.#get(f);
    if (!src) throw new NotFoundError(`no existe: '${f}'`, { path: f });
    if (f === t || isDescendant(f, t)) {
      if (f === t) throw new AlreadyExistsError(`origen y destino son el mismo: '${t}'`, { path: t });
      throw new InvalidPathError(`no se puede mover/copiar '${f}' dentro de sí mismo ('${t}')`, { path: t });
    }
    const dstDir = this.#parentDir(t);
    if (dstDir.children.has(split(t).at(-1))) throw new AlreadyExistsError(`ya existe: '${t}'`, { path: t });
    return { f, t, src, dstDir, name: split(t).at(-1) };
  }

  async rename(from, to) {
    const { f, src, dstDir, name } = this.#prepareMove(from, to);
    const srcDir = this.#get(parent(f));
    srcDir.children.delete(split(f).at(-1));
    dstDir.children.set(name, src);
    srcDir.mtime = dstDir.mtime = this.#now();
  }

  async copy(from, to) {
    const { src, dstDir, name } = this.#prepareMove(from, to);
    const clone = (n) => (n.type === 'file'
      ? newFile(n.data.slice(), this.#now())
      : Object.assign(newDir(this.#now()), { children: new Map([...n.children].map(([k, v]) => [k, clone(v)])) }));
    dstDir.children.set(name, clone(src));
    dstDir.mtime = this.#now();
  }

  async delete(path, { recursive = false } = {}) {
    const p = normalize(path);
    if (p === '') throw new InvalidPathError('no se puede eliminar la raíz', { path: p });
    const node = this.#get(p);
    if (!node) throw new NotFoundError(`no existe: '${p}'`, { path: p });
    if (node.type === 'directory' && node.children.size > 0 && !recursive) {
      throw new IoError(`el directorio '${p}' no está vacío (usa {recursive: true})`, { path: p });
    }
    const dir = this.#get(parent(p));
    dir.children.delete(split(p).at(-1));
    dir.mtime = this.#now();
  }

  async exists(path) { return this.#get(normalize(path)) !== undefined; }

  async stat(path) {
    const p = normalize(path);
    const node = this.#get(p);
    if (!node) throw new NotFoundError(`no existe: '${p}'`, { path: p });
    return { type: node.type, size: node.type === 'file' ? node.data.length : 0, mtime: node.mtime };
  }
}
