export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export async function parseSupabaseResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

export function getSupabaseErrorMessage(error) {
  const message = error?.message || error?.msg || ''
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("could not find the table 'public.usuarios' in the schema cache")) {
    return 'A tabela de usuarios ainda nao foi criada no Supabase. Execute o SQL de setup em src/scripts/setup_usuarios.sql no painel do Supabase.'
  }

  if (lowerMessage.includes('duplicate key') || lowerMessage.includes('duplicate')) {
    return 'Este e-mail ja esta cadastrado.'
  }

  if (message) {
    return message
  }

  return 'Ocorreu um erro ao comunicar com o Supabase.'
}
