import { defineConfig } from 'vite';

// public/vendor/ lo genera tools/copy-vendor.js (ver scripts de package.json) y Vite lo copia a www/.
export default defineConfig({
  base: './',            // rutas relativas: necesario para Capacitor (WebView) y para abrir www/ desde cualquier carpeta
  publicDir: 'public',
  build: { outDir: 'www', emptyOutDir: true, target: 'es2020' },
});
