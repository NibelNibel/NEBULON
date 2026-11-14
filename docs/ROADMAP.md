# ROADMAP — Plan de tareas de NEBULON

Estados permitidos: **Pendiente · En desarrollo · Implementada, sin verificar · Implementada y probada · Bloqueada**.
Regla: una tarea por vez; no se avanza sin autorización. Si una tarea resulta grande, se divide antes de empezar.
Las fases F0–F2 están detalladas completamente. Las fases siguientes tienen lista ordenada con dependencias; **cada tarea se expande al formato completo (objetivo, archivos, criterios, pruebas) justo antes de comenzarla**, para no planificar con detalle sobre supuestos que cambiarán.

Formato de cada tarea detallada: ID · Nombre · Objetivo · Dependencias · Archivos · Resultado · Criterios de aceptación · Pruebas.

---

## F0 — Cimientos y APK mínimo (prioridad: validar la cadena Capacitor cuanto antes)

### FND-001 · Esqueleto del repositorio — ✅ Implementada y probada (sesión 2)
- **Objetivo**: estructura de carpetas, `.gitignore`, `package.json` mínimo, `README` corto.
- **Dep.**: —
- **Archivos**: `package.json`, `README.md`, `.gitignore`, carpetas vacías con `.gitkeep`.
- **Resultado**: repo con scripts `npm run build/test` definidos (aún triviales).
- **Criterios**: `npm run test` termina en 0; estructura coincide con ARCHITECTURE §3.
- **Pruebas**: ejecutar scripts; revisar árbol.

### FND-002 · Vendorizar Phaser 4.2.1 — ✅ Implementada y probada (sesión 2)
- **Objetivo**: copiar `dist/phaser.min.js`, `LICENSE.md`, `types/` a `vendor/phaser/4.2.1/` con SHA-256.
- **Dep.**: FND-001
- **Archivos**: `vendor/phaser/4.2.1/*`, `vendor/phaser/CHECKSUMS.txt`, `tools/verify-vendor.js`.
- **Criterios**: el script verifica los hashes del zip original; ningún fichero de Phaser modificado.
- **Pruebas**: `node tools/verify-vendor.js` OK; romper un byte → falla.

### FND-003 · Build web con Vite — 🟡 Implementada, sin verificar (D-002 aprobada; falta ejecutar `vite build`)
- **Objetivo**: `npm run build` produce `www/` con `index.html`, JS propio y `vendor/phaser`.
- **Dep.**: FND-002, aprobación D-002
- **Archivos**: `vite.config.js`, `index.html`, `src/main.js`, `package.json`.
- **Criterios**: `www/` se sirve localmente y carga sin errores en consola.
- **Pruebas**: Playwright abre `www/`, lee consola, 0 errores. *(Requiere red para `npm install`: se ejecuta en CI o en tu entorno.)*

### FND-004 · Phaser arranca en la página — ✅ Implementada y probada (sesión 2)
- **Objetivo**: un lienzo Phaser mínimo que muestra la versión (`Phaser.VERSION`) y renderer en uso.
- **Dep.**: FND-003
- **Archivos**: `src/main.js`, `src/boot/phaserBoot.js`.
- **Criterios**: texto «Phaser 4.2.1 · WebGL» visible; sin errores.
- **Pruebas**: Playwright captura pantalla y lee estado vía `window.__nebulon.status`.

### FND-005 · Capa `platform/`
- **Objetivo**: `isNative()`, `getPlatform()`, `getAndroidApiLevel()` (cuando posible), sin importar Capacitor en navegador.
- **Dep.**: FND-004
- **Archivos**: `src/platform/Platform.js`, `tests/unit/platform.test.js`.
- **Criterios**: en Node/navegador devuelve `web`; con `window.Capacitor` simulado devuelve nativo.
- **Pruebas**: unitarias con globales simulados.

### CI-001 · Capacitor en el proyecto
- **Objetivo**: `capacitor.config.json` y dependencias `@capacitor/core|cli|android|filesystem` en versión 8.x fijada.
- **Dep.**: FND-005, aprobación D-003
- **Archivos**: `package.json`, `capacitor.config.json`.
- **Criterios**: `npx cap --version` = 8.x; `npm ci` limpio.
- **Pruebas**: en CI.

### CI-002 · Plataforma Android y parches reproducibles (D-004/D-005)
- **Objetivo**: `android/` generado, con manifest (permisos con `maxSdkVersion`), `density` en `configChanges`, SDK 36/minSdk 24.
- **Dep.**: CI-001
- **Archivos**: `android/**`, `tools/android/patch-manifest.js`.
- **Criterios**: `cap sync android` sin errores; el parche es idempotente.
- **Pruebas**: ejecutar parche dos veces → mismo resultado (diff vacío).

### CI-003 · Workflow de APK de depuración
- **Objetivo**: GitHub Actions que genera `app-debug.apk` y lo publica como artefacto.
- **Dep.**: CI-002
- **Archivos**: `.github/workflows/android-debug.yml`.
- **Criterios**: ejecución verde; APK descargable; se instala en tu teléfono y muestra la pantalla de FND-004.
- **Pruebas**: ejecución en GitHub + **prueba manual en tu teléfono** (la haces tú; yo preparo la lista de comprobación en TESTING.md).

### CI-004 · Pantalla de diagnóstico de almacenamiento (sin UI de editor)
- **Objetivo**: pantalla técnica temporal que ejecuta `mkdir`, `writeFile`, `readFile`, `readdir`, `rename`, `rmdir` en `Documents/Nebulon/_diag/` y muestra resultados reales + versión de Android.
- **Dep.**: CI-003
- **Archivos**: `src/diagnostics/storageDiag.js`.
- **Criterios**: cada operación muestra OK/ERROR con el mensaje real; resultados exportables como texto.
- **Pruebas**: **en teléfono**; los resultados responden KI-001/KI-002 y deciden D-008.

> **Hito H0**: APK que instala, arranca Phaser y diagnostica Documents. Sin esto no se construye más almacenamiento Android.

---

## F1 — Capa de almacenamiento

| ID | Nombre | Dep. | Criterio principal |
|---|---|---|---|
| STO-001 | ✅ Contrato `StorageBackend` + errores normalizados (implementada y probada) | — (FND-005 era dependencia nominal) | Tipos/JSdoc + clases de error; test de forma |
| STO-002 | ✅ Utilidades de rutas (implementada y probada) | STO-001 | 100% de casos de borde probados |
| STO-003 | ✅ `MemoryBackend` (solo pruebas; implementada y probada con tests propios) | STO-001,002 | Pasa la suite de contrato (STO-004 la extraerá y reutilizará) |
| STO-004 | ✅ Suite de contrato reutilizable (implementada y probada) | STO-003 | Se ejecuta contra cualquier backend (Node y navegador); mutantes detectados |
| STO-005 | ✅ `FileOperations` (copia/borrado recursivo, escritura atómica, recuperación) (implementada y probada) | STO-004 | Probado sobre Memory y con inyección de fallos |
| STO-006 | `BrowserIdbBackend` | STO-004 | Pasa contrato en Chromium (Playwright); sobrevive recarga |
| STO-007 | `BrowserFsaBackend` (showDirectoryPicker, handle persistido) | STO-004 | Pasa contrato en Chromium; permiso re-solicitable |
| STO-008 | `AndroidDocumentsBackend` (Filesystem, DOCUMENTS, recursive) | STO-004, CI-004 | Pasa contrato **en teléfono** |
| STO-009 | Flujo de permisos Android (≤9 legacy; ≥11 sin permisos) | STO-008 | Comportamiento por versión documentado y probado |
| STO-010 | `StorageManager` (selección de backend, inicialización, fallback) | STO-006..008 | Selecciona por plataforma; errores claros |
| STO-011 | Estructura `Nebulon/{Proyectos,Plantillas,Exportaciones}` | STO-010 | Crea y tolera existencia |
| STO-012 | Exportar/importar ZIP (decisión de librería, D-009) | STO-005 | Round-trip idéntico byte a byte |
| STO-013 | *(condicional a D-008)* Backend SAF con plugin nativo | CI-004 | Persistencia de acceso tras reinicio |

## F2 — Proyectos

| ID | Nombre | Dep. |
|---|---|---|
| PRJ-001 | Esquema `project.json` + validador | STO-011 |
| PRJ-002 | Crear proyecto vacío (estructura de carpetas) | PRJ-001 |
| PRJ-003 | Listar/abrir proyectos con recuperación ante `project.json` corrupto | PRJ-002 |
| PRJ-004 | Renombrar | PRJ-003 |
| PRJ-005 | Duplicar | PRJ-003, STO-005 |
| PRJ-006 | Eliminar (confirmación en capa UI, aquí solo API) | PRJ-003 |
| PRJ-007 | Proyectos recientes (en `settings/`) | PRJ-003 |
| PRJ-008 | Guardar configuración de proyecto | PRJ-001 |
| PRJ-009 | Sistema de plantillas + plantilla «2D vacío» | PRJ-002 |
| PRJ-010..014 | Plantillas Plataformas, Vista superior, Aventura, Arcade, Demostración (cada una requiere escenas/recursos reales; **se posponen hasta F3–F5**) | F3+ |

## F3 — Núcleo de nodos (desglose acordado en tu documento, 12 pasos)

CORE-001 clase base `Node` → CORE-002 IDs únicos → CORE-003 relaciones padre-hijo → CORE-004 propiedades básicas → CORE-005 serialización → CORE-006 deserialización → CORE-007 componentes → CORE-008 tipos de nodo base (Node2D, Sprite, Text, Container, …) → CORE-009 `Scene` (contenedor de árbol) → CORE-010 eliminación → CORE-011 duplicación → CORE-012 reordenamiento → CORE-013 versionado/migración de formato.
*(El árbol visual, selección y conexión con el editor pertenecen a F5.)*

## F4 — Escenas y viewport 2D

SCN-001 guardar/cargar escena (JSON en `scenes/`) · SCN-002 crear/eliminar escena · SCN-003 instanciar escena en otra · SCN-004 relaciones entre escenas · VP-001 adaptador Phaser: renderizar un Node → objeto Phaser · VP-002 sincronización Node↔Phaser (cambios de propiedades) · VP-003 cámara del editor (pan) · VP-004 zoom · VP-005 cuadrícula · VP-006 selección por toque/clic · VP-007 mover · VP-008 rotar · VP-009 escalar · VP-010 snapping · VP-011 guías · VP-012 capas.

## F5 — Interfaz del editor

UI-001 layout responsive móvil/escritorio · UI-002 árbol visual de nodos · UI-003 selección · UI-004 eliminar · UI-005 duplicar · UI-006 reordenar (arrastrar) · UI-007 conectar árbol↔viewport · ED-001 sistema de comandos · ED-002 undo/redo · INS-001 inspector: transform · INS-002 opacidad/visibilidad · INS-003 tamaño · INS-004 textura · …

## F6 — Recursos

RES-001 explorador de recursos (usa StorageManager) · RES-002 importar imágenes (selector de archivos) · RES-003 spritesheets (configuración de frames) · RES-004 audio · RES-005 fuentes · RES-006 JSON · RES-007 carpetas · RES-008 previsualización.

## F7 — Herramientas avanzadas

ANI-xxx animaciones · PHY-xxx física Arcade/Matter · COL-xxx colisiones · SCR-xxx scripts (editor + ejecución) · GUI-xxx interfaces · AUD-xxx audio · DBG-xxx depuración · EXP-xxx exportación HTML5.

## F8 — Distribución

CI-010 firma de release con secretos · CI-011 versionado automático · CI-012 caché de Gradle.

---

## Grafo de dependencias de alto nivel

```
FND-001→002→003→004→005→CI-001→CI-002→CI-003→CI-004 ═► H0
                                   │
STO-001→002→003→004→005 ───────────┼─► STO-006/007 (navegador)
                  CI-004 ─► STO-008→009 ─► STO-010→011 ─► F2 (PRJ)
CORE-001..013 (independiente del storage; puede ir en paralelo lógico) ─► F4 ─► F5
```
Nota: F3 (CORE) no depende de F1/F2 y podría adelantarse, pero se mantiene el orden serie por tu regla de una tarea cada vez.
