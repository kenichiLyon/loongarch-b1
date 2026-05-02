import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseService } from '../database/database.service';
import { AuditService } from './audit.service';

test('records audit events with json details', async () => {
  const seen: { sql: string; params: readonly unknown[] }[] = [];
  const service = new AuditService(
    fakeDatabase(async (sql, params) => {
      seen.push({ sql, params });
      return {
        rows: [
          {
            id: 'audit-1',
            actorId: params[0],
            action: params[1],
            entityType: params[2],
            entityId: params[3],
            detailJson: JSON.parse(String(params[4])),
            createdAt: '2026-05-02T00:00:00.000Z',
          },
        ],
      };
    }),
  );

  const row = await service.record({
    actorId: '00000000-0000-0000-0000-000000000001',
    action: 'artifact.uploaded',
    entityType: 'artifact',
    entityId: '00000000-0000-0000-0000-000000000002',
    detail: { submissionId: 'submission-1' },
  });

  assert.equal(row.action, 'artifact.uploaded');
  assert.equal(row.detailJson.submissionId, 'submission-1');
  assert.match(seen[0].sql, /INSERT INTO audit_logs/);
});

test('lists audit logs with bounded filters', async () => {
  const seen: { sql: string; params: readonly unknown[] }[] = [];
  const service = new AuditService(
    fakeDatabase(async (sql, params) => {
      seen.push({ sql, params });
      return { rows: [] };
    }),
  );

  await service.listAuditLogs({
    action: 'artifact.parse_succeeded',
    entityType: 'artifact',
    limit: 500,
  });

  assert.match(seen[0].sql, /WHERE al.action = \$1 AND al.entity_type = \$2/);
  assert.equal(seen[0].params.at(-1), 200);
});

function fakeDatabase(query: (sql: string, params: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  return {
    query,
  } as unknown as DatabaseService;
}
