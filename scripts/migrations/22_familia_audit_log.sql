CREATE TABLE IF NOT EXISTS familia_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id  UUID NOT NULL,
  actor_id    UUID NOT NULL,
  membro_id   UUID,
  acao        TEXT NOT NULL,
  papel_antes TEXT,
  papel_depois TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
