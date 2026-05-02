import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { addEqualityFilter, clampQueryLimit } from '../database/sql-query.helpers';

export interface AuditLogRow extends QueryResultRow {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detailJson: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
  client?: PoolClient;
}

export interface ListAuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(input: AuditLogInput) {
    const sql = `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, detail_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, actor_id AS "actorId", NULL::text AS "actorUsername", NULL::text AS "actorDisplayName",
                 NULL::text AS "actorRole", action, entity_type AS "entityType", entity_id AS "entityId",
                 detail_json AS "detailJson", created_at AS "createdAt"`;
    const params = [
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.detail ?? {}),
    ];
    const result = input.client ? await input.client.query<AuditLogRow>(sql, params) : await this.database.query<AuditLogRow>(sql, params);
    return result.rows[0];
  }

  async listAuditLogs(filters: ListAuditLogFilters) {
    const params: unknown[] = [];
    const where: string[] = [];

    addEqualityFilter(where, params, 'al.action', filters.action);
    addEqualityFilter(where, params, 'al.entity_type', filters.entityType);
    addEqualityFilter(where, params, 'al.entity_id', filters.entityId);
    addEqualityFilter(where, params, 'al.actor_id', filters.actorId);

    const limit = clampQueryLimit(filters.limit);
    params.push(limit);

    const result = await this.database.query<AuditLogRow>(
      `SELECT al.id, al.actor_id AS "actorId", u.username AS "actorUsername",
              u.display_name AS "actorDisplayName", u.role AS "actorRole",
              al.action, al.entity_type AS "entityType", al.entity_id AS "entityId",
              al.detail_json AS "detailJson", al.created_at AS "createdAt"
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY al.created_at DESC
        LIMIT $${params.length}`,
      params,
    );

    return result.rows;
  }
}
