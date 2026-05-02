import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseService } from './database.service';

test('requires DATABASE_URL before running queries', async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const service = new DatabaseService();

  await assert.rejects(() => service.query('SELECT 1'), /DATABASE_URL is required/);

  if (original === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = original;
  }
});
