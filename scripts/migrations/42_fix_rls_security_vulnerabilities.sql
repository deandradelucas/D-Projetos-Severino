-- Remove INSERT policies com WITH CHECK(true) que permitiam acesso direto via Supabase REST.
-- Toda escrita passa agora pelo backend Hono com service_role — anon nunca faz INSERT direto.
-- Também revoga EXECUTE em aceitar_convite_familia de roles públicas e fixa search_path.
DROP POLICY IF EXISTS "Anon pode cadastrar usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated pode cadastrar usuário" ON public.usuarios;

REVOKE EXECUTE ON FUNCTION public.aceitar_convite_familia(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aceitar_convite_familia(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aceitar_convite_familia(uuid, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.aceitar_convite_familia(p_actor_id uuid, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_conv  familia_convites%ROWTYPE;
  v_count INTEGER;
  v_papel TEXT;
BEGIN
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

  IF EXISTS (
    SELECT 1 FROM usuarios
     WHERE id = v_conv.titular_usuario_id
       AND vinculo_conta_principal_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'titular_invalido: O titular deste convite não pode ser conta vinculada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM usuarios
     WHERE id = p_actor_id
       AND vinculo_conta_principal_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ja_vinculado: Esta conta já está vinculada a uma família. Saia antes de aceitar outro convite.';
  END IF;

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
$function$;
