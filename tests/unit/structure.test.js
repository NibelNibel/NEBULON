import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Estructura de ARCHITECTURE.md §3. android/ se genera en CI-002 y www/ en FND-003.
const dirs = [
  'docs', 'tools', 'vendor/phaser', 'public', 'tests/unit', 'tests/browser', '.github/workflows',
  'src/platform', 'src/storage', 'src/core', 'src/projects', 'src/editor', 'src/viewport', 'src/runtime', 'src/ui',
];
const files = ['HANDOFF.md', 'README.md', 'package.json', '.gitignore',
  'docs/ENGINE_AUDIT.md', 'docs/ARCHITECTURE.md', 'docs/ROADMAP.md', 'docs/PROGRESS.md', 'docs/KNOWN_ISSUES.md', 'docs/TESTING.md'];

for (const d of dirs) {
  test(`existe el directorio ${d}`, () => {
    assert.ok(existsSync(join(root, d)) && statSync(join(root, d)).isDirectory());
  });
}
for (const f of files) {
  test(`existe el archivo ${f}`, () => {
    assert.ok(existsSync(join(root, f)) && statSync(join(root, f)).isFile());
  });
}
test('package.json no declara dependencias todavía', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
