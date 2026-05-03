import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReportExportJobPayload } from './report-export-worker.service';

test('validates report export worker payloads', () => {
  assert.deepEqual(parseReportExportJobPayload({ exportId: 'export-id' }), {
    exportId: 'export-id',
  });

  assert.throws(() => parseReportExportJobPayload({ submissionId: 'submission-id' }), /Invalid export_report job payload/);
});
