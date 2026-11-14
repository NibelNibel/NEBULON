import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verify } from '../../tools/verify-vendor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sandbox() {
  const d = mkdtempSync(join(tmpdir(), 'nebulon-vendor-'));
  cpSync(join(root, 'vendor'), join(d, 'vendor'), { recursive: true });
  cpSync(join(root, 'tools', 'audit'), join(d, 'tools', 'audit'), { recursive: true });
  return d;
}

test('vendor/phaser/4.2.1 es copia fiel', () => {
  const r = verify(root);
  assert.deepEqual(r.errors, []);
  assert.ok(r.ok);
});

test('detecta un byte alterado en phaser.min.js', () => {
  const d = sandbox();
  appendFileSync(join(d, 'vendor/phaser/4.2.1/phaser.min.js'), ' ');
  const r = verify(d);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('hash distinto: phaser.min.js')));
  rmSync(d, { recursive: true });
});

test('detecta fichero extra no registrado', () => {
  const d = sandbox();
  writeFileSync(join(d, 'vendor/phaser/4.2.1/extra.js'), 'x');
  assert.ok(verify(d).errors.some((e) => e.includes('no registrado: extra.js')));
  rmSync(d, { recursive: true });
});

test('detecta fichero faltante', () => {
  const d = sandbox();
  rmSync(join(d, 'vendor/phaser/4.2.1/LICENSE.md'));
  assert.ok(verify(d).errors.some((e) => e.includes('falta LICENSE.md')));
  rmSync(d, { recursive: true });
});
