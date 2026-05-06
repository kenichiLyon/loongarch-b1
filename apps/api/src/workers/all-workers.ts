import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EvaluationWorkerService } from '../evaluation/evaluation-worker.service';
import { ReportExportWorkerService } from '../reports/report-export-worker.service';
import { ParseWorkerService } from './parse-worker.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const parseWorker = app.get(ParseWorkerService);
  const evaluationWorker = app.get(EvaluationWorkerService);
  const exportWorker = app.get(ReportExportWorkerService);
  const runOnce = process.env.JOB_RUN_ONCE === 'true';
  const retryDelaySeconds = readPositiveInt('JOB_RETRY_DELAY_SECONDS', 30);
  const staleAfterSeconds = readPositiveInt('JOB_STALE_AFTER_SECONDS', 15 * 60);
  const pollIntervalMs = readPositiveInt('JOB_POLL_INTERVAL_MS', 2000);
  let keepRunning = true;

  const stop = () => {
    keepRunning = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  try {
    await Promise.all([
      runWorkerLoop({
        keepRunning: () => keepRunning,
        runOnce,
        name: 'parse',
        workerId: process.env.PARSE_JOB_WORKER_ID ?? `parse-worker-${process.pid}`,
        batchSize: readPositiveInt('PARSE_JOB_BATCH_SIZE', Number(process.env.JOB_BATCH_SIZE ?? 5)),
        retryDelaySeconds,
        staleAfterSeconds,
        pollIntervalMs,
        processBatch: (options) => parseWorker.processBatch(options),
      }),
      runWorkerLoop({
        keepRunning: () => keepRunning,
        runOnce,
        name: 'evaluate',
        workerId: process.env.EVALUATE_JOB_WORKER_ID ?? `evaluation-worker-${process.pid}`,
        batchSize: readPositiveInt('EVALUATE_JOB_BATCH_SIZE', Number(process.env.JOB_BATCH_SIZE ?? 5)),
        retryDelaySeconds,
        staleAfterSeconds,
        pollIntervalMs,
        processBatch: (options) => evaluationWorker.processBatch(options),
      }),
      runWorkerLoop({
        keepRunning: () => keepRunning,
        runOnce,
        name: 'export',
        workerId: process.env.EXPORT_JOB_WORKER_ID ?? `report-export-worker-${process.pid}`,
        batchSize: readPositiveInt('EXPORT_JOB_BATCH_SIZE', 3),
        retryDelaySeconds,
        staleAfterSeconds,
        pollIntervalMs,
        processBatch: (options) => exportWorker.processBatch(options),
      }),
    ]);
  } finally {
    await app.close();
  }
}

async function runWorkerLoop<T extends { claimed: number }>(input: {
  keepRunning: () => boolean;
  runOnce: boolean;
  name: string;
  workerId: string;
  batchSize: number;
  retryDelaySeconds: number;
  staleAfterSeconds: number;
  pollIntervalMs: number;
  processBatch: (options: {
    workerId: string;
    batchSize: number;
    retryDelaySeconds: number;
    staleAfterSeconds: number;
  }) => Promise<T>;
}) {
  let firstIteration = true;
  while (input.keepRunning() && (firstIteration || !input.runOnce)) {
    firstIteration = false;
    const result = await input.processBatch({
      workerId: input.workerId,
      batchSize: input.batchSize,
      retryDelaySeconds: input.retryDelaySeconds,
      staleAfterSeconds: input.staleAfterSeconds,
    });
    console.log(JSON.stringify({ worker: input.name, workerId: input.workerId, ...result, timestamp: new Date().toISOString() }));

    if (input.runOnce) {
      break;
    }
    await sleep(result.claimed > 0 ? 0 : input.pollIntervalMs);
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
