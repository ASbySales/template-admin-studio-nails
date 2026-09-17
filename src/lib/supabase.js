import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Atenção: As variáveis de ambiente do Supabase não foram configuradas. Verifique seu arquivo .env!')
}

// Adaptador inteligente para Docker PostgREST local e túneis (Localtunnel/Ngrok)
const isLocalOrTunnel = supabaseUrl && !supabaseUrl.includes('supabase.co')

const customFetch = async (input, init = {}) => {
  if (isLocalOrTunnel) {
    let url = typeof input === 'string' ? input : (input?.url || input?.toString() || '')
    url = url.replace('/rest/v1/', '/')

    // Unifica os headers do Request ou do init
    const headers = new Headers(input instanceof Request ? input.headers : (init.headers || {}))
    headers.delete('authorization')
    headers.delete('Authorization')

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    const newInit = {
      ...init,
      headers
    }

    return fetch(url, newInit)
  }
  return fetch(input, init)
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: isLocalOrTunnel ? { fetch: customFetch } : {}
  }
)
