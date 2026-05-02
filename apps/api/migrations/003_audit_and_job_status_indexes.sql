CREATE INDEX IF NOT EXISTS idx_jobs_type_status_updated
  ON jobs (job_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_payload_submission
  ON jobs ((payload->>'submissionId'))
  WHERE payload ? 'submissionId';

CREATE INDEX IF NOT EXISTS idx_jobs_payload_artifact
  ON jobs ((payload->>'artifactId'))
  WHERE payload ? 'artifactId';

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs (actor_id, created_at DESC);
