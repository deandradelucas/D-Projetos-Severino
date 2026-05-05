/** Texto útil a partir de Error, PostgrestError ou objeto genérico. */
export function errorToText(error) {
  if (error == null) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message) {
    const bits = [error.message, error.details, error.hint, error.code].filter(Boolean)
    return bits.join(' | ')
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Erros de configuração/rede do Supabase — retorna null se for falha genérica. */
export function mapSupabaseOrNetworkError(error) {
  const raw = errorToText(error)
  if (
    /Missing Supabase URL \(VITE_SUPABASE_URL or SUPABASE_URL\)/i.test(raw) ||
    /Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/i.test(raw)
  ) {
    return {
      status: 503,
      message:
        'Banco de dados não configurado. Em desenvolvimento, crie um arquivo .env na raiz com VITE_SUPABASE_URL (ou SUPABASE_URL no servidor) e SUPABASE_SERVICE_ROLE_KEY (copie de env.example). No Vercel, defina as mesmas variáveis no projeto e faça um novo deploy.',
    }
  }
  if (/Invalid supabaseUrl|Invalid VITE_SUPABASE_URL|Must be a valid HTTP or HTTPS URL/i.test(raw)) {
    return {
      status: 503,
      message:
        'URL do Supabase inválida. No .env, defina VITE_SUPABASE_URL como a URL do projeto (https://….supabase.co), sem aspas nem espaços — copie de Settings → API no painel do Supabase.',
    }
  }
  if (/Invalid API key|JWT expired|invalid value for JWT|JWT|API key/i.test(raw)) {
    return {
      status: 503,
      message:
        'Chave do Supabase inválida ou ausente. Confira SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL no .env (local) ou nas variáveis do Vercel.',
    }
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|NetworkError|Failed to fetch|getaddrinfo|certificate/i.test(raw)) {
    return {
      status: 503,
      message: 'Não foi possível conectar ao banco de dados. Tente de novo em alguns instantes.',
    }
  }
  if (
    /webauthn_credentials|webauthn_challenges/i.test(raw) &&
    /does not exist|42P01|Could not find the table|PGRST205|schema cache/i.test(raw)
  ) {
    return {
      status: 503,
      message:
        'As tabelas de biometria ainda não existem no banco. No Supabase (SQL Editor), execute o arquivo scripts/migrations/13_webauthn.sql deste projeto.',
    }
  }
  if (/relation.*does not exist|42P01|PGRST205|Could not find the table.*schema cache/i.test(raw)) {
    return {
      status: 503,
      message:
        'Tabela ou recurso não encontrado no banco. Rode os scripts em scripts/migrations/ no SQL Editor do Supabase (neste projeto).',
    }
  }
  if (/permission denied for table|42501/i.test(raw)) {
    return {
      status: 503,
      message:
        'Acesso negado ao banco. Confira SUPABASE_SERVICE_ROLE_KEY (service role) no .env local ou no Vercel.',
    }
  }
  if (/PGRST116|multiple rows|more than one row/i.test(raw)) {
    return {
      status: 409,
      message: 'Existem registros duplicados para este e-mail. Contate o suporte.',
    }
  }
  if (/column .* does not exist|Could not find the .*column/i.test(raw)) {
    return {
      status: 503,
      message:
        'O banco está desatualizado em relação ao app. Rode as migrations em scripts/migrations/ no SQL Editor do Supabase.',
    }
  }
  if (/PGRST100|PGRST102|failed to parse|parse.*filter|invalid.*filter/i.test(raw)) {
    return {
      status: 503,
      message:
        'A consulta ao banco foi rejeitada (filtro inválido). Se acabou de atualizar o app, faça um deploy recente; senão, verifique os logs do servidor.',
    }
  }
  if (/PGRST301|JWT expired|expired|timeout|ETIMEDOUT|connect ECONNREFUSED|socket hang up/i.test(raw)) {
    return {
      status: 503,
      message: 'Serviço de dados temporariamente indisponível. Tente de novo em alguns instantes.',
    }
  }
  if (
    /generativelanguage\.googleapis\.com|Gemini API|RESOURCE_EXHAUSTED|quota exceeded|429.*generateContent/i.test(
      raw,
    )
  ) {
    return {
      status: 503,
      message:
        'O serviço de inteligência artificial está temporariamente indisponível ou sem quota. Tente novamente em alguns minutos.',
    }
  }
  if (/api\.mercadopago\.com|Mercado\s*Pago|mercadopago/i.test(raw) && /ECONNRESET|ETIMEDOUT|5\d\d|fetch failed/i.test(raw)) {
    return {
      status: 503,
      message: 'O gateway de pagamentos está indisponível no momento. Tente novamente em instantes.',
    }
  }
  return null
}
