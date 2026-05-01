CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  student_no TEXT,
  teacher_no TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  major TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, grade, major)
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_teacher_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE course_classes (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, class_id)
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, name, version)
);

CREATE TABLE rubric_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_template_id UUID NOT NULL REFERENCES rubric_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  weight NUMERIC(6, 3) NOT NULL CHECK (weight > 0),
  max_score NUMERIC(6, 2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  scoring_rule TEXT NOT NULL DEFAULT '',
  allow_teacher_override BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rubric_template_id, name)
);

CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rubric_template_id UUID NOT NULL REFERENCES rubric_templates(id),
  title TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  allowed_artifact_kinds TEXT[] NOT NULL DEFAULT ARRAY['word', 'pdf', 'image', 'code_archive', 'git_link'],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'parsing', 'evaluating', 'teacher_review', 'published', 'failed')),
  attempt_no INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ,
  current_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, student_id, attempt_no)
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'pdf', 'image', 'code_archive', 'git_link', 'other')),
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  sha256 TEXT,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'parsed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extracted_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  source_ref TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('text', 'ocr', 'code_structure', 'metadata')),
  content_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ai_draft' CHECK (status IN ('ai_draft', 'teacher_reviewed', 'published')),
  total_ai_score NUMERIC(6, 2),
  total_teacher_score NUMERIC(6, 2),
  final_score NUMERIC(6, 2),
  teacher_comment TEXT,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE metric_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_result_id UUID NOT NULL REFERENCES evaluation_results(id) ON DELETE CASCADE,
  rubric_metric_id UUID NOT NULL REFERENCES rubric_metrics(id),
  rule_score NUMERIC(6, 2),
  ai_score NUMERIC(6, 2),
  teacher_score NUMERIC(6, 2),
  final_score NUMERIC(6, 2),
  confidence NUMERIC(5, 4),
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (evaluation_result_id, rubric_metric_id)
);

CREATE TABLE verification_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_result_id UUID NOT NULL REFERENCES evaluation_results(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL CHECK (finding_type IN ('requirement', 'step', 'logic', 'security', 'document', 'code')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  evidence TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE llm_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cloud', 'local')),
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_json JSONB,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('student', 'class', 'course')),
  format TEXT NOT NULL CHECK (format IN ('xlsx', 'pdf')),
  requested_by UUID REFERENCES users(id),
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  storage_key TEXT,
  file_sha256 TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('parse_artifact', 'evaluate_submission', 'export_report')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_enrollments_course_class ON enrollments(course_id, class_id);
CREATE INDEX idx_experiments_course ON experiments(course_id);
CREATE INDEX idx_submissions_experiment_status ON submissions(experiment_id, status);
CREATE INDEX idx_artifacts_submission ON artifacts(submission_id);
CREATE INDEX idx_extracted_contents_artifact ON extracted_contents(artifact_id);
CREATE INDEX idx_metric_scores_result ON metric_scores(evaluation_result_id);
CREATE INDEX idx_findings_result_severity ON verification_findings(evaluation_result_id, severity);
CREATE INDEX idx_jobs_status_run_after ON jobs(status, run_after);
CREATE INDEX idx_report_exports_status ON report_exports(status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
