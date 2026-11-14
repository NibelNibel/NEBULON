// Errores normalizados de almacenamiento (STO-001). Los backends traducen los errores propios
// de su plataforma (Capacitor OS-PLUG-FILE-xxxx, DOMException, IndexedDB) a estas clases,
// para que el resto de NEBULON no dependa de ninguna plataforma.

export const ErrorCodes = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_PATH: 'INVALID_PATH',
  UNSUPPORTED: 'UNSUPPORTED',
  IO: 'IO',
});

export class StorageError extends Error {
  /**
   * @param {string} code uno de ErrorCodes
   * @param {string} message
   * @param {{path?: string, cause?: unknown}} [details]
   */
  constructor(code, message, details = {}) {
    super(message, details.cause !== undefined ? { cause: details.cause } : undefined);
    this.name = 'StorageError';
    this.code = code;
    this.path = details.path;
  }
}

const make = (name, code) => {
  const C = class extends StorageError {
    constructor(message, details) { super(code, message, details); this.name = name; }
  };
  Object.defineProperty(C, 'name', { value: name });
  return C;
};

export const NotFoundError = make('NotFoundError', ErrorCodes.NOT_FOUND);
export const AlreadyExistsError = make('AlreadyExistsError', ErrorCodes.ALREADY_EXISTS);
export const PermissionDeniedError = make('PermissionDeniedError', ErrorCodes.PERMISSION_DENIED);
export const InvalidPathError = make('InvalidPathError', ErrorCodes.INVALID_PATH);
export const UnsupportedError = make('UnsupportedError', ErrorCodes.UNSUPPORTED);
export const IoError = make('IoError', ErrorCodes.IO);

export const isStorageError = (e, code) => e instanceof StorageError && (code === undefined || e.code === code);
