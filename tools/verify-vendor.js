// Verifica que vendor/phaser/4.2.1 es copia fiel de la distribución original (FND-002).
// Uso: node tools/verify-vendor.js   (código de salida 0 = OK, 1 = discrepancias)
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function verify(root = join(here, '..')) {
  const errors = [];
  const base = join(root, 'vendor', 'phaser', '4.2.1');
  const sumsFile = join(root, 'vendor', 'phaser', 'CHECKSUMS.txt');
  if (!existsSync(sumsFile)) return { ok: false, errors: ['falta vendor/phaser/CHECKSUMS.txt'] };

  const expected = new Map();
  for (const line of readFileSync(sumsFile, 'utf8').split('\n').filter(Boolean)) {
    const m = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!m) { errors.push(`línea inválida en CHECKSUMS.txt: ${line}`); continue; }
    expected.set(m[2], m[1]);
  }
  for (const [file, hash] of expected) {
    const p = join(base, file);
    if (!existsSync(p)) errors.push(`falta ${file}`);
    else if (sha(p) !== hash) errors.push(`hash distinto: ${file}`);
  }
  if (existsSync(base)) {
    for (const p of walk(base)) {
      const rel = relative(base, p).split('\\').join('/');
      if (!expected.has(rel)) errors.push(`fichero no registrado: ${rel}`);
    }
  } else errors.push('falta vendor/phaser/4.2.1');

  // Contraste con el hash medido en la auditoría sobre el zip original.
  const audit = join(root, 'tools', 'audit', 'phaser-4.2.1.sha256');
  if (existsSync(audit)) {
    const m = readFileSync(audit, 'utf8').match(/^([0-9a-f]{64})  dist\/phaser\.min\.js$/m);
    if (!m) errors.push('auditoría sin hash de dist/phaser.min.js');
    else if (expected.get('phaser.min.js') !== m[1]) errors.push('phaser.min.js no coincide con el original auditado');
  } else errors.push('falta tools/audit/phaser-4.2.1.sha256');

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = verify();
  if (r.ok) console.log('vendor/phaser/4.2.1: OK (copia fiel del original)');
  else { console.error('vendor/phaser/4.2.1: FALLA\n- ' + r.errors.join('\n- ')); process.exit(1); }
}
