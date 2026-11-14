// Copia phaser.min.js (ya verificado) a <destino>/vendor/phaser/phaser.min.js.
// Uso: node tools/copy-vendor.js <directorio-destino>   (p. ej. public)
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { verify } from './verify-vendor.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');

export function copyVendor(destDir, root = projectRoot) {
  const r = verify(root);
  if (!r.ok) throw new Error('vendor/phaser no es copia fiel:\n- ' + r.errors.join('\n- '));
  const outDir = join(resolve(destDir), 'vendor', 'phaser');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, 'phaser.min.js');
  copyFileSync(join(root, 'vendor', 'phaser', '4.2.1', 'phaser.min.js'), out);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('uso: node tools/copy-vendor.js <directorio-destino>'); process.exit(2); }
  try { console.log('copiado:', copyVendor(process.argv[2])); }
  catch (e) { console.error(e.message); process.exit(1); }
}
