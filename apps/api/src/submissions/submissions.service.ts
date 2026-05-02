import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ArtifactKind, UserRole } from '../domain/core';
import { LocalObjectStoreService } from '../storage/local-object-store.service';
import { validateArtifactUpload, type UploadFileLike } from './artifact-upload.policy';
import type { CreateSubmissionDto, UploadArtifactDto } from './submissions.dto';

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
  ) {}

  async listSubmissions(filters: { experimentId?: string; studentId?: string }, user: AuthenticatedUser) {
    const params: unknown[] = [];
    const where: string[] = [];

    if (filters.experimentId) {
      params.push(filters.experimentId);
      where.push(`experiment_id = $${params.length}`);
    }

    if (user.role === UserRole.Student) {
      params.push(user.id);
      where.push(`student_id = $${params.length}`);
    } else if (filters.studentId) {
      params.push(filters.studentId);
      where.push(`student_id = $${params.length}`);
    }

    const result = await this.database.query<SubmissionRow>(
      `SELECT id, experiment_id AS "experimentId", student_id AS "studentId", status, attempt_no AS "attemptNo",
              submitted_at AS "submittedAt", current_error AS "currentError", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM submissions
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC`,
      params,
    );

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
    const submission = await this.getSubmissionForUser(submissionId, user);
    const metadata = validateArtifactUpload(dto.kind, file);
    const stored = await this.objectStore.storeArtifact({
      submissionId: submission.id,
      originalName: metadata.originalName,
      buffer: file.buffer as Buffer,
    });

    return this.database.withTransaction(async (client) => {
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
