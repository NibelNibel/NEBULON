# ARCHITECTURE — Arquitectura propuesta de NEBULON

Estado: **PROPUESTA** (nada de esto está implementado todavía). Las decisiones marcadas «D-xxx» esperan tu aprobación o se tomaron por defecto y están listadas en la sección 8.

## 1. Principios
1. **Una base de código** para navegador Chromium y Android WebView (Capacitor 8).
2. **Núcleo independiente**: el modelo de nodos/escenas/proyectos no importa Phaser, ni Capacitor, ni el DOM. Se puede probar con Node.
3. **Capas con dependencias en un solo sentido** (ver diagrama). Prohibido importar hacia arriba.
4. **Todo acceso a archivos pasa por `StorageManager`**. Ningún componente visual ni el gestor de proyectos importa `@capacitor/filesystem`.
5. **Phaser no se modifica**. Se usa `vendor/phaser/4.2.1/phaser.min.js`; las extensiones de NEBULON viven en `src/`.
6. **Nada simulado**: una función de UI solo se añade cuando su backend existe y está probado.

## 2. Capas

```
┌──────────────────────────────────────────────────────────┐
│ ui/            Paneles DOM (árbol, inspector, recursos…)  │
├──────────────────────────────────────────────────────────┤
│ editor/        Comandos, selección, undo/redo, herramientas│
├───────────────┬───────────────────────┬──────────────────┤
│ viewport/     │ projects/             │ runtime/          │
│ Adaptador     │ ProjectManager        │ Carga escenas en  │
│ Phaser del    │ (usa storage/)        │ Phaser para jugar │
│ editor 2D     │                       │ y exportar        │
├───────────────┴───────────┬───────────┴──────────────────┤
│ core/   Node, Scene, Component, serialización (puro JS)   │
├──────────────────────────────────────────────────────────┤
│ storage/ StorageManager → backends                        │
│   AndroidDocumentsBackend (Capacitor Filesystem)          │
│   AndroidSafBackend (futuro, plugin nativo)               │
│   BrowserFsaBackend (File System Access API)              │
│   BrowserIdbBackend (IndexedDB)                           │
│   MemoryBackend (solo pruebas)                            │
├──────────────────────────────────────────────────────────┤
│ platform/  isNative(), plataforma, permisos (Capacitor)   │
└──────────────────────────────────────────────────────────┘
```

Regla: `core/` y `storage/` (salvo los backends) no conocen `platform/` ni Phaser. Los backends son el único código que importa Capacitor, y se cargan con `import()` dinámico para que el navegador no necesite el plugin.

## 3. Estructura de carpetas objetivo

```
nebulon/
├── HANDOFF.md
├── docs/                    # ENGINE_AUDIT, ARCHITECTURE, ROADMAP, PROGRESS, KNOWN_ISSUES, TESTING
├── src/
│   ├── main.js              # punto de entrada del editor
│   ├── platform/
│   ├── storage/             # StorageManager, backends, FileOperations, ProjectStorage
│   ├── core/                # Node, Scene, serialización
│   ├── projects/
│   ├── editor/
│   ├── viewport/            # adaptador Phaser
│   ├── runtime/
│   └── ui/
├── public/ (o www/)         # index.html, CSS, vendor/phaser copiado en build
├── vendor/phaser/4.2.1/     # phaser.min.js + LICENSE + types + SHA-256 (copia fiel de dist/)
├── tests/                   # unit (Node), browser (Playwright)
├── tools/                   # auditoría, scripts de build/CI
├── android/                 # proyecto Capacitor (ver D-004); NO existe aún, se genera en CI-002
├── capacitor.config.json
├── package.json
├── .github/workflows/android-debug.yml
└── third_party/             # (ignorado por git) código fuente Phaser descomprimido
```

## 4. API de almacenamiento (contrato)

Todas las rutas son **relativas a la raíz de NEBULON** (`Nebulon/…` en Documents, o la carpeta elegida en navegador), con `/` como separador, sin `..`, sin rutas absolutas.

```js
interface StorageBackend {
  initialize(): Promise<{ root: string, persistent: boolean, kind: string }>
  createDirectory(path): Promise<void>        // recursivo, tolera existencia
  readFile(path, { encoding: 'utf8' | 'binary' }): Promise<string | Uint8Array>
  writeFile(path, data, { encoding }): Promise<void>   // crea padres
  listDirectory(path): Promise<Array<{ name, type: 'file'|'directory', size, mtime }>>
  rename(from, to): Promise<void>
  copy(from, to): Promise<void>               // ficheros y directorios
  delete(path, { recursive }): Promise<void>
  exists(path): Promise<boolean>
  stat(path): Promise<{ type, size, mtime }>
}
```
Errores normalizados (`NotFound`, `AlreadyExists`, `PermissionDenied`, `InvalidPath`, `Unsupported`, `Io`) para que la UI no dependa de códigos de Capacitor (`OS-PLUG-FILE-xxxx`).
`FileOperations` añade utilidades sobre el contrato (copia recursiva, borrado recursivo en backends sin soporte, escritura atómica `*.tmp` → rename). `ProjectStorage` sabe la estructura `Proyectos/<n>/{project.json,scenes,scripts,assets,animations,settings}`.

Un **conjunto de pruebas de contrato común** se ejecuta contra cada backend (Memory, IDB, FSA con Playwright; Android en dispositivo).

## 5. Capacitor
- `capacitor.config.json`: `appId` (D-003), `appName: NEBULON`, `webDir: www`.
- Dependencias: `@capacitor/core`, `@capacitor/android`, `@capacitor/filesystem` (+ `@capacitor/cli` dev). Otros plugins solo con justificación.
- Detección: `Capacitor.isNativePlatform()` en `platform/`. En navegador **no** se importa el plugin.
- Android: manifest con permisos heredados `READ/WRITE_EXTERNAL_STORAGE` limitados con `android:maxSdkVersion` a 29/28 (D-005); `density` en `configChanges`; gestión de insets edge-to-edge (SDK 36).

## 6. Compilación y CI
- Build web: ES modules + **Vite** (D-002, devDependency) → `www/`. Phaser se copia como asset (no se empaqueta).
- Workflow `.github/workflows/android-debug.yml`: checkout → Node 22 → JDK 21 (temurin) → `npm ci` → `npm run build` → `npx cap sync android` → `./gradlew assembleDebug` → `upload-artifact` con el APK.
- Firma de release: preparada con secretos (`ANDROID_KEYSTORE_B64`, `…_PASSWORD`, `…_ALIAS`) en tarea posterior; inicialmente solo debug.

## 7. Modelo de datos (resumen; se detallará en CORE-xxx)
- `Node`: `id` (UUID corto), `type`, `name`, `parent`, `children[]`, `properties{}`, `components[]`.
- Escena = árbol de Nodes + metadatos; serializable a JSON con `version` y migraciones.
- `viewport/` traduce cada tipo de Node a un objeto Phaser (Image, Sprite, Text, Container, Graphics, TileSprite…), sin que `core/` lo sepa.
- `project.json`: `{ formatVersion, name, id, created, modified, engine: {phaser: '4.2.1'}, mainScene, settings }`.

## 8. Decisiones (D-xxx)

| ID | Decisión | Estado |
|---|---|---|
| D-001 | Phaser como UMD `phaser.min.js` copiado a `vendor/`, no recompilado | Propuesta (por defecto) |
| D-002 | Vite como bundler/dev-server (única herramienta de build añadida) | **Pide tu aprobación** |
| D-003 | `appId`: `app.nebulon.editor` | **Pide tu aprobación** (no se puede cambiar sin fricción tras publicar) |
| D-004 | Carpeta `android/` generada por `cap add android` y **versionada en git** con parches reproducibles (script) | Propuesta |
| D-005 | Permisos heredados con `maxSdkVersion` | Propuesta |
| D-006 | UI del editor con DOM/CSS propio, sin framework (Phaser solo para el viewport) | Propuesta |
| D-007 | Pruebas unitarias con `node --test` (sin dependencias) y navegador con Playwright | Propuesta |
| D-008 | Estrategia de almacenamiento Android si KI-001/KI-002 se confirman (SAF vs Documents puro) | **Pendiente de prueba en dispositivo** |
