CREATE TABLE IF NOT EXISTS evaluation_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('built', 'used_for_llm', 'superseded')),
  prompt_version TEXT NOT NULL,
  context_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  context_json JSONB NOT NULL,
  context_text TEXT NOT NULL,
  original_char_count INTEGER NOT NULL CHECK (original_char_count >= 0),
  redacted_char_count INTEGER NOT NULL CHECK (redacted_char_count >= 0),
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  source_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE llm_call_logs
  ADD COLUMN IF NOT EXISTS context_snapshot_id UUID REFERENCES evaluation_context_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evaluation_context_snapshots_submission_created
  ON evaluation_context_snapshots (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evaluation_context_snapshots_input_hash
  ON evaluation_context_snapshots (input_hash);

CREATE INDEX IF NOT EXISTS idx_evaluation_context_snapshots_status
  ON evaluation_context_snapshots (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_call_logs_context_snapshot
  ON llm_call_logs (context_snapshot_id);
