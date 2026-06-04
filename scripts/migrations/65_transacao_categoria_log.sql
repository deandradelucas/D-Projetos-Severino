-- Migration 65: loop de aprendizado de categoria de transação (few-shot por correção)
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).

-- Registra correções de categoria feitas pelo usuário (descrição -> categoria correta),
-- para alimentar o few-shot dinâmico na resolução de categoria por IA.
CREATE TABLE IF NOT EXISTS public.transacao_categoria_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id),
  descricao text NOT NULL,
  categoria_nome text NOT NULL,
  tipo text,
  created_at timestamptz DEFAULT now()
);

-- Convenção do projeto: RLS habilitado SEM policy (backend via service_role).
ALTER TABLE public.transacao_categoria_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transacao_categoria_log_usuario
  ON public.transacao_categoria_log (usuario_id, created_at DESC);

-- Atualiza a função de purga LGPD para apagar também esta tabela (evita FK bloquear
-- a exclusão do usuário e cumpre a eliminação real).
CREATE OR REPLACE FUNCTION public.lgpd_purge_usuario(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM usuarios WHERE vinculo_conta_principal_id = p_id) THEN
    RAISE EXCEPTION 'titular_com_membros: usuario % tem membros vinculados', p_id;
  END IF;

  UPDATE transacoes          SET lancado_por_usuario_id = NULL WHERE lancado_por_usuario_id = p_id;
  UPDATE shopping_list_items SET checked_por = NULL            WHERE checked_por = p_id;
  UPDATE familia_convites    SET consumed_by_usuario_id = NULL WHERE consumed_by_usuario_id = p_id;
  UPDATE admin_audit_log     SET actor_user_id = NULL          WHERE actor_user_id = p_id;
  UPDATE admin_audit_log     SET target_user_id = NULL, target_email = NULL WHERE target_user_id = p_id;

  UPDATE pagamentos_asaas
     SET usuario_id = NULL, payer_email = NULL, raw_payload = NULL
   WHERE usuario_id = p_id;

  DELETE FROM transacao_categoria_log WHERE usuario_id = p_id;
  DELETE FROM meta_aportes         WHERE usuario_id = p_id;
  DELETE FROM investimento_aportes WHERE investimento_id IN (SELECT id FROM investimentos_usuario WHERE usuario_id = p_id);
  DELETE FROM shopping_list_items  WHERE lista_id IN (SELECT id FROM shopping_lists WHERE usuario_id = p_id);
  DELETE FROM subcategorias        WHERE categoria_id IN (SELECT id FROM categorias WHERE usuario_id = p_id);
  DELETE FROM agenda_title_log     WHERE usuario_id = p_id;
  DELETE FROM agenda_eventos       WHERE usuario_id = p_id;
  DELETE FROM transacoes           WHERE usuario_id = p_id;
  DELETE FROM recorrencias_mensais WHERE usuario_id = p_id;
  DELETE FROM limites_orcamento    WHERE usuario_id = p_id;
  DELETE FROM metas                WHERE usuario_id = p_id;
  DELETE FROM shopping_lists       WHERE usuario_id = p_id;
  DELETE FROM investimentos_usuario WHERE usuario_id = p_id;
  DELETE FROM cartoes              WHERE usuario_id = p_id;
  DELETE FROM categorias           WHERE usuario_id = p_id;
  DELETE FROM contas               WHERE usuario_id = p_id;
  DELETE FROM whatsapp_logs        WHERE usuario_id = p_id;
  DELETE FROM webauthn_credentials WHERE usuario_id = p_id;
  DELETE FROM webauthn_challenges  WHERE usuario_id = p_id;
  DELETE FROM familia_convites     WHERE titular_usuario_id = p_id;
  DELETE FROM familia_audit_log    WHERE titular_id = p_id OR actor_id = p_id OR membro_id = p_id;
  DELETE FROM refresh_tokens       WHERE usuario_id = p_id;

  DELETE FROM usuarios WHERE id = p_id;
END;
$$;
