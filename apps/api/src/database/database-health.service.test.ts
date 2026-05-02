import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseHealthService, maskConnectionString } from './database-health.service';

test('marks database health as disabled when no connection string is configured', async () => {
  const service = new DatabaseHealthService();

  const result = await service.check({ connectionString: '' });

  assert.equal(result.status, 'disabled');
  assert.equal(result.message, 'DATABASE_URL is not configured');
});

test('masks database password in health payloads', () => {
  const masked = maskConnectionString('postgres://postgres:secret@localhost:5432/loongarch_b1');

  assert.equal(masked, 'postgres://postgres:***@localhost:5432/loongarch_b1');
});
