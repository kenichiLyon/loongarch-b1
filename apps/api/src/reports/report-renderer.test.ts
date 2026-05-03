import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReportDocument, type ReportStatistics } from './report-renderer';

const statistics: ReportStatistics = {
  generatedAt: '2026-05-03T00:00:00.000Z',
  filters: { courseId: '00000000-0000-0000-0000-000000000001' },
  summary: {
    publishedCount: 2,
    averageScore: 88.5,
    minScore: 77,
    maxScore: 100,
  },
  metrics: [
    {
      rubricMetricId: 'metric-1',
      metricName: '功能实现度',
      averageFinalScore: 90,
      averageTeacherScore: 91,
      averageAiScore: 86,
      averageRuleScore: 80,
    },
  ],
  findings: [{ findingType: 'requirement', severity: 'warning', count: 3 }],
};

test('renders xlsx report as an OpenXML zip payload', () => {
  const result = renderReportDocument({ reportType: 'course', format: 'xlsx', statistics });

  assert.equal(result.fileExtension, 'xlsx');
  assert.equal(result.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(result.buffer.subarray(0, 4).toString('hex'), '504b0304');
  assert.equal(result.buffer.includes(Buffer.from('xl/workbook.xml')), true);
  assert.equal(result.buffer.includes(Buffer.from('<c r="C2"><v>90</v></c>')), true);
});

test('renders pdf report as a minimal PDF payload', () => {
  const result = renderReportDocument({ reportType: 'course', format: 'pdf', statistics });

  assert.equal(result.fileExtension, 'pdf');
  assert.equal(result.mimeType, 'application/pdf');
  assert.equal(result.buffer.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.equal(result.buffer.includes(Buffer.from('Report Type: course')), true);
});
