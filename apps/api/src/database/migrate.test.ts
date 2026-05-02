import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checksumSql, loadMigrationFiles } from './migrate';

test('loads SQL migration files in version order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'loongarch-b1-migrations-'));
  try {
    await writeFile(join(dir, '002_second.sql'), 'SELECT 2;\n', 'utf8');
    await writeFile(join(dir, '001_initial.sql'), 'SELECT 1;\n', 'utf8');
    await writeFile(join(dir, 'README.md'), 'ignored', 'utf8');

    const migrations = await loadMigrationFiles(dir);

    assert.deepEqual(
      migrations.map((migration) => migration.version),
      ['001', '002'],
    );
    assert.equal(migrations[0].name, 'initial');
    assert.equal(migrations[1].name, 'second');
    assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('creates stable SQL checksums', () => {
  assert.equal(checksumSql('SELECT 1;'), checksumSql('SELECT 1;'));
  assert.notEqual(checksumSql('SELECT 1;'), checksumSql('SELECT 2;'));
});
