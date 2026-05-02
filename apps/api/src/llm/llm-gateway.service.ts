import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type LlmProvider = 'cloud' | 'local';

export interface LlmGatewayConfig {
  configured: boolean;
  provider: LlmProvider;
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
  hasApiKey: boolean;
}

export interface LlmJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LlmJsonResponse {
  provider: LlmProvider;
  modelName: string;
  inputHash: string;
  rawText: string;
  parsedJson: unknown;
  latencyMs: number;
}

@Injectable()
export class LlmGatewayService {
  getConfig(): LlmGatewayConfig {
    const baseUrl = (process.env.LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
    const modelName = (process.env.LLM_MODEL ?? '').trim();
    const provider = process.env.LLM_PROVIDER === 'local' ? 'local' : 'cloud';
    const timeoutMs = readPositiveInt('LLM_TIMEOUT_MS', 30_000);

    return {
      configured: Boolean(baseUrl && modelName && !baseUrl.includes('example.invalid')),
      provider,
      baseUrl,
      modelName,
      timeoutMs,
      hasApiKey: Boolean(process.env.LLM_API_KEY),
    };
  }

  isConfigured() {
    return this.getConfig().configured;
  }

  async requestJson(request: LlmJsonRequest): Promise<LlmJsonResponse> {
    const config = this.getConfig();
    if (!config.configured) {
      throw new Error('LLM Gateway is not configured');
    }

    const inputHash = buildLlmInputHash(request.systemPrompt, request.userPrompt);
    const started = Date.now();
    const response = await this.postChatCompletion(config, request);
    const rawText = readAssistantContent(response);

    return {
      provider: config.provider,
      modelName: config.modelName,
      inputHash,
      rawText,
      parsedJson: parseJsonContent(rawText),
      latencyMs: Date.now() - started,
    };
  }

  private async postChatCompletion(config: LlmGatewayConfig, request: LlmJsonRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.LLM_API_KEY) {
      headers.Authorization = `Bearer ${process.env.LLM_API_KEY}`;
    }

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.modelName,
          temperature: request.temperature ?? 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with HTTP ${response.status}`);
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildLlmInputHash(systemPrompt: string, userPrompt: string) {
  return createHash('sha256').update(`${systemPrompt}\n---\n${userPrompt}`, 'utf8').digest('hex');
}

export function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

function readAssistantContent(response: unknown) {
  const choices = (response as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM response did not include assistant JSON content');
  }
  return content;
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Math.floor(value);
}
