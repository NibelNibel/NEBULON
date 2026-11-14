# HANDOFF — Punto de entrada para cualquier IA que continúe NEBULON

Última actualización: 2026-11-13 · Sesión 2 · Idioma de trabajo con el usuario: **español**.

## H. Instrucciones de incorporación (leer primero)
1. Lee este archivo completo.
2. Lee `docs/ENGINE_AUDIT.md` (qué es Phaser 4.2.1 aquí y qué se verificó) y `docs/ARCHITECTURE.md` (capas y decisiones D-xxx).
3. Lee `docs/ROADMAP.md` y `docs/KNOWN_ISSUES.md`.
4. **Reglas del usuario (innegociables)**: una sola tarea pequeña por vez; no avanzar sin autorización explícita; no afirmar que algo funciona sin probarlo; no botones decorativos ni operaciones simuladas; no modificar Phaser; no importar `@capacitor/filesystem` fuera de los backends de `src/storage/`; no 3D; no actualizar Phaser; Git y copias de seguridad antes de cambios importantes; tras cada tarea actualizar HANDOFF, PROGRESS (+ROADMAP, KNOWN_ISSUES, TESTING, ARCHITECTURE si procede) y detenerse.
5. Estados válidos: Pendiente · En desarrollo · Implementada, sin verificar · Implementada y probada · Bloqueada.
6. No reconstruyas lo ya hecho: **hoy no hay código de producto**, solo documentación y una prueba de humo.
7. Entorno de sesión: la shell **no tiene red** (no `npm install`); sí hay Node 22, Playwright/Chromium globales (`NODE_PATH=$(npm root -g)`). No hay Android.

## A. Identidad del proyecto
- **NEBULON**: editor y motor de videojuegos 2D, inspirado en Godot 4.x, basado en **Phaser 4.2.1**, pensado sobre todo para **Android**, también en navegador Chromium.
- Objetivo final: crear proyectos completos, escenas/nodos, scripts, UI, físicas, animaciones, exportar HTML5; instalable como APK generado en **GitHub Actions** (sin Android Studio en el teléfono); proyectos guardados físicamente en `Documents/Nebulon/`.
- Tecnologías: HTML5, CSS3, JavaScript, Phaser 4.2.1, Capacitor 8 (Android WebView), GitHub Actions. Una sola base de código.
- Arquitectura: ver `docs/ARCHITECTURE.md` (capas platform → storage → core → projects/viewport/runtime → editor → ui).

## B. Estado actual
- **Implementado**: contrato (STO-001), rutas seguras (STO-002) y backend en memoria solo para pruebas (STO-003); no hay ningún backend que persista, esqueleto (FND-001) y Phaser 4.2.1 vendorizado y verificable (FND-002): carpetas, `package.json` sin dependencias, `README.md`, prueba de estructura. Ningún sistema del producto. Documentación y `tools/audit/phaser-smoke.js`.
- **Incompleto**: —
- **Pendiente**: todo (ver ROADMAP).
- **Estado real**: fase de auditoría y planificación terminada; falta aprobación de decisiones D-002 y D-003 para arrancar F0.

## C. Progreso de tareas
- Implementada sin verificar: FND-003. Terminadas: FND-001, FND-002, FND-004, STO-001, STO-002, STO-003, AUD-001, AUD-002 (probadas); AUD-003, DOC-001, PLAN-001 (sin verificar por humano).
- En desarrollo: ninguna.
- Pendientes: F0 (FND-003…CI-004), F1…F8 (ver ROADMAP).
- Bloqueadas: AUD-004 (no se recibió el «bundle minificado existente»).

## D. Última sesión (2): FND-001 a FND-004 y STO-001 a STO-003
- STO-003: `src/storage/MemoryBackend.js` (reloj inyectable `{now}`; árbol de Map; copias de buffers) y `tests/unit/storage-memory.test.js`. Decisiones de contrato fijadas (también en `StorageBackend.js`): `rename/copy` NO crean el directorio padre del destino (NotFound); destino existente ⇒ AlreadyExists; mover/copiar dentro de sí mismo o la raíz ⇒ InvalidPath; `delete` de directorio no vacío sin `recursive` ⇒ IoError; `writeFile` sí crea padres; `readFile` de bytes no UTF-8 en 'utf8' ⇒ IoError. 71/71 OK.
- STO-002: `src/storage/paths.js` (`normalize`, `join`, `split`, `parent`, `basename`, `extname`, `isDescendant`, `assertValidName`; constantes `MAX_SEGMENT_BYTES=255`, `MAX_PATH_BYTES=1024`) y `tests/unit/storage-paths.test.js`. Política: se **rechaza** (no se corrige) lo peligroso (`..`, absolutas, `\\`, control, reservados `<>:"|?*`, punto/espacio final). Raíz = `''`. Unicode NFC. Bug encontrado por las pruebas y corregido: `join` aceptaba partes absolutas. 58/58 OK.
- STO-001: `src/storage/errors.js` (StorageError + 6 subclases, `ErrorCodes`, `isStorageError`), `src/storage/StorageBackend.js` (`BACKEND_METHODS`, clase base cuyas operaciones lanzan `UnsupportedError`, `missingBackendMethods`, semántica documentada en comentarios), `tests/unit/storage-contract.test.js`. 44/44 OK. Decisión: se tomó la «alternativa sin red» porque CI-001 sigue bloqueada (D-003 sin confirmar, sin red).
- FND-004: `src/boot/phaserBoot.js` (Game AUTO, escena `boot`, texto con versión y renderer; usa el global `window.Phaser`), `src/main.js` publica `window.__nebulon` = `{status:'ready'|'error'|'loading', version, renderer, label}`. Probado en Chromium (T-FND-004). Se añadió `SIGUIENTE_PASO.md` (guía para el usuario) y se entregó un zip del proyecto.
- FND-003 (D-002 aprobada por el usuario): `package.json` (devDependency `vite ^7.0.0`; scripts `dev`, `build`, `preview`, `test`, `test:browser`), `vite.config.js` (`base './'`, `outDir www`), `index.html`, `src/main.js`, `tools/copy-vendor.js` (verifica y copia Phaser a `public/vendor/`, gitignored), `tests/browser/static-smoke.mjs`. Probado: 32/32 unitarias; Chromium carga la página sin errores (sin Vite). **No probado: `vite build`** (KI-009).
- FND-002: `vendor/phaser/4.2.1/{phaser.min.js,LICENSE.md,types/}` (9,1 MB, copia byte a byte), `vendor/phaser/CHECKSUMS.txt`, `tools/verify-vendor.js` (exporta `verify(root)`; CLI sale 1 si hay discrepancias), `tests/unit/vendor.test.js`. Pruebas: 30/30 OK, alteración detectada. No se tocó ningún fichero de Phaser. Solo se vendoriza el UMD completo (con Matter); la variante arcade-only queda como optimización futura.
- FND-001:
- Implementado: esqueleto del repo. Archivos: `package.json` (type module, Node ≥22, scripts `build` —mensaje, sin implementar— y `test` = `node --test tests/unit/*.test.js`), `README.md`, `tests/unit/structure.test.js`, `.gitkeep` en carpetas vacías (`src/*`, `public`, `vendor/phaser`, `tests/browser`, `.github/workflows`).
- Decisión: `android/` y `www/` no se crean (los generan CI-002 y FND-003). `public/` elegido (no `www/`) como carpeta de estáticos.
- Nota técnica: en Node 22 `node --test <directorio>` falla; se usa glob `tests/unit/*.test.js`.
- Pruebas: `npm test` 26/26 OK; comprobado que falla si falta una carpeta.

## D-bis. Sesión 1
(auditoría)
- Implementado: extracción y auditoría del zip de Phaser; prueba de humo; investigación de Capacitor 8; plan de tareas; documentos; repositorio Git.
- Archivos creados: `HANDOFF.md`, `docs/{ENGINE_AUDIT,ARCHITECTURE,ROADMAP,PROGRESS,KNOWN_ISSUES,TESTING}.md`, `tools/audit/phaser-smoke.js`, `tools/audit/phaser-4.2.1.sha256`, `.gitignore`.
- Decisiones: propuestas D-001…D-008 (ver ARCHITECTURE §8), ninguna aprobada aún.
- Pruebas: T-AUD-001 OK (Phaser 4.2.1 arranca con WebGL en Chromium, 3 bundles). Android no probado.
- Hallazgo clave: `Documents` en Android 11+ solo permite acceder a lo creado por la propia app (KI-001/002/003). Puede obligar a SAF.

## E. Arquitectura
Ver `docs/ARCHITECTURE.md`. Estructura actual del repo:
```
HANDOFF.md  docs/  tools/audit/  .gitignore
third_party/phaser-4.2.1-src/   (ignorado por git; código fuente descomprimido del zip)
```
El zip original (SHA-256 `3381e1eb…139da`) es la copia intacta; **no está en git**: el usuario lo conserva. Puntos de entrada futuros: `src/main.js`, `index.html`.

## F. Problemas conocidos
Ver `docs/KNOWN_ISSUES.md` (KI-001…KI-008). Decisiones pendientes: D-002 (Vite), D-003 (`appId`), D-008 (estrategia de almacenamiento Android, depende de prueba en teléfono).

## G. Próxima tarea
- **Pendiente de cierre (usuario)**: `npm install && npm run build` con red, comprobar `www/`, subir `package-lock.json` (KI-009). Ver `SIGUIENTE_PASO.md`.
- **Siguiente tarea propuesta**: STO-004 — suite de contrato reutilizable. Mover/generalizar las comprobaciones de `tests/unit/storage-memory.test.js` a `tests/contract/storageContract.js` (función `runStorageContract(name, createBackend)` que registra las pruebas con `node:test`), y hacer que `MemoryBackend` la pase. Debe ser importable desde Playwright/navegador más adelante (sin dependencias de Node en la lógica de las aserciones salvo `node:assert`, que se abstraerá). Criterios: Memory pasa; un backend roto a propósito (mutante) la falla; sin duplicar casos entre el test de Memory y la suite.
- **CI-001** sigue bloqueada por D-003 y red.
