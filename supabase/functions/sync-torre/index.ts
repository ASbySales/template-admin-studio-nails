// supabase/functions/sync-torre/index.ts
// Edge Function da AS Gestão (lbtbxkwffixnvbsibcip)
// Valida o Admin Master na Torre e executa 1 única RPC transacional atômica no banco da AS Gestão.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const ALLOWED_ORIGINS = new Set([
  'https://gestao.asales.online',
  'https://www.gestao.asales.online'
])

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://gestao.asales.online'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-torre-admin-jwt',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
}

const TORRE_SUPABASE_URL = 'https://mejqqeikokadefyfqajk.supabase.co'
const TORRE_SUPABASE_ANON_KEY = 'sb_publishable_XMwhuIOUwF4qyK9q330nRw_1ewUHPq8'

const VALID_ASSINATURA_STATUS = new Set(['em_dia', 'atrasado', 'bloqueado', 'pendente_sync'])
const COMPETENCIA_REGEX = /^(0[1-9]|1[0-2])\/(20\d{2}|2100)$/
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_REGEX.exec(value.trim())
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 2000 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

function parseStrictIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = ISO_TIMESTAMP_REGEX.exec(trimmed)
  if (!match) return null
  if (!isValidCalendarDate(match[1])) return null

  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // 1. Valida o JWT do Admin Master explicitamente contra o Auth da Torre
    const torreJwt = (req.headers.get('x-torre-admin-jwt') || '').trim()
    if (!torreJwt) {
      return new Response(JSON.stringify({ error: 'Token Admin Master da Torre ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const torreClient = createClient(TORRE_SUPABASE_URL, TORRE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${torreJwt}` } }
    })

    const { data: userData, error: userErr } = await torreClient.auth.getUser(torreJwt)
    const user = userData?.user
    const appRole = user?.app_metadata?.torre_role || user?.app_metadata?.role

    if (userErr || !user || appRole !== 'admin_master') {
      return new Response(JSON.stringify({ error: 'Acesso negado: usuário não é Admin Master da Torre.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Valida também no banco da Torre a política oficial admin_master_aal2() com o JWT já verificado
    const { data: isAal2Authorized, error: aal2Err } = await torreClient
      .schema('torre')
      .rpc('admin_master_aal2')

    if (aal2Err || isAal2Authorized !== true) {
      return new Response(JSON.stringify({ error: 'Acesso negado pela política de segurança da Torre (admin_master_aal2).' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Valida 100% do payload antes de qualquer chamada ao banco
    let body: Record<string, unknown>
    try {
      const parsed = await req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return new Response(JSON.stringify({ error: 'Payload JSON deve ser um objeto.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      body = parsed as Record<string, unknown>
    } catch {
      return new Response(JSON.stringify({ error: 'JSON malformado na requisição.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
    if (!tenant_id || tenant_id.length > 80 || !/^[a-z0-9_-]+$/i.test(tenant_id)) {
      return new Response(JSON.stringify({ error: 'tenant_id inválido ou ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let statusValidado: string | null = null
    if (body.status !== undefined && body.status !== null) {
      if (typeof body.status !== 'string' || !VALID_ASSINATURA_STATUS.has(body.status.trim())) {
        return new Response(JSON.stringify({ error: 'Status de assinatura inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      statusValidado = body.status.trim()
    }

    let valorMensalidadeValidado: number | null = null
    if (body.valor_mensalidade !== undefined && body.valor_mensalidade !== null) {
      const val = Number(body.valor_mensalidade)
      if (!Number.isFinite(val) || val < 0 || val > 100000) {
        return new Response(JSON.stringify({ error: 'valor_mensalidade inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      valorMensalidadeValidado = Number(val.toFixed(2))
    }

    let diaVencimentoValidado: number | null = null
    if (body.dia_vencimento !== undefined && body.dia_vencimento !== null) {
      const dia = Number(body.dia_vencimento)
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        return new Response(JSON.stringify({ error: 'dia_vencimento deve ser um inteiro entre 1 e 31.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      diaVencimentoValidado = dia
    }

    const limparProximoVencimento = body.proximo_vencimento === null
    let proximoVencimentoValidado: string | null = null
    if (body.proximo_vencimento !== undefined && body.proximo_vencimento !== null) {
      if (!isValidCalendarDate(body.proximo_vencimento)) {
        return new Response(JSON.stringify({ error: 'proximo_vencimento deve ser uma data real YYYY-MM-DD ou null.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      proximoVencimentoValidado = body.proximo_vencimento.trim()
    }

    let isentoCobrancaValidado: boolean | null = null
    if (body.isento_cobranca !== undefined && body.isento_cobranca !== null) {
      if (typeof body.isento_cobranca !== 'boolean') {
        return new Response(JSON.stringify({ error: 'isento_cobranca deve ser estritamente booleano.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      isentoCobrancaValidado = body.isento_cobranca
    }

    const limparAdiamento = body.adiado_ate === null
    let adiadoAteValidado: string | null = null
    if (body.adiado_ate !== undefined && body.adiado_ate !== null) {
      if (!isValidCalendarDate(body.adiado_ate)) {
        return new Response(JSON.stringify({ error: 'adiado_ate deve ser uma data real YYYY-MM-DD ou null.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      adiadoAteValidado = body.adiado_ate.trim()
    }

    let faturaPagaValidada: {
      competencia: string
      valor: number
      data_vencimento: string
      data_pagamento: string
      status: 'paga'
      recibo_path: string | null
    } | null = null

    if (body.fatura_paga !== undefined && body.fatura_paga !== null) {
      if (typeof body.fatura_paga !== 'object' || Array.isArray(body.fatura_paga)) {
        return new Response(JSON.stringify({ error: 'fatura_paga deve ser um objeto válido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const fp = body.fatura_paga as Record<string, unknown>

      const competencia = typeof fp.competencia === 'string' ? fp.competencia.trim() : ''
      if (!COMPETENCIA_REGEX.test(competencia)) {
        return new Response(JSON.stringify({ error: 'competencia da fatura_paga deve estar no formato MM/YYYY.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const valorFatura = Number(fp.valor)
      if (!Number.isFinite(valorFatura) || valorFatura < 0 || valorFatura > 100000) {
        return new Response(JSON.stringify({ error: 'valor da fatura_paga inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!isValidCalendarDate(fp.data_vencimento)) {
        return new Response(JSON.stringify({ error: 'data_vencimento da fatura_paga deve ser uma data real YYYY-MM-DD.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (fp.status !== undefined && fp.status !== 'paga') {
        return new Response(JSON.stringify({ error: 'fatura_paga aceita apenas status "paga".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let dataPagamentoIso = new Date().toISOString()
      if (fp.data_pagamento !== undefined && fp.data_pagamento !== null) {
        const parsedTs = parseStrictIsoTimestamp(fp.data_pagamento)
        if (!parsedTs) {
          return new Response(JSON.stringify({ error: 'data_pagamento deve estar no formato estrito ISO-8601 (YYYY-MM-DDTHH:mm:ssZ).' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        dataPagamentoIso = parsedTs
      }

      let reciboPath: string | null = null
      if (fp.recibo_path !== undefined && fp.recibo_path !== null) {
        if (typeof fp.recibo_path !== 'string' || fp.recibo_path.trim().length > 500) {
          return new Response(JSON.stringify({ error: 'recibo_path inválido.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        reciboPath = fp.recibo_path.trim() || null
      }

      faturaPagaValidada = {
        competencia,
        valor: Number(valorFatura.toFixed(2)),
        data_vencimento: fp.data_vencimento.trim(),
        data_pagamento: dataPagamentoIso,
        status: 'paga',
        recibo_path: reciboPath
      }
    }

    // 3. Executa UMA ÚNICA RPC transacional atômica no banco da AS Gestão
    const asGestaoUrl = Deno.env.get('SUPABASE_URL')
    const asGestaoSecretKey =
      Deno.env.get('SUPABASE_SECRET_KEY') ||
      Deno.env.get('AS_GESTAO_SECRET_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!asGestaoUrl || !asGestaoSecretKey) {
      return new Response(JSON.stringify({ error: 'Configuração interna do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const asAdmin = createClient(asGestaoUrl, asGestaoSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: rpcData, error: rpcErr } = await asAdmin.rpc('sincronizar_status_assinatura_torre', {
      p_tenant_id: tenant_id,
      p_status: statusValidado,
      p_valor_mensalidade: valorMensalidadeValidado,
      p_dia_vencimento: diaVencimentoValidado,
      p_proximo_vencimento: proximoVencimentoValidado,
      p_limpar_proximo_vencimento: limparProximoVencimento,
      p_isento_cobranca: isentoCobrancaValidado,
      p_adiado_ate: adiadoAteValidado,
      p_limpar_adiamento: limparAdiamento,
      p_fatura_paga: faturaPagaValidada
    })

    if (rpcErr) {
      console.error('[sync-torre] Erro na RPC transacional sincronizar_status_assinatura_torre:', rpcErr.message)
      return new Response(JSON.stringify({ error: 'Falha ao sincronizar assinatura/fatura no banco.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(
      JSON.stringify(rpcData || { sucesso: true, tenant_id, status_aplicado: statusValidado || 'mantido' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[sync-torre] Exceção inesperada:', err)
    return new Response(JSON.stringify({ error: 'Erro interno ao processar sincronização.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
