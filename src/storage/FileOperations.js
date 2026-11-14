// Operaciones de ficheros sobre CUALQUIER StorageBackend (STO-005). Solo usan las 10 operaciones del
// contrato (nunca Capacitor ni APIs de plataforma), así valen igual para Memory, IndexedDB, carpeta del
// navegador o Android. Ver docs/ARCHITECTURE.md §4.
import { normalize, parent, join, isDescendant } from './paths.js';
import {
  NotFoundError, AlreadyExistsError, InvalidPathError, isStorageError,
} from './errors.js';

const TMP = '.nebulon-tmp-';
const BAK = '.nebulon-bak-';
let counter = 0;
const newId = () => `${Date.now().toString(36)}${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Borra un fichero o un árbol entero SIN depender de `delete({recursive})` del backend:
 * borra hijos primero y el directorio después.
 * @param {import('./StorageBackend.js').StorageBackend} backend
 * @param {string} path
 * @param {{missingOk?: boolean}} [options]  missingOk: si no existe, no hace nada (por defecto NotFoundError)
 */
export async function deleteTree(backend, path, { missingOk = false } = {}) {
  const p = normalize(path);
  if (p === '') throw new InvalidPathError('no se puede eliminar la raíz', { path: p });
  let st;
  try { st = await backend.stat(p); }
  catch (e) {
    if (missingOk && isStorageError(e, 'NOT_FOUND')) return;
    throw e;
  }
  if (st.type === 'directory') {
    for (const entry of await backend.listDirectory(p)) await deleteTree(backend, join(p, entry.name));
  }
  await backend.delete(p);
}

/**
 * Copia recursiva usando solo lectura/escritura/listado (sirve aunque el backend no copie directorios
 * de forma nativa). Misma semántica que `backend.copy`: NotFound si falta el origen o el PADRE del destino,
 * AlreadyExists si el destino existe, InvalidPath si se copia la raíz o un directorio dentro de sí mismo.
 * Si falla a mitad, intenta dejar el destino sin restos (best-effort) y relanza el error original.
 */
export async function copyTree(backend, from, to) {
  const f = normalize(from);
  const t = normalize(to);
  if (f === '' || t === '') throw new InvalidPathError('la raíz no se puede copiar', { path: f === '' ? f : t });
  if (f === t) throw new AlreadyExistsError(`origen y destino son el mismo: '${t}'`, { path: t });
  if (isDescendant(f, t)) throw new InvalidPathError(`no se puede copiar '${f}' dentro de sí mismo ('${t}')`, { path: t });
  const st = await backend.stat(f);                              // NotFound si falta el origen
  if (await backend.exists(t)) throw new AlreadyExistsError(`ya existe: '${t}'`, { path: t });
  const dstParent = parent(t);
  if (!(await backend.exists(dstParent))) throw new NotFoundError(`no existe el directorio padre: '${dstParent}'`, { path: t });
  if ((await backend.stat(dstParent)).type !== 'directory') throw new AlreadyExistsError(`'${dstParent}' es un fichero, no un directorio`, { path: t });

  const walk = async (src, dst, type) => {
    if (type === 'file') {
      await backend.writeFile(dst, await backend.readFile(src, { encoding: 'binary' }), { encoding: 'binary' });
      return;
    }
    await backend.createDirectory(dst);
    for (const e of await backend.listDirectory(src)) await walk(join(src, e.name), join(dst, e.name), e.type);
  };
  try {
    await walk(f, t, st.type);
  } catch (error) {
    try { await deleteTree(backend, t, { missingOk: true }); } catch { /* el error original es el relevante */ }
    throw error;
  }
}

/**
 * Escritura «atómica» de un fichero (best-effort, solo con el contrato):
 *  1. escribe los datos completos en un temporal hermano `<nombre>.nebulon-tmp-<id>`;
 *  2. si el destino existe, lo mueve a `<nombre>.nebulon-bak-<id>` (rename NO pisa);
 *  3. mueve el temporal al destino; 4. borra la copia de seguridad.
 * Si algo falla, se intenta restaurar el original y limpiar. Si el PROCESO muere entre 2 y 3, el destino
 * puede faltar un instante: `recoverAtomicWrites(backend, dir)` lo repone desde la copia `.bak`.
 * Garantía: tras recover, el destino contiene SIEMPRE el contenido anterior o el nuevo completo, nunca uno parcial.
 * No es atómico a nivel de sistema operativo: depende de que `rename` del backend sea todo-o-nada.
 * @param {{encoding?: 'utf8'|'binary', id?: string}} [options]  id: sufijo fijo (pruebas deterministas)
 */
export async function writeFileAtomic(backend, path, data, { encoding, id = newId() } = {}) {
  const p = normalize(path);
  if (p === '') throw new InvalidPathError('no se puede escribir en la raíz', { path: p });
  const tmp = `${p}${TMP}${id}`;
  const bak = `${p}${BAK}${id}`;
  normalize(tmp); normalize(bak);                                // nombre demasiado largo ⇒ InvalidPath antes de tocar nada
  if (await backend.exists(p) && (await backend.stat(p)).type === 'directory') {
    throw new AlreadyExistsError(`'${p}' es un directorio`, { path: p });
  }
  try {
    await backend.writeFile(tmp, data, { encoding });
  } catch (error) {
    await deleteTree(backend, tmp, { missingOk: true }).catch(() => {});
    throw error;
  }
  let movedOriginal = false;
  try {
    if (await backend.exists(p)) { await backend.rename(p, bak); movedOriginal = true; }
    await backend.rename(tmp, p);
  } catch (error) {
    if (movedOriginal && !(await backend.exists(p).catch(() => true))) await backend.rename(bak, p).catch(() => {});
    await deleteTree(backend, tmp, { missingOk: true }).catch(() => {});
    throw error;
  }
  if (movedOriginal) await deleteTree(backend, bak, { missingOk: true }).catch(() => {}); // si falla, lo limpia recover
}

/**
 * Repara un directorio tras una escritura atómica interrumpida: restaura un `.bak` si falta el destino,
 * borra `.bak` sobrantes y temporales huérfanos. Es idempotente.
 * @returns {Promise<{restored: string[], removed: string[]}>}
 */
export async function recoverAtomicWrites(backend, dir) {
  const d = normalize(dir);
  const restored = []; const removed = [];
  if (!(await backend.exists(d))) return { restored, removed };
  const entries = (await backend.listDirectory(d)).map((e) => e.name);
  const names = new Set(entries);
  for (const name of entries) {
    const iBak = name.indexOf(BAK);
    const iTmp = name.indexOf(TMP);
    const full = join(d, name);
    if (iBak > 0) {
      const target = name.slice(0, iBak);
      if (names.has(target)) { await deleteTree(backend, full, { missingOk: true }); removed.push(full); }
      else { await backend.rename(full, join(d, target)); names.add(target); restored.push(join(d, target)); }
    } else if (iTmp > 0) {
      await deleteTree(backend, full, { missingOk: true }); removed.push(full);
    }
  }
  return { restored, removed };
}

