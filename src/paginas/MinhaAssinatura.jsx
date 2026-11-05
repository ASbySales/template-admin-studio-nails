import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
    ArrowLeft, 
    CreditCard, 
    CheckCircle2, 
    AlertTriangle, 
    Lock, 
    Copy, 
    Check, 
    Send, 
    FileText, 
    Calendar, 
    DollarSign,
    RefreshCw,
    ExternalLink
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'

const WHATSAPP_AS = '5583996327988'

export default function MinhaAssinatura() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [activeTenantId, setActiveTenantId] = useState(() => {
        return localStorage.getItem('as_active_tenant') || 'demo'
    })
    const [tenantInfo, setTenantInfo] = useState(null)
    const [assinatura, setAssinatura] = useState(null)
    const [faturas, setFaturas] = useState([])
    const [copiado, setCopiado] = useState(false)
    const [atualizando, setAtualizando] = useState(false)

    useEffect(() => {
        carregarDados()
    }, [activeTenantId])

    const carregarDados = async () => {
        setLoading(true)
        try {
            // 1. Carrega dados do tenant
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, nome, segmento, ativo, whatsapp')
                .eq('id', activeTenantId)
                .single()
            setTenantInfo(tenantData)

            // 2. Carrega dados da assinatura do tenant
            const { data: assData, error: errAss } = await supabase
                .from('assinaturas_tenant')
                .select('*')
                .eq('tenant_id', activeTenantId)
                .single()

            if (errAss && errAss.code !== 'PGRST116') {
                console.error('Erro ao buscar assinatura:', errAss)
            }
            setAssinatura(assData)

            // 3. Carrega histórico de faturas do tenant
            const { data: fatData, error: errFat } = await supabase
                .from('faturas_tenant')
                .select('*')
                .eq('tenant_id', activeTenantId)
                .order('data_vencimento', { ascending: false })

            if (errFat) {
                console.error('Erro ao buscar faturas:', errFat)
            }
            setFaturas(fatData || [])
        } catch (err) {
            console.error('Erro ao carregar dados de assinatura:', err)
        } finally {
            setLoading(false)
            setAtualizando(false)
        }
    }

    const handleCopiarPix = () => {
        if (!assinatura?.chave_pix) return
        navigator.clipboard.writeText(assinatura.chave_pix)
        setCopiado(true)
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

    const statusBadge = (status) => {
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
        <div className="min-h-screen bg-gray-50 flex flex-col items-center">
            {/* Topbar */}
            <header className="w-full bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/')}
                        className="h-9 w-9 hover:scale-105 active:scale-95 flex justify-center items-center rounded-full bg-gray-100 text-gray-600 transition-all cursor-pointer"
                        title="Voltar ao Painel"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="text-left">
                        <h1 className="text-md font-cinzel font-bold text-gray-900 tracking-wider">AS GESTÃO</h1>
                        <span className="text-[10px] block font-sans font-bold text-[#C5A059]">
                            {tenantInfo?.segmento === 'nail_design' ? '💅' : '🌸'} MINHA ASSINATURA • {tenantInfo?.nome || activeTenantId}
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => {
                        setAtualizando(true)
                        carregarDados()
                    }}
                    disabled={atualizando}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    title="Atualizar Informações"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#C5A059] ${atualizando ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Atualizar</span>
                </button>
            </header>

            {/* Conteúdo Principal */}
            <main className="w-full max-w-4xl p-4 sm:p-6 flex flex-col gap-6">
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-2">
                        <div className="w-8 h-8 border-3 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold">Carregando informações da assinatura...</span>
                    </div>
                ) : (
                    <>
                        {/* Card Principal: Status da Assinatura */}
                        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-gray-100 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-[#C5A059]" />
                                        Situação do Seu Estabelecimento
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Gerenciamento do plano mensal e regularização de faturas.
                                    </p>
                                </div>
                                <div>
                                    {statusBadge(assinatura?.status)}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Valor do Plano</span>
                                    <span className="text-xl font-cinzel font-bold text-gray-900 mt-1 block">
                                        R$ {valorMensalidade}
                                    </span>
                                    <span className="text-[10px] text-gray-400">cobrança mensal</span>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Dia de Vencimento</span>
                                    <span className="text-xl font-cinzel font-bold text-gray-900 mt-1 block">
                                        Todo dia {assinatura?.dia_vencimento || 10}
                                    </span>
                                    <span className="text-[10px] text-gray-400">vencimento padrão</span>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Próxima Fatura</span>
                                    <span className="text-xl font-cinzel font-bold text-[#C5A059] mt-1 block">
                                        {formatarData(assinatura?.proximo_vencimento)}
                                    </span>
                                    <span className="text-[10px] text-gray-400">limite para pagamento</span>
                                </div>
                            </div>
                        </div>

                        {/* Card de Pagamento Pix / Antecipação */}
                        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-gray-100 flex flex-col gap-5">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-emerald-600" />
                                    Pagamento via Pix (Antecipação ou Regularização)
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Escaneie o QR Code abaixo ou copie a chave Pix Copia e Cola para realizar o pagamento.
                                </p>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-6 bg-emerald-50/40 border border-emerald-100/80 rounded-2xl p-5">
                                {/* Imagem do QR Code */}
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

                                {/* Chave Copia e Cola & Botão de WhatsApp */}
                                <div className="flex-1 w-full flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">
                                            Chave Pix (Copia e Cola):
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                readOnly 
                                                value={assinatura?.chave_pix || ''}
                                                className="w-full bg-white px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl text-gray-600 focus:outline-none select-all"
                                            />
                                            <button 
                                                onClick={handleCopiarPix}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                                                    copiado 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : 'bg-gray-900 hover:bg-gray-800 text-white active:scale-95'
                                                }`}
                                            >
                                                {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-emerald-100">
                                        <span className="text-xs text-gray-600 block mb-2 font-medium">
                                            Após pagar pelo seu aplicativo bancário, envie o comprovante para liberação automática do recibo:
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

                        {/* Card de Histórico de Faturas & Recibos */}
                        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-gray-100 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-[#C5A059]" />
                                        Histórico de Faturas & Recibos
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Recibos emitidos pelo sistema central da Torre após a confirmação do pagamento.
                                    </p>
                                </div>
                            </div>

                            {faturas.length === 0 ? (
                                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 border border-dashed border-gray-200">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-xs font-semibold text-gray-500">Nenhuma fatura registrada no momento.</p>
                                    <span className="text-[11px] text-gray-400 block mt-1">
                                        Assim que a Torre registrar os ciclos de pagamento, os recibos aparecerão aqui.
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
                                                <th className="pb-2 text-right">Recibo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {faturas.map((fat) => (
                                                <tr key={fat.id} className="hover:bg-gray-50/50">
                                                    <td className="py-3 font-bold text-gray-800">{fat.competencia}</td>
                                                    <td className="py-3 text-gray-600">{formatarData(fat.data_vencimento)}</td>
                                                    <td className="py-3 font-semibold text-gray-800">
                                                        R$ {parseFloat(fat.valor || 0).toFixed(2).replace('.', ',')}
                                                    </td>
                                                    <td className="py-3">
                                                        {fat.status === 'paga' ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Paga</span>
                                                        ) : fat.status === 'atrasada' ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">Atrasada</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">Pendente</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        {fat.recibo_path || fat.recibo_url ? (
                                                            <a 
                                                                href={fat.recibo_url || fat.recibo_path} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[#C5A059] hover:underline font-bold"
                                                            >
                                                                <span>Abrir Recibo</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">Aguardando Baixa</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
