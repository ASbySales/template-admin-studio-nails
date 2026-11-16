import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
  Send,
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { supabase } from '../lib/supabase'
import { getSegmentoMeta } from '../lib/segmento'
import { deslogarAdmin, lerVinculosEmCache, resolverTenantAtivo } from '../lib/tenantSession'
import { useAdminUI } from '../lib/adminUi'
import { AdminShell, PuxarAtualizar, Sheet } from '../componentes/AppLayout'

const WHATSAPP_AS = '5583988964507'
const CHAVE_PIX_PADRAO = '4lbert.ns@gmail.com'

async function buscarAssinaturaTenant(tId = null) {
  const { tenantId, vinculos } = await resolverTenantAtivo(tId)
  const [{ data: tenantData }, { data: assData, error: errAss }, { data: fatData, error: errFat }, { count: pendCount }] =
    await Promise.all([
      supabase.from('tenants').select('id, nome, segmento, ativo, whatsapp').eq('id', tenantId).single(),
      supabase.from('assinaturas_tenant').select('*').eq('tenant_id', tenantId).single(),
      supabase
        .from('faturas_tenant')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('data_vencimento', { ascending: false }),
      supabase
        .from('solicitacoes_agendamento')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pendente'),
    ])

  if (errAss && errAss.code !== 'PGRST116') {
    console.error('Erro ao buscar assinatura:', errAss)
  }
  if (errFat) {
    console.error('Erro ao buscar faturas:', errFat)
  }

  return {
    tenantId,
    vinculos,
    tenantData,
    assData: assData || null,
    fatData: fatData || [],
    pendCount: pendCount || 0,
  }
}

export default function MinhaAssinatura() {
  const navigate = useNavigate()
  const { avisar } = useAdminUI()

  const [loading, setLoading] = useState(true)
  const [activeTenantId, setActiveTenantId] = useState(() => {
    return localStorage.getItem('as_active_tenant') || 'demo'
  })
  const [userTenants, setUserTenants] = useState(lerVinculosEmCache)
  const [tenantInfo, setTenantInfo] = useState(null)
  const [assinatura, setAssinatura] = useState(null)
  const [faturas, setFaturas] = useState([])
  const [pendentesCount, setPendentesCount] = useState(0)
  const [copiado, setCopiado] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [reciboSelecionado, setReciboSelecionado] = useState(null)

  const aplicarDados = useCallback((dados) => {
    if (dados.vinculos.length > 0) setUserTenants(dados.vinculos)
    setActiveTenantId(dados.tenantId)
    if (dados.tenantData) {
      setTenantInfo(dados.tenantData)
      document.title = `${dados.tenantData.nome} • Minha Assinatura`
    }
    setAssinatura(dados.assData)
    setFaturas(dados.fatData)
    setPendentesCount(dados.pendCount)
  }, [])

  const carregarDados = useCallback(async (tId = null, exibirLoader = true) => {
    if (exibirLoader) setLoading(true)
    try {
      const dados = await buscarAssinaturaTenant(tId)
      aplicarDados(dados)
    } catch (err) {
      console.error('Erro ao carregar dados de assinatura:', err)
    } finally {
      setLoading(false)
      setAtualizando(false)
    }
  }, [aplicarDados])

  useEffect(() => {
    let ativo = true
    buscarAssinaturaTenant()
      .then((dados) => {
        if (ativo) aplicarDados(dados)
      })
      .catch((err) => {
        console.error('Erro ao carregar dados de assinatura:', err)
      })
      .finally(() => {
        if (ativo) {
          setLoading(false)
          setAtualizando(false)
        }
      })
    return () => {
      ativo = false
    }
  }, [aplicarDados])

  const handleTrocarTenant = (novoTenantId) => {
    setActiveTenantId(novoTenantId)
    setReciboSelecionado(null)
    localStorage.setItem('as_active_tenant', novoTenantId)
    carregarDados(novoTenantId)
  }

  const chavePixAtiva = assinatura?.chave_pix || CHAVE_PIX_PADRAO

  const handleCopiarPix = () => {
    navigator.clipboard.writeText(chavePixAtiva)
    setCopiado(true)
    avisar('Chave Pix copiada!')
    setTimeout(() => setCopiado(false), 2500)
  }

  const formatarData = (dataStr) => {
    if (!dataStr) return '--/--/----'
    try {
      const [ano, mes, dia] = dataStr.split('T')[0].split('-')
      return `${dia}/${mes}/${ano}`
    } catch {
      return dataStr
    }
  }

  const meta = getSegmentoMeta(tenantInfo?.segmento)
  const isIsento =
    Boolean(assinatura?.isento_cobranca) || parseFloat(assinatura?.valor_mensalidade ?? 69.9) === 0

  const statusBadge = (status) => {
    if (isIsento) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Cortesia / Isento de Mensalidade
        </span>
      )
    }
    switch (status) {
      case 'em_dia':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Assinatura em Dia
          </span>
        )
      case 'atrasado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Mensalidade Pendente
          </span>
        )
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <Lock className="w-3.5 h-3.5" />
            Acesso Suspenso
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">
            Pendente de Sincronização
          </span>
        )
    }
  }

  const valorMensalidade = parseFloat(assinatura?.valor_mensalidade || 0).toFixed(2).replace('.', ',')
  const qrcodeImg = assinatura?.qrcode_pix_url || '/qrcode-pix.jpg'

  const linkWhatsappComprovante = `https://wa.me/${WHATSAPP_AS}?text=${encodeURIComponent(
    `Olá! Segue o comprovante de pagamento da mensalidade da loja *${tenantInfo?.nome || activeTenantId}* (Valor: R$ ${valorMensalidade}). Poderia confirmar a baixa no sistema?`
  )}`

  return (
    <AdminShell
      titulo="ASSINATURA"
      tenantInfo={tenantInfo}
      userTenants={userTenants}
      activeTenantId={activeTenantId}
      onTrocarTenant={handleTrocarTenant}
      pendentesCount={pendentesCount}
      onDeslogar={() => deslogarAdmin(navigate)}
      maxWidthClass="max-w-4xl"
    >
      <PuxarAtualizar
        aoAtualizar={() => carregarDados(activeTenantId)}
        className="w-full p-3.5 sm:p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--as-accent-deep)' }}
          >
            {meta.emoji} Plano & Faturas
          </span>
          <button
            type="button"
            onClick={() => {
              setAtualizando(true)
              carregarDados(activeTenantId)
            }}
            disabled={atualizando}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-white border border-[var(--as-soft)] hover:bg-gray-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar Informações"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`}
              style={{ color: 'var(--as-accent-deep)' }}
            />
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-2">
            <div
              className="w-8 h-8 border-3 rounded-full animate-spin"
              style={{ borderColor: 'var(--as-soft)', borderTopColor: 'var(--as-accent)' }}
            />
            <span className="text-xs font-semibold">Carregando informações da assinatura...</span>
          </div>
        ) : (
          <>
            {/* Card Principal: Status da Assinatura */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[var(--as-card-border)] flex flex-col gap-4 text-left">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" style={{ color: 'var(--as-accent-deep)' }} />
                    Situação do Seu Estabelecimento
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Gerenciamento do plano mensal e regularização de faturas.
                  </p>
                </div>
                <div>{statusBadge(assinatura?.status)}</div>
              </div>

              {assinatura?.adiado_ate && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-800">
                  <div>
                    <strong className="font-bold">
                      ⏳ Prazo de Pagamento Estendido Temporariamente:
                    </strong>{' '}
                    Seu acesso foi mantido ativo mediante promessa de pagamento até{' '}
                    <strong>{formatarData(assinatura.adiado_ate)}</strong> (seu dia de vencimento
                    fixo permanece todo dia {assinatura?.dia_vencimento || 10}).
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                <div className="bg-[var(--as-bg)] rounded-2xl p-3.5 border border-[var(--as-card-border)]">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Valor do Plano
                  </span>
                  <span className="text-xl font-cinzel font-bold text-gray-900 mt-1 block">
                    {isIsento ? 'ISENTO (R$ 0,00)' : `R$ ${valorMensalidade}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {isIsento ? 'conta presenteada / cortesia' : 'cobrança mensal'}
                  </span>
                </div>

                <div className="bg-[var(--as-bg)] rounded-2xl p-3.5 border border-[var(--as-card-border)]">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Dia de Vencimento
                  </span>
                  <span className="text-xl font-cinzel font-bold text-gray-900 mt-1 block">
                    {isIsento ? 'Vitalício' : `Todo dia ${assinatura?.dia_vencimento || 10}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {isIsento ? 'sem vencimento mensal' : 'vencimento padrão fixo'}
                  </span>
                </div>

                <div className="bg-[var(--as-bg)] rounded-2xl p-3.5 border border-[var(--as-card-border)]">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Próxima Fatura
                  </span>
                  <span
                    className="text-xl font-cinzel font-bold mt-1 block"
                    style={{ color: 'var(--as-accent-deep)' }}
                  >
                    {isIsento ? 'Isento' : formatarData(assinatura?.proximo_vencimento)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {isIsento ? 'cobrança desativada' : 'limite para pagamento'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card de Pagamento Pix ou Aviso de Cortesia */}
            {isIsento ? (
              <div className="bg-purple-50/50 rounded-3xl p-6 border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                <div>
                  <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                    🎁 Conta Cortesia / Isenta de Cobrança Mensal
                  </h3>
                  <p className="text-xs text-purple-700 mt-1">
                    Este estabelecimento possui isenção ativa concedida pela administração da AS
                    Gestão Digital. Nenhuma cobrança mensal é gerada para esta conta.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[var(--as-card-border)] flex flex-col gap-5 text-left">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Pagamento via Pix (Antecipação ou Regularização)
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Escaneie o QR Code abaixo ou copie a chave Pix Copia e Cola para realizar o
                    pagamento.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 bg-emerald-50/40 border border-emerald-100/80 rounded-2xl p-5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-44 h-44 bg-white p-2 rounded-xl shadow-sm border border-emerald-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={qrcodeImg}
                        alt="QR Code Pix"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.src = '/qrcode-pix.jpg'
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      QR Code Pix Oficial
                    </span>
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        Chave Pix (Copia e Cola):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={chavePixAtiva}
                          className="w-full bg-white px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl text-gray-600 focus:outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopiarPix}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                            copiado
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-900 hover:bg-gray-800 text-white active:scale-95'
                          }`}
                        >
                          {copiado ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-100">
                      <span className="text-xs text-gray-600 block mb-2 font-medium">
                        Após pagar pelo seu aplicativo bancário, envie o comprovante para liberação
                        automática do recibo:
                      </span>
                      <a
                        href={linkWhatsappComprovante}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:scale-[1.01] active:scale-95 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Comprovante no WhatsApp da AS</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Histórico de Faturas */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[var(--as-card-border)] flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5" style={{ color: 'var(--as-accent-deep)' }} />
                    Histórico de Faturas & Notas Comprovantes
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Notas comprovantes e recibos emitidos automaticamente pela Torre após a baixa do
                    pagamento.
                  </p>
                </div>
              </div>

              {faturas.length === 0 ? (
                <div className="bg-[var(--as-bg)] rounded-2xl p-8 text-center text-gray-400 border border-dashed border-[var(--as-soft)]">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold text-gray-500">
                    Nenhuma fatura registrada no momento.
                  </p>
                  <span className="text-[11px] text-gray-400 block mt-1">
                    Assim que a Torre registrar os ciclos de pagamento, as notas comprovantes
                    aparecerão aqui.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px]">
                        <th className="pb-2">Competência</th>
                        <th className="pb-2">Vencimento</th>
                        <th className="pb-2">Valor</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Nota Comprovante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {faturas.map((fat) => {
                        const isPago = fat.status === 'pago' || fat.status === 'paga'
                        const isAtrasado = fat.status === 'atrasado' || fat.status === 'atrasada'
                        return (
                          <tr key={fat.id} className="hover:bg-gray-50/50">
                            <td className="py-3 font-bold text-gray-800">{fat.competencia}</td>
                            <td className="py-3 text-gray-600">{formatarData(fat.data_vencimento)}</td>
                            <td className="py-3 font-semibold text-gray-800">
                              R$ {parseFloat(fat.valor || 0).toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3">
                              {isPago ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                  Pago
                                </span>
                              ) : isAtrasado ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                                  Atrasado
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              {isPago ? (
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setReciboSelecionado(fat)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all"
                                    style={{
                                      backgroundColor: 'var(--as-blush)',
                                      color: 'var(--as-accent-deep)',
                                    }}
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Ver Nota Comprovante</span>
                                  </button>
                                  {(fat.recibo_url || fat.recibo_path) &&
                                    String(fat.recibo_url || fat.recibo_path).startsWith('http') && (
                                      <a
                                        href={fat.recibo_url || fat.recibo_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-bold text-[11px]"
                                        title="Abrir Anexo Original"
                                      >
                                        <span>Anexo</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[10px]">Aguardando Baixa</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </PuxarAtualizar>

      {reciboSelecionado && (
        <Sheet
          titulo="NOTA COMPROVANTE DE QUITAÇÃO"
          subtitulo="AS Gestão Digital • Recibo Oficial"
          aoFechar={() => setReciboSelecionado(null)}
          rodape={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs cursor-pointer transition-all"
              >
                Imprimir / Salvar PDF
              </button>
              <button
                type="button"
                onClick={() => setReciboSelecionado(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer transition-all"
              >
                Fechar
              </button>
            </div>
          }
        >
          <div className="flex items-center gap-2.5 mb-3">
            <img
              src={AlbertSalesLogo}
              alt="AS Gestão"
              className="w-8 h-8 rounded-full object-cover bg-[#0F172A]"
            />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--as-accent-deep)' }}
            >
              {meta.emoji} {tenantInfo?.nome || activeTenantId}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 space-y-2.5 text-xs border border-[var(--as-card-border)]">
            <div className="flex justify-between">
              <span className="text-gray-500">Estabelecimento:</span>
              <span className="font-bold text-gray-900">{tenantInfo?.nome || activeTenantId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Competência:</span>
              <span className="font-bold text-gray-900">{reciboSelecionado.competencia}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Valor Liquidado:</span>
              <span className="font-bold text-emerald-700">
                R$ {parseFloat(reciboSelecionado.valor || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data de Vencimento:</span>
              <span className="text-gray-800">{formatarData(reciboSelecionado.data_vencimento)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data da Baixa / Quitação:</span>
              <span className="text-gray-800">
                {reciboSelecionado.data_pagamento
                  ? formatarData(reciboSelecionado.data_pagamento)
                  : formatarData(new Date().toISOString())}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-500">Autenticação:</span>
              <span className="font-mono text-[10px] text-gray-600">
                {String(reciboSelecionado.id).slice(0, 18).toUpperCase()}
              </span>
            </div>
          </div>

          {(reciboSelecionado.recibo_url || reciboSelecionado.recibo_path) && (
            <div className="mt-3">
              {String(reciboSelecionado.recibo_url || reciboSelecionado.recibo_path).startsWith(
                'http'
              ) ? (
                <a
                  href={reciboSelecionado.recibo_url || reciboSelecionado.recibo_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Visualizar Comprovante / Anexo Enviado</span>
                </a>
              ) : (
                <div className="w-full py-2 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Comprovante validado e arquivado com segurança na Torre</span>
                </div>
              )}
            </div>
          )}
        </Sheet>
      )}
    </AdminShell>
  )
}
