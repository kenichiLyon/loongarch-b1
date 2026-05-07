import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { ArtifactKind, UserRole } from '../domain/core';
import { LocalObjectStoreService } from '../storage/local-object-store.service';
import { validateArtifactUpload, type UploadFileLike } from './artifact-upload.policy';
import { sanitizeFileName } from '../storage/local-object-store.service';
import type { CreateGitLinkArtifactDto, CreateSubmissionDto, ListSubmissionsQueryDto, UploadArtifactDto } from './submissions.dto';

export interface SubmissionRow extends QueryResultRow {
  id: string;
  experimentId: string;
  studentId: string;
  status: string;
  attemptNo: number;
  submittedAt: string | null;
  currentError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRow extends QueryResultRow {
  id: string;
  submissionId: string;
  kind: ArtifactKind;
  originalName: string;
  mimeType: string | null;
  sizeBytes: string;
  sha256: string;
  storageKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly objectStore: LocalObjectStoreService,
    private readonly auditService: AuditService,
  ) {}

  async listSubmissions(filters: ListSubmissionsQueryDto, user: AuthenticatedUser) {
    const query = buildListSubmissionsSql(filters, user);
    const result = await this.database.query<SubmissionRow>(query.sql, query.params);

    return result.rows;
  }

  async createSubmission(dto: CreateSubmissionDto, user: AuthenticatedUser) {
    const studentId = resolveStudentId(dto.studentId, user);
    const result = await this.database.query<SubmissionRow>(
      `INSERT INTO submissions (experiment_id, student_id, status, attempt_no)
       VALUES ($1, $2, 'draft', COALESCE($3, 1))
       RETURNING id, experiment_id AS "experimentId", student_id AS "studentId", status, attempt_no AS "attemptNo",
                 submitted_at AS "submittedAt", current_error AS "currentError", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [dto.experimentId, studentId, dto.attemptNo ?? null],
    );

    return result.rows[0];
  }

  async uploadArtifact(submissionId: string, dto: UploadArtifactDto, file: UploadFileLike, user: AuthenticatedUser) {
    try {
      const submission = await this.getSubmissionForUser(submissionId, user);
      const metadata = validateArtifactUpload(dto.kind, file);
      const stored = await this.objectStore.storeArtifact({
        submissionId: submission.id,
        originalName: metadata.originalName,
        buffer: file.buffer,
        sourcePath: file.path,
      });

      return await this.database.withTransaction(async (client) => {
        const artifact = await insertArtifact(client, {
          submissionId: submission.id,
          kind: dto.kind,
          originalName: metadata.originalName,
          mimeType: metadata.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          storageKey: stored.storageKey,
        });

        await client.query(
          `INSERT INTO jobs (job_type, payload)
           VALUES ('parse_artifact', $1::jsonb)`,
          [JSON.stringify({ artifactId: artifact.id, submissionId: submission.id })],
        );

        await client.query(
          `UPDATE submissions
              SET status = 'parsing', updated_at = now()
            WHERE id = $1`,
          [submission.id],
        );

        await this.auditService.record({
          actorId: user.id,
          action: 'artifact.uploaded',
          entityType: 'artifact',
          entityId: artifact.id,
          detail: {
            submissionId: submission.id,
            kind: artifact.kind,
            originalName: artifact.originalName,
            mimeType: artifact.mimeType,
            sizeBytes: Number(artifact.sizeBytes),
            sha256: artifact.sha256,
            queuedJobType: 'parse_artifact',
          },
          client,
        });

        return artifact;
      });
    } finally {
      await removeTemporaryUpload(file.path);
    }
  }

  async createGitLinkArtifact(submissionId: string, dto: CreateGitLinkArtifactDto, user: AuthenticatedUser) {
    const submission = await this.getSubmissionForUser(submissionId, user);
    const payload = buildGitLinkPayload(dto);
    const stored = await this.objectStore.storeArtifact({
      submissionId: submission.id,
      originalName: buildGitLinkArtifactName(payload),
      buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
    });

    return this.database.withTransaction(async (client) => {
      const artifact = await insertArtifact(client, {
        submissionId: submission.id,
        kind: ArtifactKind.GitLink,
        originalName: buildGitLinkArtifactName(payload),
        mimeType: 'application/json',
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        storageKey: stored.storageKey,
      });

      await client.query(
        `INSERT INTO jobs (job_type, payload)
         VALUES ('parse_artifact', $1::jsonb)`,
        [JSON.stringify({ artifactId: artifact.id, submissionId: submission.id })],
      );

      await client.query(
        `UPDATE submissions
            SET status = 'parsing', updated_at = now()
          WHERE id = $1`,
        [submission.id],
      );

      await this.auditService.record({
        actorId: user.id,
        action: 'artifact.uploaded',
        entityType: 'artifact',
        entityId: artifact.id,
        detail: {
          submissionId: submission.id,
          kind: artifact.kind,
          gitUrl: payload.url,
          branch: payload.branch ?? null,
          commitSha: payload.commitSha ?? null,
          queuedJobType: 'parse_artifact',
        },
        client,
      });

      return artifact;
    });
  }

  private async getSubmissionForUser(submissionId: string, user: AuthenticatedUser) {
    const result = await this.database.query<SubmissionRow>(
      `SELECT id, experiment_id AS "experimentId", student_id AS "studentId", status, attempt_no AS "attemptNo",
              submitted_at AS "submittedAt", current_error AS "currentError", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM submissions
        WHERE id = $1`,
      [submissionId],
    );

    const submission = result.rows[0];
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (user.role === UserRole.Student && submission.studentId !== user.id) {
      throw new ForbiddenException('Students can only access their own submissions');
    }

    return submission;
  }
}

function buildGitLinkPayload(dto: CreateGitLinkArtifactDto) {
  return {
    url: dto.url.trim(),
    branch: dto.branch?.trim() || undefined,
    commitSha: dto.commitSha?.trim() || undefined,
  };
}

function buildGitLinkArtifactName(payload: { url: string }) {
  const repoSlug = extractRepoSlug(payload.url);
  return sanitizeFileName(`${repoSlug || 'git-link'}.gitlink.json`);
}

function extractRepoSlug(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const repo = segments[1]?.replace(/\.git$/i, '');
    const owner = segments[0];
    return owner && repo ? `${owner}-${repo}` : repo || owner || 'git-link';
  } catch {
    return 'git-link';
  }
}

export function buildListSubmissionsSql(filters: ListSubmissionsQueryDto, user: AuthenticatedUser) {
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters.experimentId) {
    params.push(filters.experimentId);
    where.push(`s.experiment_id = $${params.length}`);
  }
  if (filters.courseId) {
    params.push(filters.courseId);
    where.push(`e.course_id = $${params.length}`);
  }
  if (filters.classId) {
    params.push(filters.classId);
    where.push(`en.class_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`s.status = $${params.length}`);
  }

  if (user.role === UserRole.Student) {
    params.push(user.id);
    where.push(`s.student_id = $${params.length}`);
  } else if (filters.studentId) {
    params.push(filters.studentId);
    where.push(`s.student_id = $${params.length}`);
  }

  return {
    sql: `SELECT s.id, s.experiment_id AS "experimentId", s.student_id AS "studentId", s.status,
                 s.attempt_no AS "attemptNo", s.submitted_at AS "submittedAt", s.current_error AS "currentError",
                 s.created_at AS "createdAt", s.updated_at AS "updatedAt"
            FROM submissions s
            JOIN experiments e ON e.id = s.experiment_id
            LEFT JOIN enrollments en ON en.student_id = s.student_id AND en.course_id = e.course_id
           ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY s.created_at DESC`,
    params,
  };
}

async function removeTemporaryUpload(filePath: string | undefined) {
  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch {
    // Cleanup is best-effort; persisted artifacts and DB state should not be rolled back by temp-file deletion failures.
  }
}

function resolveStudentId(studentId: string | undefined, user: AuthenticatedUser) {
  if (user.role === UserRole.Student) {
    if (studentId && studentId !== user.id) {
      throw new ForbiddenException('Students can only create submissions for themselves');
    }
    return user.id;
  }

  if (!studentId) {
    throw new BadRequestException('studentId is required for admin or teacher submission creation');
  }

  return studentId;
}

async function insertArtifact(
  client: PoolClient,
  input: {
    submissionId: string;
    kind: ArtifactKind;
    originalName: string;
    mimeType: string | null;
    sizeBytes: number;
    sha256: string;
    storageKey: string;
  },
) {
  const result = await client.query<ArtifactRow>(
    `INSERT INTO artifacts (submission_id, kind, original_name, mime_type, size_bytes, sha256, storage_key, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
     RETURNING id, submission_id AS "submissionId", kind, original_name AS "originalName", mime_type AS "mimeType",
               size_bytes AS "sizeBytes", sha256, storage_key AS "storageKey", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [input.submissionId, input.kind, input.originalName, input.mimeType, input.sizeBytes, input.sha256, input.storageKey],
  );
  return result.rows[0];
}
