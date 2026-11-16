import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  DollarSign,
  Edit,
  Image as ImageIcon,
  Layers,
  Plus,
  RotateCw,
  Save,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { supabase } from '../lib/supabase'
import { getSegmentoMeta, verificarBloqueioAssinatura } from '../lib/segmento'
import { deslogarAdmin, lerVinculosEmCache, resolverTenantAtivo } from '../lib/tenantSession'
import { useAdminUI } from '../lib/adminUi'
import { AdminShell, ListaOrdenavel, PuxarAtualizar, Sheet } from '../componentes/AppLayout'
import BloqueioInadimplencia from '../componentes/BloqueioInadimplencia'

const ordenarItens = (a, b) => (a.ordem ?? 999999) - (b.ordem ?? 999999) || a.id - b.id

const blobParaDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

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
      y: clientY - arrastando.current.y,
    })
  }
  const pararArraste = () => {
    arrastando.current = null
  }

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

    canvas.toBlob(
      (blob) => {
        if (blob) aoConfirmar(blob)
      },
      'image/jpeg',
      0.85
    )
  }

  const esc = escalaBase() * zoom

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-[360px] bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between">
          <h3 className="font-cinzel font-bold text-gray-800 text-sm">Ajustar Imagem (1:1)</h3>
          <button
            type="button"
            onClick={() => setRotacao((r) => (r + 90) % 360)}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer"
            style={{
              backgroundColor: 'var(--as-blush)',
              color: 'var(--as-accent-deep)',
            }}
          >
            <RotateCw className="w-3.5 h-3.5" /> Girar
          </button>
        </div>

        <div
          className="relative rounded-2xl overflow-hidden bg-gray-100 border-2 select-none touch-none cursor-move"
          style={{ width: TAM_VIEW, height: TAM_VIEW, borderColor: 'var(--as-accent)' }}
          onMouseDown={(e) => iniciarArraste(e.clientX, e.clientY)}
          onMouseMove={(e) => moverArraste(e.clientX, e.clientY)}
          onMouseUp={pararArraste}
          onMouseLeave={pararArraste}
          onTouchStart={(e) => e.touches[0] && iniciarArraste(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => e.touches[0] && moverArraste(e.touches[0].clientX, e.touches[0].clientY)}
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
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotacao}deg) scale(${esc})`,
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
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--as-accent)' }}
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
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            style={{ backgroundColor: 'var(--as-accent)' }}
          >
            <Check className="w-4 h-4" /> Usar Foto 1:1
          </button>
        </div>
      </div>
    </div>
  )
}

async function buscarCatalogoTenant(tId = null) {
  const { tenantId, vinculos } = await resolverTenantAtivo(tId)
  const [{ data: tData }, { data: assData }, { data: catData, error: errCat }, { data: servData, error: errServ }, { count: pendCount }] =
    await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('assinaturas_tenant').select('*').eq('tenant_id', tenantId).single(),
      supabase
        .from('categorias')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ordem', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('servicos')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ordem', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('solicitacoes_agendamento')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pendente'),
    ])

  if (errCat) throw errCat
  if (errServ) throw errServ

  return {
    tenantId,
    vinculos,
    tData,
    assData: assData || null,
    catsOrdenadas: [...(catData || [])].filter((c) => !c.arquivado).sort(ordenarItens),
    servsOrdenados: [...(servData || [])].filter((s) => !s.arquivado).sort(ordenarItens),
    pendCount: pendCount || 0,
  }
}

export default function CatalogoManager() {
  const [servicos, setServicos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendentesCount, setPendentesCount] = useState(0)
  const [valorAcrescimo, setValorAcrescimo] = useState('0')
  const [infoAdicional, setInfoAdicional] = useState('')
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formValor, setFormValor] = useState('')
  const [formImg, setFormImg] = useState('')
  const [formTipo, setFormTipo] = useState('')
  const [formCategoriaId, setFormCategoriaId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [formAceitaAdicionais, setFormAceitaAdicionais] = useState(true)
  const [recorteSrc, setRecorteSrc] = useState(null)

  const [catModalAberto, setCatModalAberto] = useState(false)
  const [catEditandoId, setCatEditandoId] = useState(null)
  const [catNome, setCatNome] = useState('')
  const [catEscolha, setCatEscolha] = useState(true)

  const [activeTenantId, setActiveTenantId] = useState(() => {
    return localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
  })
  const [userTenants, setUserTenants] = useState(lerVinculosEmCache)
  const [tenantInfo, setTenantInfo] = useState(null)
  const [assinatura, setAssinatura] = useState(null)

  const navigate = useNavigate()
  const { avisar, confirmar } = useAdminUI()

  const meta = getSegmentoMeta(tenantInfo?.segmento)
  const isLojaVendas = meta.isVendas

  const aplicarDados = useCallback((dados) => {
    if (dados.vinculos.length > 0) setUserTenants(dados.vinculos)
    setActiveTenantId(dados.tenantId)
    if (dados.tData) {
      setTenantInfo(dados.tData)
      setValorAcrescimo(String(dados.tData.valor_acrescimo ?? 0))
      setInfoAdicional(dados.tData.info_adicional || '')
      document.title = `${dados.tData.nome} • Gerenciar Catálogo`
    }
    setAssinatura(dados.assData)
    setPendentesCount(dados.pendCount)
    setCategorias(dados.catsOrdenadas)
    setServicos(dados.servsOrdenados)
    setFormCategoriaId((prev) => {
      if (dados.catsOrdenadas.length === 0) return ''
      return dados.catsOrdenadas.some((c) => String(c.id) === String(prev))
        ? prev
        : dados.catsOrdenadas[0].id.toString()
    })
  }, [])

  const fetchDados = useCallback(
    async (tId = null) => {
      try {
        setLoading(true)
        const dados = await buscarCatalogoTenant(tId)
        aplicarDados(dados)
      } catch (error) {
        console.error('Erro ao buscar dados do catálogo:', error)
        avisar('Erro ao carregar os dados do catálogo.')
      } finally {
        setLoading(false)
      }
    },
    [aplicarDados, avisar]
  )

  useEffect(() => {
    let ativo = true
    buscarCatalogoTenant()
      .then((dados) => {
        if (ativo) aplicarDados(dados)
      })
      .catch((error) => {
        console.error('Erro ao buscar dados do catálogo:', error)
        if (ativo) avisar('Erro ao carregar os dados do catálogo.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [aplicarDados, avisar])

  const handleTrocarTenant = (novoTenantId) => {
    setActiveTenantId(novoTenantId)
    setModalAberto(false)
    setCatModalAberto(false)
    localStorage.setItem('as_active_tenant', novoTenantId)
    fetchDados(novoTenantId)
  }

  const handleReordenarCategorias = async (novaOrdemCats) => {
    const atualizadas = novaOrdemCats.map((c, idx) => ({ ...c, ordem: idx }))
    setCategorias(atualizadas)

    try {
      await Promise.all(
        atualizadas.map((c, idx) => supabase.from('categorias').update({ ordem: idx }).eq('id', c.id))
      )
      avisar('Ordem das categorias atualizada!')
    } catch (err) {
      console.error('Erro ao reordenar categorias:', err)
      fetchDados(activeTenantId)
    }
  }

  const handleReordenarServicos = async (novaListaCat) => {
    const mapaOrdens = new Map(novaListaCat.map((s, idx) => [s.id, idx]))
    setServicos((prev) =>
      prev.map((s) => (mapaOrdens.has(s.id) ? { ...s, ordem: mapaOrdens.get(s.id) } : s))
    )

    try {
      await Promise.all(
        novaListaCat.map((s, idx) => supabase.from('servicos').update({ ordem: idx }).eq('id', s.id))
      )
      avisar('Ordem atualizada!')
    } catch (err) {
      console.error('Erro ao reordenar item:', err)
      fetchDados(activeTenantId)
    }
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
      avisar('Processando imagem 1:1...')

      const filePath = `${activeTenantId}/${Date.now()}.jpg`
      let urlFinal = null

      const { error: uploadError } = await supabase.storage
        .from('stores-media')
        .upload(filePath, blob, { contentType: 'image/jpeg' })

      if (!uploadError) {
        const { data } = supabase.storage.from('stores-media').getPublicUrl(filePath)
        if (data?.publicUrl) {
          urlFinal = data.publicUrl
        }
      }

      if (!urlFinal) {
        urlFinal = await blobParaDataUrl(blob)
      }

      setFormImg(urlFinal)
      avisar('Imagem 1:1 pronta!')
    } catch (error) {
      console.error('Erro ao processar imagem:', error)
      avisar('Erro ao processar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  const handleOpenCreateModal = () => {
    if (categorias.length === 0) {
      avisar('Crie ao menos uma categoria antes de cadastrar.')
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
      avisar(`Digite o nome do ${meta.itemLabel.toLowerCase()}.`)
      return
    }

    const valorLimpo = String(formValor).replace(/[^\d.,-]/g, '').replace(',', '.')
    const valorFormatado = parseFloat(valorLimpo)
    if (isNaN(valorFormatado) || valorFormatado < 0) {
      avisar('Informe um valor monetário válido.')
      return
    }

    const catIdNum = parseInt(formCategoriaId, 10) || categorias[0]?.id
    if (!catIdNum) {
      avisar('Selecione ou crie uma categoria válida.')
      return
    }

    const dadosServico = {
      tenant_id: activeTenantId,
      nome: formNome.trim(),
      descricao: formDescricao.trim(),
      valor: valorFormatado,
      img: formImg.trim() || null,
      tipo: formTipo === '' ? null : formTipo,
      categoria_id: catIdNum,
      aceita_adicionais: formAceitaAdicionais,
      arquivado: false,
    }

    try {
      if (editandoId) {
        const { error } = await supabase.from('servicos').update(dadosServico).eq('id', editandoId)
        if (error) throw error
        avisar(`${meta.itemLabel} atualizado com sucesso!`)
      } else {
        const servsDaCat = servicos.filter((s) => s.categoria_id === catIdNum)
        const { error } = await supabase
          .from('servicos')
          .insert({ ...dadosServico, ordem: servsDaCat.length })
        if (error) throw error
        avisar(`${meta.itemLabel} cadastrado com sucesso!`)
      }

      setModalAberto(false)
      fetchDados(activeTenantId)
    } catch (error) {
      console.error('Erro ao salvar item:', error)
      avisar('Erro ao salvar no banco de dados.')
    }
  }

  const handleDeletarServico = async (serv) => {
    const ok = await confirmar({
      titulo: `Remover ${meta.itemLabel.toLowerCase()}?`,
      texto: `"${serv.nome}" sairá do catálogo público, preservando pedidos anteriores no histórico.`,
      ok: 'Remover',
      perigo: true,
    })
    if (!ok) return

    try {
      const { error: errArq } = await supabase
        .from('servicos')
        .update({ arquivado: true })
        .eq('id', serv.id)

      if (errArq) {
        const { error: errDel } = await supabase.from('servicos').delete().eq('id', serv.id)
        if (errDel) throw errArq
      }

      avisar(`${meta.itemLabel} removido do catálogo!`)
      fetchDados(activeTenantId)
    } catch (error) {
      console.error('Erro ao remover item:', error)
      avisar('Não foi possível remover o item.')
    }
  }

  const handleSalvarConfigLoja = async (e) => {
    e.preventDefault()
    const valorNum = Math.max(0, parseFloat(String(valorAcrescimo).replace(',', '.')) || 0)

    try {
      setSalvandoConfig(true)
      const { error } = await supabase
        .from('tenants')
        .update({
          valor_acrescimo: valorNum,
          info_adicional: infoAdicional.trim() || null,
        })
        .eq('id', activeTenantId)

      if (error) throw error
      avisar('Configurações de acréscimo e retirada salvas!')
    } catch (error) {
      console.error('Erro ao salvar configurações da loja:', error)
      avisar('Erro ao salvar configurações (verifique permissão admin).')
    } finally {
      setSalvandoConfig(false)
    }
  }

  const handleSalvarCategoria = async (e) => {
    e.preventDefault()
    if (!catNome.trim()) {
      avisar('Digite o nome da categoria.')
      return
    }

    const dadosCat = {
      tenant_id: activeTenantId,
      nome: catNome.trim(),
      escolha: catEscolha,
      arquivado: false,
    }

    try {
      if (catEditandoId) {
        const { error } = await supabase
          .from('categorias')
          .update(dadosCat)
          .eq('id', catEditandoId)
        if (error) throw error
        avisar('Categoria atualizada com sucesso!')
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert({ ...dadosCat, ordem: categorias.length })
        if (error) throw error
        avisar('Nova categoria criada com sucesso!')
      }

      setCatNome('')
      setCatEscolha(true)
      setCatEditandoId(null)
      fetchDados(activeTenantId)
    } catch (error) {
      console.error('Erro ao salvar categoria:', error)
      avisar(`Erro ao salvar categoria: ${error?.message || error?.code || 'erro desconhecido'}`)
    }
  }

  const handleDeletarCategoria = async (cat) => {
    const servsAtivos = servicos.filter((s) => s.categoria_id === cat.id && !s.arquivado)
    const texto =
      servsAtivos.length > 0
        ? `A categoria "${cat.nome}" possui ${servsAtivos.length} item(ns) ativo(s). Todos sairão do catálogo, preservando pedidos antigos.`
        : `Deseja excluir a categoria "${cat.nome}"?`

    const ok = await confirmar({
      titulo: 'Excluir categoria?',
      texto,
      ok: 'Excluir',
      perigo: true,
    })
    if (!ok) return

    try {
      await supabase.from('servicos').update({ arquivado: true }).eq('categoria_id', cat.id)

      const { error: errArq } = await supabase
        .from('categorias')
        .update({ arquivado: true })
        .eq('id', cat.id)

      if (errArq) {
        await supabase.from('servicos').update({ categoria_id: null }).eq('categoria_id', cat.id)
        const { error: errDel } = await supabase.from('categorias').delete().eq('id', cat.id)
        if (errDel) throw errArq
      }

      avisar('Categoria removida com sucesso!')
      fetchDados(activeTenantId)
    } catch (error) {
      console.error('Erro ao deletar categoria:', error)
      avisar('Não foi possível excluir a categoria.')
    }
  }

  if (verificarBloqueioAssinatura(assinatura)) {
    return (
      <BloqueioInadimplencia
        tenantInfo={tenantInfo}
        assinatura={assinatura}
        onAtualizarStatus={() => fetchDados(activeTenantId)}
        onDeslogar={() => deslogarAdmin(navigate)}
      />
    )
  }

  return (
    <AdminShell
      titulo={meta.isNail ? 'SERVIÇOS' : 'CATÁLOGO'}
      tenantInfo={tenantInfo}
      userTenants={userTenants}
      activeTenantId={activeTenantId}
      onTrocarTenant={handleTrocarTenant}
      pendentesCount={pendentesCount}
      onDeslogar={() => deslogarAdmin(navigate)}
      maxWidthClass="max-w-[1000px]"
    >
      {recorteSrc && (
        <ModalRecorte1x1
          src={recorteSrc}
          aoCancelar={() => setRecorteSrc(null)}
          aoConfirmar={handleConfirmarRecorte}
        />
      )}

      <PuxarAtualizar
        aoAtualizar={() => fetchDados(activeTenantId)}
        className="flex-1 w-full p-3.5 md:p-6 flex flex-col gap-5"
      >
        {/* Barra de ações rápidas do Catálogo */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="text-left">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--as-accent-deep)' }}
            >
              {meta.emoji} {meta.rotuloSegmento}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCatEditandoId(null)
                setCatNome('')
                setCatEscolha(true)
                setCatModalAberto(true)
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white px-3.5 py-2 rounded-xl border transition-all cursor-pointer active:scale-95"
              style={{
                color: 'var(--as-accent-deep)',
                borderColor: 'var(--as-soft)',
              }}
            >
              <Layers className="w-4 h-4" />
              <span>Categorias</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              style={{ backgroundColor: 'var(--as-accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>{meta.novoItemLabel}</span>
            </button>
          </div>
        </div>

        {/* Configurações Universais da Loja (exibido apenas para Lojas de Vendas) */}
        {isLojaVendas && (
          <form
            onSubmit={handleSalvarConfigLoja}
            className="bg-white rounded-3xl p-4 border border-[var(--as-card-border)] shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-end text-left"
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
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[var(--as-accent)]"
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
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[var(--as-accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={salvandoConfig}
              className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 shrink-0 active:scale-95"
              style={{ backgroundColor: 'var(--as-accent)' }}
            >
              {salvandoConfig ? 'Salvando...' : 'Salvar Taxa / Info'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="w-9 h-9 border-3 rounded-full animate-spin"
              style={{ borderColor: 'var(--as-soft)', borderTopColor: 'var(--as-accent)' }}
            />
            <p className="text-xs text-gray-400 font-semibold font-cinzel">Carregando catálogo...</p>
          </div>
        ) : categorias.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-[var(--as-card-border)] shadow-2xs gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--as-blush)' }}
            >
              <Layers className="w-7 h-7" style={{ color: 'var(--as-accent)' }} />
            </div>
            <p className="font-semibold text-gray-700 text-sm">Nenhuma categoria ativa cadastrada</p>
            <p className="text-xs text-gray-400 max-w-sm">
              Crie a primeira categoria (ex.: Buquês, Alongamento, Adicionais) para começar a
              organizar seus {meta.itemPlural.toLowerCase()}.
            </p>
            <button
              type="button"
              onClick={() => {
                setCatEditandoId(null)
                setCatNome('')
                setCatEscolha(true)
                setCatModalAberto(true)
              }}
              className="mt-1 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--as-accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Categoria</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {categorias.map((cat) => {
              const servsDaCat = servicos.filter((s) => s.categoria_id === cat.id).sort(ordenarItens)

              return (
                <div key={cat.id} className="w-full flex flex-col gap-3 text-left">
                  <div className="flex justify-between items-center border-b border-[var(--as-soft)] pb-2">
                    <h2 className="text-base sm:text-lg font-cinzel font-bold text-gray-800 tracking-wide flex items-center flex-wrap gap-2">
                      <span>{cat.nome}</span>
                      <span
                        className={`text-[10px] font-sans font-bold rounded-full px-2.5 py-0.5 border ${
                          cat.escolha
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {cat.escolha ? 'Aparece no catálogo' : 'Adicionais / Oculta'}
                      </span>
                    </h2>
                    <span className="text-xs text-gray-400 font-semibold shrink-0">
                      {servsDaCat.length} {servsDaCat.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  {servsDaCat.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2 pl-2">
                      Nenhum item cadastrado nesta categoria.
                    </p>
                  ) : (
                    <ListaOrdenavel
                      itens={servsDaCat}
                      aoReordenar={handleReordenarServicos}
                      gridClassName="grid grid-cols-1 md:grid-cols-2 gap-3"
                      renderItem={(serv, _idx, { ControlesOrdem }) => (
                        <div className="bg-white rounded-2xl border border-[var(--as-card-border)] p-3 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={serv.img || AlbertSalesLogo}
                              alt={serv.nome}
                              className="w-12 h-12 aspect-square rounded-xl object-cover bg-gray-50 border border-gray-100 shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-gray-800 truncate">
                                {serv.nome}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate max-w-[190px] sm:max-w-[260px]">
                                {serv.descricao || 'Sem descrição cadastrada'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: 'var(--as-accent-deep)' }}
                                >
                                  R$ {parseFloat(serv.valor).toFixed(2).replace('.', ',')}
                                </span>
                                {serv.tipo === 'extra' && (
                                  <span className="text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                                    Adicional (+ Extra)
                                  </span>
                                )}
                                {serv.tipo === 'substitutivo' && (
                                  <span className="text-[8px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                                    Substitutivo
                                  </span>
                                )}
                                {!serv.tipo && (
                                  <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                                    Principal
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {ControlesOrdem}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(serv)}
                              className="h-8 w-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                              title={`Editar ${meta.itemLabel.toLowerCase()}`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletarServico(serv)}
                              className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex justify-center items-center border border-red-100 transition-colors cursor-pointer"
                              title={`Excluir ${meta.itemLabel.toLowerCase()}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PuxarAtualizar>

      {modalAberto && (
        <Sheet
          titulo={editandoId ? meta.editarItemLabel : meta.cadastrarItemLabel}
          aoFechar={() => setModalAberto(false)}
          rodape={
            <button
              type="submit"
              form="form-catalogo-item"
              disabled={uploading}
              className="w-full h-12 text-white font-bold text-sm rounded-2xl shadow-sm active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--as-accent)' }}
            >
              <Save className="w-4 h-4" />
              <span>Salvar no Catálogo</span>
            </button>
          }
        >
          <form
            id="form-catalogo-item"
            onSubmit={handleSalvarServico}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">
                Nome do {meta.itemLabel}
              </label>
              <input
                type="text"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder={
                  isLojaVendas
                    ? 'Ex: Vela Lavanda 180g'
                    : meta.isNail
                    ? 'Ex: Alongamento em Gel'
                    : 'Ex: Buquê de Rosas Colombianas'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Descrição</label>
              <textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Descrição detalhada do item."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)] min-h-[68px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
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
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)] bg-white"
                  required
                >
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                Imagem (Formato 1:1)
              </label>
              <div className="flex flex-col gap-2">
                <div className="relative border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors cursor-pointer group">
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
                        <div
                          className="w-5 h-5 border-2 rounded-full animate-spin"
                          style={{
                            borderColor: 'var(--as-soft)',
                            borderTopColor: 'var(--as-accent)',
                          }}
                        />
                        <span className="text-[11px] font-semibold text-gray-500">
                          Processando imagem...
                        </span>
                      </>
                    ) : formImg ? (
                      <>
                        <img
                          src={formImg}
                          alt="Prévia"
                          className="w-16 h-16 aspect-square rounded-lg object-cover border border-gray-200"
                        />
                        <span
                          className="text-[10px] font-semibold group-hover:underline"
                          style={{ color: 'var(--as-accent-deep)' }}
                        >
                          Trocar e cortar imagem (1:1)
                        </span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-gray-500">
                          Escolher e Cortar Foto (1:1)
                        </span>
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
                      className="flex-1 px-3 py-1.5 text-[10px] text-gray-400 border border-gray-100 rounded-lg bg-white focus:outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={() => setRecorteSrc(formImg)}
                      className="text-[10px] hover:underline font-bold cursor-pointer"
                      style={{ color: 'var(--as-accent-deep)' }}
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

            {!isLojaVendas && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">
                    Tipo de Item / Cobrança
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)] bg-white"
                  >
                    <option value="">Item Principal (Padrão)</option>
                    <option value="extra">Adicional / Extra (Acrescenta ao pedido)</option>
                    <option value="substitutivo">
                      Substituição / Variação (Substitui item base)
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="aceita_adicionais"
                    checked={formAceitaAdicionais}
                    onChange={(e) => setFormAceitaAdicionais(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-gray-300 cursor-pointer"
                    style={{ accentColor: 'var(--as-accent)' }}
                  />
                  <label
                    htmlFor="aceita_adicionais"
                    className="text-xs font-bold text-gray-700 cursor-pointer select-none"
                  >
                    Permitir adicionar complementos / adicionais neste item
                  </label>
                </div>
              </>
            )}
          </form>
        </Sheet>
      )}

      {catModalAberto && (
        <Sheet titulo="Gerenciar Categorias" cheio aoFechar={() => setCatModalAberto(false)}>
          <div className="flex flex-col gap-5">
            <form
              onSubmit={handleSalvarCategoria}
              className="bg-white rounded-2xl p-3.5 border border-[var(--as-card-border)] flex flex-col gap-3"
            >
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {catEditandoId ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-500">Nome da Categoria</label>
                <input
                  type="text"
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  placeholder={
                    meta.isNail
                      ? 'Ex: Alongamento, Manutenção ou Adicionais'
                      : 'Ex: Buquês, Coleção ou Presentes'
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)] bg-white"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-500">Tipo de Exibição</label>
                <select
                  value={catEscolha ? 'true' : 'false'}
                  onChange={(e) => setCatEscolha(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)] bg-white"
                >
                  <option value="true">Aparece no catálogo (Visível na página inicial)</option>
                  <option value="false">
                    Não aparece no catálogo (Apenas como adicionais de outro item)
                  </option>
                </select>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex justify-center items-center gap-1.5"
                  style={{ backgroundColor: 'var(--as-accent)' }}
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

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                Categorias Cadastradas
              </h3>

              {categorias.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2 text-center">
                  Nenhuma categoria cadastrada.
                </p>
              ) : (
                <ListaOrdenavel
                  itens={categorias}
                  aoReordenar={handleReordenarCategorias}
                  renderItem={(cat, _idx, { ControlesOrdem }) => (
                    <div className="bg-white rounded-xl border border-[var(--as-card-border)] p-2.5 flex items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-gray-800 truncate">{cat.nome}</span>
                        <span className="text-[9px] font-semibold mt-0.5 text-gray-500">
                          {cat.escolha ? 'Aparece no catálogo' : 'Adicionais / Oculta'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {ControlesOrdem}
                        <button
                          type="button"
                          onClick={() => {
                            setCatEditandoId(cat.id)
                            setCatNome(cat.nome)
                            setCatEscolha(cat.escolha)
                          }}
                          className="h-8 w-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex justify-center items-center border border-gray-200 transition-colors cursor-pointer"
                          title="Editar categoria"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletarCategoria(cat)}
                          className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex justify-center items-center border border-red-100 transition-colors cursor-pointer"
                          title="Excluir categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          </div>
        </Sheet>
      )}
    </AdminShell>
  )
}
