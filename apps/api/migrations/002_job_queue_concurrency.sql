CREATE INDEX IF NOT EXISTS idx_jobs_claim_queue
  ON jobs (job_type, status, run_after, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_jobs_running_locked
  ON jobs (job_type, locked_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_artifacts_status_submission
  ON artifacts (status, submission_id);
