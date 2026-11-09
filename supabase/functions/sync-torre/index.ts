// supabase/functions/sync-torre/index.ts
// Edge Function da AS Gestão (lbtbxkwffixnvbsibcip)
// Recebe comandos autenticados do Admin Master da Torre e sincroniza usando SUPABASE_SERVICE_ROLE_KEY nativa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-torre-admin-jwt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const TORRE_SUPABASE_URL = 'https://mejqqeikokadefyfqajk.supabase.co'
const TORRE_SUPABASE_ANON_KEY = 'sb_publishable_XMwhuIOUwF4qyK9q330nRw_1ewUHPq8'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Valida o JWT do Admin Master emitido pelo Supabase da Torre
    const torreJwt = req.headers.get('x-torre-admin-jwt') || ''
    if (!torreJwt) {
      return new Response(JSON.stringify({ error: 'Token Admin Master da Torre ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const torreClient = createClient(TORRE_SUPABASE_URL, TORRE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${torreJwt}` } }
    })

    const { data: userData, error: userErr } = await torreClient.auth.getUser()
    const user = userData?.user
    const appRole = user?.app_metadata?.torre_role || user?.app_metadata?.role

    if (userErr || !user || appRole !== 'admin_master') {
      return new Response(JSON.stringify({ error: 'Acesso negado: usuário não é Admin Master da Torre.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Conecta ao banco da AS Gestão usando a SERVICE_ROLE_KEY nativa do ambiente do Supabase
    const asGestaoUrl = Deno.env.get('SUPABASE_URL')!
    const asGestaoServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const asAdmin = createClient(asGestaoUrl, asGestaoServiceKey)

    const body = await req.json()
    const {
      tenant_id,
      status,
      valor_mensalidade,
      dia_vencimento,
      proximo_vencimento,
      isento_cobranca,
      adiado_ate,
      fatura_paga
    } = body

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Se veio atualização de status, executa a RPC segura restrita a service_role
    if (status) {
      await asAdmin.rpc('sincronizar_status_assinatura_torre', {
        p_tenant_id: tenant_id,
        p_status: status
      })
    }

    // 4. Atualiza campos complementares da assinatura (isenção, adiamento, próximo vencimento)
    const updateAssinatura: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (status !== undefined) updateAssinatura.status = status
    if (valor_mensalidade !== undefined) updateAssinatura.valor_mensalidade = valor_mensalidade
    if (dia_vencimento !== undefined) updateAssinatura.dia_vencimento = dia_vencimento
    if (proximo_vencimento !== undefined) updateAssinatura.proximo_vencimento = proximo_vencimento
    if (isento_cobranca !== undefined) updateAssinatura.isento_cobranca = isento_cobranca
    if (adiado_ate !== undefined) updateAssinatura.adiado_ate = adiado_ate

    await asAdmin
      .from('assinaturas_tenant')
      .upsert({ tenant_id, ...updateAssinatura }, { onConflict: 'tenant_id' })

    // 5. Se veio fatura/recibo (Nota Comprovante), grava em faturas_tenant na conta do cliente
    if (fatura_paga && fatura_paga.competencia) {
      await asAdmin
        .from('faturas_tenant')
        .upsert(
          {
            tenant_id,
            competencia: fatura_paga.competencia,
            valor: fatura_paga.valor ?? 69.9,
            data_vencimento: fatura_paga.data_vencimento,
            data_pagamento: fatura_paga.data_pagamento || new Date().toISOString(),
            status: fatura_paga.status || 'pago',
            recibo_url: fatura_paga.recibo_url || null
          },
          { onConflict: 'tenant_id,competencia' }
        )
    }

    return new Response(
      JSON.stringify({ sucesso: true, tenant_id, status_aplicado: status || 'mantido' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
