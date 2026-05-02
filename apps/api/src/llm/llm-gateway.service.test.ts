import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLlmInputHash, LlmGatewayService, parseJsonContent } from './llm-gateway.service';

test('parses plain and fenced JSON content', () => {
  assert.deepEqual(parseJsonContent('{"ok":true}'), { ok: true });
  assert.deepEqual(parseJsonContent('```json\n{"ok":true}\n```'), { ok: true });
});

test('builds stable input hashes', () => {
  assert.equal(buildLlmInputHash('system', 'user'), buildLlmInputHash('system', 'user'));
  assert.notEqual(buildLlmInputHash('system', 'user'), buildLlmInputHash('system', 'other'));
});

test('calls OpenAI-compatible chat completions endpoint with optional bearer token', async () => {
  await withLlmEnv(async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    let requestedHeaders: Record<string, string> = {};
    try {
      globalThis.fetch = (async (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = init?.headers as Record<string, string>;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"totalAiScore":80,"metricScores":[],"findings":[]}' } }],
          }),
        } as Response;
      }) as typeof fetch;

      const result = await new LlmGatewayService().requestJson({
        systemPrompt: 'system',
        userPrompt: 'user',
      });

      assert.equal(requestedUrl, 'https://llm.example/v1/chat/completions');
      assert.equal(requestedHeaders.Authorization, 'Bearer test-key');
      assert.deepEqual(result.parsedJson, { totalAiScore: 80, metricScores: [], findings: [] });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

async function withLlmEnv(run: () => Promise<void>) {
  const previous = {
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS,
  };
  process.env.LLM_BASE_URL = 'https://llm.example/v1';
  process.env.LLM_MODEL = 'unit-test-model';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_TIMEOUT_MS = '1000';
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
