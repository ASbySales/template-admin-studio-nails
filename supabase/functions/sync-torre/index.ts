// supabase/functions/sync-torre/index.ts
// Edge Function da AS Gestão (lbtbxkwffixnvbsibcip)
// Recebe comandos autenticados do Admin Master da Torre e sincroniza usando SUPABASE_SERVICE_ROLE_KEY nativa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://gestao.asales.online',
  'https://www.gestao.asales.online',
  'http://localhost:5173',
  'http://localhost:3000'
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
const VALID_FATURA_STATUS = new Set(['pendente', 'paga', 'atrasada', 'cancelada', 'estornada'])
const COMPETENCIA_REGEX = /^(0[1-9]|1[0-2])\/\d{4}$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

    // 2. Conecta ao banco da AS Gestão usando a SERVICE_ROLE_KEY nativa do ambiente
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

    const body = await req.json()
    const tenant_id = typeof body?.tenant_id === 'string' ? body.tenant_id.trim() : ''

    if (!tenant_id || tenant_id.length > 80) {
      return new Response(JSON.stringify({ error: 'tenant_id inválido ou ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const status = body?.status !== undefined ? String(body.status).trim() : undefined
    if (status !== undefined && !VALID_ASSINATURA_STATUS.has(status)) {
      return new Response(JSON.stringify({ error: 'Status de assinatura inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Se veio atualização de status, executa a RPC segura restrita a service_role e verifica erro
    if (status) {
      const { error: rpcErr } = await asAdmin.rpc('sincronizar_status_assinatura_torre', {
        p_tenant_id: tenant_id,
        p_status: status
      })
      if (rpcErr) {
        console.error('[sync-torre] Erro na RPC sincronizar_status_assinatura_torre:', rpcErr.message)
        return new Response(JSON.stringify({ error: 'Falha ao sincronizar status da assinatura.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 4. Atualiza campos complementares da assinatura e verifica erro
    const updateAssinatura: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (status !== undefined) updateAssinatura.status = status
    if (body?.valor_mensalidade !== undefined) {
      const val = Number(body.valor_mensalidade)
      if (!Number.isFinite(val) || val < 0) {
        return new Response(JSON.stringify({ error: 'valor_mensalidade inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.valor_mensalidade = val
    }
    if (body?.dia_vencimento !== undefined) {
      const dia = Number(body.dia_vencimento)
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        return new Response(JSON.stringify({ error: 'dia_vencimento deve estar entre 1 e 31.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.dia_vencimento = dia
    }
    if (body?.proximo_vencimento !== undefined) {
      if (body.proximo_vencimento !== null && !ISO_DATE_REGEX.test(String(body.proximo_vencimento))) {
        return new Response(JSON.stringify({ error: 'proximo_vencimento deve estar no formato YYYY-MM-DD.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.proximo_vencimento = body.proximo_vencimento
    }
    if (body?.isento_cobranca !== undefined) {
      updateAssinatura.isento_cobranca = Boolean(body.isento_cobranca)
    }
    if (body?.adiado_ate !== undefined) {
      if (body.adiado_ate !== null && !ISO_DATE_REGEX.test(String(body.adiado_ate))) {
        return new Response(JSON.stringify({ error: 'adiado_ate deve estar no formato YYYY-MM-DD.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      updateAssinatura.adiado_ate = body.adiado_ate
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

    // 5. Se veio fatura/recibo (Nota Comprovante), valida os campos e grava em faturas_tenant
    if (body?.fatura_paga) {
      const fp = body.fatura_paga
      const competencia = typeof fp.competencia === 'string' ? fp.competencia.trim() : ''
      if (!COMPETENCIA_REGEX.test(competencia)) {
        return new Response(JSON.stringify({ error: 'competencia da fatura deve estar no formato MM/YYYY.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const valorFatura = Number(fp.valor ?? 69.9)
      if (!Number.isFinite(valorFatura) || valorFatura < 0) {
        return new Response(JSON.stringify({ error: 'valor da fatura inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const dataVencimento = String(fp.data_vencimento || '').trim()
      if (!ISO_DATE_REGEX.test(dataVencimento)) {
        return new Response(JSON.stringify({ error: 'data_vencimento da fatura deve estar no formato YYYY-MM-DD.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const statusFaturaBruto = String(fp.status || 'paga').trim()
      const statusFatura = statusFaturaBruto === 'pago' ? 'paga' : statusFaturaBruto
      if (!VALID_FATURA_STATUS.has(statusFatura)) {
        return new Response(JSON.stringify({ error: 'status da fatura inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const reciboPath = typeof fp.recibo_path === 'string' && fp.recibo_path.trim().length > 0
        ? fp.recibo_path.trim()
        : null

      const { error: upsertFaturaErr } = await asAdmin
        .from('faturas_tenant')
        .upsert(
          {
            tenant_id,
            competencia,
            valor: valorFatura,
            data_vencimento: dataVencimento,
            data_pagamento: statusFatura === 'paga' ? (fp.data_pagamento || new Date().toISOString()) : null,
            status: statusFatura,
            recibo_path: reciboPath
          },
          { onConflict: 'tenant_id,competencia' }
        )

      if (upsertFaturaErr) {
        console.error('[sync-torre] Erro no upsert de faturas_tenant:', upsertFaturaErr.message)
        return new Response(JSON.stringify({ error: 'Falha ao sincronizar fatura do tenant.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(
      JSON.stringify({ sucesso: true, tenant_id, status_aplicado: status || 'mantido' }),
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
