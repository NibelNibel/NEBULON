# KNOWN_ISSUES

| ID | Tipo | Descripción | Estado | Acción |
|---|---|---|---|---|
| KI-001 | Riesgo/Android | En Android 11+ `Directory.Documents` solo da acceso a ficheros **creados por la propia app**. Tras desinstalar/reinstalar o cambiar de firma (debug→release) la nueva instalación podría no ver proyectos anteriores. | Abierto — **no verificado** | Probar en teléfono con CI-004; decidir D-008 |
| KI-002 | Limitación/Android | Los recursos que el usuario copie manualmente a `Documents/Nebulon/` no serán visibles en Android 11+. Se necesita un selector (SAF) para importar. | Abierto — por documentación | Diseñar importación con selector (RES-002) |
| KI-003 | Riesgo/Android 10 | Con targetSdk 36 el flag `requestLegacyExternalStorage` no tiene efecto; `Documents` en Android 10 podría no funcionar. | Abierto — **no verificado** | Probar en Android 10 si hay dispositivo; si no, documentar como no soportado o usar SAF |
| KI-004 | Entorno | Sin red en la shell de la sesión: no se pueden instalar paquetes ni ejecutar Capacitor/Gradle aquí. | Permanente en este entorno | Validar en GitHub Actions y teléfono |
| KI-005 | Información | No se recibió el «bundle minificado existente» mencionado; no hay comparación de distribuciones. | Abierto | Adjuntar bundle si difiere del zip |
| KI-006 | Información | El `dist/phaser.js` sin minificar contiene comentarios JSDoc con «v3.60» heredados; son texto, no versión. `Phaser.VERSION` es 4.2.1 (verificado). | Cerrado (informativo) | — |
| KI-007 | Compatibilidad | Capacitor 8 exige JDK 21 y Node ≥ 22; con target 36 el edge-to-edge es obligatorio (insets). | Abierto | Tratar en CI-002/CI-003 y UI-001 |
| KI-008 | Compatibilidad | Phaser 4 usa contexto `webgl` (v1) con fallback Canvas. Rendimiento en WebView real sin medir. | Abierto — no verificado | Medir con APK de CI-003 |
| KI-009 | Verificación | `vite build` y `npm install` no se han ejecutado nunca (sin red). Versión de Vite `^7.0.0` sin confirmar contra el registro; no existe `package-lock.json`, por lo que `npm ci` fallará: usar `npm install` y **commitear el lock generado**. La ruta `/vendor/phaser/phaser.min.js` con `base: './'` debe comprobarse en `www/index.html`. | Abierto | Primer `npm install && npm run build` en CI/PC del usuario |
| KI-010 | Riesgo | `writeFileAtomic` solo es tan atómica como el `rename` del backend y deja una ventana breve sin destino entre `rename(dest→bak)` y `rename(tmp→dest)`; `recoverAtomicWrites` debe llamarse al abrir un proyecto/directorio. En Android (`Filesystem.rename`, SAF) y en IndexedDB/FSA la atomicidad real no está medida. | Abierto — **no verificado en backends reales** | Medir en STO-006/007/008; llamar a recover en STO-011/PRJ-xxx |

Decisiones pendientes: D-003, D-008 (ver ARCHITECTURE §8).
