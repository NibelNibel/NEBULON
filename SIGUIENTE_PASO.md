# NEBULON — Qué sigue (guía para ti)

Fecha: 2026-11-13 (actualizado tras STO-001). Este archivo es para la persona; el resumen para cualquier IA es `HANDOFF.md`.

## Dónde estamos
- Hecho y probado: estructura del repo, Phaser 4.2.1 vendorizado con verificación de integridad, y una página que arranca Phaser en Chromium mostrando «Phaser 4.2.1 · WebGL» (`npm test` y `npm run test:browser`).
- Hecho pero **sin verificar**: el build con Vite (`npm run build`). No pude ejecutarlo porque mi entorno no tiene red.
- Hecho y probado también: el **contrato de almacenamiento** (`src/storage/`: errores normalizados y operaciones que deberán cumplir todos los backends). Aún no hay ningún backend real.
- No existe todavía: editor, almacenamiento, proyectos, Capacitor, APK. Nada de eso está simulado.

## Lo que necesito de ti (cuando puedas)
1. **Verificar el build.** En un PC con Node 22.12+ (o en GitHub Codespaces):
   ```
   unzip nebulon-proyecto-*.zip && cd nebulon
   npm install
   npm run build
   ```
   Comprueba que existe `www/index.html` y `www/vendor/phaser/phaser.min.js`. Si todo va bien, sube a Git el `package-lock.json` que se genera. Si falla, copia el error completo en la próxima conversación.
2. **Crear el repositorio en GitHub** y subir el proyecto (el zip incluye la carpeta `.git` con el historial). El APK se genera allí.
3. **Confirmar el `appId`** de Android. Propuesta: `app.nebulon.editor` (D-003). Es difícil de cambiar tras publicar.
4. **Opcional:** si tienes el «bundle minificado» anterior de Phaser, adjúntalo para compararlo con el del zip.

## Próximas tareas (una por vez, tú autorizas cada una)
| Orden | Tarea | Qué consigue |
|---|---|---|
| 1 | CI-001 | Capacitor 8 en el proyecto (necesita D-003 y red para instalar) |
| 2 | CI-002 | Carpeta `android/` con permisos y ajustes para SDK 36 |
| 3 | CI-003 | Workflow de GitHub Actions que genera el APK de depuración |
| 4 | CI-004 | Pantalla de **diagnóstico de almacenamiento**: prueba de verdad crear/leer/borrar en `Documents/Nebulon/` en tu teléfono |
| ahora | STO-002 → STO-005 | Rutas seguras, backend en memoria, suite de contrato y utilidades (no necesitan red; es lo que haré mientras CI-001 espera tu confirmación) |
| 5 | STO-006… | Backends reales: IndexedDB, carpeta del navegador, Android |

**La tarea más importante para ti es CI-004.** En Android 11+ la carpeta pública `Documents` solo es accesible a lo que la propia app creó; puede que haya que usar otro mecanismo (Storage Access Framework). Tu prueba en el teléfono decide eso (KI-001/002/003 en `docs/KNOWN_ISSUES.md`).

## Cómo continuar en otra conversación
Adjunta este zip (y, si quieres compararlo, el zip original de Phaser) y escribe algo como:
> Continúa NEBULON. Lee primero HANDOFF.md y sigue su apartado H. Haz solo la tarea indicada en «Próxima tarea», prueba, actualiza la documentación y detente.

## Notas
- El zip no incluye el código fuente completo de Phaser (71 MB, carpeta `third_party/`, ignorada por Git). La copia necesaria para ejecutar está en `vendor/phaser/4.2.1/`. Conserva tu zip original de Phaser.
- Las pruebas de navegador usan Playwright: `NODE_PATH=$(npm root -g) npm run test:browser` en mi entorno; en el tuyo hará falta instalar Playwright (aún no es dependencia del proyecto).
