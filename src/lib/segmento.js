const SEGMENTOS_LOJA_VENDAS = ['vendas', 'loja', 'produtos']
const SEGMENTOS_NAIL_DESIGN = [
  'nails',
  'nail_design',
  'nail-design',
  'naildesign',
  'manicure',
  'estudio',
  'estúdio',
  'studio',
]

export function normalizarSegmento(segmento) {
  return String(segmento || '').trim().toLowerCase()
}

export function isLojaVendas(segmento) {
  return SEGMENTOS_LOJA_VENDAS.includes(normalizarSegmento(segmento))
}

export function isNailDesign(segmento) {
  return SEGMENTOS_NAIL_DESIGN.includes(normalizarSegmento(segmento))
}

/**
 * Retorna metadados visuais e de rotulagem seguros para cada segmento atendido pela AS Gestão,
 * preservando o fluxo específico de Vendas, Floricultura (Flora Haste) e Nail Design.
 */
export function getSegmentoMeta(segmento) {
  const norm = normalizarSegmento(segmento)

  if (isNailDesign(norm)) {
    return {
      segmento: norm,
      isNail: true,
      isVendas: false,
      tema: 'rose',
      emoji: '💅',
      rotuloSegmento: 'Nail Design',
      itemLabel: 'Serviço',
      itemPlural: 'Serviços',
      novoItemLabel: 'Novo Serviço',
      editarItemLabel: 'Editar Serviço',
      cadastrarItemLabel: 'Cadastrar Serviço',
      solicitacaoLabel: 'Solicitação',
    }
  }

  if (isLojaVendas(norm)) {
    return {
      segmento: norm,
      isNail: false,
      isVendas: true,
      tema: 'gold',
      emoji: '🛍️',
      rotuloSegmento: 'Catálogo & Vendas',
      itemLabel: 'Produto',
      itemPlural: 'Produtos',
      novoItemLabel: 'Novo Produto',
      editarItemLabel: 'Editar Produto',
      cadastrarItemLabel: 'Cadastrar Produto',
      solicitacaoLabel: 'Pedido',
    }
  }

  return {
    segmento: norm || 'floricultura',
    isNail: false,
    isVendas: false,
    tema: 'gold',
    emoji: '🌸',
    rotuloSegmento: norm === 'floricultura' ? 'Floricultura' : 'Catálogo Online',
    itemLabel: 'Produto',
    itemPlural: 'Produtos',
    novoItemLabel: 'Novo Serviço / Produto',
    editarItemLabel: 'Editar Item',
    cadastrarItemLabel: 'Cadastrar Item',
    solicitacaoLabel: 'Pedido',
  }
}

/**
 * Formata o código de exibição do pedido sem confundir lojas de venda / floricultura
 * com códigos de agendamento (#AG-XXXX) usados nos templates de Nail Design.
 */
export function formatarCodigoPedido(sol, segmento) {
  const bruto = sol?.codigo_pedido ?? sol?.id
  if (bruto === null || bruto === undefined || bruto === '') return ''

  const texto = String(bruto).trim()
  const isNail = isNailDesign(segmento)

  if (/^#?AG-/i.test(texto)) {
    return texto.startsWith('#') ? texto.toUpperCase() : `#${texto.toUpperCase()}`
  }

  const limpo = texto.replace(/^#/, '')
  const num = Number(limpo)

  if (Number.isInteger(num) && num > 0) {
    return isNail ? `#AG-${String(num).padStart(4, '0')}` : `#${num}`
  }

  const sufixo = limpo.slice(-4).toUpperCase()
  return isNail ? `#AG-${sufixo}` : `#${sufixo}`
}

export function formatarBrl(valor) {
  return `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`
}

export function mascaraWhatsapp(value) {
  let val = String(value || '').replace(/\D/g, '')
  if (val.length > 11) val = val.slice(0, 11)

  let formatted = ''
  if (val.length > 0) formatted += `(${val.slice(0, 2)}`
  if (val.length > 2) formatted += `) ${val.slice(2, 3)}`
  if (val.length > 3) formatted += ` ${val.slice(3, 7)}`
  if (val.length > 7) formatted += `-${val.slice(7, 11)}`
  return formatted
}

export function whatsappLink(whatsapp) {
  const digitos = String(whatsapp || '').replace(/\D/g, '')
  if (!digitos) return '#'
  const completo = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  return `https://wa.me/${completo}`
}

export function telLink(whatsapp) {
  const digitos = String(whatsapp || '').replace(/\D/g, '')
  return digitos ? `tel:${digitos}` : '#'
}

export function tempoRelativo(dataStr, agoraMs = Date.now()) {
  if (!dataStr) return ''
  const ts = new Date(dataStr).getTime()
  if (Number.isNaN(ts)) return ''
  const seg = Math.max(0, Math.floor((agoraMs - ts) / 1000))
  if (seg < 60) return 'agora'
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`
  const dias = Math.floor(seg / 86400)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

/**
 * Calcula o valor real de uma solicitação com fallback em preco_unitario congelado
 * e regra de item substitutivo (valorOpc - valorBase / 10).
 */
export function calcularTotalSolicitacao(sol, servicos = []) {
  let total = 0
  const itens = sol?.itens_agendamento
  if (!Array.isArray(itens) || itens.length === 0) return 0

  const itensPrincipais = itens.filter((i) => i.parent_item_id === null)
  itensPrincipais.forEach((itemPrincipal) => {
    const servPrincipal = servicos.find((s) => s.id === itemPrincipal.servico_id)
    const valorBase = servPrincipal
      ? parseFloat(servPrincipal.valor)
      : parseFloat(itemPrincipal.preco_unitario || 0)

    let subtotalItem = (Number.isFinite(valorBase) ? valorBase : 0) * (itemPrincipal.quantidade || 1)

    const opcionais = itens.filter((i) => i.parent_item_id === itemPrincipal.id)
    opcionais.forEach((opcItem) => {
      const opc = servicos.find((s) => s.id === opcItem.servico_id)
      const qtd = opcItem.quantidade || 0
      if (qtd > 0) {
        const valorOpc = opc ? parseFloat(opc.valor) : parseFloat(opcItem.preco_unitario || 0)
        const vOpc = Number.isFinite(valorOpc) ? valorOpc : 0
        if (opc?.tipo === 'substitutivo') {
          const valorUnidadeSimples = (Number.isFinite(valorBase) ? valorBase : 0) / 10
          subtotalItem += qtd * (vOpc - valorUnidadeSimples)
        } else {
          subtotalItem += qtd * vOpc
        }
      }
    })

    total += Math.max(0, subtotalItem)
  })

  return total
}

export function exibirValorTotalSolicitacao(sol, servicos = []) {
  const val = parseFloat(sol?.valor_total)
  if (Number.isNaN(val) || val <= 0) {
    return calcularTotalSolicitacao(sol, servicos) + (Number(sol?.valor_acrescimo) || 0)
  }
  return val
}

export function calcularTotalEdicao(editItens = [], servicos = []) {
  if (!servicos.length) return 0
  let total = 0

  editItens.forEach((item) => {
    const servPrincipal = servicos.find((s) => s.id === item.servico_id)
    if (!servPrincipal) return

    const valorBase = parseFloat(servPrincipal.valor) || 0
    const qtdPrincipal = Math.max(1, Number(item.quantidade) || 1)
    let subtotalItem = valorBase * qtdPrincipal

    Object.entries(item.opcionais || {}).forEach(([idStr, qtd]) => {
      const id = parseInt(idStr, 10)
      const opc = servicos.find((s) => s.id === id)
      const q = Number(qtd) || 0
      if (opc && q > 0) {
        const valorOpc = parseFloat(opc.valor) || 0
        if (opc.tipo === 'substitutivo') {
          subtotalItem += q * (valorOpc - valorBase / 10)
        } else {
          subtotalItem += q * valorOpc
        }
      }
    })

    total += Math.max(0, subtotalItem)
  })

  return total
}

export function verificarBloqueioAssinatura(assinatura, hojeBrasilOverride = null) {
  if (!assinatura) return false
  const hojeBrasil =
    hojeBrasilOverride || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const isIsento = Boolean(assinatura.isento_cobranca)
  const adiamentoVigente = Boolean(assinatura.adiado_ate && assinatura.adiado_ate >= hojeBrasil)
  if (isIsento || adiamentoVigente) return false

  const vencimentoExpirado = (() => {
    if (!assinatura.proximo_vencimento) return false
    const dt = new Date(`${String(assinatura.proximo_vencimento).split('T')[0]}T12:00:00`)
    if (Number.isNaN(dt.getTime())) return false
    dt.setDate(dt.getDate() + 3)
    return dt.toISOString().split('T')[0] < hojeBrasil
  })()

  return (
    assinatura.status === 'bloqueado' ||
    vencimentoExpirado ||
    (assinatura.status === 'atrasado' && !assinatura.proximo_vencimento)
  )
}
