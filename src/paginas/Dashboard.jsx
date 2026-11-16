import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Check,
  CheckCheck,
  CheckSquare,
  Database,
  Edit3,
  Inbox,
  Loader2,
  MessageCircle,
  Minus,
  Pencil,
  Phone,
  Plus,
  Search,
  Slash,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  calcularTotalEdicao,
  exibirValorTotalSolicitacao,
  formatarBrl,
  formatarCodigoPedido,
  getSegmentoMeta,
  mascaraWhatsapp,
  telLink,
  tempoRelativo,
  verificarBloqueioAssinatura,
  whatsappLink,
} from '../lib/segmento'
import { deslogarAdmin, lerVinculosEmCache, resolverTenantAtivo } from '../lib/tenantSession'
import { useAdminUI } from '../lib/adminUi'
import { AdminShell, PuxarAtualizar, SeloStatus, Sheet } from '../componentes/AppLayout'
import BloqueioInadimplencia from '../componentes/BloqueioInadimplencia'

const ABAS_STATUS = [
  { id: 'pendente', rotulo: 'Pendentes' },
  { id: 'aprovado', rotulo: 'Aprovados' },
  { id: 'cumprido', rotulo: 'Cumpridos' },
  { id: 'negado', rotulo: 'Negados' },
]

const ROTULOS_STATUS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  cumprido: 'Cumprido',
  negado: 'Negado',
}

function CardSolicitacao({
  sol,
  servicos,
  segmento,
  agoraMs,
  swipeDxAtual,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onAbrirDetalhe,
  onAbrirEdicao,
  onAtualizarStatus,
}) {
  const statusAtual = sol.status || 'pendente'
  const isNovo =
    statusAtual === 'pendente' && agoraMs - new Date(sol.created_at).getTime() < 12 * 3600 * 1000
  const itensPrincipais = (sol.itens_agendamento || []).filter((i) => i.parent_item_id === null)
  const codigoPedido = formatarCodigoPedido(sol, segmento)

  return (
    <div className="relative">
      {statusAtual === 'pendente' && swipeDxAtual !== 0 && (
        <div
          className={`absolute inset-0 rounded-3xl flex items-center px-6 ${
            swipeDxAtual > 0 ? 'bg-emerald-500 justify-start' : 'bg-red-500 justify-end'
          }`}
        >
          <span className="text-white font-bold text-xs flex items-center gap-1.5">
            {swipeDxAtual > 0 ? (
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (Math.abs(swipeDxAtual) < 5) onAbrirDetalhe(sol)
        }}
        style={{
          transform: `translateX(${swipeDxAtual}px)`,
          transition: swipeDxAtual ? 'none' : 'transform 0.25s',
        }}
        className="bg-white rounded-3xl border border-[var(--as-card-border)] p-4 shadow-2xs relative flex flex-col justify-between gap-3 transition-shadow hover:shadow-sm text-left cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {codigoPedido && (
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0"
                  style={{
                    backgroundColor: 'var(--as-blush)',
                    borderColor: 'var(--as-soft)',
                    color: 'var(--as-accent-deep)',
                  }}
                >
                  {codigoPedido}
                </span>
              )}
              <h3 className="font-bold text-[15px] text-gray-900 truncate">{sol.nome_cliente}</h3>
              {isNovo && (
                <span
                  className="text-[9px] font-extrabold tracking-wider text-white rounded-full px-2 py-0.5 uppercase shrink-0"
                  style={{ backgroundColor: 'var(--as-accent)' }}
                >
                  NOVO
                </span>
              )}
            </div>

            <a
              href={whatsappLink(sol.whatsapp_cliente)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] hover:underline font-semibold mt-1"
              style={{ color: 'var(--as-accent-deep)' }}
            >
              <Phone className="w-3 h-3" />
              <span>{sol.whatsapp_cliente}</span>
            </a>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-[11px] text-gray-400 font-medium">
              {tempoRelativo(sol.created_at, agoraMs)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAbrirEdicao(sol)
              }}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-0.5 cursor-pointer"
              title="Editar pedido"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editar</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-left">
          {itensPrincipais.length === 0 ? (
            <span className="text-xs text-gray-400 italic">Itens do pedido</span>
          ) : (
            itensPrincipais.map((itemPrincipal) => {
              const serv = servicos.find((s) => s.id === itemPrincipal.servico_id)
              const nomeItem = serv ? serv.nome : `Item #${itemPrincipal.servico_id}`
              const opcionais = (sol.itens_agendamento || []).filter(
                (i) => i.parent_item_id === itemPrincipal.id
              )

              return (
                <div key={itemPrincipal.id} className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-gray-700 font-medium">
                    {(itemPrincipal.quantidade || 1) > 1 ? `${itemPrincipal.quantidade}x ` : ''}
                    {nomeItem}
                  </span>
                  {opcionais.length > 0 && (
                    <div className="pl-2.5 flex flex-col gap-0.5 border-l-2 border-dashed border-gray-200">
                      {opcionais.map((opcItem) => {
                        const opc = servicos.find((s) => s.id === opcItem.servico_id)
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

        {sol.observacoes && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 text-left text-[11px] text-amber-950 leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block mb-0.5">
              Observações / Entrega:
            </span>
            <span className="line-clamp-2">{sol.observacoes}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5 gap-2 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-[17px]" style={{ color: 'var(--as-accent-deep)' }}>
              {formatarBrl(exibirValorTotalSolicitacao(sol, servicos))}
            </span>
            {Number(sol.valor_acrescimo) > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                + {formatarBrl(sol.valor_acrescimo)} acréscimo
              </span>
            )}
          </div>
          <SeloStatus status={statusAtual} />
        </div>

        {statusAtual === 'pendente' && (
          <div className="grid grid-cols-2 gap-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onAtualizarStatus(sol, 'negado')}
              className="py-2.5 px-3 rounded-2xl bg-[#FDECEC] hover:bg-[#fbdADA] text-[#B43C3C] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Negar</span>
            </button>
            <button
              type="button"
              onClick={() => onAtualizarStatus(sol, 'aprovado')}
              className="py-2.5 px-3 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Aprovar</span>
            </button>
          </div>
        )}

        {statusAtual === 'aprovado' && (
          <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onAtualizarStatus(sol, 'cumprido')}
              className="py-2.5 px-3 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Cumprir / Concluir</span>
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onAtualizarStatus(sol, 'negado')}
                className="py-2.5 px-2 rounded-2xl bg-[#FDECEC] hover:bg-[#fbdADA] text-[#B43C3C] flex items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                title="Mover para Negados"
              >
                <X className="w-3.5 h-3.5" />
                <span>Negar</span>
              </button>
              <button
                type="button"
                onClick={() => onAtualizarStatus(sol, 'pendente')}
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
          <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onAtualizarStatus(sol, 'pendente')}
              className="py-2 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Slash className="w-3.5 h-3.5" />
              <span>Voltar p/ Pendente</span>
            </button>
            <button
              type="button"
              onClick={() => onAtualizarStatus(sol, 'aprovado')}
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
}

function DetalheSolicitacaoSheet({ sol, servicos, segmento, aoFechar, aoAbrirEdicao, aoAtualizarStatus }) {
  if (!sol) return null

  const meta = getSegmentoMeta(segmento)
  const codigo = formatarCodigoPedido(sol, segmento)
  const statusAtual = sol.status || 'pendente'
  const dataCriacao = sol.created_at
    ? new Date(sol.created_at).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  const itensPrincipais = (sol.itens_agendamento || []).filter((i) => i.parent_item_id === null)
  const subtitulo = [codigo ? `${meta.solicitacaoLabel} ${codigo}` : meta.solicitacaoLabel, dataCriacao]
    .filter(Boolean)
    .join(' · ')

  const rodape = (
    <div className="flex flex-col gap-2">
      {statusAtual === 'pendente' && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              aoAtualizarStatus(sol, 'negado')
              aoFechar()
            }}
            className="h-12 rounded-2xl bg-[#FDECEC] hover:bg-[#fbdADA] text-[#B43C3C] flex items-center justify-center gap-1.5 text-sm font-bold transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Negar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              aoAtualizarStatus(sol, 'aprovado')
              aoFechar()
            }}
            className="h-12 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-1.5 text-sm font-bold transition active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aprovar</span>
          </button>
        </div>
      )}

      {statusAtual === 'aprovado' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              aoAtualizarStatus(sol, 'cumprido')
              aoFechar()
            }}
            className="h-12 rounded-2xl bg-[#E7F6ED] hover:bg-[#d5f0e0] text-[#1E7A46] flex items-center justify-center gap-2 text-sm font-bold transition active:scale-95 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Cumprir / Concluir</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                aoAtualizarStatus(sol, 'negado')
                aoFechar()
              }}
              className="h-10 rounded-2xl bg-[#FDECEC] text-[#B43C3C] flex items-center justify-center gap-1 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Negar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                aoAtualizarStatus(sol, 'pendente')
                aoFechar()
              }}
              className="h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center gap-1 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Slash className="w-3.5 h-3.5" />
              <span>Voltar p/ Pendente</span>
            </button>
          </div>
        </div>
      )}

      {(statusAtual === 'cumprido' || statusAtual === 'negado') && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              aoAtualizarStatus(sol, 'pendente')
              aoFechar()
            }}
            className="h-11 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <Slash className="w-3.5 h-3.5" />
            <span>Voltar p/ Pendente</span>
          </button>
          <button
            type="button"
            onClick={() => {
              aoAtualizarStatus(sol, 'aprovado')
              aoFechar()
            }}
            className="h-11 rounded-2xl bg-[#E7F6ED] text-[#1E7A46] flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aprovar</span>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <Sheet titulo={sol.nome_cliente} subtitulo={subtitulo} aoFechar={aoFechar} rodape={rodape}>
      <div className="flex items-center justify-between mb-4">
        <SeloStatus status={statusAtual} />
        <button
          type="button"
          onClick={() => aoAbrirEdicao(sol)}
          className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3.5 py-1.5 transition active:scale-95 cursor-pointer"
          style={{
            backgroundColor: 'var(--as-blush)',
            color: 'var(--as-accent-deep)',
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Editar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={whatsappLink(sol.whatsapp_cliente)}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 rounded-2xl bg-[#25D366] hover:bg-[#1fb958] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95"
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp</span>
        </a>
        <a
          href={telLink(sol.whatsapp_cliente)}
          className="h-12 rounded-2xl bg-white border border-[var(--as-soft)] font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95"
          style={{ color: 'var(--as-accent-deep)' }}
        >
          <Phone className="w-4 h-4" />
          <span>Ligar</span>
        </a>
      </div>
      <p className="text-center text-xs text-gray-500 mt-2 font-medium">{sol.whatsapp_cliente}</p>

      {(sol.data_agendamento || sol.horario_agendamento) && (
        <div className="mt-4 bg-white rounded-2xl border border-[var(--as-card-border)] p-3 flex items-center gap-2.5 text-xs text-gray-700">
          <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--as-accent)' }} />
          <span>
            {sol.data_agendamento && <strong>{sol.data_agendamento}</strong>}
            {sol.data_agendamento && sol.horario_agendamento ? ' · ' : ''}
            {sol.horario_agendamento}
          </span>
        </div>
      )}

      {sol.observacoes && (
        <div className="mt-4 bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block mb-1">
            Observações / Entrega
          </span>
          <span>{sol.observacoes}</span>
        </div>
      )}

      <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-5 mb-2">
        {meta.itemPlural}
      </h3>
      <div className="bg-white rounded-2xl border border-[var(--as-card-border)] divide-y divide-gray-100 overflow-hidden">
        {itensPrincipais.length === 0 ? (
          <div className="p-3.5 text-xs text-gray-400 italic">Sem itens detalhados</div>
        ) : (
          itensPrincipais.map((itemPrincipal) => {
            const serv = servicos.find((s) => s.id === itemPrincipal.servico_id)
            const nomeItem = serv ? serv.nome : `Item #${itemPrincipal.servico_id}`
            const valorUnit = serv ? serv.valor : itemPrincipal.preco_unitario || 0
            const opcionais = (sol.itens_agendamento || []).filter(
              (i) => i.parent_item_id === itemPrincipal.id
            )
            return (
              <div key={itemPrincipal.id} className="p-3.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {(itemPrincipal.quantidade || 1) > 1 ? `${itemPrincipal.quantidade}x ` : ''}
                    {nomeItem}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 shrink-0">
                    {formatarBrl(valorUnit)}
                  </span>
                </div>
                {opcionais.length > 0 && (
                  <div className="mt-1.5 pl-3 border-l-2 border-dashed border-[var(--as-soft)] flex flex-col gap-1">
                    {opcionais.map((opcItem) => {
                      const opc = servicos.find((s) => s.id === opcItem.servico_id)
                      const nomeOpc = opc ? opc.nome : `Adicional #${opcItem.servico_id}`
                      return (
                        <div
                          key={opcItem.id}
                          className="flex justify-between text-xs text-gray-500"
                        >
                          <span>
                            + {nomeOpc} ({opcItem.quantidade}x)
                          </span>
                          <span>{formatarBrl(opc ? opc.valor : opcItem.preco_unitario || 0)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}

        {Number(sol.valor_acrescimo) > 0 && (
          <div className="px-3.5 py-2.5 flex justify-between items-center text-xs text-amber-900 bg-amber-50/50">
            <span className="font-semibold">Acréscimo / Taxa</span>
            <span className="font-bold">+ {formatarBrl(sol.valor_acrescimo)}</span>
          </div>
        )}

        <div
          className="p-3.5 flex justify-between items-center"
          style={{ backgroundColor: 'var(--as-blush)' }}
        >
          <span className="font-bold text-gray-900 text-sm">Total</span>
          <span className="font-bold text-lg" style={{ color: 'var(--as-accent-deep)' }}>
            {formatarBrl(exibirValorTotalSolicitacao(sol, servicos))}
          </span>
        </div>
      </div>
    </Sheet>
  )
}

function EditarSolicitacaoSheet({
  sol,
  servicos,
  opcionaisDisponiveis,
  aoFechar,
  aoSalvo,
}) {
  const { avisar } = useAdminUI()
  const [nome, setNome] = useState(sol?.nome_cliente || '')
  const [whatsapp, setWhatsapp] = useState(sol?.whatsapp_cliente || '')
  const [salvando, setSalvando] = useState(false)
  const [itens, setItens] = useState(() =>
    (sol?.itens_agendamento || [])
      .filter((i) => i.parent_item_id === null)
      .map((itemPrincipal) => {
        const opcionais = {}
        ;(sol?.itens_agendamento || [])
          .filter((i) => i.parent_item_id === itemPrincipal.id)
          .forEach((opc) => {
            opcionais[opc.servico_id] = opc.quantidade
          })
        return {
          idInterno: itemPrincipal.id,
          servico_id: itemPrincipal.servico_id,
          quantidade: Math.max(1, Number(itemPrincipal.quantidade) || 1),
          opcionais,
        }
      })
  )

  if (!sol) return null

  const alterarOpcional = (idInterno, opcId, direcao) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.idInterno !== idInterno) return item

        const novosOpcionais = { ...item.opcionais }
        const qtdAtual = novosOpcionais[opcId] || 0
        const opc = servicos.find((s) => s.id === opcId)

        if (direcao === 'mais') {
          if (opc && opc.tipo === 'substitutivo') {
            const totalSubstitutivos = Object.entries(novosOpcionais).reduce((soma, [idStr, q]) => {
              const op = servicos.find((s) => s.id === parseInt(idStr, 10))
              return op && op.tipo === 'substitutivo' ? soma + q : soma
            }, 0)
            if (totalSubstitutivos >= 10) {
              avisar('Limite máximo de 10 variações substitutivas atingido.')
              return item
            }
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
      })
    )
  }

  const totalCalculado = calcularTotalEdicao(itens, servicos) + (Number(sol.valor_acrescimo) || 0)

  const handleSalvar = async () => {
    try {
      setSalvando(true)
      const payloadItens = itens.map((item) => ({
        servico_id: item.servico_id,
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        opcionais: Object.entries(item.opcionais || {})
          .filter(([, qtd]) => Number(qtd) > 0)
          .map(([opcId, qtd]) => ({
            servico_id: parseInt(opcId, 10),
            quantidade: Number(qtd),
          })),
      }))

      const { error: errRpc } = await supabase.rpc('editar_solicitacao_lojista', {
        p_solicitacao_id: sol.id,
        p_nome_cliente: nome.trim(),
        p_whatsapp_cliente: whatsapp,
        p_data_agendamento: sol.data_agendamento || null,
        p_horario_agendamento: sol.horario_agendamento || null,
        p_status: sol.status || 'pendente',
        p_observacoes: sol.observacoes || null,
        p_itens: payloadItens,
      })

      if (errRpc) {
        const tenantId = sol.tenant_id || localStorage.getItem('as_active_tenant')
        const { error: errUpd } = await supabase
          .from('solicitacoes_agendamento')
          .update({
            nome_cliente: nome.trim(),
            whatsapp_cliente: whatsapp,
            valor_total: totalCalculado > 0 ? totalCalculado : sol.valor_total,
          })
          .eq('id', sol.id)
          .eq('tenant_id', tenantId)

        if (errUpd) throw errUpd
      }

      avisar('Alterações salvas com sucesso!')
      aoSalvo?.()
      aoFechar()
    } catch (error) {
      console.error('Erro ao salvar edições do agendamento:', error)
      avisar('Erro ao salvar as edições.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet
      titulo="Editar Solicitação"
      cheio
      z={70}
      aoFechar={aoFechar}
      rodape={
        <button
          type="button"
          disabled={salvando}
          onClick={handleSalvar}
          className="w-full h-12 rounded-2xl text-white font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: 'var(--as-accent)' }}
        >
          {salvando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>Salvar · {formatarBrl(totalCalculado)}</span>
          )}
        </button>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Nome do Cliente
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[var(--as-soft)] rounded-2xl focus:outline-none focus:border-[var(--as-accent)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            WhatsApp
          </label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(mascaraWhatsapp(e.target.value))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[var(--as-soft)] rounded-2xl focus:outline-none focus:border-[var(--as-accent)]"
          />
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Itens e Opcionais
          </h3>
          {itens.map((item) => {
            const serv = servicos.find((s) => s.id === item.servico_id)
            const nomePrincipal = serv ? serv.nome : `Item #${item.servico_id}`

            return (
              <div
                key={item.idInterno}
                className="bg-white rounded-2xl p-3.5 border border-[var(--as-card-border)] flex flex-col gap-2.5"
              >
                <span className="text-sm font-bold text-gray-800">
                  {item.quantidade > 1 ? `${item.quantidade}x ` : ''}
                  {nomePrincipal}
                </span>

                <div className="flex flex-col gap-2">
                  {opcionaisDisponiveis
                    .filter((opc) => !opc.arquivado || (item.opcionais[opc.id] || 0) > 0)
                    .map((opc) => {
                      const qtd = item.opcionais[opc.id] || 0
                      return (
                        <div
                          key={opc.id}
                          className="flex justify-between items-center rounded-2xl px-3 py-2 border border-gray-100"
                          style={qtd > 0 ? { backgroundColor: 'var(--as-blush)' } : undefined}
                        >
                          <div className="flex flex-col text-left min-w-0 pr-2">
                            <span className="text-xs text-gray-800 font-bold truncate">
                              {opc.nome}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatarBrl(opc.valor)}
                              {opc.tipo === 'substitutivo' ? ' · substitutivo' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => alterarOpcional(item.idInterno, opc.id, 'menos')}
                              className="h-8 w-8 bg-white border border-[var(--as-soft)] hover:bg-gray-50 rounded-full flex justify-center items-center text-gray-700 cursor-pointer active:scale-90"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-xs w-5 text-center tabular-nums">
                              {qtd}
                            </span>
                            <button
                              type="button"
                              onClick={() => alterarOpcional(item.idInterno, opc.id, 'mais')}
                              className="h-8 w-8 rounded-full flex justify-center items-center text-white cursor-pointer active:scale-90"
                              style={{ backgroundColor: 'var(--as-accent)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
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
    </Sheet>
  )
}

async function buscarDashboardTenant(tId = null) {
  const { tenantId: currentTenant, vinculos } = await resolverTenantAtivo(tId)
  const [{ data: tData }, { data: assData }, { data: catData }, { data: servicosData, error: errServ }, { data: solicitacoesData, error: errSol }] =
    await Promise.all([
      supabase.from('tenants').select('*').eq('id', currentTenant).single(),
      supabase.from('assinaturas_tenant').select('*').eq('tenant_id', currentTenant).single(),
      supabase.from('categorias').select('*').eq('tenant_id', currentTenant),
      supabase.from('servicos').select('*').eq('tenant_id', currentTenant),
      supabase
        .from('solicitacoes_agendamento')
        .select(
          `
          *,
          itens_agendamento (
            id,
            servico_id,
            parent_item_id,
            quantidade,
            preco_unitario
          )
        `
        )
        .eq('tenant_id', currentTenant)
        .order('created_at', { ascending: false }),
    ])

  if (errServ) throw errServ
  if (errSol) throw errSol

  return {
    currentTenant,
    vinculos,
    tData,
    assData: assData || null,
    catData: catData || [],
    servicosData: servicosData || [],
    solicitacoesData: solicitacoesData || [],
  }
}

export default function Dashboard() {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [servicos, setServicos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('pendente')
  const [pesquisa, setPesquisa] = useState('')
  const [loading, setLoading] = useState(true)
  const [detalheSolId, setDetalheSolId] = useState(null)
  const [editingSolId, setEditingSolId] = useState(null)
  const [agoraMs, setAgoraMs] = useState(() => Date.now())

  const [swipeCardId, setSwipeCardId] = useState(null)
  const [swipeDx, setSwipeDx] = useState(0)
  const swipeRef = useRef(null)

  const [activeTenantId, setActiveTenantId] = useState(() => {
    return localStorage.getItem('as_active_tenant') || import.meta.env.VITE_TENANT_ID || 'demo'
  })
  const [tenantInfo, setTenantInfo] = useState(null)
  const [assinatura, setAssinatura] = useState(null)
  const [userTenants, setUserTenants] = useState(lerVinculosEmCache)

  const audioRef = useRef(null)
  const navigate = useNavigate()
  const { avisar } = useAdminUI()

  const tocarNotificacao = useCallback(() => {
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

      tocarNota(1318.5, 0, 0.18)
      tocarNota(1661.2, 0.16, 0.32)
    } catch (e) {
      console.error('Aviso sonoro bloqueado pelo navegador:', e)
    }
  }, [])

  const aplicarDados = useCallback((dados) => {
    if (dados.vinculos.length > 0) setUserTenants(dados.vinculos)
    setActiveTenantId(dados.currentTenant)
    if (dados.tData) {
      setTenantInfo(dados.tData)
      document.title = `${dados.tData.nome} • Painel AS Gestão`
    }
    setAssinatura(dados.assData)
    setCategorias(dados.catData)
    setServicos(dados.servicosData)
    setSolicitacoes(dados.solicitacoesData)
    setAgoraMs(Date.now())
  }, [])

  const fetchDados = useCallback(
    async (tId = null) => {
      try {
        const dados = await buscarDashboardTenant(tId)
        aplicarDados(dados)
      } catch (error) {
        console.error('Erro ao buscar dados do Supabase:', error)
      } finally {
        setLoading(false)
      }
    },
    [aplicarDados]
  )

  useEffect(() => {
    let ativo = true
    buscarDashboardTenant()
      .then((dados) => {
        if (ativo) aplicarDados(dados)
      })
      .catch((error) => {
        console.error('Erro ao buscar dados do Supabase:', error)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    const canalRealtime = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'solicitacoes_agendamento' },
        (payload) => {
          const tenantAtual = localStorage.getItem('as_active_tenant')
          if (payload?.new?.tenant_id && tenantAtual && payload.new.tenant_id !== tenantAtual) {
            return
          }
          tocarNotificacao()
          avisar('Nova solicitação recebida!')
          fetchDados()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'solicitacoes_agendamento' },
        () => {
          fetchDados()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'solicitacoes_agendamento' },
        () => {
          fetchDados()
        }
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(canalRealtime)
    }
  }, [aplicarDados, fetchDados, tocarNotificacao, avisar])

  const handleTrocarTenant = (novoTenantId) => {
    setActiveTenantId(novoTenantId)
    setDetalheSolId(null)
    setEditingSolId(null)
    localStorage.setItem('as_active_tenant', novoTenantId)
    fetchDados(novoTenantId)
  }

  const handleUpdateStatus = async (sol, novoStatus, permiteDesfazer = true) => {
    const statusAnterior = sol.status || 'pendente'
    try {
      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === sol.id ? { ...s, status: novoStatus } : s))
      )

      const { error: errRpc } = await supabase.rpc('atualizar_status_agendamento', {
        p_solicitacao_id: sol.id,
        p_status: novoStatus,
      })

      if (errRpc) {
        const { error: errUpdate } = await supabase
          .from('solicitacoes_agendamento')
          .update({ status: novoStatus })
          .eq('id', sol.id)
          .eq('tenant_id', activeTenantId)

        if (errUpdate) throw errUpdate
      }

      const rotuloStatus = ROTULOS_STATUS[novoStatus] || 'Atualizado'
      avisar(
        `Movido para "${rotuloStatus}"`,
        permiteDesfazer
          ? {
              rotulo: 'Desfazer',
              fn: () => handleUpdateStatus({ ...sol, status: novoStatus }, statusAnterior, false),
            }
          : undefined
      )
      fetchDados()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      avisar('Erro ao atualizar status.')
      fetchDados()
    }
  }

  const handleTouchStartCard = (sol, e) => {
    if ((sol.status || 'pendente') !== 'pendente') return
    const t = e.touches?.[0]
    if (!t) return
    swipeRef.current = { id: sol.id, x: t.clientX, y: t.clientY, h: null }
    setSwipeCardId(sol.id)
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
      setSwipeDx(Math.max(-140, Math.min(140, ddx)))
    }
  }

  const handleTouchEndCard = (sol) => {
    const st = swipeRef.current
    if (!st || st.id !== sol.id) return
    if (swipeDx > 90) {
      handleUpdateStatus(sol, 'aprovado')
    } else if (swipeDx < -90) {
      handleUpdateStatus(sol, 'negado')
    }
    setSwipeDx(0)
    setSwipeCardId(null)
    swipeRef.current = null
  }

  const contagemPorStatus = useMemo(() => {
    const cont = { pendente: 0, aprovado: 0, cumprido: 0, negado: 0 }
    solicitacoes.forEach((s) => {
      const st = s.status || 'pendente'
      cont[st] = (cont[st] || 0) + 1
    })
    return cont
  }, [solicitacoes])

  const solicitacoesFiltradas = useMemo(() => {
    const termo = pesquisa.toLowerCase().trim()
    const digitosBusca = termo.replace(/\D/g, '')

    return solicitacoes.filter((sol) => {
      const statusAtual = sol.status || 'pendente'
      if (statusAtual !== abaAtiva) return false
      if (!termo) return true

      const codigo = formatarCodigoPedido(sol, tenantInfo?.segmento).toLowerCase()
      const matchCodigo = codigo.includes(termo)
      const matchNome = (sol.nome_cliente || '').toLowerCase().includes(termo)
      const matchTel =
        digitosBusca.length > 0 &&
        (sol.whatsapp_cliente || '').replace(/\D/g, '').includes(digitosBusca)

      const matchServicos = (sol.itens_agendamento || []).some((item) => {
        const serv = servicos.find((s) => s.id === item.servico_id)
        return serv && serv.nome.toLowerCase().includes(termo)
      })

      return matchCodigo || matchNome || matchTel || matchServicos
    })
  }, [solicitacoes, servicos, abaAtiva, pesquisa, tenantInfo?.segmento])

  const opcionaisDisponiveis = useMemo(() => {
    const idsCatOcultas = new Set(categorias.filter((c) => c.escolha === false).map((c) => c.id))
    return servicos.filter((s) => idsCatOcultas.has(s.categoria_id) || s.tipo !== null)
  }, [servicos, categorias])

  const detalheSol = useMemo(
    () => solicitacoes.find((s) => s.id === detalheSolId) || null,
    [solicitacoes, detalheSolId]
  )
  const editingSol = useMemo(
    () => solicitacoes.find((s) => s.id === editingSolId) || null,
    [solicitacoes, editingSolId]
  )

  if (verificarBloqueioAssinatura(assinatura)) {
    return (
      <BloqueioInadimplencia
        tenantInfo={tenantInfo}
        assinatura={assinatura}
        onAtualizarStatus={fetchDados}
        onDeslogar={() => deslogarAdmin(navigate)}
      />
    )
  }

  return (
    <AdminShell
      titulo="SOLICITAÇÕES"
      tenantInfo={tenantInfo}
      userTenants={userTenants}
      activeTenantId={activeTenantId}
      onTrocarTenant={handleTrocarTenant}
      pendentesCount={contagemPorStatus.pendente}
      onDeslogar={() => deslogarAdmin(navigate)}
    >
      <PuxarAtualizar
        aoAtualizar={() => fetchDados(activeTenantId)}
        className="flex-1 w-full p-3.5 md:p-6 flex flex-col gap-3.5"
      >
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
                    ? 'text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-[var(--as-soft)]'
                }`}
                style={ativo ? { backgroundColor: 'var(--as-accent)' } : undefined}
              >
                <span>{aba.rotulo}</span>
                {qtd > 0 && (
                  <span
                    className={`text-[11px] font-extrabold ${
                      ativo ? 'text-white/90' : 'text-gray-400'
                    }`}
                  >
                    {qtd}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar cliente, telefone, código (#AG) ou item"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--as-soft)] rounded-2xl focus:outline-none focus:border-[var(--as-accent)] text-xs sm:text-sm text-gray-800 shadow-2xs"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 px-1">
            {abaAtiva === 'pendente' ? (
              <span>Dica: toque no card para detalhes · deslize → aprovar ou ← negar</span>
            ) : (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-500 animate-pulse" />
                Realtime Conectado
              </span>
            )}
            <span>
              {solicitacoesFiltradas.length}{' '}
              {solicitacoesFiltradas.length === 1 ? 'solicitação' : 'solicitações'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
            <div
              className="w-8 h-8 border-3 rounded-full animate-spin"
              style={{
                borderColor: 'var(--as-soft)',
                borderTopColor: 'var(--as-accent)',
              }}
            />
            <p className="text-xs text-gray-400 font-semibold font-cinzel">
              Carregando solicitações...
            </p>
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-[var(--as-card-border)] shadow-2xs gap-2 my-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
              style={{ backgroundColor: 'var(--as-blush)' }}
            >
              {abaAtiva === 'pendente' ? (
                <Inbox className="w-6 h-6" style={{ color: 'var(--as-accent)' }} />
              ) : (
                <CheckCheck className="w-6 h-6" style={{ color: 'var(--as-accent)' }} />
              )}
            </div>
            <p className="font-bold text-sm text-gray-700">
              {pesquisa
                ? 'Nada encontrado para esta busca'
                : abaAtiva === 'pendente'
                ? 'Tudo em dia!'
                : `Nenhuma solicitação em "${ABAS_STATUS.find((a) => a.id === abaAtiva)?.rotulo}"`}
            </p>
            <p className="text-xs text-gray-400 max-w-xs">
              {abaAtiva === 'pendente' && !pesquisa
                ? 'Novas solicitações enviadas pelos clientes aparecem aqui em tempo real.'
                : 'Altere a aba acima para visualizar solicitações com outros status.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {solicitacoesFiltradas.map((sol) => (
              <CardSolicitacao
                key={sol.id}
                sol={sol}
                servicos={servicos}
                segmento={tenantInfo?.segmento}
                agoraMs={agoraMs}
                swipeDxAtual={swipeCardId === sol.id ? swipeDx : 0}
                onTouchStart={(e) => handleTouchStartCard(sol, e)}
                onTouchMove={(e) => handleTouchMoveCard(sol, e)}
                onTouchEnd={() => handleTouchEndCard(sol)}
                onAbrirDetalhe={(s) => setDetalheSolId(s.id)}
                onAbrirEdicao={(s) => setEditingSolId(s.id)}
                onAtualizarStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </PuxarAtualizar>

      <DetalheSolicitacaoSheet
        sol={detalheSol}
        servicos={servicos}
        segmento={tenantInfo?.segmento}
        aoFechar={() => setDetalheSolId(null)}
        aoAbrirEdicao={(s) => setEditingSolId(s.id)}
        aoAtualizarStatus={handleUpdateStatus}
      />

      {editingSol && (
        <EditarSolicitacaoSheet
          key={editingSol.id}
          sol={editingSol}
          servicos={servicos}
          opcionaisDisponiveis={opcionaisDisponiveis}
          aoFechar={() => setEditingSolId(null)}
          aoSalvo={() => fetchDados(activeTenantId)}
        />
      )}
    </AdminShell>
  )
}
