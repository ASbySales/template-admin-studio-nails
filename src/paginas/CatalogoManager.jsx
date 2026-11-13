import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
    ArrowLeft, 
    Plus, 
    Edit, 
    Trash2, 
    Save, 
    Sparkles, 
    Image, 
    DollarSign,
    Layers,
    ArrowUp,
    ArrowDown,
    CreditCard,
    RotateCw,
    ZoomIn,
    Check
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import BloqueioInadimplencia from '../componentes/BloqueioInadimplencia'

const ordenarItens = (a, b) => ((a.ordem ?? 999999) - (b.ordem ?? 999999)) || (a.id - b.id)

const blobParaDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
})

// Modal de corte interativo 1:1 (quadrado automático)
function ModalRecorte1x1({ src, aoCancelar, aoConfirmar }) {
    const [imgEl, setImgEl] = useState(null)
    const [zoom, setZoom] = useState(1)
    const [rotacao, setRotacao] = useState(0)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const arrastando = useRef(null)
    const TAM_VIEW = 260

    useEffect(() => {
        const im = new window.Image()
        im.crossOrigin = 'anonymous'
        im.onload = () => {
            setImgEl(im)
            setZoom(1)
            setRotacao(0)
            setOffset({ x: 0, y: 0 })
        }
        im.src = src
    }, [src])

    const escalaBase = () => {
        if (!imgEl) return 1
        const w = rotacao % 180 === 0 ? imgEl.width : imgEl.height
        const h = rotacao % 180 === 0 ? imgEl.height : imgEl.width
        return Math.max(TAM_VIEW / w, TAM_VIEW / h)
    }

    const iniciarArraste = (clientX, clientY) => {
        arrastando.current = { x: clientX - offset.x, y: clientY - offset.y }
    }
    const moverArraste = (clientX, clientY) => {
        if (!arrastando.current) return
        setOffset({
            x: clientX - arrastando.current.x,
            y: clientY - arrastando.current.y
        })
    }
    const pararArraste = () => { arrastando.current = null }

    const confirmarRecorte = () => {
        if (!imgEl) return
        const SAIDA = 720
        const canvas = document.createElement('canvas')
        canvas.width = SAIDA
        canvas.height = SAIDA
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, SAIDA, SAIDA)

        const fator = SAIDA / TAM_VIEW
        const esc = escalaBase() * zoom * fator

        ctx.save()
        ctx.translate(SAIDA / 2 + offset.x * fator, SAIDA / 2 + offset.y * fator)
        ctx.rotate((rotacao * Math.PI) / 180)
        ctx.scale(esc, esc)
        ctx.drawImage(imgEl, -imgEl.width / 2, -imgEl.height / 2)
        ctx.restore()

        canvas.toBlob((blob) => {
            if (blob) aoConfirmar(blob)
        }, 'image/jpeg', 0.85)
    }

    const esc = escalaBase() * zoom

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-[360px] bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4">
                <div className="w-full flex items-center justify-between">
                    <h3 className="font-cinzel font-bold text-gray-800 text-sm">Ajustar Imagem (1:1)</h3>
                    <button
                        type="button"
                        onClick={() => setRotacao(r => (r + 90) % 360)}
                        className="flex items-center gap-1 text-xs font-bold text-[#C5A059] bg-[#C5A059]/10 px-2.5 py-1.5 rounded-xl cursor-pointer"
                    >
                        <RotateCw className="w-3.5 h-3.5" /> Girar
                    </button>
                </div>

                <div
                    className="relative rounded-2xl overflow-hidden bg-gray-100 border-2 border-[#C5A059] select-none touch-none cursor-move"
                    style={{ width: TAM_VIEW, height: TAM_VIEW }}
                    onMouseDown={e => iniciarArraste(e.clientX, e.clientY)}
                    onMouseMove={e => moverArraste(e.clientX, e.clientY)}
                    onMouseUp={pararArraste}
                    onMouseLeave={pararArraste}
                    onTouchStart={e => e.touches[0] && iniciarArraste(e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchMove={e => e.touches[0] && moverArraste(e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchEnd={pararArraste}
                >
                    {imgEl && (
                        <img
                            src={src}
                            alt="Recorte"
                            draggable={false}
                            className="pointer-events-none max-w-none absolute left-1/2 top-1/2"
                            style={{
                                width: imgEl.width,
                                height: imgEl.height,
                                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotacao}deg) scale(${esc})`
                            }}
                        />
                    )}
                    <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="border border-white/25" />
                        ))}
                    </div>
                </div>

                <div className="w-full flex items-center gap-2.5 px-1">
                    <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.02"
                        value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))}
                        className="w-full accent-[#C5A059]"
                    />
                </div>

                <div className="w-full flex gap-2">
                    <button
                        type="button"
                        onClick={aoCancelar}
                        className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={confirmarRecorte}
                        className="flex-1 py-2.5 rounded-xl bg-[#C5A059] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                        <Check className="w-4 h-4" /> Usar Foto 1:1
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function CatalogoManager() {
    const [servicos, setServicos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [loading, setLoading] = useState(true)
    const [toastMessage, setToastMessage] = useState('')
    const [valorAcrescimo, setValorAcrescimo] = useState('0')
    const [infoAdicional, setInfoAdicional] = useState('')
    const [salvandoConfig, setSalvandoConfig] = useState(false)
    
    // Estados do Formulário de Serviço
    const [modalAberto, setModalAberto] = useState(false)
    const [editandoId, setEditandoId] = useState(null)
    const [formNome, setFormNome] = useState('')
    const [formDescricao, setFormDescricao] = useState('')
    const [formValor, setFormValor] = useState('')
    const [formImg, setFormImg] = useState('')
    const [formTipo, setFormTipo] = useState('') // '', 'substitutivo', 'extra'
    const [formCategoriaId, setFormCategoriaId] = useState('')
    const [uploading, setUploading] = useState(false)
    const [formAceitaAdicionais, setFormAceitaAdicionais] = useState(true)
    const [recorteSrc, setRecorteSrc] = useState(null)

    // Estados para Gerenciamento de Categorias
    const [catModalAberto, setCatModalAberto] = useState(false)
    const [catEditandoId, setCatEditandoId] = useState(null)
    const [catNome, setCatNome] = useState('')
    const [catEscolha, setCatEscolha] = useState(true)

    const [tenantInfo, setTenantInfo] = useState(null)
    const [assinatura, setAssinatura] = useState(null)
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

    useEffect(() => {
        fetchDados()
    }, [])

    const fetchDados = async () => {
        try {
            setLoading(true)
            let tenantId = localStorage.getItem('as_active_tenant')

            // Sincroniza com os vínculos reais do usuário
            const { data: vinculos } = await supabase
                .from('tenants_usuarios')
                .select('tenant_id, role, tenants(id, nome, segmento)')

            if (vinculos && vinculos.length > 0) {
                const valido = vinculos.some(v => v.tenant_id === tenantId)
                if (!valido) {
                    tenantId = vinculos[0].tenant_id
                    localStorage.setItem('as_active_tenant', tenantId)
                }
            } else if (!tenantId) {
                tenantId = import.meta.env.VITE_TENANT_ID || 'demo'
            }
            
            // Busca dados do tenant ativo
            const { data: tData } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', tenantId)
                .single()

            if (tData) {
                setTenantInfo(tData)
                setValorAcrescimo(String(tData.valor_acrescimo ?? 0))
                setInfoAdicional(tData.info_adicional || '')
                document.title = `${tData.nome} • Gerenciar Catálogo`
            }

            // Busca assinatura do tenant
            const { data: assData } = await supabase
                .from('assinaturas_tenant')
                .select('*')
                .eq('tenant_id', tenantId)
                .single()
            setAssinatura(assData)

            const { data: catData, error: errCat } = await supabase
                .from('categorias')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('ordem', { ascending: true })
                .order('id', { ascending: true })
            
            if (errCat) throw errCat
            const catsOrdenadas = [...(catData || [])]
                .filter(c => !c.arquivado)
                .sort(ordenarItens)
            setCategorias(catsOrdenadas)

            const { data: servData, error: errServ } = await supabase
                .from('servicos')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('ordem', { ascending: true })
                .order('id', { ascending: true })

            if (errServ) throw errServ
            const servsOrdenados = [...(servData || [])]
                .filter(s => !s.arquivado)
                .sort(ordenarItens)
            setServicos(servsOrdenados)

            if (catsOrdenadas.length > 0) {
                const catValida = catsOrdenadas.some(c => String(c.id) === String(formCategoriaId))
                if (!catValida) {
                    setFormCategoriaId(catsOrdenadas[0].id.toString())
                }
            } else {
                setFormCategoriaId('')
            }
        } catch (error) {
            console.error('Erro ao buscar dados do catálogo:', error)
            showToast('Erro ao carregar os dados.')
        } finally {
            setLoading(false)
        }
    }

    // Reordenar Categorias
    const handleMoverCategoria = async (index, direcao) => {
        const destino = index + direcao
        if (destino < 0 || destino >= categorias.length) return

        const novas = [...categorias]
        const [movida] = novas.splice(index, 1)
        novas.splice(destino, 0, movida)

        const atualizadas = novas.map((c, idx) => ({ ...c, ordem: idx }))
        setCategorias(atualizadas)

        try {
            await Promise.all(
                atualizadas.map((c, idx) => 
                    supabase.from('categorias').update({ ordem: idx }).eq('id', c.id)
                )
            )
            showToast('Ordem das categorias atualizada!')
        } catch (err) {
            console.error('Erro ao reordenar categorias:', err)
            fetchDados()
        }
    }

    // Reordenar Serviços dentro da Categoria
    const handleMoverServico = async (servicoId, categoriaId, direcao) => {
        const servsCat = servicos
            .filter(s => s.categoria_id === categoriaId)
            .sort(ordenarItens)

        const index = servsCat.findIndex(s => s.id === servicoId)
        if (index === -1) return

        const destino = index + direcao
        if (destino < 0 || destino >= servsCat.length) return

        const novosServsCat = [...servsCat]
        const [movido] = novosServsCat.splice(index, 1)
        novosServsCat.splice(destino, 0, movido)

        const mapaOrdens = new Map(novosServsCat.map((s, idx) => [s.id, idx]))

        setServicos(prev => prev.map(s => mapaOrdens.has(s.id) ? { ...s, ordem: mapaOrdens.get(s.id) } : s))

        try {
            await Promise.all(
                novosServsCat.map((s, idx) =>
                    supabase.from('servicos').update({ ordem: idx }).eq('id', s.id)
                )
            )
            showToast('Ordem do item atualizada!')
        } catch (err) {
            console.error('Erro ao reordenar serviço:', err)
            fetchDados()
        }
    }

    const showToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(''), 4000)
    }

    const handleSelecionarArquivo = (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setRecorteSrc(reader.result)
        reader.readAsDataURL(file)
    }

    const handleConfirmarRecorte = async (blob) => {
        setRecorteSrc(null)
        try {
            setUploading(true)
            showToast('Processando imagem 1:1...')

            const tenantId = localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
            const fileName = `${Date.now()}.jpg`
            const filePath = `${tenantId}/${fileName}`

            let urlFinal = null

            // 1. Tenta enviar ao Supabase Storage caso o bucket esteja liberado
            const { error: uploadError } = await supabase.storage
                .from('stores-media')
                .upload(filePath, blob, { contentType: 'image/jpeg' })

            if (!uploadError) {
                const { data } = supabase.storage
                    .from('stores-media')
                    .getPublicUrl(filePath)
                if (data?.publicUrl) {
                    urlFinal = data.publicUrl
                }
            }

            // 2. Fallback automático infalível: se o bucket retornar RLS/erro, converte o recorte 1:1 otimizado em DataURL
            if (!urlFinal) {
                urlFinal = await blobParaDataUrl(blob)
            }

            setFormImg(urlFinal)
            showToast('Imagem 1:1 pronta!')
        } catch (error) {
            console.error('Erro ao processar imagem:', error)
            showToast('Erro ao processar a imagem.')
        } finally {
            setUploading(false)
        }
    }

    const handleOpenCreateModal = () => {
        if (categorias.length === 0) {
            showToast('Crie ao menos uma categoria antes de cadastrar um serviço.')
            setCatEditandoId(null)
            setCatNome('')
            setCatEscolha(true)
            setCatModalAberto(true)
            return
        }
        setEditandoId(null)
        setFormNome('')
        setFormDescricao('')
        setFormValor('')
        setFormImg('')
        setFormTipo('')
        setFormAceitaAdicionais(true)
        setFormCategoriaId(categorias[0].id.toString())
        setModalAberto(true)
    }

    const handleOpenEditModal = (serv) => {
        setEditandoId(serv.id)
        setFormNome(serv.nome)
        setFormDescricao(serv.descricao || '')
        setFormValor(String(serv.valor).replace('.', ','))
        setFormImg(serv.img || '')
        setFormTipo(serv.tipo || '')
        setFormCategoriaId((serv.categoria_id ?? categorias[0]?.id ?? '').toString())
        setFormAceitaAdicionais(serv.aceita_adicionais ?? true)
        setModalAberto(true)
    }

    const handleSalvarServico = async (e) => {
        e.preventDefault()

        if (!formNome.trim()) {
            showToast('Por favor, digite o nome do serviço.')
            return
        }

        const valorLimpo = String(formValor).replace(/[^\d.,-]/g, '').replace(',', '.')
        const valorFormatado = parseFloat(valorLimpo)
        if (isNaN(valorFormatado) || valorFormatado < 0) {
            showToast('Por favor, informe um valor monetário válido.')
            return
        }

        const catIdNum = parseInt(formCategoriaId) || categorias[0]?.id
        if (!catIdNum) {
            showToast('Selecione ou crie uma categoria válida.')
            return
        }

        const tenantId = localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
        const dadosServico = {
            tenant_id: tenantId,
            nome: formNome.trim(),
            descricao: formDescricao.trim(),
            valor: valorFormatado,
            img: formImg.trim() || null,
            tipo: formTipo === '' ? null : formTipo,
            categoria_id: catIdNum,
            aceita_adicionais: formAceitaAdicionais,
            arquivado: false
        }

        try {
            if (editandoId) {
                const { error } = await supabase
                    .from('servicos')
                    .update(dadosServico)
                    .eq('id', editandoId)

                if (error) throw error
                showToast('Serviço atualizado com sucesso!')
            } else {
                const servsDaCat = servicos.filter(s => s.categoria_id === catIdNum)
                const novaOrdem = servsDaCat.length
                const { error } = await supabase
                    .from('servicos')
                    .insert({ ...dadosServico, ordem: novaOrdem })

                if (error) throw error
                showToast('Novo serviço cadastrado com sucesso!')
            }

            setModalAberto(false)
            fetchDados()
        } catch (error) {
            console.error('Erro ao salvar serviço:', error)
            showToast('Erro ao salvar o serviço no banco de dados.')
        }
    }

    // Arquiva o serviço no banco (soft delete), preservando o histórico de agendamentos anteriores
    const handleDeletarServico = async (id) => {
        if (!confirm('Deseja remover este serviço do catálogo? (Os pedidos anteriores que tinham este item continuarão preservados no histórico).')) {
            return
        }

        try {
            const { error: errArq } = await supabase
                .from('servicos')
                .update({ arquivado: true })
                .eq('id', id)

            if (errArq) {
                const { error: errDel } = await supabase
                    .from('servicos')
                    .delete()
                    .eq('id', id)
                if (errDel) throw errArq
            }

            showToast('Serviço removido do catálogo com sucesso!')
            fetchDados()
        } catch (error) {
            console.error('Erro ao remover serviço:', error)
            showToast('Não foi possível remover o serviço.')
        }
    }

    const handleSalvarConfigLoja = async (e) => {
        e.preventDefault()
        const tenantId = localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
        const valorNum = Math.max(0, parseFloat(String(valorAcrescimo).replace(',', '.')) || 0)

        try {
            setSalvandoConfig(true)
            const { error } = await supabase
                .from('tenants')
                .update({
                    valor_acrescimo: valorNum,
                    info_adicional: infoAdicional.trim() || null
                })
                .eq('id', tenantId)

            if (error) throw error
            showToast('Configurações de acréscimo e retirada salvas!')
        } catch (error) {
            console.error('Erro ao salvar configurações da loja:', error)
            showToast('Erro ao salvar configurações (verifique permissão admin).')
        } finally {
            setSalvandoConfig(false)
        }
    }

    const handleSalvarCategoria = async (e) => {
        e.preventDefault()
        if (!catNome.trim()) {
            showToast('Digite o nome da categoria.')
            return
        }

        const tenantId = localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
        const dadosCat = {
            tenant_id: tenantId,
            nome: catNome.trim(),
            escolha: catEscolha,
            arquivado: false
        }

        try {
            if (catEditandoId) {
                const { error } = await supabase
                    .from('categorias')
                    .update(dadosCat)
                    .eq('id', catEditandoId)

                if (error) throw error
                showToast('Categoria atualizada com sucesso!')
            } else {
                const { error } = await supabase
                    .from('categorias')
                    .insert({ ...dadosCat, ordem: categorias.length })

                if (error) throw error
                showToast('Nova categoria criada com sucesso!')
            }

            setCatNome('')
            setCatEscolha(true)
            setCatEditandoId(null)
            fetchDados()
        } catch (error) {
            console.error('Erro ao salvar categoria:', error)
            showToast('Erro ao salvar a categoria no banco de dados.')
        }
    }

    const handleDeletarCategoria = async (id) => {
        const servsAtivos = servicos.filter(s => s.categoria_id === id && !s.arquivado)
        const msg = servsAtivos.length > 0
            ? `Esta categoria possui ${servsAtivos.length} serviço(s) ativo(s). Ao excluí-la, a categoria e seus serviços sairão do catálogo (mantendo o histórico de pedidos). Deseja continuar?`
            : 'Deseja realmente excluir esta categoria?'

        if (!confirm(msg)) {
            return
        }

        try {
            // 1. Arquiva todos os serviços pertencentes a essa categoria para preservar histórico
            await supabase.from('servicos').update({ arquivado: true }).eq('categoria_id', id)

            // 2. Arquiva a categoria (soft delete) sem esbarrar em foreign keys
            const { error: errArq } = await supabase
                .from('categorias')
                .update({ arquivado: true })
                .eq('id', id)

            if (errArq) {
                await supabase.from('servicos').update({ categoria_id: null }).eq('categoria_id', id)
                const { error: errDel } = await supabase
                    .from('categorias')
                    .delete()
                    .eq('id', id)
                if (errDel) throw errArq
            }

            showToast('Categoria removida com sucesso!')
            fetchDados()
        } catch (error) {
            console.error('Erro ao deletar categoria:', error)
            showToast('Não foi possível excluir a categoria.')
        }
    }

    // Se o estabelecimento estiver bloqueado ou com vencimento + 3 dias de tolerância expirados (respeitando isenção/cortesia e adiamento vigente), bloqueia acesso e exibe tela de cobrança
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
        <div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans">
            
            {recorteSrc && (
                <ModalRecorte1x1
                    src={recorteSrc}
                    aoCancelar={() => setRecorteSrc(null)}
                    aoConfirmar={handleConfirmarRecorte}
                />
            )}

            {/* Toast flutuante */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-[#C5A059] text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-2 border border-white/20">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Topbar */}
            <header className="w-full bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/')}
                        className="h-9 w-9 hover:scale-105 active:scale-95 flex justify-center items-center rounded-full bg-gray-100 text-gray-600 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="text-left">
                        <h1 className="text-md font-cinzel font-bold text-gray-900 tracking-wider">AS GESTÃO</h1>
                        <span className="text-[10px] block font-sans font-bold text-[#C5A059]">
                            {tenantInfo?.segmento === 'nail_design' ? '💅' : '🌸'} CATÁLOGO & PRODUTOS • {tenantInfo?.nome || 'Estabelecimento Ativo'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate('/pagamentos')}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                        title="Minha Assinatura e Pagamentos"
                    >
                        <CreditCard className="w-4 h-4 text-[#C5A059]" />
                        <span className="hidden sm:inline">Assinatura</span>
                    </button>
                    <button 
                        onClick={() => {
                            setCatEditandoId(null)
                            setCatNome('')
                            setCatEscolha(true)
                            setCatModalAberto(true)
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#C5A059] border border-[#C5A059] hover:bg-[#C5A059]/5 px-4 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <Layers className="w-4 h-4" />
                        <span>Categorias</span>
                    </button>
                    <button 
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#C5A059] hover:bg-[#b08d48] px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Serviço</span>
                    </button>
                </div>
            </header>

            {/* Container Principal */}
            <main className="flex-1 max-w-[1000px] w-full mx-auto p-4 md:p-6 flex flex-col gap-6">

                {/* Configurações Universais da Loja (Acréscimo / Frete e Retirada) */}
                <form
                    onSubmit={handleSalvarConfigLoja}
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-end"
                >
                    <div className="w-full md:w-48">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Valor Acrescido (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={valorAcrescimo}
                            onChange={(e) => setValorAcrescimo(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#C5A059]"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Info Adicional (Endereço de Retirada / Aviso)
                        </label>
                        <input
                            type="text"
                            value={infoAdicional}
                            onChange={(e) => setInfoAdicional(e.target.value)}
                            placeholder="Ex: Rua das Flores, 88 — Seg a Sáb, 09h às 18h"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#C5A059]"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={salvandoConfig}
                        className="px-5 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#b08d48] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 shrink-0"
                    >
                        {salvandoConfig ? 'Salvando...' : 'Salvar Taxa / Info'}
                    </button>
                </form>
                
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-10 h-10 border-4 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-400 font-semibold font-cinzel">Carregando catálogo...</p>
                    </div>
                ) : categorias.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-gray-100 shadow-sm gap-3">
                        <Layers className="w-12 h-12 text-[#C5A059]/30" />
                        <p className="font-semibold text-gray-600">Nenhuma categoria ativa cadastrada</p>
                        <p className="text-xs text-gray-400 max-w-sm">Crie a primeira categoria (ex.: Buquês, Cestas, Alongamento, Adicionais) para começar a adicionar seus produtos ou serviços.</p>
                        <button
                            type="button"
                            onClick={() => {
                                setCatEditandoId(null)
                                setCatNome('')
                                setCatEscolha(true)
                                setCatModalAberto(true)
                            }}
                            className="mt-1 px-4 py-2.5 rounded-xl bg-[#C5A059] text-white text-xs font-bold shadow-xs hover:bg-[#b08d48] transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Criar Primeira Categoria</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {categorias.map((cat, catIdx) => {
                            const servsDaCat = servicos
                                .filter(s => s.categoria_id === cat.id)
                                .sort(ordenarItens)

                            return (
                                <div key={cat.id} className="w-full flex flex-col gap-3 text-left">
                                    <div className="flex justify-between items-center border-b border-[#D9A09E]/30 pb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    disabled={catIdx === 0}
                                                    onClick={() => handleMoverCategoria(catIdx, -1)}
                                                    className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Mover categoria para cima"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={catIdx === categorias.length - 1}
                                                    onClick={() => handleMoverCategoria(catIdx, 1)}
                                                    className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Mover categoria para baixo"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <h2 className="text-lg font-cinzel font-bold text-gray-800 tracking-wide flex items-center flex-wrap gap-2">
                                                <span>{cat.nome}</span>
                                                <span className={`text-[10px] font-sans font-bold rounded-full px-2.5 py-0.5 border ${
                                                    cat.escolha 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                        : 'bg-purple-50 text-purple-700 border-purple-200'
                                                }`}>
                                                    {cat.escolha ? 'Aparece no catálogo' : 'Não aparece no catálogo'}
                                                </span>
                                            </h2>
                                        </div>
                                        <span className="text-xs text-gray-400 font-semibold">{servsDaCat.length} itens</span>
                                    </div>

                                    {servsDaCat.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-2 pl-2">Nenhum serviço cadastrado nesta categoria.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {servsDaCat.map((serv, servIdx) => (
                                                <div key={serv.id} className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <img 
                                                            src={serv.img || AlbertSalesLogo} 
                                                            className="w-12 h-12 aspect-square rounded-xl object-cover bg-gray-50 border border-gray-100 flex-shrink-0" 
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-bold text-gray-800 truncate">{serv.nome}</span>
                                                            <span className="text-[10px] text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
                                                                {serv.descricao || 'Sem descrição cadastrada'}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs font-bold text-[#C5A059]">R$ {parseFloat(serv.valor).toFixed(2).replace('.', ',')}</span>
                                                                {serv.tipo === 'extra' && (
                                                                    <span className="text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                                                                        Adicional (+ Extra)
                                                                    </span>
                                                                )}
                                                                {serv.tipo === 'substitutivo' && (
                                                                    <span className="text-[8px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                                                                        Substitutivo / Variação
                                                                    </span>
                                                                )}
                                                                {!serv.tipo && (
                                                                    <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                                                                        Item Principal
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <div className="flex flex-col gap-0.5">
                                                            <button 
                                                                type="button"
                                                                disabled={servIdx === 0}
                                                                onClick={() => handleMoverServico(serv.id, cat.id, -1)}
                                                                className="h-4 w-7 rounded bg-gray-50 hover:bg-gray-200 text-gray-500 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Subir posição no catálogo"
                                                            >
                                                                <ArrowUp className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                disabled={servIdx === servsDaCat.length - 1}
                                                                onClick={() => handleMoverServico(serv.id, cat.id, 1)}
                                                                className="h-4 w-7 rounded bg-gray-50 hover:bg-gray-200 text-gray-500 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Descer posição no catálogo"
                                                            >
                                                                <ArrowDown className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleOpenEditModal(serv)}
                                                            className="h-8 w-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                                                            title="Editar serviço"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeletarServico(serv.id)}
                                                            className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex justify-center items-center border border-red-100 transition-colors cursor-pointer"
                                                            title="Excluir serviço"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {modalAberto && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-xs px-4">
                    <form onSubmit={handleSalvarServico} className="w-full max-w-[420px] max-h-[85vh] rounded-3xl flex flex-col bg-white ring-1 ring-[#D9A09E]/50 shadow-2xl p-4 overflow-hidden relative">
                        
                        <div className="w-full flex justify-between items-center pb-2 border-b border-gray-100">
                            <button 
                                type="button"
                                onClick={() => setModalAberto(false)}
                                className="h-8 w-8 hover:scale-110 active:scale-100 flex justify-center items-center pb-0.5 rounded-full bg-gray-100 text-gray-500 transition-all cursor-pointer"
                            >
                                ✕
                            </button>
                            <h2 className="text-md font-cinzel font-bold text-gray-800 tracking-wide">
                                {editandoId ? 'Editar Serviço' : 'Cadastrar Serviço'}
                            </h2>
                            <div className="w-8 h-8"></div>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col gap-4 text-left">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700">Nome do Serviço</label>
                                <input 
                                    type="text" 
                                    value={formNome}
                                    onChange={(e) => setFormNome(e.target.value)}
                                    placeholder="Ex: Buquê de Rosas / Alongamento em Gel"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700">Descrição</label>
                                <textarea 
                                    value={formDescricao}
                                    onChange={(e) => setFormDescricao(e.target.value)}
                                    placeholder="Ex: Descrição detalhada do produto ou serviço."
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] min-h-[60px]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                        Valor (R$)
                                    </label>
                                    <input 
                                        type="text" 
                                        inputMode="decimal"
                                        value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        placeholder="35,00"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059]"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                        <Layers className="w-3.5 h-3.5 text-gray-400" />
                                        Categoria
                                    </label>
                                    <select 
                                        value={formCategoriaId}
                                        onChange={(e) => setFormCategoriaId(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                                        required
                                    >
                                        {categorias.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                    <Image className="w-3.5 h-3.5 text-gray-400" />
                                    Imagem do Serviço (Formato 1:1)
                                </label>
                                <div className="flex flex-col gap-2">
                                    <div className="relative border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleSelecionarArquivo}
                                            disabled={uploading}
                                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <div className="flex flex-col items-center gap-1.5 text-center pointer-events-none">
                                            {uploading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin"></div>
                                                    <span className="text-[11px] font-semibold text-gray-500">Processando imagem...</span>
                                                </>
                                            ) : formImg ? (
                                                <>
                                                    <img src={formImg} className="w-16 h-16 aspect-square rounded-lg object-cover border border-gray-200" />
                                                    <span className="text-[10px] font-semibold text-[#C5A059] group-hover:underline">Trocar e cortar imagem (1:1)</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Image className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                                    <span className="text-xs font-semibold text-gray-500">Escolher e Cortar Foto (1:1)</span>
                                                    <span className="text-[9px] text-gray-400">JPG, PNG ou WEBP</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {formImg && (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={formImg.startsWith('data:') ? 'Imagem 1:1 recortada pronta' : formImg}
                                                readOnly
                                                className="flex-1 px-3 py-1.5 text-[10px] text-gray-400 border border-gray-100 rounded-lg bg-gray-50/50 focus:outline-none truncate"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setRecorteSrc(formImg)}
                                                className="text-[10px] text-[#C5A059] hover:underline font-bold cursor-pointer"
                                            >
                                                Cortar 1:1
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setFormImg('')}
                                                className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                                            >
                                                Limpar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700">Tipo de Item / Cobrança</label>
                                <select 
                                    value={formTipo}
                                    onChange={(e) => setFormTipo(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                                >
                                    <option value="">Item Principal (Padrão)</option>
                                    <option value="extra">Adicional / Extra (Acrescenta ao pedido)</option>
                                    <option value="substitutivo">Substituição / Variação (Substitui item base)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 py-1">
                                <input 
                                    type="checkbox" 
                                    id="aceita_adicionais"
                                    checked={formAceitaAdicionais}
                                    onChange={(e) => setFormAceitaAdicionais(e.target.checked)}
                                    className="w-4.5 h-4.5 rounded text-[#C5A059] focus:ring-[#C5A059] border-gray-300 accent-[#C5A059] cursor-pointer"
                                />
                                <label htmlFor="aceita_adicionais" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                                    Permitir adicionar complementos / adicionais neste item
                                </label>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                            <button 
                                type="submit"
                                disabled={uploading}
                                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#b08d48] text-white font-bold text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                <span>Salvar no Catálogo</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL DE GERENCIAMENTO DE CATEGORIAS */}
            {/* ========================================================================= */}
            {catModalAberto && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-xs px-4">
                    <div className="w-full max-w-[440px] max-h-[85vh] rounded-3xl flex flex-col bg-white ring-1 ring-[#D9A09E]/50 shadow-2xl p-4 overflow-hidden relative">
                        
                        <div className="w-full flex justify-between items-center pb-2 border-b border-gray-100">
                            <button 
                                type="button"
                                onClick={() => setCatModalAberto(false)}
                                className="h-8 w-8 hover:scale-110 active:scale-100 flex justify-center items-center pb-0.5 rounded-full bg-gray-100 text-gray-500 transition-all cursor-pointer"
                            >
                                ✕
                            </button>
                            <h2 className="text-md font-cinzel font-bold text-gray-800 tracking-wide">
                                Gerenciar Categorias
                            </h2>
                            <div className="w-8 h-8"></div>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col gap-5 text-left">
                            
                            {/* Formulário de Criação/Edição */}
                            <form onSubmit={handleSalvarCategoria} className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/60 flex flex-col gap-3">
                                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    {catEditandoId ? 'Editar Categoria' : 'Nova Categoria'}
                                </h3>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-gray-500">Nome da Categoria</label>
                                    <input 
                                        type="text" 
                                        value={catNome}
                                        onChange={(e) => setCatNome(e.target.value)}
                                        placeholder="Ex: Buquês, Cestas ou Arranjos"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-gray-500">Tipo de Exibição</label>
                                    <select 
                                        value={catEscolha ? 'true' : 'false'}
                                        onChange={(e) => setCatEscolha(e.target.value === 'true')}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                                    >
                                        <option value="true">Aparece no catálogo (Visível na página inicial)</option>
                                        <option value="false">Não aparece no catálogo (Apenas como adicionais de outro item)</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 mt-1">
                                    <button 
                                        type="submit"
                                        className="flex-1 py-2 bg-[#C5A059] hover:bg-[#b08d48] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex justify-center items-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Salvar Categoria</span>
                                    </button>
                                    {catEditandoId && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setCatEditandoId(null)
                                                setCatNome('')
                                                setCatEscolha(true)
                                            }}
                                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* Listagem de Categorias Existentes */}
                            <div className="flex flex-col gap-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Categorias Cadastradas</h3>
                                
                                <div className="max-h-[220px] overflow-y-auto no-scrollbar flex flex-col gap-2">
                                    {categorias.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-2 text-center">Nenhuma categoria cadastrada.</p>
                                    ) : (
                                        categorias.map((cat, idx) => (
                                             <div key={cat.id} className="bg-white rounded-xl border border-gray-200/80 p-2.5 flex items-center justify-between gap-3 shadow-3xs">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold text-gray-800 truncate">{cat.nome}</span>
                                                    <span className="text-[9px] font-semibold mt-0.5 text-gray-500">
                                                        {cat.escolha ? 'Aparece no catálogo' : 'Não aparece no catálogo'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button 
                                                        type="button"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMoverCategoria(idx, -1)}
                                                        className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-20 disabled:cursor-not-allowed flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                                                        title="Mover categoria para cima"
                                                    >
                                                        <ArrowUp className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        disabled={idx === categorias.length - 1}
                                                        onClick={() => handleMoverCategoria(idx, 1)}
                                                        className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-20 disabled:cursor-not-allowed flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                                                        title="Mover categoria para baixo"
                                                    >
                                                        <ArrowDown className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setCatEditandoId(cat.id)
                                                            setCatNome(cat.nome)
                                                            setCatEscolha(cat.escolha)
                                                        }}
                                                        className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                                                        title="Editar categoria"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDeletarCategoria(cat.id)}
                                                        className="h-7 w-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex justify-center items-center border border-red-100 transition-colors cursor-pointer"
                                                        title="Excluir categoria"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
