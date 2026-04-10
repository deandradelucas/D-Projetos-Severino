-- Auditoria de ações administrativas (API Node com service role).
-- Rode no SQL Editor do Supabase após as migrations anteriores.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  target_email text,
  detail jsonb,
  client_ip text
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_user_id);

COMMENT ON TABLE public.admin_audit_log IS 'Trilha de auditoria: alterações via /api/admin/* (RLS não se aplica ao service role).';
