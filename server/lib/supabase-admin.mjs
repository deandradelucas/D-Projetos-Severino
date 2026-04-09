import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './load-env.mjs'

let client

function trimEnv(value) {
  let s = String(value ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function isValidHttpUrlForSupabase(raw) {
  try {
    const u = new URL(trimEnv(raw))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function getSupabaseAdmin() {
  if (client) {
    return client
  }

  loadEnv()

  const supabaseUrl = trimEnv(process.env.VITE_SUPABASE_URL)
  const serviceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  }

  if (!isValidHttpUrlForSupabase(supabaseUrl)) {
    throw new Error(
      'Invalid VITE_SUPABASE_URL: use a URL completa com https:// (ex.: https://xxxx.supabase.co). Sem aspas no .env; copie de Settings → API no Supabase.',
    )
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return client
}
