import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EvaluationWorkerService } from '../evaluation/evaluation-worker.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const worker = app.get(EvaluationWorkerService);
  const workerId = process.env.JOB_WORKER_ID ?? `evaluation-worker-${process.pid}`;
  const batchSize = readPositiveInt('JOB_BATCH_SIZE', 5);
  const retryDelaySeconds = readPositiveInt('JOB_RETRY_DELAY_SECONDS', 30);
  const staleAfterSeconds = readPositiveInt('JOB_STALE_AFTER_SECONDS', 15 * 60);
  const pollIntervalMs = readPositiveInt('JOB_POLL_INTERVAL_MS', 2000);
  const runOnce = process.env.JOB_RUN_ONCE === 'true';

  try {
    let keepRunning = true;
    while (keepRunning) {
      const result = await worker.processBatch({ workerId, batchSize, retryDelaySeconds, staleAfterSeconds });
      console.log(JSON.stringify({ workerId, ...result, timestamp: new Date().toISOString() }));

      if (runOnce) {
        keepRunning = false;
      } else {
        await sleep(result.claimed > 0 ? 0 : pollIntervalMs);
      }
    }
  } finally {
    await app.close();
  }
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Math.floor(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
