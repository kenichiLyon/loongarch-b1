import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RubricMetric, validateRubricMetrics } from '../domain/core';
import {
  AttachCourseClassDto,
  CreateClassDto,
  CreateCourseDto,
  CreateExperimentDto,
  CreateRubricDto,
  CreateUserDto,
} from './foundation.dto';

const defaultArtifactKinds = ['word', 'pdf', 'image', 'code_archive', 'git_link'];

type Row = Record<string, unknown>;

@Injectable()
export class FoundationService {
  constructor(private readonly database: DatabaseService) {}

  async listUsers(role?: string) {
    const params: unknown[] = [];
    const where = role ? 'WHERE role = $1' : '';
    if (role) {
      params.push(role);
    }

    const result = await this.database.query(
      `SELECT id, role, username, display_name AS "displayName", email, phone, student_no AS "studentNo",
              teacher_no AS "teacherNo", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM users ${where}
        ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async createUser(dto: CreateUserDto) {
    const result = await this.database.query(
      `INSERT INTO users (role, username, display_name, password_hash, email, phone, student_no, teacher_no, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE))
       RETURNING id, role, username, display_name AS "displayName", email, phone, student_no AS "studentNo",
                 teacher_no AS "teacherNo", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        dto.role,
        dto.username,
        dto.displayName,
        hashPassword(dto.initialPassword),
        dto.email ?? null,
        dto.phone ?? null,
        dto.studentNo ?? null,
        dto.teacherNo ?? null,
        dto.isActive ?? null,
      ],
    );
    return result.rows[0];
  }

  async listClasses() {
    const result = await this.database.query(
      `SELECT id, name, grade, major, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM classes
        ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async createClass(dto: CreateClassDto) {
    const result = await this.database.query(
      `INSERT INTO classes (name, grade, major)
       VALUES ($1, $2, $3)
       RETURNING id, name, grade, major, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [dto.name, dto.grade ?? null, dto.major ?? null],
    );
    return result.rows[0];
  }

  async listCourses() {
    const result = await this.database.query(
      `SELECT id, name, code, description, owner_teacher_id AS "ownerTeacherId", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM courses
        ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async createCourse(dto: CreateCourseDto) {
    const result = await this.database.query(
      `INSERT INTO courses (name, code, description, owner_teacher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, code, description, owner_teacher_id AS "ownerTeacherId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [dto.name, dto.code, dto.description ?? null, dto.ownerTeacherId ?? null],
    );
    return result.rows[0];
  }

  async attachClassToCourse(courseId: string, dto: AttachCourseClassDto) {
    await this.database.query(
      `INSERT INTO course_classes (course_id, class_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [courseId, dto.classId],
    );
    return { courseId, classId: dto.classId, attached: true };
  }

  async listRubrics(courseId?: string) {
    const params: unknown[] = [];
    const where = courseId ? 'WHERE rt.course_id = $1' : '';
    if (courseId) {
      params.push(courseId);
    }

    const result = await this.database.query(
      `SELECT rt.id, rt.course_id AS "courseId", rt.name, rt.version, rt.description, rt.is_active AS "isActive",
              rt.created_by AS "createdBy", rt.created_at AS "createdAt",
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', rm.id,
                    'name', rm.name,
                    'description', rm.description,
                    'weight', rm.weight,
                    'maxScore', rm.max_score,
                    'scoringRule', rm.scoring_rule,
                    'allowTeacherOverride', rm.allow_teacher_override,
                    'sortOrder', rm.sort_order
                  ) ORDER BY rm.sort_order ASC, rm.created_at ASC
                ) FILTER (WHERE rm.id IS NOT NULL),
                '[]'::json
              ) AS metrics
         FROM rubric_templates rt
         LEFT JOIN rubric_metrics rm ON rm.rubric_template_id = rt.id
         ${where}
        GROUP BY rt.id
        ORDER BY rt.created_at DESC`,
      params,
    );
    return result.rows;
  }

  async createRubric(dto: CreateRubricDto) {
    validateRubricOrThrow(dto);

    return this.database.withTransaction(async (client) => {
      const rubric = await client.query(
        `INSERT INTO rubric_templates (course_id, name, version, description, is_active, created_by)
         VALUES ($1, $2, COALESCE($3, 1), $4, COALESCE($5, TRUE), $6)
         RETURNING id, course_id AS "courseId", name, version, description, is_active AS "isActive",
                   created_by AS "createdBy", created_at AS "createdAt"`,
        [dto.courseId, dto.name, dto.version ?? null, dto.description ?? null, dto.isActive ?? null, dto.createdBy ?? null],
      );

      const rubricId = rubric.rows[0].id as string;
      const metrics = await insertRubricMetrics(client, rubricId, dto.metrics);
      return { ...rubric.rows[0], metrics };
    });
  }

  async listExperiments(courseId?: string) {
    const params: unknown[] = [];
    const where = courseId ? 'WHERE course_id = $1' : '';
    if (courseId) {
      params.push(courseId);
    }

    const result = await this.database.query(
      `SELECT id, course_id AS "courseId", rubric_template_id AS "rubricTemplateId", title, requirement_text AS "requirementText",
              due_at AS "dueAt", allowed_artifact_kinds AS "allowedArtifactKinds", created_by AS "createdBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM experiments ${where}
        ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async createExperiment(dto: CreateExperimentDto) {
    const result = await this.database.query(
      `INSERT INTO experiments (course_id, rubric_template_id, title, requirement_text, due_at, allowed_artifact_kinds, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, course_id AS "courseId", rubric_template_id AS "rubricTemplateId", title, requirement_text AS "requirementText",
                 due_at AS "dueAt", allowed_artifact_kinds AS "allowedArtifactKinds", created_by AS "createdBy",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        dto.courseId,
        dto.rubricTemplateId,
        dto.title,
        dto.requirementText,
        dto.dueAt ?? null,
        dto.allowedArtifactKinds ?? defaultArtifactKinds,
        dto.createdBy ?? null,
      ],
    );
    return result.rows[0];
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, hash] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export function validateRubricOrThrow(dto: CreateRubricDto) {
  const metrics: RubricMetric[] = dto.metrics.map((metric, index) => ({
    id: `metric-${index}`,
    name: metric.name,
    description: metric.description,
    weight: metric.weight,
    maxScore: metric.maxScore ?? 100,
    allowTeacherOverride: metric.allowTeacherOverride ?? true,
  }));

  const validation = validateRubricMetrics(metrics);
  if (!validation.valid) {
    throw new BadRequestException({ message: 'Invalid rubric metrics', errors: validation.errors });
  }
}

async function insertRubricMetrics(client: PoolClient, rubricId: string, metrics: CreateRubricDto['metrics']) {
  const rows: Row[] = [];
  for (const [index, metric] of metrics.entries()) {
    const result = await client.query(
      `INSERT INTO rubric_metrics (rubric_template_id, name, description, weight, max_score, scoring_rule, allow_teacher_override, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8)
       RETURNING id, name, description, weight, max_score AS "maxScore", scoring_rule AS "scoringRule",
                 allow_teacher_override AS "allowTeacherOverride", sort_order AS "sortOrder"`,
      [
        rubricId,
        metric.name,
        metric.description,
        metric.weight,
        metric.maxScore ?? 100,
        metric.scoringRule ?? '',
        metric.allowTeacherOverride ?? null,
        metric.sortOrder ?? index,
      ],
    );
    rows.push(result.rows[0]);
  }
  return rows;
}
