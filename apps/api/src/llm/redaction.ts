export interface ExtractedEvidence {
  sourceRef: string;
  contentKind: string;
  contentText: string;
}

export interface EvidenceSummary {
  text: string;
  originalCharCount: number;
  redactedCharCount: number;
  truncated: boolean;
}

const defaultMaxEvidenceChars = 24_000;

export function redactSensitiveText(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '[REDACTED_PHONE]')
    .replace(/(?<!\d)\d{8,18}(?!\d)/g, '[REDACTED_ID]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildEvidenceSummary(contents: ExtractedEvidence[], maxChars = readEvaluationMaxContextChars()): EvidenceSummary {
  const lines = contents.map((content, index) => {
    const redacted = redactSensitiveText(content.contentText);
    return `Evidence ${index + 1} [${content.contentKind}] ${content.sourceRef}: ${redacted}`;
  });
  const joined = lines.join('\n');
  const originalCharCount = contents.reduce((sum, content) => sum + content.contentText.length, 0);

  if (joined.length <= maxChars) {
    return {
      text: joined,
      originalCharCount,
      redactedCharCount: joined.length,
      truncated: false,
    };
  }

  return {
    text: joined.slice(0, maxChars),
    originalCharCount,
    redactedCharCount: maxChars,
    truncated: true,
  };
}

export function readEvaluationMaxContextChars() {
  const configured = Number(process.env.EVALUATION_MAX_CONTEXT_CHARS ?? defaultMaxEvidenceChars);
  if (!Number.isFinite(configured) || configured <= 0) {
    throw new Error('EVALUATION_MAX_CONTEXT_CHARS must be a positive number');
  }
  return Math.floor(configured);
}
