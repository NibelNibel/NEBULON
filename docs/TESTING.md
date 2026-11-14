# TESTING

## Convenciones
- Unitarias de lógica pura: `node --test` (D-007).
- Navegador: Playwright + Chromium.
- Android: prueba manual guiada en dispositivo real (no hay emulador en la sesión). Cada prueba manual indica versión de Android y resultado.
- Resultado: OK / FALLA / NO EJECUTADA. Nada se marca «probada» sin una ejecución registrada aquí.

## Registro

| ID | Fecha | Qué | Cómo | Resultado |
|---|---|---|---|---|
| T-AUD-001 | 2026-11-13 | `phaser.min.js`, `phaser-arcade-physics.min.js`, `phaser.js` (4.2.1) arrancan en Chromium con WebGL, `Phaser.VERSION==='4.2.1'`, sin errores de página; Matter solo en bundle completo | `NODE_PATH=$(npm root -g) node tools/audit/phaser-smoke.js third_party/phaser-4.2.1-src` | **OK** (Chromium headless, GL por software SwiftShader) |
| T-AUD-002 | 2026-11-13 | Android WebView real, Capacitor, Documents | — | **NO EJECUTADA** (sin dispositivo) |
| T-FND-001 | 2026-11-13 | Estructura del repo según ARCHITECTURE §3 (26 comprobaciones) y ausencia de dependencias | `npm test` | **OK** 26/26; con `src/ui` retirado falla (exit≠0), restaurado vuelve a OK |
| T-FND-002 | 2026-11-13 | `vendor/phaser/4.2.1` idéntico al original; el verificador detecta byte alterado, fichero extra y fichero faltante | `node tools/verify-vendor.js`; `npm test` (`tests/unit/vendor.test.js`); `cmp` contra `third_party/.../dist/phaser.min.js` | **OK** 30/30; alterado → exit 1; restaurado → exit 0 |
| T-FND-003a | 2026-11-13 | `index.html` + `src/main.js` + Phaser copiado: carga en Chromium sin errores/avisos de consola, 0 respuestas ≥400, `Phaser.VERSION==='4.2.1'`. Sirve estático, **sin Vite** | `NODE_PATH=$(npm root -g) npm run test:browser` | **OK**; sin `src/main.js` → FALLA (comprobado) |
| T-FND-003b | 2026-11-13 | `npm run build` (vite build) genera `www/` con index, JS y `vendor/phaser/phaser.min.js`; rutas relativas | `npm install && npm run build` | **NO EJECUTADA** (sin red). Verificar en CI o en máquina del usuario |
| T-AUD-003 | 2026-11-13 | Tests propios de Phaser (`vitest`) | — | **NO EJECUTADA** (sin red para instalar dependencias; no es necesaria para integrar el dist) |

## Plantilla de prueba manual Android (se rellenará en CI-003/CI-004)
1. Instalar APK de `artifacts`. 2. Anotar modelo y versión de Android. 3. Abrir app: ¿se ve «Phaser 4.2.1 · WebGL»? 4. Pantalla de diagnóstico: copiar el texto de resultados. 5. Cerrar y reabrir: ¿persisten los datos? 6. Desinstalar y reinstalar: ¿se ven los datos previos? (responde KI-001).
