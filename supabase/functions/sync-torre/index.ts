// supabase/functions/sync-torre/index.ts
// Edge Function da AS Gestão (lbtbxkwffixnvbsibcip)
// Recebe comandos autenticados do Admin Master da Torre e sincroniza usando SUPABASE_SERVICE_ROLE_KEY nativa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

/**
 * Valida se uma string YYYY-MM-DD representa uma data real de calendário (ex: rejeita 2025-99-99 e 2026-02-30).
 */
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

/**
 * Valida se uma string representa um timestamp ISO-8601 válido e retorna sua forma canônica ISO.
 */
function parseValidIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length < 10 || trimmed.length > 40) return null
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
      auth: { persistSession: false, autoRefreshToken: false }
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

    // 2. Lê e valida TODO o payload ANTES de qualquer escrita no banco
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

    let statusValidado: string | undefined = undefined
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VALID_ASSINATURA_STATUS.has(body.status.trim())) {
        return new Response(JSON.stringify({ error: 'Status de assinatura inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      statusValidado = body.status.trim()
    }

    const updateAssinatura: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (statusValidado !== undefined) {
      updateAssinatura.status = statusValidado
    }

    if (body.valor_mensalidade !== undefined) {
      const val = Number(body.valor_mensalidade)
      if (!Number.isFinite(val) || val < 0 || val > 100000) {
        return new Response(JSON.stringify({ error: 'valor_mensalidade inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.valor_mensalidade = Number(val.toFixed(2))
    }

    if (body.dia_vencimento !== undefined) {
      const dia = Number(body.dia_vencimento)
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        return new Response(JSON.stringify({ error: 'dia_vencimento deve ser um inteiro entre 1 e 31.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.dia_vencimento = dia
    }

    if (body.proximo_vencimento !== undefined) {
      if (body.proximo_vencimento !== null && !isValidCalendarDate(body.proximo_vencimento)) {
        return new Response(JSON.stringify({ error: 'proximo_vencimento deve ser uma data real no formato YYYY-MM-DD ou null.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.proximo_vencimento = body.proximo_vencimento === null ? null : body.proximo_vencimento.trim()
    }

    if (body.isento_cobranca !== undefined) {
      if (typeof body.isento_cobranca !== 'boolean') {
        return new Response(JSON.stringify({ error: 'isento_cobranca deve ser estritamente um booleano (true ou false).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.isento_cobranca = body.isento_cobranca
    }

    if (body.adiado_ate !== undefined) {
      if (body.adiado_ate !== null && !isValidCalendarDate(body.adiado_ate)) {
        return new Response(JSON.stringify({ error: 'adiado_ate deve ser uma data real no formato YYYY-MM-DD ou null.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.adiado_ate = body.adiado_ate === null ? null : body.adiado_ate.trim()
    }

    // Validação completa de fatura_paga ANTES de qualquer escrita
    let faturaPagaValidada: {
      tenant_id: string
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

      // Contrato estrito: fatura_paga só aceita status 'paga'
      if (fp.status !== undefined && fp.status !== 'paga') {
        return new Response(JSON.stringify({ error: 'fatura_paga aceita apenas status "paga".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let dataPagamentoIso = new Date().toISOString()
      if (fp.data_pagamento !== undefined && fp.data_pagamento !== null) {
        const parsedTs = parseValidIsoTimestamp(fp.data_pagamento)
        if (!parsedTs) {
          return new Response(JSON.stringify({ error: 'data_pagamento deve ser um timestamp ISO-8601 válido.' }), {
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
        tenant_id,
        competencia,
        valor: Number(valorFatura.toFixed(2)),
        data_vencimento: fp.data_vencimento.trim(),
        data_pagamento: dataPagamentoIso,
        status: 'paga',
        recibo_path: reciboPath
      }
    }

    // 3. Somente após 100% do payload estar validado, abre conexão service_role e executa as escritas
    const asGestaoUrl = Deno.env.get('SUPABASE_URL')
    const asGestaoServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!asGestaoUrl || !asGestaoServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuração interna do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const asAdmin = createClient(asGestaoUrl, asGestaoServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    if (statusValidado) {
      const { error: rpcErr } = await asAdmin.rpc('sincronizar_status_assinatura_torre', {
        p_tenant_id: tenant_id,
        p_status: statusValidado
      })
      if (rpcErr) {
        console.error('[sync-torre] Erro na RPC sincronizar_status_assinatura_torre:', rpcErr.message)
        return new Response(JSON.stringify({ error: 'Falha ao sincronizar status da assinatura.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const { error: upsertAssinaturaErr } = await asAdmin
      .from('assinaturas_tenant')
      .upsert({ tenant_id, ...updateAssinatura }, { onConflict: 'tenant_id' })

    if (upsertAssinaturaErr) {
      console.error('[sync-torre] Erro no upsert de assinaturas_tenant:', upsertAssinaturaErr.message)
      return new Response(JSON.stringify({ error: 'Falha ao atualizar dados da assinatura.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (faturaPagaValidada) {
      const { error: upsertFaturaErr } = await asAdmin
        .from('faturas_tenant')
        .upsert(faturaPagaValidada, { onConflict: 'tenant_id,competencia' })

      if (upsertFaturaErr) {
        console.error('[sync-torre] Erro no upsert de faturas_tenant:', upsertFaturaErr.message)
        return new Response(JSON.stringify({ error: 'Falha ao sincronizar fatura paga do tenant.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(
      JSON.stringify({ sucesso: true, tenant_id, status_aplicado: statusValidado || 'mantido' }),
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
