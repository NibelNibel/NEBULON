// Mini-assert sin dependencias de Node para ejecutar la suite de contrato en el navegador (STO-004).
// Misma firma que node:assert/strict para lo que usa storageContract.js: equal, deepEqual, ok, rejects.
const fail = (msg, extra) => { const e = new Error(msg + (extra ? ` — ${extra}` : '')); e.name = 'AssertionError'; throw e; };
const show = (v) => { try { return JSON.stringify(v, (_, x) => (x instanceof Uint8Array ? [...x] : x)); } catch { return String(v); } };
const same = (a, b) => {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
};

export const assert = {
  ok(v, msg) { if (!v) fail(msg || 'se esperaba un valor verdadero'); },
  equal(a, b, msg) { if (!Object.is(a, b)) fail(msg || 'no son iguales', `${show(a)} !== ${show(b)}`); },
  deepEqual(a, b, msg) { if (!same(a, b)) fail(msg || 'no son profundamente iguales', `${show(a)} vs ${show(b)}`); },
  async rejects(promise, check, msg) {
    let error; let rejected = false;
    try { await promise; } catch (e) { rejected = true; error = e; }
    if (!rejected) fail(msg || 'la promesa debía rechazar');
    if (typeof check === 'function' && check(error) !== true) fail(msg || 'el error no cumple la comprobación', `${error?.name}: ${error?.message}`);
  },
};
