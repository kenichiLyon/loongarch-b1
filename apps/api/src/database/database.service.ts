import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export type TransactionHandler<T> = (client: PoolClient) => Promise<T>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: Pool;

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
    return this.getPool().query<T>(sql, [...params]);
  }

  async withTransaction<T>(handler: TransactionHandler<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  private getPool() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for database operations');
    }

    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX ?? 10),
        idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
        connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000),
      });
    }

    return this.pool;
  }
}
