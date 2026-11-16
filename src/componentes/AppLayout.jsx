import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  CreditCard,
  GripVertical,
  Lock,
  LogOut,
  Package,
  RefreshCw,
  Sparkles,
  ArrowUp,
  ArrowDown,
  WifiOff,
  X,
} from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { getSegmentoMeta } from '../lib/segmento'
import { useAdminUI } from '../lib/adminUi'

const STATUS_MAP = {
  pendente: {
    rotulo: 'PENDENTE',
    cls: 'bg-amber-50/90 text-amber-800 border-amber-200',
  },
  aprovado: {
    rotulo: 'APROVADO',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  cumprido: {
    rotulo: 'CUMPRIDO',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  negado: {
    rotulo: 'NEGADO',
    cls: 'bg-red-50 text-red-600 border-red-200',
  },
}

export function SeloStatus({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pendente
  return (
    <span
      className={`text-[10px] font-bold rounded-full px-3 py-1 uppercase tracking-wider border shrink-0 ${s.cls}`}
    >
      {s.rotulo}
    </span>
  )
}

/**
 * Bottom sheet arrastável no mobile (e modal limpo no desktop) inspirado no App JK.
 */
export function Sheet({ titulo, subtitulo, aoFechar, children, rodape, cheio = false, z = 60 }) {
  const [arraste, setArraste] = useState(0)
  const inicioY = useRef(null)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') aoFechar?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [aoFechar])

  const onTouchStart = (e) => {
    inicioY.current = e.touches?.[0]?.clientY ?? null
  }
  const onTouchMove = (e) => {
    if (inicioY.current === null) return
    const dy = (e.touches?.[0]?.clientY ?? 0) - inicioY.current
    setArraste(Math.max(0, dy))
  }
  const onTouchEnd = () => {
    if (arraste > 110) {
      aoFechar?.()
    }
    setArraste(0)
    inicioY.current = null
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[1px] sm:p-4 anim-fade"
      style={{ zIndex: z }}
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-lg bg-[var(--as-bg)] rounded-t-[28px] sm:rounded-3xl flex flex-col anim-sheet shadow-2xl border border-[var(--as-soft)] overflow-hidden ${
          cheio ? 'h-[92vh] sm:h-auto sm:max-h-[88vh]' : 'max-h-[90vh] sm:max-h-[88vh]'
        }`}
        style={{
          transform: `translateY(${arraste}px)`,
          transition: arraste ? 'none' : 'transform 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pt-2.5 pb-3 px-5 bg-white/95 border-b border-[var(--as-card-border)] touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-[var(--as-soft)] sm:hidden" />
          <div className="flex items-start justify-between gap-3 mt-2 sm:mt-0.5 text-left">
            <div className="min-w-0">
              <h2 className="font-cinzel text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
                {titulo}
              </h2>
              {subtitulo && (
                <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">{subtitulo}</p>
              )}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="h-9 w-9 shrink-0 rounded-full bg-[var(--as-blush)] text-[var(--as-accent-deep)] hover:opacity-80 flex items-center justify-center active:scale-90 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 text-left">{children}</div>

        {rodape && (
          <div className="px-5 pt-3 pb-safe bg-white/95 border-t border-[var(--as-card-border)]">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Container com gesto de "puxar para atualizar" (pull-to-refresh) no mobile.
 */
export function PuxarAtualizar({ aoAtualizar, children, className = '' }) {
  const ref = useRef(null)
  const inicio = useRef(null)
  const [puxado, setPuxado] = useState(0)
  const [atualizando, setAtualizando] = useState(false)

  const onTouchStart = (e) => {
    const el = ref.current
    if (!el || window.scrollY <= 0) {
      inicio.current = e.touches?.[0]?.clientY ?? null
    }
  }

  const onTouchMove = (e) => {
    if (inicio.current === null || atualizando) return
    const dy = (e.touches?.[0]?.clientY ?? 0) - inicio.current
    if (dy > 0 && window.scrollY <= 0) {
      setPuxado(Math.min(84, dy * 0.45))
    }
  }

  const onTouchEnd = async () => {
    if (puxado > 56 && aoAtualizar) {
      setAtualizando(true)
      setPuxado(48)
      try {
        await aoAtualizar()
      } finally {
        setAtualizando(false)
      }
    }
    setPuxado(0)
    inicio.current = null
  }

  return (
    <div
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={className}
    >
      {(puxado > 0 || atualizando) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: puxado }}
        >
          <RefreshCw
            className={`w-5 h-5 ${atualizando ? 'animate-spin' : ''}`}
            style={{
              color: 'var(--as-accent)',
              transform: atualizando ? undefined : `rotate(${puxado * 4}deg)`,
            }}
          />
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Lista reordenável com toque (drag handle) e setas rápidas (↑ / ↓) compatível com mobile e desktop.
 */
export function ListaOrdenavel({ itens = [], renderItem, aoReordenar, gridClassName = 'flex flex-col gap-2.5' }) {
  const [arraste, setArraste] = useState(null)
  const containerRef = useRef(null)

  const listaExibida = arraste?.lista ?? itens
  const arrastandoIdx = arraste?.idx ?? null

  const iniciarArraste = (idx) => {
    setArraste({ idx, lista: [...itens], mudou: false })
  }

  const onTouchMove = (e) => {
    if (arraste === null || !containerRef.current) return
    const touch = e.touches?.[0]
    if (!touch) return
    const filhos = Array.from(containerRef.current.children)
    for (let i = 0; i < filhos.length; i++) {
      const rect = filhos[i].getBoundingClientRect()
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        const meio = rect.top + rect.height / 2
        if ((i < arraste.idx && touch.clientY < meio) || (i > arraste.idx && touch.clientY > meio)) {
          const destino = i
          setArraste((prev) => {
            if (!prev) return null
            const de = prev.idx
            if (destino < 0 || destino >= prev.lista.length || de === destino) return prev
            const nova = [...prev.lista]
            const [movido] = nova.splice(de, 1)
            nova.splice(destino, 0, movido)
            return { idx: destino, lista: nova, mudou: true }
          })
        }
        break
      }
    }
  }

  const finalizarArraste = () => {
    if (!arraste) return
    const { lista, mudou } = arraste
    setArraste(null)
    if (mudou) aoReordenar?.(lista)
  }

  const moverBotao = (idx, direcao) => {
    const base = listaExibida
    const destino = idx + direcao
    if (destino < 0 || destino >= base.length) return
    const nova = [...base]
    const [movido] = nova.splice(idx, 1)
    nova.splice(destino, 0, movido)
    aoReordenar?.(nova)
  }

  return (
    <div
      ref={containerRef}
      className={gridClassName}
      onTouchMove={onTouchMove}
      onTouchEnd={finalizarArraste}
      onTouchCancel={finalizarArraste}
    >
      {listaExibida.map((item, idx) => {
        const ativo = arrastandoIdx === idx
        return (
          <div
            key={item.id}
            className={`transition-transform ${ativo ? 'scale-[1.01] z-10 ring-2 ring-[var(--as-accent)] rounded-2xl' : ''}`}
          >
            {renderItem(item, idx, {
              ativo,
              isPrimeiro: idx === 0,
              isUltimo: idx === listaExibida.length - 1,
              subir: () => moverBotao(idx, -1),
              descer: () => moverBotao(idx, 1),
              dragHandleProps: {
                onTouchStart: () => iniciarArraste(idx),
              },
              ControlesOrdem: (
                <div className="flex items-center gap-1 shrink-0">
                  <div
                    onTouchStart={() => iniciarArraste(idx)}
                    className="h-8 w-6 flex items-center justify-center text-[var(--as-accent-deep)] touch-none cursor-grab active:cursor-grabbing md:hidden"
                    title="Segure e arraste para reordenar"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moverBotao(idx, -1)}
                      className="h-4.5 w-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                      title="Subir posição"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === listaExibida.length - 1}
                      onClick={() => moverBotao(idx, 1)}
                      className="h-4.5 w-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                      title="Descer posição"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ),
            })}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Shell compartilhado da AS Gestão:
 * - Adapta tema automaticamente por segmento (rose para Nail Design, gold neutro para Flora Haste / Vendas)
 * - Barra inferior fixa no mobile (estilo App JK) e navegação no topo no desktop
 * - Seletor multi-tenant unificado + banner offline + confirmação de logout
 */
export function AdminShell({
  titulo,
  tenantInfo,
  userTenants = [],
  activeTenantId,
  onTrocarTenant,
  pendentesCount = 0,
  onDeslogar,
  headerRight = null,
  children,
  maxWidthClass = 'max-w-[1100px]',
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { setTema, confirmar } = useAdminUI()
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )

  const meta = getSegmentoMeta(tenantInfo?.segmento)

  useEffect(() => {
    setTema(meta.tema)
  }, [meta.tema, setTema])

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const rotaAtual = location.pathname === '/assinatura' ? '/pagamentos' : location.pathname

  const abas = [
    {
      path: '/',
      rotulo: 'Solicitações',
      Icone: ClipboardList,
      badge: pendentesCount,
    },
    {
      path: '/servicos',
      rotulo: meta.isNail ? 'Serviços' : 'Catálogo',
      Icone: meta.isNail ? Sparkles : Package,
    },
    {
      path: '/pagamentos',
      rotulo: 'Assinatura',
      Icone: CreditCard,
    },
  ]

  const pedirSaida = async () => {
    const ok = await confirmar({
      titulo: 'Sair do painel?',
      texto: 'Você precisará entrar novamente com seu e-mail e senha.',
      ok: 'Sair',
      perigo: true,
    })
    if (ok) onDeslogar?.()
  }

  return (
    <div className="min-h-screen w-full bg-[var(--as-bg)] flex flex-col font-sans pb-20 md:pb-0">
      {offline && (
        <div className="bg-amber-600 text-white text-[11px] font-bold py-1.5 px-4 flex items-center justify-center gap-1.5 z-30">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Sem conexão — mostrando últimos dados</span>
        </div>
      )}

      <header className="w-full bg-white/95 backdrop-blur border-b border-[var(--as-card-border)] px-4 py-3 flex justify-between items-center shadow-2xs sticky top-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-full bg-[#0F172A] shadow-xs overflow-hidden flex justify-center items-center shrink-0 border"
            style={{ borderColor: 'var(--as-soft)' }}
          >
            <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="AS Gestão" />
          </div>
          <div className="text-left min-w-0">
            <span className="text-[9px] block font-sans font-bold tracking-[0.16em] text-gray-400 uppercase truncate">
              {tenantInfo?.nome || 'AS GESTÃO'}
            </span>
            <h1 className="text-base sm:text-lg font-cinzel font-bold text-gray-900 leading-none tracking-wide truncate">
              {titulo}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {userTenants.length > 1 && onTrocarTenant ? (
            <div
              className="rounded-xl px-2.5 py-1 flex items-center gap-1.5 border"
              style={{
                backgroundColor: 'var(--as-blush)',
                borderColor: 'var(--as-soft)',
              }}
            >
              <span className="text-xs">{meta.emoji}</span>
              <select
                value={activeTenantId}
                onChange={(e) => onTrocarTenant(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer max-w-[115px] sm:max-w-[200px]"
                style={{ color: 'var(--as-accent-deep)' }}
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
            <div
              className="hidden md:flex px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 border"
              style={{
                backgroundColor: 'var(--as-blush)',
                borderColor: 'var(--as-soft)',
                color: 'var(--as-accent-deep)',
              }}
            >
              <span>{meta.emoji}</span>
              <span className="max-w-[150px] truncate">{tenantInfo?.nome || 'Estabelecimento'}</span>
            </div>
          )}

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-1.5">
            {abas.map((aba) => {
              const ativo = rotaAtual === aba.path
              const Icone = aba.Icone
              return (
                <button
                  key={aba.path}
                  type="button"
                  onClick={() => navigate(aba.path)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    ativo ? 'text-white shadow-xs' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={ativo ? { backgroundColor: 'var(--as-accent)' } : undefined}
                >
                  <Icone
                    className="w-4 h-4"
                    style={ativo ? undefined : { color: 'var(--as-accent-deep)' }}
                  />
                  <span>{aba.rotulo}</span>
                  {aba.badge > 0 && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        ativo ? 'bg-white/25 text-white' : 'bg-white text-gray-700'
                      }`}
                    >
                      {aba.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {headerRight}

          <button
            type="button"
            onClick={() => navigate('/redefinir-senha')}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            title="Alterar Senha da Conta"
          >
            <Lock className="w-4 h-4" style={{ color: 'var(--as-accent-deep)' }} />
            <span className="hidden lg:inline">Senha</span>
          </button>

          <button
            type="button"
            onClick={pedirSaida}
            className="flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all cursor-pointer"
            title="Sair do Painel"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className={`flex-1 ${maxWidthClass} w-full mx-auto flex flex-col`}>{children}</div>

      {/* Barra de Navegação Inferior estilo App JK (Mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-[var(--as-card-border)] pb-safe shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-3 pt-1.5">
          {abas.map((aba) => {
            const ativo = rotaAtual === aba.path
            const Icone = aba.Icone
            return (
              <button
                key={aba.path}
                type="button"
                onClick={() => navigate(aba.path)}
                className="flex flex-col items-center gap-0.5 py-1 relative cursor-pointer"
              >
                <span
                  className="relative h-8 w-14 rounded-full flex items-center justify-center transition-all"
                  style={ativo ? { backgroundColor: 'var(--as-blush)' } : undefined}
                >
                  <Icone
                    className="w-[21px] h-[21px] transition"
                    style={{ color: ativo ? 'var(--as-accent-deep)' : '#9CA3AF' }}
                    strokeWidth={ativo ? 2.4 : 1.9}
                  />
                  {aba.badge > 0 && (
                    <span
                      className="absolute -top-0.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
                      style={{ backgroundColor: 'var(--as-accent)' }}
                    >
                      {aba.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] ${ativo ? 'font-bold' : 'font-medium text-gray-400'}`}
                  style={ativo ? { color: 'var(--as-accent-deep)' } : undefined}
                >
                  {aba.rotulo}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
