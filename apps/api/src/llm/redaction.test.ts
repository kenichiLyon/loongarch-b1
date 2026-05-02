import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceSummary, redactSensitiveText } from './redaction';

test('redacts emails, phones, and long numeric identifiers', () => {
  const redacted = redactSensitiveText('张三 202312345678 test@example.edu 13812345678 保留普通数字 123');

  assert.match(redacted, /\[REDACTED_ID\]/);
  assert.match(redacted, /\[REDACTED_EMAIL\]/);
  assert.match(redacted, /\[REDACTED_PHONE\]/);
  assert.match(redacted, /123$/);
});

test('builds bounded evidence summary from extracted contents', () => {
  const summary = buildEvidenceSummary(
    [
      {
        sourceRef: 'artifact.md#text',
        contentKind: 'text',
        contentText: 'hello 13812345678 world',
      },
    ],
    40,
  );

  assert.equal(summary.truncated, true);
  assert.match(summary.text, /Evidence 1/);
  assert.equal(summary.originalCharCount, 23);
});
