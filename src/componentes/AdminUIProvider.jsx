import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AdminUIContext } from '../lib/adminUi'

/**
 * Provedor global de feedback estilo App JK:
 * - Toast no topo com ação opcional ("Desfazer")
 * - Confirmação em Bottom Sheet estilizada (substitui confirm() do navegador)
 */
export function AdminUIProvider({ children }) {
  const [toast, setToast] = useState(null)
  const [confirmacao, setConfirmacao] = useState(null)
  const [tema, setTema] = useState('gold')
  const timerRef = useRef(null)

  const avisar = useCallback((msg, acao) => {
    if (!msg) return
    clearTimeout(timerRef.current)
    setToast({ msg, acao, id: Date.now() })
    timerRef.current = setTimeout(() => setToast(null), acao ? 5000 : 3500)
  }, [])

  const confirmar = useCallback((opcoes) => {
    return new Promise((resolve) => {
      setConfirmacao({ ...opcoes, resolve })
    })
  }, [])

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!confirmacao) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        confirmacao.resolve(false)
        setConfirmacao(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmacao])

  return (
    <AdminUIContext.Provider value={{ avisar, confirmar, tema, setTema }}>
      <div data-tema={tema} className="min-h-screen">
        {children}

        {toast && (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="fixed left-3 right-3 z-[90] flex justify-center pointer-events-none anim-pop"
            style={{ top: 'calc(var(--sat) + 12px)' }}
          >
            <div className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl bg-[#1F2937]/95 text-white px-4 py-3 shadow-2xl backdrop-blur border border-white/10">
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--as-accent)' }} />
              <span className="text-xs sm:text-sm font-medium flex-1 text-left">{toast.msg}</span>
              {toast.acao?.fn && (
                <button
                  type="button"
                  onClick={() => {
                    toast.acao.fn()
                    setToast(null)
                  }}
                  className="text-xs sm:text-sm font-bold px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer shrink-0"
                  style={{ color: 'var(--as-soft)' }}
                >
                  {toast.acao.rotulo || 'Desfazer'}
                </button>
              )}
            </div>
          </div>
        )}

        {confirmacao && (
          <div
            className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center sm:p-4 anim-fade"
            onClick={() => {
              confirmacao.resolve(false)
              setConfirmacao(null)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-3xl p-5 pb-safe shadow-2xl border border-[var(--as-soft)] anim-sheet text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-gray-200 sm:hidden" />
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-gray-900">
                {confirmacao.titulo}
              </h3>
              {confirmacao.texto && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-relaxed">
                  {confirmacao.texto}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    confirmacao.resolve(false)
                    setConfirmacao(null)
                  }}
                  className="min-h-11 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
                >
                  {confirmacao.cancelar || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmacao.resolve(true)
                    setConfirmacao(null)
                  }}
                  className={`min-h-11 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer ${
                    confirmacao.perigo ? 'bg-red-500 hover:bg-red-600' : ''
                  }`}
                  style={confirmacao.perigo ? undefined : { backgroundColor: 'var(--as-accent)' }}
                >
                  {confirmacao.ok || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminUIContext.Provider>
  )
}
