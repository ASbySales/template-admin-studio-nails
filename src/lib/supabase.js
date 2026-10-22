import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lbtbxkwffixnvbsibcip.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JT7TZAE_0fxQcBHD8X-XpA_CHHmR9FT'

// Adaptador inteligente para Docker PostgREST local e túneis (Localtunnel/Ngrok)
const isLocalOrTunnel = supabaseUrl && !supabaseUrl.includes('supabase.co')

const customFetch = async (input, init = {}) => {
  if (isLocalOrTunnel) {
    let url = typeof input === 'string' ? input : (input?.url || input?.toString() || '')
    url = url.replace('/rest/v1/', '/')

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
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    global: isLocalOrTunnel ? { fetch: customFetch } : {}
  }
)
