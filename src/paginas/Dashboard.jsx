import { useState, useEffect, useRef } from 'react'
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
    Package
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'

export default function Dashboard() {
    const [solicitacoes, setSolicitacoes] = useState([])
    const [servicos, setServicos] = useState([])
    const [pesquisa, setPesquisa] = useState('')
    const [loading, setLoading] = useState(true)
    const [editingSolicitacao, setEditingSolicitacao] = useState(null)
    const [toastMessage, setToastMessage] = useState('')
    
    // Estados do Formulário de Edição no Modal
    const [editNome, setEditNome] = useState('')
    const [editWhatsapp, setEditWhatsapp] = useState('')
    const [editItens, setEditItens] = useState([]) // Lista de itens modificados no modal
    
    const audioRef = useRef(null)
    const navigate = useNavigate()

    const deslogarAdmin = () => {
        localStorage.removeItem('admin_demo_auth')
        navigate('/login')
    }

    // Som de notificação em formato Base64 para ser 100% autônomo e não falhar
    const soundUrl = "https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav"

    useEffect(() => {
        // Tenta inicializar o objeto Audio
        audioRef.current = new Audio(soundUrl)
        
        fetchDados()

        // Escuta atualizações e novos agendamentos em Tempo Real no Supabase
        const canalRealtime = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'solicitacoes_agendamento' },
                (payload) => {
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

    const fetchDados = async () => {
        try {
            // Busca serviços para cruzar nomes e valores
            const { data: servicosData, error: errServ } = await supabase
                .from('servicos')
                .select('*')
            
            if (errServ) throw errServ
            setServicos(servicosData)

            // Busca solicitações com seus respectivos itens aninhados
            const { data: solicitacoesData, error: errSol } = await supabase
                .from('solicitacoes_agendamento')
                .select(`
                    *,
                    itens_agendamento (
                        id,
                        servico_id,
                        parent_item_id,
                        quantidade
                    )
                `)
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
        if (audioRef.current) {
            audioRef.current.play().catch(err => console.log('Bloqueado pelo navegador:', err))
        }
    }

    const showToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(''), 4000)
    }

    const handleLogOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    // Altera o status do agendamento
    const handleUpdateStatus = async (id, novoStatus) => {
        try {
            const { error } = await supabase
                .from('solicitacoes_agendamento')
                .update({ status: novoStatus })
                .eq('id', id)

            if (error) throw error
            showToast(`Status atualizado para "${novoStatus}" com sucesso!`)
            fetchDados()
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
        }
    }

    // Calcula o valor total de uma solicitação a partir de seus itens e opcionais em tempo real (fallback)
    const calcularTotalSolicitacaoReal = (sol) => {
        let total = 0
        if (!sol.itens_agendamento || !servicos.length) return 0

        const itensPrincipais = sol.itens_agendamento.filter(i => i.parent_item_id === null)
        itensPrincipais.forEach(itemPrincipal => {
            const servPrincipal = servicos.find(s => s.id === itemPrincipal.servico_id)
            if (!servPrincipal) return

            let valorBase = parseFloat(servPrincipal.valor)
            let subtotalItem = valorBase

            const opcionais = sol.itens_agendamento.filter(i => i.parent_item_id === itemPrincipal.id)
            opcionais.forEach(opcItem => {
                const opc = servicos.find(s => s.id === opcItem.servico_id)
                if (opc && opcItem.quantidade > 0) {
                    let valorOpc = parseFloat(opc.valor)
                    if (opc.tipo === 'substitutivo') {
                        let valorUnidadeSimples = valorBase / 10
                        subtotalItem += opcItem.quantidade * (valorOpc - valorUnidadeSimples)
                    } else {
                        subtotalItem += opcItem.quantidade * valorOpc
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
        const itensMapeados = sol.itens_agendamento
            .filter(i => i.parent_item_id === null)
            .map(itemPrincipal => {
                const prod = servicos.find(s => s.id === itemPrincipal.servico_id)
                
                // Mapeia opcionais vinculados a este principal
                const opcionaisDoPrincipal = {}
                sol.itens_agendamento
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

    // Salva as alterações feitas no modal de volta para o Supabase
    const handleSaveEdits = async () => {
        try {
            setLoading(true)
            
            // 1. Atualiza Nome, Telefone e o valor_total recalculado!
            const { error: errCabecalho } = await supabase
                .from('solicitacoes_agendamento')
                .update({
                    nome_cliente: editNome.trim(),
                    whatsapp_cliente: editWhatsapp,
                    valor_total: calcularTotalEdicao()
                })
                .eq('id', editingSolicitacao.id)

            if (errCabecalho) throw errCabecalho

            // 2. Limpa os itens antigos da tabela e insere a nova lista atualizada
            const { error: errLimpar } = await supabase
                .from('itens_agendamento')
                .delete()
                .eq('solicitacao_id', editingSolicitacao.id)

            if (errLimpar) throw errLimpar

            // 3. Insere a lista atualizada
            for (const item of editItens) {
                const { data: itemPrincipal, error: errPrincipal } = await supabase
                    .from('itens_agendamento')
                    .insert({
                        solicitacao_id: editingSolicitacao.id,
                        servico_id: item.servico_id,
                        parent_item_id: null,
                        quantidade: 1
                    })
                    .select()
                    .single()

                if (errPrincipal) throw errPrincipal

                const opcionaisParaInserir = Object.entries(item.opcionais).map(([opcId, qtd]) => ({
                    solicitacao_id: editingSolicitacao.id,
                    servico_id: parseInt(opcId),
                    parent_item_id: itemPrincipal.id,
                    quantidade: qtd
                }))

                if (opcionaisParaInserir.length > 0) {
                    const { error: errOpc } = await supabase
                        .from('itens_agendamento')
                        .insert(opcionaisParaInserir)

                    if (errOpc) throw errOpc
                }
            }

            // A trigger no Supabase vai recalcular o valor_total automaticamente!
            
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

    // Lógica de busca avançada: filtra por Nome, WhatsApp, Serviço Principal ou Adicionais
    const solicitacoesFiltradas = solicitacoes.filter(sol => {
        const termo = pesquisa.toLowerCase()
        
        // A. Busca no cabeçalho
        const matchNome = sol.nome_cliente.toLowerCase().includes(termo)
        const matchTel = sol.whatsapp_cliente.replace(/\D/g, '').includes(termo.replace(/\D/g, ''))

        // B. Busca nos Serviços Principais
        const matchServicos = sol.itens_agendamento.some(item => {
            const serv = servicos.find(s => s.id === item.servico_id)
            return serv && serv.nome.toLowerCase().includes(termo)
        })

        return matchNome || matchTel || matchServicos
    })

    return (
        <div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans">
            
            {/* Toast de Notificação flutuante */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-[#C5A059] text-white px-4 py-2.5 rounded-2xl shadow-xl font-semibold flex items-center gap-2 border border-white/20 animate-bounce text-xs">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Topbar Administrativo Compacto */}
            <header className="w-full bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full border border-gray-200 bg-[#0F172A] shadow-sm overflow-hidden flex justify-center items-center">
                        <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="Logo Albert Sales" />
                    </div>
                    <div className="text-left font-cinzel">
                        <h1 className="text-xs font-bold text-gray-900 tracking-wider">ALBERT SALES</h1>
                        <span className="text-[9px] block font-sans font-bold text-amber-700 leading-none">PAINEL ADMINISTRATIVO (MODELO)</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate('/servicos')}
                        className="flex items-center justify-center text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-xl transition-all cursor-pointer"
                        title="Gerenciar Catálogo"
                    >
                        <Package className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={deslogarAdmin}
                        className="flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all cursor-pointer"
                        title="Sair"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Dashboard Container */}
            <main className="flex-1 max-w-[1200px] w-full mx-auto p-3.5 md:p-6 flex flex-col gap-4">
                
                {/* Filtros e Busca Compacto */}
                <div className="w-full flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-2xs border border-gray-100">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <input 
                            type="text"
                            placeholder="Buscar cliente, telefone ou serviço..."
                            value={pesquisa}
                            onChange={(e) => setPesquisa(e.target.value)}
                            className="w-full pl-8 pr-4 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] text-xs"
                        />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-semibold text-gray-400 px-1">
                        <span className="flex items-center gap-1">
                            <Database className="w-3 h-3 text-green-500 animate-pulse" />
                            Realtime Conectado
                        </span>
                        <span>{solicitacoesFiltradas.length} agendamentos</span>
                    </div>
                </div>

                {/* Fila de Cards de Agendamento */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
                        <div className="w-8 h-8 border-3 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin"></div>
                        <p className="text-xs text-gray-400 font-semibold font-cinzel">Carregando agendamentos...</p>
                    </div>
                ) : solicitacoesFiltradas.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-gray-100 shadow-sm gap-2">
                        <Calendar className="w-10 h-10 text-[#C5A059]/30" />
                        <p className="font-semibold text-xs text-gray-500">Nenhum agendamento encontrado</p>
                        <p className="text-[10px] text-gray-400">As novas solicitações enviadas pelas clientes aparecerão aqui em tempo real.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {solicitacoesFiltradas.map((sol) => (
                            <div 
                                key={sol.id} 
                                className={`bg-white rounded-2xl border p-3.5 shadow-2xs relative flex flex-col justify-between gap-3 transition-all hover:shadow-xs ${
                                    sol.status === 'aprovado' ? 'border-green-100 bg-green-50/5' :
                                    sol.status === 'negado' ? 'border-red-100 bg-red-50/5' :
                                    sol.status === 'cumprido' ? 'border-blue-100 bg-blue-50/5' : 'border-yellow-100 bg-yellow-50/5'
                                }`}
                            >
                                {/* Header do Card (Código e Data) */}
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 font-mono">#0{String(sol.codigo_pedido).padStart(2, '0')}</span>
                                    <span className="text-[9px] text-gray-400 font-semibold bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 shadow-3xs">
                                        {new Date(sol.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Corpo do Card (Cliente e Contato) */}
                                <div className="flex flex-col gap-1 text-left">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <span className="font-bold text-gray-800 text-xs truncate">{sol.nome_cliente}</span>
                                    </div>
                                    <a 
                                        href={`https://wa.me/55${sol.whatsapp_cliente.replace(/\D/g, '')}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[11px] text-[#C5A059] hover:underline font-semibold w-max"
                                    >
                                        <Phone className="w-3 h-3 text-[#C5A059]/70" />
                                        <span>{sol.whatsapp_cliente}</span>
                                    </a>
                                </div>

                                {/* Itens Escolhidos */}
                                <div className="border-t border-b border-gray-100/70 py-2 flex flex-col gap-1.5 text-left">
                                    {sol.itens_agendamento
                                        .filter(i => i.parent_item_id === null)
                                        .map((itemPrincipal) => {
                                            const serv = servicos.find(s => s.id === itemPrincipal.servico_id)
                                            if (!serv) return null

                                            return (
                                                <div key={itemPrincipal.id} className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-gray-700">{serv.nome}</span>
                                                    
                                                    {/* Opcionais vinculados */}
                                                    {sol.itens_agendamento.some(i => i.parent_item_id === itemPrincipal.id) && (
                                                        <div className="pl-2 flex flex-col gap-0.5 border-l-2 border-dashed border-gray-200">
                                                            {sol.itens_agendamento
                                                                .filter(i => i.parent_item_id === itemPrincipal.id)
                                                                .map((opcItem) => {
                                                                    const opc = servicos.find(s => s.id === opcItem.servico_id)
                                                                    if (!opc) return null
                                                                    return (
                                                                        <span key={opcItem.id} className="text-[10px] text-gray-400 font-medium">
                                                                            + {opc.nome} ({opcItem.quantidade}x)
                                                                        </span>
                                                                    )
                                                                })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>

                                {/* Preço e Status Atual */}
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col text-left">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">Subtotal</span>
                                        <span className="text-sm font-bold text-[#C5A059] mt-0.5">R$ {exibirValorTotal(sol).toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wider ${
                                        sol.status === 'aprovado' ? 'bg-green-50 text-green-700 border border-green-200' :
                                        sol.status === 'negado' ? 'bg-red-50 text-red-700 border border-red-200' :
                                        sol.status === 'cumprido' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    }`}>
                                        {sol.status === 'aprovado' ? 'Aprovado' :
                                         sol.status === 'negado' ? 'Negado' :
                                         sol.status === 'cumprido' ? 'Cumprido' : 'Pendente'}
                                    </span>
                                </div>

                                {/* Barra de Ações Rápidas com Nomes e Ícones Claros */}
                                <div className="border-t border-gray-100 pt-2.5 flex flex-wrap gap-1.5 justify-end">
                                    <button 
                                        onClick={() => handleOpenEditModal(sol)}
                                        className="px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center gap-1 text-gray-600 border border-gray-200/80 text-[11px] font-semibold transition-colors cursor-pointer"
                                        title="Editar agendamento"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                        <span>Editar</span>
                                    </button>

                                    {sol.status !== 'aprovado' && sol.status !== 'cumprido' && (
                                        <button 
                                            onClick={() => handleUpdateStatus(sol.id, 'aprovado')}
                                            className="px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                                            title="Aprovar agendamento"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Aprovar</span>
                                        </button>
                                    )}

                                    {sol.status !== 'negado' && sol.status !== 'cumprido' && (
                                        <button 
                                            onClick={() => handleUpdateStatus(sol.id, 'negado')}
                                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                                            title="Recusar agendamento"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Recusar</span>
                                        </button>
                                    )}

                                    {sol.status === 'aprovado' && (
                                        <button 
                                            onClick={() => handleUpdateStatus(sol.id, 'cumprido')}
                                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                                            title="Marcar como Concluído / Atendido"
                                        >
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            <span>Concluir</span>
                                        </button>
                                    )}

                                    {(sol.status === 'aprovado' || sol.status === 'negado' || sol.status === 'cumprido') && (
                                        <button 
                                            onClick={() => handleUpdateStatus(sol.id, 'pendente')}
                                            className="px-2 py-1 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                                            title="Retornar para Pendente"
                                        >
                                            <Slash className="w-3 h-3" />
                                            <span>Pendente</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
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
                            <h2 className="text-sm font-cinzel font-bold text-gray-800 tracking-wide">Editar Agendamento</h2>
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
                                    if (!serv) return null

                                    return (
                                        <div key={item.idInterno} className="bg-gray-50 rounded-2xl p-2.5 border border-gray-200/60 flex flex-col gap-2">
                                            <span className="text-[11px] font-bold text-gray-800">{serv.nome}</span>
                                            
                                            {/* Opcionais/Adicionais da Categoria */}
                                            <div className="flex flex-col gap-1.5">
                                                {servicos.filter(s => s.categoria_id === 2 || s.tipo !== null).map((opc) => {
                                                    const qtd = item.opcionais[opc.id] || 0

                                                    return (
                                                        <div key={opc.id} className="flex justify-between items-center bg-white rounded-xl px-2 py-1 border border-gray-100/60">
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-[11px] text-gray-700 font-bold leading-tight">{opc.nome}</span>
                                                                <span className="text-[9px] text-gray-400 leading-none">R$ {opc.valor}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <button 
                                                                    onClick={() => handleAlterarOpcionalModal(item.idInterno, opc.id, 'menos')}
                                                                    className="h-5 w-5 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center font-bold text-[11px] cursor-pointer"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="font-bold text-xs w-4 text-center">{qtd}</span>
                                                                <button 
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
