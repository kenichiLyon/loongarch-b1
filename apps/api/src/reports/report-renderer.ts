import type { ReportFormat, ReportType } from './reports.dto';

export interface ReportStatisticSummary {
  publishedCount: number;
  averageScore: number | null;
  minScore: number | null;
  maxScore: number | null;
}

export interface ReportMetricStatistic {
  rubricMetricId: string;
  metricName: string;
  averageFinalScore: number | null;
  averageTeacherScore: number | null;
  averageAiScore: number | null;
  averageRuleScore: number | null;
}

export interface ReportFindingStatistic {
  findingType: string;
  severity: string;
  count: number;
}

export interface ReportStatistics {
  generatedAt: string;
  filters: Record<string, string>;
  summary: ReportStatisticSummary;
  metrics: ReportMetricStatistic[];
  findings: ReportFindingStatistic[];
}

export interface RenderReportInput {
  reportType: ReportType;
  format: ReportFormat;
  statistics: ReportStatistics;
}

interface ZipEntry {
  name: string;
  content: Buffer;
}

const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function renderReportDocument(input: RenderReportInput) {
  if (input.format === 'xlsx') {
    return {
      buffer: renderXlsx(input),
      mimeType: xlsxMimeType,
      fileExtension: 'xlsx',
    };
  }

  return {
    buffer: renderPdf(input),
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
  };
}

function renderXlsx(input: RenderReportInput) {
  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      content: xmlBuffer(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      content: xmlBuffer(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      content: xmlBuffer(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Summary" sheetId="1" r:id="rId1"/>
    <sheet name="Metrics" sheetId="2" r:id="rId2"/>
    <sheet name="Findings" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: xmlBuffer(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: xmlBuffer(renderWorksheet(buildSummaryRows(input))),
    },
    {
      name: 'xl/worksheets/sheet2.xml',
      content: xmlBuffer(
        renderWorksheet([
          ['metricId', 'metricName', 'averageFinalScore', 'averageTeacherScore', 'averageAiScore', 'averageRuleScore'],
          ...input.statistics.metrics.map((metric) => [
            metric.rubricMetricId,
            metric.metricName,
            valueToCell(metric.averageFinalScore),
            valueToCell(metric.averageTeacherScore),
            valueToCell(metric.averageAiScore),
            valueToCell(metric.averageRuleScore),
          ]),
        ]),
      ),
    },
    {
      name: 'xl/worksheets/sheet3.xml',
      content: xmlBuffer(
        renderWorksheet([
          ['findingType', 'severity', 'count'],
          ...input.statistics.findings.map((finding) => [finding.findingType, finding.severity, String(finding.count)]),
        ]),
      ),
    },
  ];

  return zipStore(entries);
}

function buildSummaryRows(input: RenderReportInput) {
  return [
    ['reportType', input.reportType],
    ['generatedAt', input.statistics.generatedAt],
    ['publishedCount', String(input.statistics.summary.publishedCount)],
    ['averageScore', valueToCell(input.statistics.summary.averageScore)],
    ['minScore', valueToCell(input.statistics.summary.minScore)],
    ['maxScore', valueToCell(input.statistics.summary.maxScore)],
    ['filters', JSON.stringify(input.statistics.filters)],
  ];
}

function renderWorksheet(rows: string[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function renderPdf(input: RenderReportInput) {
  const lines = [
    `Report Type: ${input.reportType}`,
    `Generated At: ${input.statistics.generatedAt}`,
    `Published Count: ${input.statistics.summary.publishedCount}`,
    `Average Score: ${valueToCell(input.statistics.summary.averageScore)}`,
    `Min Score: ${valueToCell(input.statistics.summary.minScore)}`,
    `Max Score: ${valueToCell(input.statistics.summary.maxScore)}`,
    `Filters: ${JSON.stringify(input.statistics.filters)}`,
    '',
    'Metric Averages:',
    ...input.statistics.metrics.slice(0, 20).map((metric) => `${metric.metricName}: ${valueToCell(metric.averageFinalScore)}`),
    '',
    'Finding Counts:',
    ...input.statistics.findings.slice(0, 20).map((finding) => `${finding.findingType}/${finding.severity}: ${finding.count}`),
  ];
  const textCommands = lines
    .map((line, index) => `BT /F1 10 Tf 50 ${780 - index * 16} Td (${escapePdfText(asciiFallback(line))}) Tj ET`)
    .join('\n');
  const stream = Buffer.from(textCommands, 'ascii');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.byteLength} >>\nstream\n${stream.toString('ascii')}\nendstream`,
  ];

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets: number[] = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.concat(chunks).byteLength);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, 'ascii'));
  }
  const xrefOffset = Buffer.concat(chunks).byteLength;
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, 'ascii'));
  for (const offset of offsets.slice(1)) {
    chunks.push(Buffer.from(`${String(offset).padStart(10, '0')} 00000 n \n`, 'ascii'));
  }
  chunks.push(
    Buffer.from(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      'ascii',
    ),
  );
  return Buffer.concat(chunks);
}

function zipStore(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.content.byteLength, 18);
    localHeader.writeUInt32LE(entry.content.byteLength, 22);
    localHeader.writeUInt16LE(name.byteLength, 26);
    localParts.push(localHeader, name, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.content.byteLength, 20);
    centralHeader.writeUInt32LE(entry.content.byteLength, 24);
    centralHeader.writeUInt16LE(name.byteLength, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.byteLength + name.byteLength + entry.content.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function valueToCell(value: number | null) {
  return value === null ? '' : String(value);
}

function columnName(index: number) {
  let name = '';
  let current = index;
  while (current > 0) {
    current -= 1;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return name;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function xmlBuffer(value: string) {
  return Buffer.from(value, 'utf8');
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapePdfText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function asciiFallback(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 ? char : '?';
    })
    .join('');
}
