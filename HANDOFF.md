# HANDOFF — Punto de entrada para cualquier IA que continúe NEBULON

Última actualización: 2026-11-13 · Sesión 1 · Idioma de trabajo con el usuario: **español**.

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
- **Implementado**: nada del producto. Repositorio Git inicial con documentación y `tools/audit/phaser-smoke.js`.
- **Incompleto**: —
- **Pendiente**: todo (ver ROADMAP).
- **Estado real**: fase de auditoría y planificación terminada; falta aprobación de decisiones D-002 y D-003 para arrancar F0.

## C. Progreso de tareas
- Terminadas (documentales): AUD-001, AUD-002 (probadas); AUD-003, DOC-001, PLAN-001 (sin verificar por humano).
- En desarrollo: ninguna.
- Pendientes: F0 (FND-001…CI-004), F1…F8 (ver ROADMAP).
- Bloqueadas: AUD-004 (no se recibió el «bundle minificado existente»).

## D. Última sesión (1)
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
- **Identificador**: FND-001 — Esqueleto del repositorio.
- **Objetivo**: `package.json` mínimo, `README.md`, estructura de carpetas (ARCHITECTURE §3), scripts `build`/`test` triviales.
- **Revisar antes**: `docs/ARCHITECTURE.md` §3, `docs/ROADMAP.md` (F0).
- **Implementación esperada**: solo ficheros de estructura; sin lógica.
- **Criterios**: `npm run test` sale con 0; árbol coincide con ARCHITECTURE §3.
- **Pruebas**: ejecutar scripts; revisar árbol; registrar en TESTING.md.
- **Bloqueo previo**: ninguno para FND-001/FND-002. FND-003 necesita que el usuario apruebe D-002; CI-001 necesita D-003.
