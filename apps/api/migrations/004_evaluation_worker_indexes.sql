CREATE INDEX IF NOT EXISTS idx_llm_call_logs_submission_created
  ON llm_call_logs (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evaluation_results_status_updated
  ON evaluation_results (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_findings_type_severity
  ON verification_findings (finding_type, severity);
