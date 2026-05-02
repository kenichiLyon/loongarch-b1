import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Client } from 'pg';

export interface MigrationFile {
  version: string;
  name: string;
  path: string;
  checksum: string;
  sql: string;
}

export interface MigrationRunnerOptions {
  connectionString?: string;
  migrationsDir?: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  appliedAt: Date;
}

const migrationFilePattern = /^(\d+)_(.+)\.sql$/;

export function defaultMigrationsDir() {
  return join(__dirname, '../../migrations');
}

export function checksumSql(sql: string) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function loadMigrationFiles(migrationsDir = defaultMigrationsDir()): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = entry.name.match(migrationFilePattern);
    if (!match) {
      continue;
    }

    const path = join(migrationsDir, entry.name);
    const sql = await readFile(path, 'utf8');
    migrations.push({
      version: match[1],
      name: match[2],
      path,
      checksum: checksumSql(sql),
      sql,
    });
  }

  return migrations.sort((left, right) => left.version.localeCompare(right.version));
}

export async function ensureMigrationTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function listAppliedMigrations(client: Client): Promise<AppliedMigration[]> {
  const result = await client.query<{
    version: string;
    name: string;
    checksum: string;
    applied_at: Date;
  }>('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC');

  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at,
  }));
}

export async function runMigrations(options: MigrationRunnerOptions = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationTable(client);
    const migrationFiles = await loadMigrationFiles(options.migrationsDir);
    const applied = new Map((await listAppliedMigrations(client)).map((migration) => [migration.version, migration]));
    const appliedVersions: string[] = [];
    const skippedVersions: string[] = [];

    for (const migration of migrationFiles) {
      const appliedMigration = applied.get(migration.version);
      if (appliedMigration) {
        if (appliedMigration.checksum !== migration.checksum) {
          throw new Error(`Migration ${migration.version} checksum mismatch. Refusing to continue.`);
        }
        skippedVersions.push(migration.version);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        appliedVersions.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return {
      applied: appliedVersions,
      skipped: skippedVersions,
      total: migrationFiles.length,
    };
  } finally {
    await client.end();
  }
}

async function runFromCli() {
  const result = await runMigrations();
  console.log(
    `Migrations complete: ${result.applied.length} applied, ${result.skipped.length} skipped, ${result.total} total.`,
  );
}

if (require.main === module && basename(process.argv[1]) === basename(__filename)) {
  runFromCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
