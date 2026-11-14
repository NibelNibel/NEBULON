# ENGINE_AUDIT — Auditoría de la base tecnológica

Fecha: 2026-11-13 · Sesión: 1 · Estado: auditoría inicial completada (solo lectura; no se escribió código de NEBULON).

Los hechos marcados **[VERIFICADO]** se comprobaron ejecutando código o leyendo ficheros en esta sesión. **[FUENTE]** = tomado de documentación oficial (URL en la sección 7). **[NO VERIFICADO]** = requiere prueba en dispositivo o CI.

---

## 1. Distribución de Phaser 4.2.1 recibida

Archivo: `phaser-4.2.1.zip` (17,9 MB), SHA-256 `3381e1ebe7e3802332d5f326e60dfbe57697f0b9f8f3bee1f406ce2474a139da`.
Extraído (sin modificar) en `third_party/phaser-4.2.1-src/` (ignorado por git; 3 608 ficheros, 71 MB). **El zip original es la copia intacta de referencia.**

- `package.json`: nombre `phaser`, versión **4.2.1** («Giedi», 9 jul 2026), licencia MIT. Única dependencia de runtime: `eventemitter3 ^5`. **[VERIFICADO]**
- `.nvmrc`: Node 24.8.0 (solo para compilar Phaser; NEBULON no necesita recompilarlo).
- `src/const.js`: `VERSION: '4.2.1'`.

### Contenido de `dist/`

| Fichero | Tamaño | Formato | SHA-256 (inicio) |
|---|---|---|---|
| `phaser.min.js` | 1,38 MB | UMD, minificado (ES5) | 66348b1b… |
| `phaser.js` | 8,5 MB | UMD, sin minificar | 5fbaf1df… |
| `phaser.esm.min.js` | 1,38 MB | ES module, minificado | f4c5fd14… |
| `phaser.esm.js` | 8,5 MB | ES module | 9df0086f… |
| `phaser-arcade-physics.min.js` | 1,27 MB | UMD, sin Matter | 744c12f7… |
| `phaser-arcade-physics.js` | 7,9 MB | UMD, sin Matter | 1b01b255… |

Hashes completos: `tools/audit/phaser-4.2.1.sha256`.

### Prueba de humo **[VERIFICADO]** (`tools/audit/phaser-smoke.js`)

Chromium headless (Playwright, SwiftShader), `new Phaser.Game({type: WEBGL})`: los tres bundles UMD (`phaser.min.js`, `phaser-arcade-physics.min.js`, `phaser.js`) devuelven `Phaser.VERSION === '4.2.1'`, crean contexto WebGL, ejecutan `Scene.create()` sin errores. `Phaser.Physics.Matter` existe solo en el bundle completo.

### ⚠ Punto abierto: «bundle minificado existente»
Tu mensaje habla de un bundle minificado que «ya tienes». **En esta sesión no recibí ningún bundle separado**; solo el contenido del zip. No puedo establecer diferencias con el bundle anterior. El `dist/phaser.min.js` del zip sí es 4.2.1. Si tienes otro bundle, adjúntalo y compararé SHA-256 y `Phaser.VERSION`. Hasta entonces **la referencia es `dist/` del zip**.

## 2. Estructura de `src/` (líneas de JS aprox.)

| Módulo | Ficheros | Líneas | Relevancia para NEBULON |
|---|---|---|---|
| `gameobjects` | 458 | 62k | **Alta**: base del renderizado de nodos (Image, Sprite, Text, BitmapText, Graphics, Shape, Container, Layer, TileSprite, NineSlice, Zone, Particles, Video, DOMElement, Rope, Mesh2D, Noise, Gradient, Stamp, SpriteGPULayer, TilemapGPULayer, CaptureFrame…) |
| `renderer` | 220 | 28k | Media: WebGL (RenderNodes) y Canvas. No tocar |
| `physics` | 165 | 33k | **Alta**: Arcade + Matter |
| `tilemaps` | 128 | 14k | Media-alta (editor de tilemaps, fase posterior) |
| `input`, `loader`, `textures`, `animations`, `tweens`, `cameras`, `scene`, `sound`, `scale`, `geom`, `math`, `curves`, `data`, `time`, `filters` | — | — | Usados por el runtime; el editor los consume vía `Phaser.*` |
| `device`, `core`, `plugins`, `structs`, `utils`, `actions`, `cache`, `dom`, `events`, `polyfills` | — | — | Infraestructura |

Puntos de entrada de compilación: `src/phaser.js` (completo), `phaser-arcade-physics.js`, `phaser-no-physics.js`, `phaser-core.js` (solo Image/Sprite/Text/Graphics/Layer), `phaser-esm.js`. Flags en webpack: `CANVAS_RENDERER`, `WEBGL_RENDERER`, `WEBGL_DEBUG`, `FEATURE_SOUND`.

Documentación útil incluida en el zip, **leer antes de tocar el renderizado**: `skills/*/SKILL.md` (28 guías: escenas, game objects, físicas, tilemaps, animaciones, v3→v4…), `docs/` (Rendering Concepts, Internal Space, Pixel Art…), `types/phaser.d.ts` (para autocompletado de scripts futuros), `changelog/v4/`.

## 3. Cambios de Phaser 4 que condicionan el diseño **[FUENTE: skills/v4-new-features del zip]**

- Pipelines → **RenderNodes**; FX/BitmapMask → **Filters/FilterMask** (`obj.enableFilters()`; `filters.internal|external`).
- **Eliminados**: `Mesh`, `Plane` (hay `Mesh2D`), `Point` (usar `Vector2`). No hay 3D (coincide con tu restricción).
- Orientación GL estándar (Y=0 abajo en texturas).
- Nuevos objetos útiles para un editor 2D: `Stamp`, `Gradient`, `Noise*`, `SpriteGPULayer`, `TilemapGPULayer`, `Lighting` (componente).
- Contexto: **WebGL 1** (`canvas.getContext('webgl')`) con renderizador Canvas como alternativa. **[VERIFICADO en código]**

## 4. Qué se aprovecha y qué no

| Decisión | Detalle |
|---|---|
| **Usar** `dist/phaser.min.js` (UMD) como runtime del editor y de juegos exportados | Se copiará a `vendor/phaser/4.2.1/` (tarea FND-002) y se cargará con `<script>`. Evita incluir 8 MB ni 3 600 ficheros en la app |
| **Usar** `dist/phaser.esm.min.js` solo si un día se adopta bundler que lo requiera | Alternativa documentada, no necesaria hoy |
| **Usar** `types/phaser.d.ts` | Referencia para el editor de scripts |
| **No copiar** `src/` en la app | Solo consulta. Reconstruir Phaser solo si hay una razón técnica documentada (p. ej. build sin Matter para reducir peso) |
| **No modificar** Phaser | Extensiones de NEBULON van en `src/` propio mediante plugins/subclases |
| Variante `arcade-physics` (−110 KB) | Candidata para juegos exportados que no usen Matter (optimización futura) |

Dependencias de runtime de Phaser: solo `eventemitter3` (ya incluido en el bundle). **[VERIFICADO]**

## 5. Compatibilidad Android / Chromium

- **[VERIFICADO]** Phaser 4.2.1 arranca en Chromium (headless, GL por software).
- **[NO VERIFICADO]** Rendimiento y WebGL en Android WebView real: se probará con el APK mínimo (CI-002/CI-003). Capacitor 8 documenta que en WebView Chromium ≥140 `viewport-fit=cover` informa `env(safe-area-inset-*)` reales; con WebViews anteriores los valores son `0px` **[FUENTE]**.
- Phaser compila a ES5 (UMD) → sin riesgo de sintaxis en WebViews antiguos; el código propio de NEBULON puede usar ES2020+ pero debe validarse en el WebView mínimo soportado (minSdk 24 → WebView actualizable por Play).

## 6. Capacitor 8 — requisitos y almacenamiento Android

### Requisitos de toolchain **[FUENTE]**
Node ≥ 22, JDK 21 (con JDK 17 falla «invalid source release: 21»), Gradle wrapper 8.14.3, AGP 8.13.0, Kotlin 2.2.20 (si se usa), **minSdk 24, compileSdk/targetSdk 36**. Edge-to-edge obligatorio con target 36 (hay que gestionar insets; plugin SystemBars incluido en core, `insetsHandling: css|native|disable`). Añadir `density` a `android:configChanges`. Sintaxis Gradle con `=`.
Implicación para GitHub Actions: runner con **Node 22+ y JDK 21 (`actions/setup-java`, temurin)**.

### `@capacitor/filesystem` y el directorio Documents **[FUENTE: capacitorjs.com/docs/apis/filesystem]**
- `Directory.Documents` = carpeta pública Documents. «No accesible en Android 10 sin almacenamiento externo heredado. **En Android 11+, solo archivos y carpetas creados por la propia app.**»
- `Directory.ExternalStorage`: solo Android ≤ 9.
- `checkPermissions()/requestPermissions()` devuelven `publicStorage` y solo aplican con `Documents`/`ExternalStorage`. Android ≤ 10 requiere declarar `READ/WRITE_EXTERNAL_STORAGE` en el manifest.
- Operaciones disponibles: `mkdir(recursive)`, `writeFile(recursive, encoding)`, `readFile`, `appendFile`, `readdir` (**no recursivo**), `stat`, `rename`, `copy` (con `toDirectory`), `deleteFile`, `rmdir(recursive)`. `writeFile` sin `encoding` exige Base64; `Blob` solo en web. Errores: OS-PLUG-FILE-0007 (permiso denegado), -0010 (ya existe), -0011 (falta padre), -0012 (dir no vacío).

### Matriz de comportamiento esperado de `Documents/Nebulon/`

| Android | Estado esperado | Notas |
|---|---|---|
| ≤ 9 (API ≤ 28) | Funciona con permisos heredados `WRITE_EXTERNAL_STORAGE` + `requestPermissions()` | **[NO VERIFICADO]** |
| 10 (API 29) | Solo con `requestLegacyExternalStorage="true"` en el manifest (la app debe apuntar a SDK ≤29 para que sea efectivo; con targetSdk 36 el flag se ignora) | ⚠ Con target 36 **probablemente no funcione** — **[NO VERIFICADO]**, requiere prueba |
| 11+ (API 30+) | `Documents/Nebulon/` se puede crear y la app accede **solo a lo que ella creó**. Sin permisos de runtime útiles | **[FUENTE]** |

### Riesgos reales del requisito «Documents/Nebulon/» (decisiones pendientes, ver KNOWN_ISSUES KI-001…KI-003)
1. **Propiedad de los ficheros**: en Android 11+ los ficheros creados por la app en carpetas públicas pertenecen a esa app. Tras **desinstalar/reinstalar** (o cambiar de firma, p. ej. APK de depuración → firmado) es probable que **la nueva instalación no pueda ver los proyectos previos**. **[NO VERIFICADO — no aparece en la documentación consultada]**; hay que probarlo en un teléfono.
2. **Importar recursos del usuario** (imágenes, audio puestos manualmente en Documents/Nebulon): en Android 11+ no serán visibles para la app. Se necesita un selector de ficheros (SAF `ACTION_OPEN_DOCUMENT`) para importar.
3. **Alternativa sólida si 1/2 se confirman**: Storage Access Framework con `ACTION_OPEN_DOCUMENT_TREE` + `takePersistableUriPermission()` (el usuario elige `Documents/Nebulon` una vez y la app conserva el acceso a todo su contenido). Requiere plugin nativo propio o de terceros (Capawesome File Picker/File Manager; File Manager es de pago). Candidata a plugin propio mínimo en Kotlin (tarea STO-xx futura).
4. Mitigación de diseño ya prevista: la API `StorageBackend` permite tener varios backends (`AndroidDocuments`, `AndroidSAF`, `BrowserFSA`, `BrowserIDB`) intercambiables sin tocar el editor.

### Navegador
File System Access API (`showDirectoryPicker`) solo Chromium con contexto seguro; handles persistibles en IndexedDB y permiso re-solicitable. **[NO VERIFICADO en esta sesión; se probará con Playwright en STO-0xx]**.

## 7. Limitaciones del entorno de esta sesión
- Sin red desde la shell: no se puede `npm install`, así que **aquí no se ejecutó Capacitor, Vite ni Gradle**. La primera validación real de la cadena Capacitor/Android será GitHub Actions y tu teléfono.
- No hay emulador ni dispositivo Android en esta sesión.

## 8. Fuentes
- [Capacitor Filesystem API](https://capacitorjs.com/docs/apis/filesystem)
- [Updating plugins to Capacitor 8](https://capacitorjs.com/docs/updating/plugins/8-0)
- [Upgrade app to Capacitor 8 (Capgo)](https://capgo.app/blog/upgrade-capacitor-app-to-capacitor-8/)
- [Android scoped storage in Capacitor apps (Capawesome)](https://capawesome.io/blog/android-scoped-storage-in-capacitor-apps/)
- Zip de Phaser 4.2.1 proporcionado (`package.json`, `src/`, `dist/`, `skills/v4-new-features`, `changelog/v4/4.2.1`).
