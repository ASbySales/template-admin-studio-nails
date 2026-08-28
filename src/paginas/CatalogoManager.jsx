import { useState, useEffect } from 'react'
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
    Layers
} from 'lucide-react'
import JKStudioNailsOnlyLogo from '../assets/JKStudioNailsOnlyLogo.png'

export default function CatalogoManager() {
    const [servicos, setServicos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [loading, setLoading] = useState(true)
    const [toastMessage, setToastMessage] = useState('')
    
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

    // Estados para Gerenciamento de Categorias
    const [catModalAberto, setCatModalAberto] = useState(false)
    const [catEditandoId, setCatEditandoId] = useState(null)
    const [catNome, setCatNome] = useState('')
    const [catEscolha, setCatEscolha] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        fetchDados()
    }, [])

    const fetchDados = async () => {
        try {
            setLoading(true)
            
            const { data: catData, error: errCat } = await supabase
                .from('categorias')
                .select('*')
                .order('id', { ascending: true })
            
            if (errCat) throw errCat
            setCategorias(catData || [])

            const { data: servData, error: errServ } = await supabase
                .from('servicos')
                .select('*')

            if (errServ) throw errServ
            setServicos(servData || [])

            if (catData && catData.length > 0 && !formCategoriaId) {
                setFormCategoriaId(catData[0].id.toString())
            }
        } catch (error) {
            console.error('Erro ao buscar dados do catálogo:', error)
            showToast('Erro ao carregar os dados.')
        } finally {
            setLoading(false)
        }
    }

    const showToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(''), 4000)
    }

    const handleUploadImg = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            setUploading(true)
            showToast('Fazendo upload da imagem...')

            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('JK-StudioNails')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('JK-StudioNails')
                .getPublicUrl(filePath)

            if (data && data.publicUrl) {
                setFormImg(data.publicUrl)
                showToast('Upload concluído com sucesso!')
            } else {
                throw new Error('Falha ao obter URL pública.')
            }
        } catch (error) {
            console.error('Erro no upload da imagem:', error)
            showToast('Erro ao realizar o upload.')
        } finally {
            setUploading(false)
        }
    }

    const handleOpenCreateModal = () => {
        setEditandoId(null)
        setFormNome('')
        setFormDescricao('')
        setFormValor('')
        setFormImg('')
        setFormTipo('')
        setFormAceitaAdicionais(true)
        if (categorias.length > 0) {
            setFormCategoriaId(categorias[0].id.toString())
        }
        setModalAberto(true)
    }

    const handleOpenEditModal = (serv) => {
        setEditandoId(serv.id)
        setFormNome(serv.nome)
        setFormDescricao(serv.descricao || '')
        setFormValor(String(serv.valor).replace('.', ','))
        setFormImg(serv.img || '')
        setFormTipo(serv.tipo || '')
        setFormCategoriaId(serv.categoria_id.toString())
        setFormAceitaAdicionais(serv.aceita_adicionais ?? true)
        setModalAberto(true)
    }

    const handleSalvarServico = async (e) => {
        e.preventDefault()

        if (!formNome.trim()) {
            showToast('Por favor, digite o nome do serviço.')
            return
        }

        const valorFormatado = parseFloat(formValor.replace(',', '.'))
        if (isNaN(valorFormatado)) {
            showToast('Por favor, informe um valor monetário válido.')
            return
        }

        const dadosServico = {
            nome: formNome.trim(),
            descricao: formDescricao.trim(),
            valor: valorFormatado,
            img: formImg.trim() || null,
            tipo: formTipo === '' ? null : formTipo,
            categoria_id: parseInt(formCategoriaId),
            aceita_adicionais: formAceitaAdicionais
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
                const { error } = await supabase
                    .from('servicos')
                    .insert(dadosServico)

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

    const handleDeletarServico = async (id) => {
        if (!confirm('Tem certeza que deseja excluir permanentemente este serviço do catálogo?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('servicos')
                .delete()
                .eq('id', id)

            if (error) throw error
            showToast('Serviço removido com sucesso!')
            fetchDados()
        } catch (error) {
            console.error('Erro ao deletar serviço:', error)
            showToast('Não foi possível excluir o serviço.')
        }
    }

    const handleSalvarCategoria = async (e) => {
        e.preventDefault()
        if (!catNome.trim()) {
            showToast('Digite o nome da categoria.')
            return
        }

        const dadosCat = {
            nome: catNome.trim(),
            escolha: catEscolha
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
                    .insert(dadosCat)

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
        if (!confirm('Deseja realmente excluir esta categoria? Atenção: Se houver serviços vinculados, eles precisarão ser alterados ou removidos primeiro.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('categorias')
                .delete()
                .eq('id', id)

            if (error) throw error
            showToast('Categoria removida com sucesso!')
            fetchDados()
        } catch (error) {
            console.error('Erro ao deletar categoria:', error)
            showToast('Não foi possível excluir. Remova todos os serviços desta categoria antes!')
        }
    }

    return (
        <div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans">
            
            {/* Toast flutuante */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-[#C08A89] text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-2 border border-white/20">
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
                        <h1 className="text-md font-cinzel font-bold text-gray-800 tracking-wider">JOYCE KAYANE</h1>
                        <span className="text-[10px] block font-sans font-semibold text-gray-400">GERENCIAR CATALOGO</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => {
                            setCatEditandoId(null)
                            setCatNome('')
                            setCatEscolha(true)
                            setCatModalAberto(true)
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#C08A89] border border-[#C08A89] hover:bg-[#C08A89]/5 px-4 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <Layers className="w-4 h-4" />
                        <span>Categorias</span>
                    </button>
                    <button 
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#C08A89] hover:bg-[#b07978] px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Serviço</span>
                    </button>
                </div>
            </header>


            {/* Container Principal */}
            <main className="flex-1 max-w-[1000px] w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
                
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-10 h-10 border-4 border-[#C08A89]/20 border-t-[#C08A89] rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-400 font-semibold font-cinzel">Carregando catálogo...</p>
                    </div>
                ) : categorias.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-gray-100 shadow-sm gap-2">
                        <Layers className="w-12 h-12 text-[#C08A89]/30" />
                        <p className="font-semibold text-gray-500">Nenhuma categoria cadastrada</p>
                        <p className="text-xs text-gray-400">Por favor, cadastre primeiro as categorias no seu banco de dados Supabase.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {categorias.map((cat) => {
                            const servsDaCat = servicos.filter(s => s.categoria_id === cat.id)

                            return (
                                <div key={cat.id} className="w-full flex flex-col gap-3 text-left">
                                    <div className="flex justify-between items-center border-b border-[#D9A09E]/30 pb-2">
                                        <h2 className="text-lg font-cinzel font-bold text-gray-800 tracking-wide">
                                            {cat.nome}
                                            <span className="text-[10px] font-sans font-bold text-[#C08A89] ml-2 bg-[#D9A09E]/10 rounded-full px-2 py-0.5">
                                                {cat.escolha ? 'Catálogo Principal' : 'Apenas Opcionais'}
                                            </span>
                                        </h2>
                                        <span className="text-xs text-gray-400 font-semibold">{servsDaCat.length} itens</span>
                                    </div>

                                    {servsDaCat.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-2 pl-2">Nenhum serviço cadastrado nesta categoria.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {servsDaCat.map((serv) => (
                                                <div key={serv.id} className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <img 
                                                            src={serv.img || JKStudioNailsOnlyLogo} 
                                                            className="w-12 h-12 rounded-xl object-cover bg-gray-50 border border-gray-100 flex-shrink-0" 
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-bold text-gray-800 truncate">{serv.nome}</span>
                                                            <span className="text-[10px] text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
                                                                {serv.descricao || 'Sem descrição cadastrada'}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs font-bold text-[#C08A89]">R$ {parseFloat(serv.valor).toFixed(2).replace('.', ',')}</span>
                                                                {serv.tipo && (
                                                                    <span className="text-[8px] uppercase tracking-wider font-bold bg-gray-100 text-gray-500 rounded px-1 py-0.5">
                                                                        {serv.tipo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
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

            {/* ========================================================================= */}
            {/* MODAL DE FORMULÁRIO (CADASTRAR / EDITAR SERVIÇO) */}
            {/* ========================================================================= */}
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
                                    placeholder="Ex: Alongamento em Gel"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700">Descrição</label>
                                <textarea 
                                    value={formDescricao}
                                    onChange={(e) => setFormDescricao(e.target.value)}
                                    placeholder="Ex: Aplicação de alongamento de alta resistência com acabamento fino."
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] min-h-[60px]"
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
                                        value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        placeholder="35,00"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89]"
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
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white"
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
                                    Imagem do Serviço
                                </label>
                                <div className="flex flex-col gap-2">
                                    <div className="relative border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleUploadImg}
                                            disabled={uploading}
                                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <div className="flex flex-col items-center gap-1.5 text-center pointer-events-none">
                                            {uploading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-[#C08A89]/20 border-t-[#C08A89] rounded-full animate-spin"></div>
                                                    <span className="text-[11px] font-semibold text-gray-500">Fazendo upload...</span>
                                                </>
                                            ) : formImg ? (
                                                <>
                                                    <img src={formImg} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                                                    <span className="text-[10px] font-semibold text-[#C08A89] group-hover:underline">Trocar imagem</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Image className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                                    <span className="text-xs font-semibold text-gray-500">Escolher Foto do Dispositivo</span>
                                                    <span className="text-[9px] text-gray-400">JPG, PNG ou WEBP</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {formImg && (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={formImg}
                                                readOnly
                                                className="flex-1 px-3 py-1.5 text-[10px] text-gray-400 border border-gray-100 rounded-lg bg-gray-50/50 focus:outline-none truncate"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setFormImg('')}
                                                className="text-[10px] text-red-500 hover:underline font-bold"
                                            >
                                                Limpar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-700">Tipo de Adicional (Apenas Opcionais)</label>
                                <select 
                                    value={formTipo}
                                    onChange={(e) => setFormTipo(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white"
                                >
                                    <option value="">Serviço Principal / Comum (Nulo)</option>
                                    <option value="extra">Extra (Soma o valor bruto)</option>
                                    <option value="substitutivo">Substitutivo (Substitui fração base)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 py-1">
                                <input 
                                    type="checkbox" 
                                    id="aceita_adicionais"
                                    checked={formAceitaAdicionais}
                                    onChange={(e) => setFormAceitaAdicionais(e.target.checked)}
                                    className="w-4.5 h-4.5 rounded text-[#C08A89] focus:ring-[#C08A89] border-gray-300 accent-[#C08A89] cursor-pointer"
                                />
                                <label htmlFor="aceita_adicionais" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                                    Permitir Adicionais / Unitários neste serviço
                                </label>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                            <button 
                                type="submit"
                                className="w-full py-2.5 bg-[#C08A89] hover:bg-[#b07978] text-white font-bold text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2"
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
                                        placeholder="Ex: Banho em Gel ou Unhas Decoradas"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-gray-500">Tipo de Exibição</label>
                                    <select 
                                        value={catEscolha ? 'true' : 'false'}
                                        onChange={(e) => setCatEscolha(e.target.value === 'true')}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white"
                                    >
                                        <option value="true">Catálogo Principal (Exibe como carrossel no site)</option>
                                        <option value="false">Apenas Opcionais (Aparece dentro do modal de serviços)</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 mt-1">
                                    <button 
                                        type="submit"
                                        className="flex-1 py-2 bg-[#C08A89] hover:bg-[#b07978] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex justify-center items-center gap-1.5"
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
                                        categorias.map((cat) => (
                                            <div key={cat.id} className="bg-white rounded-xl border border-gray-200/80 p-2.5 flex items-center justify-between gap-3 shadow-3xs">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold text-gray-800 truncate">{cat.nome}</span>
                                                    <span className="text-[9px] text-[#C08A89] font-semibold mt-0.5">
                                                        {cat.escolha ? 'Carrossel Principal' : 'Modal de Adicionais'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 flex-shrink-0">
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

