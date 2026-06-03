-- Migration 63: LGPD — função de purga atômica de conta (hard-delete após carência)
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).
--
-- Apaga DEFINITIVAMENTE os dados pessoais de um usuário, numa transação única
-- (FK-safe: filhos antes de pais). Regras decididas pelo CEO (03-Jun-2026):
--  - pagamentos_asaas: ANONIMIZAR e reter (retenção fiscal), não apagar.
--  - titular de família com membros: BLOQUEIA (exception) — não purga.
--  - referências do usuário em dados de OUTROS (lançou transação/marcou item):
--    são anonimizadas (NULL), preservando os dados do titular/família.

CREATE OR REPLACE FUNCTION public.lgpd_purge_usuario(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloqueio defensivo: titular com membros vinculados não é purgado.
  IF EXISTS (SELECT 1 FROM usuarios WHERE vinculo_conta_principal_id = p_id) THEN
    RAISE EXCEPTION 'titular_com_membros: usuario % tem membros vinculados', p_id;
  END IF;

  -- Anonimizar referências do usuário em dados de OUTROS (não apagar dados alheios).
  UPDATE transacoes          SET lancado_por_usuario_id = NULL WHERE lancado_por_usuario_id = p_id;
  UPDATE shopping_list_items SET checked_por = NULL            WHERE checked_por = p_id;
  UPDATE familia_convites    SET consumed_by_usuario_id = NULL WHERE consumed_by_usuario_id = p_id;
  UPDATE admin_audit_log     SET actor_user_id = NULL          WHERE actor_user_id = p_id;
  UPDATE admin_audit_log     SET target_user_id = NULL, target_email = NULL WHERE target_user_id = p_id;

  -- Anonimizar e RETER registros de pagamento (retenção fiscal/contábil).
  UPDATE pagamentos_asaas
     SET usuario_id = NULL, payer_email = NULL, raw_payload = NULL
   WHERE usuario_id = p_id;

  -- Apagar dados próprios do usuário (ordem FK-safe: filhos → pais).
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

  -- Por fim, o próprio cadastro.
  DELETE FROM usuarios WHERE id = p_id;
END;
$$;

-- Só o service_role (backend) pode executar — nunca anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.lgpd_purge_usuario(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lgpd_purge_usuario(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lgpd_purge_usuario(uuid) FROM authenticated;
