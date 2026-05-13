-- Índices para chaves estrangeiras sem cobertura.
-- Melhora performance de JOINs, ON DELETE/UPDATE e queries filtrando por FK.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log(target_user_id);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_transacao_vinculada
  ON public.agenda_eventos(transacao_vinculada_id)
  WHERE transacao_vinculada_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_usuario_id
  ON public.categorias(usuario_id);

CREATE INDEX IF NOT EXISTS idx_contas_usuario_id
  ON public.contas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_familia_convites_consumed_by
  ON public.familia_convites(consumed_by_usuario_id)
  WHERE consumed_by_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recorrencias_mensais_categoria_id
  ON public.recorrencias_mensais(categoria_id)
  WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recorrencias_mensais_subcategoria_id
  ON public.recorrencias_mensais(subcategoria_id)
  WHERE subcategoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria_id
  ON public.subcategorias(categoria_id);

CREATE INDEX IF NOT EXISTS idx_transacoes_conta_id
  ON public.transacoes(conta_id)
  WHERE conta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_categoria_id_fk
  ON public.transacoes(categoria_id)
  WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_subcategoria_id
  ON public.transacoes(subcategoria_id)
  WHERE subcategoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_usuario_id
  ON public.webauthn_challenges(usuario_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_usuario_id
  ON public.whatsapp_logs(usuario_id);
