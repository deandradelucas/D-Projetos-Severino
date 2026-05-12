-- Migration 20: função atômica para aceitar convite familiar (evita race condition)
CREATE OR REPLACE FUNCTION aceitar_convite_familia(
  p_actor_id UUID,
  p_token_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv  familia_convites%ROWTYPE;
  v_count INTEGER;
  v_papel TEXT;
BEGIN
  -- Lock no convite para evitar race condition de uso duplo
  SELECT * INTO v_conv
    FROM familia_convites
   WHERE token_hash = p_token_hash
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'convite_invalido: Convite inválido.';
  END IF;

  IF v_conv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'convite_revogado: Convite revogado.';
  END IF;

  IF v_conv.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'convite_consumido: Convite já utilizado.';
  END IF;

  IF v_conv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'convite_expirado: Convite expirado.';
  END IF;

  IF v_conv.titular_usuario_id = p_actor_id THEN
    RAISE EXCEPTION 'convite_proprio: Você não pode aceitar um convite da própria conta.';
  END IF;

  -- Verifica se o titular não é ele próprio um membro vinculado
  IF EXISTS (
    SELECT 1 FROM usuarios
     WHERE id = v_conv.titular_usuario_id
       AND vinculo_conta_principal_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'titular_invalido: O titular deste convite não pode ser conta vinculada.';
  END IF;

  -- Verifica se o actor já está vinculado
  IF EXISTS (
    SELECT 1 FROM usuarios
     WHERE id = p_actor_id
       AND vinculo_conta_principal_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ja_vinculado: Esta conta já está vinculada a uma família. Saia antes de aceitar outro convite.';
  END IF;

  -- Verifica limite de membros
  SELECT COUNT(*) INTO v_count
    FROM usuarios
   WHERE vinculo_conta_principal_id = v_conv.titular_usuario_id;

  IF v_count >= 4 THEN
    RAISE EXCEPTION 'limite_atingido: Esta conta familiar já atingiu o limite de membros vinculados.';
  END IF;

  v_papel := CASE
    WHEN v_conv.papel_convite IN ('ADMIN','MEMBER','VIEWER') THEN v_conv.papel_convite
    ELSE 'MEMBER'
  END;

  -- Operações atômicas: vincula usuário e marca convite como consumido
  UPDATE usuarios
     SET vinculo_conta_principal_id = v_conv.titular_usuario_id,
         familia_papel = v_papel
   WHERE id = p_actor_id;

  UPDATE familia_convites
     SET consumed_at = NOW(),
         consumed_by_usuario_id = p_actor_id
   WHERE id = v_conv.id;

  RETURN jsonb_build_object(
    'titular_usuario_id', v_conv.titular_usuario_id,
    'familia_papel', v_papel
  );
END;
$$;
