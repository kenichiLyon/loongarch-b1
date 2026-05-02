import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

export type DatabaseHealthStatus = 'ok' | 'disabled' | 'failed';

export interface DatabaseHealthCheckOptions {
  connectionString?: string;
  timeoutMs?: number;
}

export interface DatabaseHealthResult {
  status: DatabaseHealthStatus;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
  database?: string;
}

@Injectable()
export class DatabaseHealthService {
  async check(options: DatabaseHealthCheckOptions = {}): Promise<DatabaseHealthResult> {
    const connectionString = options.connectionString ?? process.env.DATABASE_URL;
    const checkedAt = new Date().toISOString();

    if (!connectionString) {
      return {
        status: 'disabled',
        checkedAt,
        message: 'DATABASE_URL is not configured',
      };
    }

    const timeoutMs = options.timeoutMs ?? Number(process.env.DATABASE_HEALTH_TIMEOUT_MS ?? 3000);
    const startedAt = Date.now();
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: timeoutMs,
    });

    try {
      await client.connect();
      await client.query('SELECT 1 AS ok');

      return {
        status: 'ok',
        checkedAt,
        latencyMs: Date.now() - startedAt,
        database: maskConnectionString(connectionString),
      };
    } catch (error) {
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown database health check error',
        database: maskConnectionString(connectionString),
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

export function maskConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}
