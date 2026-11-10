import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
    Search, 
    Calendar, 
    Check, 
    X, 
    CheckSquare, 
    Slash, 
    Edit3, 
    LogOut, 
    Phone, 
    Sparkles, 
    Database, 
    User,
    Package,
    Lock,
    CreditCard,
    Inbox,
    CheckCheck
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import BloqueioInadimplencia from '../componentes/BloqueioInadimplencia'

const ABAS_STATUS = [
    { id: 'pendente', rotulo: 'Pendentes' },
    { id: 'aprovado', rotulo: 'Aprovados' },
    { id: 'cumprido', rotulo: 'Cumpridos' },
    { id: 'negado', rotulo: 'Negados' },
]

const tempoRelativo = (dataStr) => {
    if (!dataStr) return ''
    const seg = Math.floor((Date.now() - new Date(dataStr).getTime()) / 1000)
    if (seg < 60) return 'agora'
    if (seg < 3600) return `há ${Math.floor(seg / 60)} min`
    if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`
    const dias = Math.floor(seg / 86400)
    return dias === 1 ? 'ontem' : `há ${dias} dias`
}

export default function Dashboard() {
    const [solicitacoes, setSolicitacoes] = useState([])
    const [servicos, setServicos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [abaAtiva, setAbaAtiva] = useState('pendente')
    const [pesquisa, setPesquisa] = useState('')
    const [loading, setLoading] = useState(true)
    const [editingSolicitacao, setEditingSolicitacao] = useState(null)
    const [toastMessage, setToastMessage] = useState('')
    
    // Estados de deslizar (swipe) por card no mobile
    const [swipeCardId, setSwipeCardId] = useState(null)
    const [swipeDx, setSwipeDx] = useState(0)
    const swipeRef = useRef(null)
    
    // Estados do Estabelecimento
    const [activeTenantId, setActiveTenantId] = useState(() => {
        return localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
    })
    const [tenantInfo, setTenantInfo] = useState(null)
    const [assinatura, setAssinatura] = useState(null)
    const [userTenants, setUserTenants] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('as_user_tenants') || '[]')
        } catch {
            return []
        }
    })
    
    // Estados do Formulário de Edição no Modal
    const [editNome, setEditNome] = useState('')
    const [editWhatsapp, setEditWhatsapp] = useState('')
    const [editItens, setEditItens] = useState([]) // Lista de itens modificados no modal
    
    const audioRef = useRef(null)
    const navigate = useNavigate()

    const deslogarAdmin = async () => {
        try {
            await supabase.auth.signOut()
        } catch (err) {
            console.error('Erro ao encerrar sessão Supabase:', err)
        }
        localStorage.removeItem('admin_demo_auth')
        localStorage.removeItem('as_active_tenant')
        localStorage.removeItem('as_auth_user')
        navigate('/login')
    }

    // Som de notificação autônomo via Web Audio API (100% offline/online, nunca bloqueado por links externos)
    useEffect(() => {
        fetchDados()

        // Escuta atualizações e novos agendamentos em Tempo Real no Supabase
        const canalRealtime = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'solicitacoes_agendamento' },
                () => {
                    tocarNotificacao()
                    showToast('Nova solicitação de agendamento recebida!')
                    fetchDados()
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'solicitacoes_agendamento' },
                () => {
                    fetchDados()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(canalRealtime)
        }
    }, [])

    const handleTrocarTenant = (novoTenantId) => {
        setActiveTenantId(novoTenantId)
        localStorage.setItem('as_active_tenant', novoTenantId)
        fetchDados(novoTenantId)
    }

    const fetchDados = async (tId = null) => {
        try {
            let currentTenant = tId || localStorage.getItem('as_active_tenant')

            // Busca os vínculos confiáveis do usuário logado
            const { data: vinculos } = await supabase
                .from('tenants_usuarios')
                .select('tenant_id, role, tenants(id, nome, segmento)')

            if (vinculos && vinculos.length > 0) {
                setUserTenants(vinculos)
                localStorage.setItem('as_user_tenants', JSON.stringify(vinculos))
                const valido = vinculos.some(v => v.tenant_id === currentTenant)
                if (!valido) {
                    currentTenant = vinculos[0].tenant_id
                    localStorage.setItem('as_active_tenant', currentTenant)
                }
            } else if (!currentTenant) {
                currentTenant = import.meta.env.VITE_TENANT_ID || 'demo'
            }

            setActiveTenantId(currentTenant)

            // 1. Busca dados do tenant ativo
            const { data: tData } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', currentTenant)
                .single()

            if (tData) {
                setTenantInfo(tData)
                document.title = `${tData.nome} • Painel AS Gestão`
            }

            // 2. Busca situação da assinatura do tenant
            const { data: assData } = await supabase
                .from('assinaturas_tenant')
                .select('*')
                .eq('tenant_id', currentTenant)
                .single()
            setAssinatura(assData)

            // 3. Busca categorias e serviços para cruzar nomes, valores e adicionais
            const [{ data: catData }, { data: servicosData, error: errServ }] = await Promise.all([
                supabase.from('categorias').select('*').eq('tenant_id', currentTenant),
                supabase.from('servicos').select('*').eq('tenant_id', currentTenant)
            ])
            
            if (errServ) throw errServ
            setCategorias(catData || [])
            setServicos(servicosData || [])

            // 4. Busca solicitações com seus respectivos itens aninhados (incluindo preco_unitario congelado)
            const { data: solicitacoesData, error: errSol } = await supabase
                .from('solicitacoes_agendamento')
                .select(`
                    *,
                    itens_agendamento (
                        id,
                        servico_id,
                        parent_item_id,
                        quantidade,
                        preco_unitario
                    )
                `)
                .eq('tenant_id', currentTenant)
                .order('created_at', { ascending: false })

            if (errSol) throw errSol
            setSolicitacoes(solicitacoesData || [])
        } catch (error) {
            console.error('Erro ao buscar dados do Supabase:', error)
        } finally {
            setLoading(false)
        }
    }

    const tocarNotificacao = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            if (!AudioCtx) return
            const ctx = audioRef.current || new AudioCtx()
            audioRef.current = ctx
            if (ctx.state === 'suspended') ctx.resume()

            const tocarNota = (freq, inicio, duracao) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(freq, ctx.currentTime + inicio)
                gain.gain.setValueAtTime(0.001, ctx.currentTime + inicio)
                gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao)
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start(ctx.currentTime + inicio)
                osc.stop(ctx.currentTime + inicio + duracao)
            }

            // Duplo toque suave de sino (Mi6 -> Sol#6)
            tocarNota(1318.5, 0, 0.18)
            tocarNota(1661.2, 0.16, 0.32)
        } catch (err) {
            console.log('Áudio bloqueado pelo navegador:', err)
        }
    }

    const showToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(''), 4000)
    }

    // Altera o status do agendamento via RPC oficial atualizar_status_agendamento (com fallback seguro)
    const handleUpdateStatus = async (id, novoStatus) => {
        try {
            // Atualização otimista imediata na lista local
            setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: novoStatus } : s))

            const { error: errRpc } = await supabase.rpc('atualizar_status_agendamento', {
                p_solicitacao_id: id,
                p_status: novoStatus
            })

            if (errRpc) {
                const { error: errUpdate } = await supabase
                    .from('solicitacoes_agendamento')
                    .update({ status: novoStatus })
                    .eq('id', id)
                    .eq('tenant_id', activeTenantId)

                if (errUpdate) throw errUpdate
            }

            const rotuloStatus =
                novoStatus === 'aprovado' ? 'Aprovado' :
                novoStatus === 'negado' ? 'Negado' :
                novoStatus === 'cumprido' ? 'Cumprido' : 'Pendente'

            showToast(`Movido para "${rotuloStatus}"!`)
            fetchDados()
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
            showToast('Erro ao atualizar status.')
            fetchDados()
        }
    }

    // Gestos de deslizar (swipe) estilo App JK para cards pendentes
    const handleTouchStartCard = (sol, e) => {
        if ((sol.status || 'pendente') !== 'pendente') return
        const t = e.touches?.[0]
        if (!t) return
        swipeRef.current = { id: sol.id, x: t.clientX, y: t.clientY, h: null }
        setSwipeCardId(sol.id)
        setSwipeDx(0)
    }

    const handleTouchMoveCard = (sol, e) => {
        const st = swipeRef.current
        if (!st || st.id !== sol.id) return
        const t = e.touches?.[0]
        if (!t) return
        const ddx = t.clientX - st.x
        const ddy = t.clientY - st.y
        if (st.h === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
            st.h = Math.abs(ddx) > Math.abs(ddy)
        }
        if (st.h) {
            const v = Math.max(-140, Math.min(140, ddx))
            setSwipeDx(v)
        }
    }

    const handleTouchEndCard = (sol) => {
        const st = swipeRef.current
        if (!st || st.id !== sol.id) return
        if (swipeDx > 90) {
            handleUpdateStatus(sol.id, 'aprovado')
        } else if (swipeDx < -90) {
            handleUpdateStatus(sol.id, 'negado')
        }
        swipeRef.current = null
        setSwipeCardId(null)
        setSwipeDx(0)
    }

    // Calcula o valor total de uma solicitação a partir de seus itens e opcionais em tempo real (fallback)
    const calcularTotalSolicitacaoReal = (sol) => {
        let total = 0
        if (!sol.itens_agendamento) return 0

        const itensPrincipais = sol.itens_agendamento.filter(i => i.parent_item_id === null)
        itensPrincipais.forEach(itemPrincipal => {
            const servPrincipal = servicos.find(s => s.id === itemPrincipal.servico_id)
            const valorBase = servPrincipal
                ? parseFloat(servPrincipal.valor)
                : parseFloat(itemPrincipal.preco_unitario || 0)

            let subtotalItem = valorBase * (itemPrincipal.quantidade || 1)

            const opcionais = sol.itens_agendamento.filter(i => i.parent_item_id === itemPrincipal.id)
            opcionais.forEach(opcItem => {
                const opc = servicos.find(s => s.id === opcItem.servico_id)
                const qtd = opcItem.quantidade || 0
                if (qtd > 0) {
                    const valorOpc = opc ? parseFloat(opc.valor) : parseFloat(opcItem.preco_unitario || 0)
                    if (opc?.tipo === 'substitutivo') {
                        const valorUnidadeSimples = valorBase / 10
                        subtotalItem += qtd * (valorOpc - valorUnidadeSimples)
                    } else {
                        subtotalItem += qtd * valorOpc
                    }
                }
            })
            total += subtotalItem
        })
        return total
    }

    const exibirValorTotal = (sol) => {
        const val = parseFloat(sol.valor_total)
        if (isNaN(val) || val <= 0) {
            return calcularTotalSolicitacaoReal(sol)
        }
        return val
    }

    // Calcula o total dos itens editados no modal
    const calcularTotalEdicao = () => {
        let total = 0
        if (!servicos.length) return 0

        editItens.forEach(item => {
            const servPrincipal = servicos.find(s => s.id === item.servico_id)
            if (!servPrincipal) return

            let valorBase = parseFloat(servPrincipal.valor)
            let subtotalItem = valorBase

            Object.entries(item.opcionais).forEach(([idStr, qtd]) => {
                const id = parseInt(idStr)
                const opc = servicos.find(s => s.id === id)
                if (opc && qtd > 0) {
                    let valorOpc = parseFloat(opc.valor)
                    if (opc.tipo === 'substitutivo') {
                        let valorUnidadeSimples = valorBase / 10
                        subtotalItem += qtd * (valorOpc - valorUnidadeSimples)
                    } else {
                        subtotalItem += qtd * valorOpc
                    }
                }
            })
            total += subtotalItem
        })
        return total
    }

    // Abre o Modal de Edição populando os estados locais
    const handleOpenEditModal = (sol) => {
        setEditingSolicitacao(sol)
        setEditNome(sol.nome_cliente)
        setEditWhatsapp(sol.whatsapp_cliente)
        
        // Mapeia os itens da solicitação
        const itensMapeados = (sol.itens_agendamento || [])
            .filter(i => i.parent_item_id === null)
            .map(itemPrincipal => {
                const opcionaisDoPrincipal = {}
                ;(sol.itens_agendamento || [])
                    .filter(i => i.parent_item_id === itemPrincipal.id)
                    .forEach(opc => {
                        opcionaisDoPrincipal[opc.servico_id] = opc.quantidade
                    })

                return {
                    idInterno: itemPrincipal.id,
                    servico_id: itemPrincipal.servico_id,
                    opcionais: opcionaisDoPrincipal
                }
            })
        
        setEditItens(itensMapeados)
    }

    const handleWhatsappMask = (value) => {
        let val = value.replace(/\D/g, '')
        if (val.length > 11) val = val.slice(0, 11)

        let formatted = ''
        if (val.length > 0) formatted += `(${val.slice(0, 2)}`
        if (val.length > 2) formatted += `) ${val.slice(2, 3)}`
        if (val.length > 3) formatted += ` ${val.slice(3, 7)}`
        if (val.length > 7) formatted += `-${val.slice(7, 11)}`
        return formatted
    }

    // Altera a quantidade de opcionais no item que está sendo editado no modal
    const handleAlterarOpcionalModal = (idInterno, opcId, direcao) => {
        setEditItens(prev => prev.map(item => {
            if (item.idInterno !== idInterno) return item
            
            const novosOpcionais = { ...item.opcionais }
            const qtdAtual = novosOpcionais[opcId] || 0
            const opc = servicos.find(s => s.id === opcId)

            if (direcao === 'mais') {
                if (opc && opc.tipo === 'substitutivo') {
                    const totalSubstitutivos = Object.entries(novosOpcionais)
                        .reduce((soma, [idStr, qtd]) => {
                            const op = servicos.find(s => s.id === parseInt(idStr))
                            return op && op.tipo === 'substitutivo' ? soma + qtd : soma
                        }, 0)
                    if (totalSubstitutivos >= 10) return item
                }
                novosOpcionais[opcId] = qtdAtual + 1
            } else {
                const novaQtd = Math.max(0, qtdAtual - 1)
                if (novaQtd === 0) {
                    delete novosOpcionais[opcId]
                } else {
                    novosOpcionais[opcId] = novaQtd
                }
            }

            return { ...item, opcionais: novosOpcionais }
        }))
    }

    // Salva as alterações feitas no modal de volta para o Supabase (com fallback direto caso a RPC legada esteja revogada)
    const handleSaveEdits = async () => {
        try {
            setLoading(true)

            const payloadItens = editItens.map(item => ({
                servico_id: item.servico_id,
                quantidade: 1,
                opcionais: Object.entries(item.opcionais || {})
                    .filter(([_, qtd]) => Number(qtd) > 0)
                    .map(([opcId, qtd]) => ({
                        servico_id: parseInt(opcId),
                        quantidade: Number(qtd)
                    }))
            }))

            const { error: errRpc } = await supabase.rpc('editar_solicitacao_lojista', {
                p_solicitacao_id: editingSolicitacao.id,
                p_nome_cliente: editNome.trim(),
                p_whatsapp_cliente: editWhatsapp,
                p_data_agendamento: editingSolicitacao.data_agendamento || null,
                p_horario_agendamento: editingSolicitacao.horario_agendamento || null,
                p_status: editingSolicitacao.status || 'pendente',
                p_observacoes: editingSolicitacao.observacoes || null,
                p_itens: payloadItens
            })

            if (errRpc) {
                const novoTotal = calcularTotalEdicao()
                const { error: errUpd } = await supabase
                    .from('solicitacoes_agendamento')
                    .update({
                        nome_cliente: editNome.trim(),
                        whatsapp_cliente: editWhatsapp,
                        valor_total: novoTotal > 0 ? novoTotal : editingSolicitacao.valor_total
                    })
                    .eq('id', editingSolicitacao.id)
                    .eq('tenant_id', activeTenantId)

                if (errUpd) throw errUpd
            }
            
            setEditingSolicitacao(null)
            showToast('Agendamento editado com sucesso!')
            fetchDados()
        } catch (error) {
            console.error('Erro ao salvar edições do agendamento:', error)
            showToast('Erro ao salvar as edições.')
        } finally {
            setLoading(false)
        }
    }

    // Contagem de pedidos por status para exibir nos chips das abas (igual ao App JK)
    const contagemPorStatus = useMemo(() => {
        const cont = { pendente: 0, aprovado: 0, cumprido: 0, negado: 0 }
        solicitacoes.forEach(s => {
            const st = s.status || 'pendente'
            cont[st] = (cont[st] || 0) + 1
        })
        return cont
    }, [solicitacoes])

    // Filtra por Aba Ativa (Pendentes / Aprovados / Cumpridos / Negados) + Busca por Nome, WhatsApp ou Serviço
    const solicitacoesFiltradas = useMemo(() => {
        const termo = pesquisa.toLowerCase().trim()
        const digitosBusca = termo.replace(/\D/g, '')

        return solicitacoes.filter(sol => {
            const statusAtual = sol.status || 'pendente'
            if (statusAtual !== abaAtiva) return false
            if (!termo) return true

            const matchNome = (sol.nome_cliente || '').toLowerCase().includes(termo)
            const matchTel = digitosBusca.length > 0 && (sol.whatsapp_cliente || '').replace(/\D/g, '').includes(digitosBusca)

            const matchServicos = (sol.itens_agendamento || []).some(item => {
                const serv = servicos.find(s => s.id === item.servico_id)
                return serv && serv.nome.toLowerCase().includes(termo)
            })

            return matchNome || matchTel || matchServicos
        })
    }, [solicitacoes, servicos, abaAtiva, pesquisa])

    // Lista de opcionais disponíveis para o modal de edição
    const opcionaisDisponiveis = useMemo(() => {
        const idsCatOcultas = new Set(categorias.filter(c => c.escolha === false).map(c => c.id))
        return servicos.filter(s => (idsCatOcultas.has(s.categoria_id) || s.tipo !== null))
    }, [servicos, categorias])

    // Se o estabelecimento estiver bloqueado ou com vencimento + 3 dias de tolerância expirados (respeitando isenção/cortesia e adiamento vigente), exibe tela de cobrança e bloqueio do painel
    const hojeBrasil = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const isIsento = Boolean(assinatura?.isento_cobranca)
    const adiamentoVigente = Boolean(assinatura?.adiado_ate && assinatura.adiado_ate >= hojeBrasil)
    const vencimentoExpirado = (() => {
        if (!assinatura?.proximo_vencimento) return false
        const dt = new Date(`${assinatura.proximo_vencimento.split('T')[0]}T12:00:00`)
        dt.setDate(dt.getDate() + 3) // 3 dias de tolerância padrão
        return dt.toISOString().split('T')[0] < hojeBrasil
    })()
    const bloqueioAtivo = assinatura && !isIsento && !adiamentoVigente && (
        assinatura.status === 'bloqueado' ||
        vencimentoExpirado ||
        (assinatura.status === 'atrasado' && !assinatura.proximo_vencimento)
    )
    if (bloqueioAtivo) {
        return (
            <BloqueioInadimplencia 
                tenantInfo={tenantInfo} 
                assinatura={assinatura} 
                onAtualizarStatus={fetchDados} 
                onDeslogar={deslogarAdmin} 
            />
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#FAF6F4] flex flex-col font-sans">
            
            {/* Toast de Notificação flutuante */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-[#C5A059] text-white px-4 py-2.5 rounded-2xl shadow-xl font-semibold flex items-center gap-2 border border-white/20 animate-bounce text-xs">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Topbar Administrativo Estilo App JK */}
            <header className="w-full bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex justify-between items-center shadow-2xs sticky top-0 z-20">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full border border-[#C5A059]/40 bg-[#0F172A] shadow-xs overflow-hidden flex justify-center items-center shrink-0">
                        <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="Logo AS Gestão" />
                    </div>
                    <div className="text-left min-w-0">
                        <span className="text-[9px] block font-sans font-bold tracking-[0.16em] text-gray-400 uppercase truncate">
                            {tenantInfo?.nome || 'AS GESTÃO'}
                        </span>
                        <h1 className="text-base sm:text-lg font-cinzel font-bold text-gray-900 leading-none tracking-wide">
                            SOLICITAÇÕES
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                    {/* Seletor ou Badge do Estabelecimento Vinculado */}
                    {userTenants.length > 1 ? (
                        <div className="bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                            <span className="text-xs">{tenantInfo?.segmento === 'nail_design' ? '💅' : '🌸'}</span>
                            <select
                                value={activeTenantId}
                                onChange={(e) => handleTrocarTenant(e.target.value)}
                                className="bg-transparent text-xs font-bold text-[#C5A059] focus:outline-none cursor-pointer max-w-[110px] sm:max-w-none"
                                title="Alternar entre estabelecimentos autorizados"
                            >
                                {userTenants.map((v) => (
                                    <option key={v.tenant_id} value={v.tenant_id} className="text-gray-800 bg-white">
                                        {v.tenants?.nome || v.tenant_id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="hidden md:flex bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5">
                            <span>{tenantInfo?.segmento === 'nail_design' ? '💅' : '🌸'}</span>
                            <span className="max-w-[150px] truncate">{tenantInfo?.nome || 'Estabelecimento Ativo'}</span>
                        </div>
                    )}

                    <button 
                        onClick={() => navigate('/servicos')}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                        title="Gerenciar Catálogo"
                    >
                        <Package className="w-4 h-4 text-[#C5A059]" />
                        <span className="hidden sm:inline">Catálogo</span>
                    </button>
                    <button 
                        onClick={() => navigate('/pagamentos')}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                        title="Minha Assinatura e Pagamentos"
                    >
                        <CreditCard className="w-4 h-4 text-[#C5A059]" />
                        <span className="hidden sm:inline">Assinatura</span>
                    </button>
                    <button 
                        onClick={() => navigate('/redefinir-senha')}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                        title="Alterar Senha da Conta"
                    >
                        <Lock className="w-4 h-4 text-[#C5A059]" />
                        <span className="hidden sm:inline">Senha</span>
                    </button>
                    <button 
                        onClick={deslogarAdmin}
                        className="flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all cursor-pointer"
                        title="Sair do Painel"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Dashboard Container */}
            <main className="flex-1 max-w-[1100px] w-full mx-auto p-3.5 md:p-6 flex flex-col gap-3.5">
                
                {/* Abas de Status (Pendentes | Aprovados | Cumpridos | Negados) estilo App JK */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    {ABAS_STATUS.map((aba) => {
                        const ativo = abaAtiva === aba.id
                        const qtd = contagemPorStatus[aba.id] || 0
                        return (
                            <button
                                key={aba.id}
                                type="button"
                                onClick={() => setAbaAtiva(aba.id)}
                                className={`shrink-0 h-9 px-4 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                    ativo
                                        ? 'bg-[#B38280] text-white shadow-sm'
                                        : 'bg-white text-gray-700 border border-[#E8D5D3]'
                                }`}
                            >
                                <span>{aba.rotulo}</span>
                                {qtd > 0 && (
                                    <span className={`text-[11px] font-extrabold ${ativo ? 'text-white/90' : 'text-gray-400'}`}>
                                        {qtd}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Campo de Busca Estilo App JK */}
                <div className="w-full flex flex-col gap-1.5">
                    <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text"
                            placeholder="Buscar cliente, telefone ou serviço"
                            value={pesquisa}
                            onChange={(e) => setPesquisa(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8D5D3] rounded-2xl focus:outline-none focus:border-[#B38280] text-xs sm:text-sm text-gray-800 shadow-2xs"
                        />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 px-1">
                        {abaAtiva === 'pendente' ? (
                            <span>Dica: deslize o card → para aprovar ou ← para negar</span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <Database className="w-3 h-3 text-emerald-500 animate-pulse" />
                                Realtime Conectado
                            </span>
                        )}
                        <span>{solicitacoesFiltradas.length} {solicitacoesFiltradas.length === 1 ? 'solicitação' : 'solicitações'}</span>
                    </div>
                </div>

                {/* Fila de Cards da Aba Selecionada */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
                        <div className="w-8 h-8 border-3 border-[#B38280]/20 border-t-[#B38280] rounded-full animate-spin"></div>
                        <p className="text-xs text-gray-400 font-semibold font-cinzel">Carregando solicitações...</p>
                    </div>
                ) : solicitacoesFiltradas.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-[#EFE3E1] shadow-2xs gap-2 my-2">
                        <div className="w-14 h-14 rounded-full bg-[#F8EDEB] flex items-center justify-center mb-1">
                            {abaAtiva === 'pendente' ? (
                                <Inbox className="w-6 h-6 text-[#B38280]" />
                            ) : (
                                <CheckCheck className="w-6 h-6 text-[#B38280]" />
                            )}
                        </div>
                        <p className="font-bold text-sm text-gray-700">
                            {pesquisa
                                ? 'Nada encontrado para esta busca'
                                : abaAtiva === 'pendente'
                                ? 'Tudo em dia!'
                                : `Nenhuma solicitação em "${ABAS_STATUS.find(a => a.id === abaAtiva)?.rotulo}"`}
                        </p>
                        <p className="text-xs text-gray-400 max-w-xs">
                            {abaAtiva === 'pendente' && !pesquisa
                                ? 'Novas solicitações enviadas pelos clientes aparecem aqui em tempo real.'
                                : 'Altere a aba acima para visualizar solicitações com outros status.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {solicitacoesFiltradas.map((sol) => {
                            const statusAtual = sol.status || 'pendente'
                            const isNovo = statusAtual === 'pendente' && (Date.now() - new Date(sol.created_at).getTime() < 12 * 3600 * 1000)
                            const dxAtual = swipeCardId === sol.id ? swipeDx : 0
                            const itensPrincipais = (sol.itens_agendamento || []).filter(i => i.parent_item_id === null)

                            return (
                                <div key={sol.id} className="relative">
                                    {/* Fundo revelado ao deslizar (swipe) em Pendentes */}
                                    {statusAtual === 'pendente' && dxAtual !== 0 && (
                                        <div
                                            className={`absolute inset-0 rounded-3xl flex items-center px-6 ${
                                                dxAtual > 0 ? 'bg-emerald-500 justify-start' : 'bg-red-500 justify-end'
                                            }`}
                                        >
                                            <span className="text-white font-bold text-xs flex items-center gap-1.5">
                                                {dxAtual > 0 ? (
                                                    <>
                                                        <Check className="w-4 h-4" /> Aprovar
                                                    </>
                                                ) : (
                                                    <>
                                                        Negar <X className="w-4 h-4" />
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <article
                                        onTouchStart={(e) => handleTouchStartCard(sol, e)}
                                        onTouchMove={(e) => handleTouchMoveCard(sol, e)}
                                        onTouchEnd={() => handleTouchEndCard(sol)}
                                        style={{
                                            transform: `translateX(${dxAtual}px)`,
                                            transition: dxAtual ? 'none' : 'transform .25s'
                                        }}
                                        className="bg-white rounded-3xl border border-[#EFE3E1] p-4 shadow-2xs relative flex flex-col justify-between gap-3 transition-shadow hover:shadow-xs text-left"
                                    >
                                        {/* Topo do Card: Nome + Badge NOVO e Tempo Relativo */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-[15px] text-gray-900 truncate">
                                                        {sol.nome_cliente}
                                                    </h3>
                                                    {isNovo && (
                                                        <span className="text-[9px] font-extrabold tracking-wider bg-[#B38280] text-white rounded-full px-2 py-0.5 uppercase shrink-0">
                                                            NOVO
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Contato WhatsApp clicável */}
                                                <a 
                                                    href={`https://wa.me/55${(sol.whatsapp_cliente || '').replace(/\D/g, '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] text-[#B38280] hover:underline font-semibold mt-0.5"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    <span>{sol.whatsapp_cliente}</span>
                                                </a>
                                            </div>

                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[11px] text-gray-400 font-medium">
                                                    {tempoRelativo(sol.created_at)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(sol)}
                                                    className="mt-1 text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-0.5 cursor-pointer"
                                                    title="Editar pedido"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Editar</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Resumo dos Serviços / Produtos Escolhidos */}
                                        <div className="flex flex-col gap-1 text-left">
                                            {itensPrincipais.length === 0 ? (
                                                <span className="text-xs text-gray-400 italic">Itens do pedido</span>
                                            ) : (
                                                itensPrincipais.map((itemPrincipal) => {
                                                    const serv = servicos.find(s => s.id === itemPrincipal.servico_id)
                                                    const nomeItem = serv ? serv.nome : `Item #${itemPrincipal.servico_id}`
                                                    const opcionais = (sol.itens_agendamento || []).filter(i => i.parent_item_id === itemPrincipal.id)

                                                    return (
                                                        <div key={itemPrincipal.id} className="flex flex-col gap-0.5">
                                                            <span className="text-[13px] text-gray-600 font-medium">
                                                                {nomeItem}
                                                            </span>
                                                            {opcionais.length > 0 && (
                                                                <div className="pl-2.5 flex flex-col gap-0.5 border-l-2 border-dashed border-gray-200">
                                                                    {opcionais.map((opcItem) => {
                                                                        const opc = servicos.find(s => s.id === opcItem.servico_id)
                                                                        const nomeOpc = opc ? opc.nome : `Adicional #${opcItem.servico_id}`
                                                                        return (
                                                                            <span key={opcItem.id} className="text-[11px] text-gray-400">
                                                                                + {nomeOpc} ({opcItem.quantidade}x)
                                                                            </span>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>

                                        {/* Valor Total e Selo de Status (igual à foto do App JK) */}
                                        <div className="flex items-center justify-between pt-0.5">
                                            <span className="font-bold text-[#945B59] text-[17px]">
                                                R$ {exibirValorTotal(sol).toFixed(2).replace('.', ',')}
                                            </span>
                                            <span className={`text-[10px] font-bold rounded-full px-3 py-1 uppercase tracking-wider border ${
                                                statusAtual === 'aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                statusAtual === 'negado' ? 'bg-red-50 text-red-600 border-red-200' :
                                                statusAtual === 'cumprido' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                                'bg-amber-50/80 text-amber-800 border-amber-200'
                                            }`}>
                                                {statusAtual === 'aprovado' ? 'APROVADO' :
                                                 statusAtual === 'negado' ? 'NEGADO' :
                                                 statusAtual === 'cumprido' ? 'CUMPRIDO' : 'PENDENTE'}
                                            </span>
                                        </div>

                                        {/* Botões de Ação por Aba (Layout idêntico ao App JK) */}
                                        {statusAtual === 'pendente' && (
                                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(sol.id, 'negado')}
                                                    className="py-2.5 px-3 rounded-2xl bg-[#FDECEC] hover:bg-[#fbdADA] text-[#B43C3C] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                    <span>Negar</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(sol.id, 'aprovado')}
                                                    className="py-2.5 px-3 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    <span>Aprovar</span>
                                                </button>
                                            </div>
                                        )}

                                        {statusAtual === 'aprovado' && (
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(sol.id, 'cumprido')}
                                                    className="py-2.5 px-3 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <CheckSquare className="w-4 h-4" />
                                                    <span>Cumprir / Concluir</span>
                                                </button>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(sol.id, 'negado')}
                                                        className="py-2.5 px-2 rounded-2xl bg-[#FDECEC] hover:bg-[#fbdADA] text-[#B43C3C] flex items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                                                        title="Mover para Negados"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>Negar</span>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(sol.id, 'pendente')}
                                                        className="py-2.5 px-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                                                        title="Voltar para Pendentes"
                                                    >
                                                        <Slash className="w-3 h-3" />
                                                        <span>Voltar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {(statusAtual === 'cumprido' || statusAtual === 'negado') && (
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(sol.id, 'pendente')}
                                                    className="py-2 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <Slash className="w-3.5 h-3.5" />
                                                    <span>Voltar p/ Pendente</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(sol.id, 'aprovado')}
                                                    className="py-2 px-3 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Aprovar</span>
                                                </button>
                                            </div>
                                        )}
                                    </article>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* ========================================================================= */}
            {/* MODAL DE EDIÇÃO DE AGENDAMENTO COMPACTO */}
            {/* ========================================================================= */}
            {editingSolicitacao && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-xs px-4">
                    <div className="w-full max-w-[390px] max-h-[85vh] rounded-3xl flex flex-col bg-white ring-1 ring-[#D9A09E]/50 shadow-2xl p-4 overflow-hidden relative">
                        
                        <div className="w-full flex justify-between items-center pb-2 border-b border-gray-100">
                            <button 
                                onClick={() => setEditingSolicitacao(null)}
                                className="h-7 w-7 hover:scale-105 active:scale-95 flex justify-center items-center rounded-full bg-gray-100 text-gray-500 transition-all cursor-pointer"
                            >
                                ✕
                            </button>
                            <h2 className="text-sm font-cinzel font-bold text-gray-800 tracking-wide">Editar Solicitação</h2>
                            <div className="w-7 h-7"></div>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar py-3 flex flex-col gap-3.5 text-left">
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] font-bold text-gray-500">Nome do Cliente</label>
                                <input 
                                    type="text" 
                                    value={editNome}
                                    onChange={(e) => setEditNome(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059]"
                                />
                            </div>

                            <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] font-bold text-gray-500">WhatsApp</label>
                                <input 
                                    type="text" 
                                    value={editWhatsapp}
                                    onChange={(e) => setEditWhatsapp(handleWhatsappMask(e.target.value))}
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059]"
                                />
                            </div>

                            {/* Detalhamento dos Serviços e Modificação dos Opcionais */}
                            <div className="mt-1 border-t border-gray-100 pt-2.5 flex flex-col gap-2.5">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Itens e Opcionais</h3>
                                {editItens.map((item) => {
                                    const serv = servicos.find(s => s.id === item.servico_id)
                                    const nomePrincipal = serv ? serv.nome : `Item #${item.servico_id}`

                                    return (
                                        <div key={item.idInterno} className="bg-gray-50 rounded-2xl p-2.5 border border-gray-200/60 flex flex-col gap-2">
                                            <span className="text-[11px] font-bold text-gray-800">{nomePrincipal}</span>
                                            
                                            {/* Opcionais/Adicionais da Categoria */}
                                            <div className="flex flex-col gap-1.5">
                                                {opcionaisDisponiveis
                                                    .filter(opc => !opc.arquivado || (item.opcionais[opc.id] || 0) > 0)
                                                    .map((opc) => {
                                                        const qtd = item.opcionais[opc.id] || 0

                                                        return (
                                                            <div key={opc.id} className="flex justify-between items-center bg-white rounded-xl px-2 py-1 border border-gray-100/60">
                                                                <div className="flex flex-col text-left">
                                                                    <span className="text-[11px] text-gray-700 font-bold leading-tight">{opc.nome}</span>
                                                                    <span className="text-[9px] text-gray-400 leading-none">R$ {opc.valor}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleAlterarOpcionalModal(item.idInterno, opc.id, 'menos')}
                                                                        className="h-5 w-5 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center font-bold text-[11px] cursor-pointer"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="font-bold text-xs w-4 text-center">{qtd}</span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleAlterarOpcionalModal(item.idInterno, opc.id, 'mais')}
                                                                        className="h-5 w-5 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center font-bold text-[11px] cursor-pointer"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="pt-2.5 border-t border-gray-100 flex flex-col gap-2">
                            <button 
                                onClick={handleSaveEdits}
                                className="w-full py-2 bg-[#C5A059] text-white font-bold text-xs rounded-xl shadow-sm hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
