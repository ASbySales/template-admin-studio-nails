import { useState } from 'react'
import { LogOut, Copy, Check, Send, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'

const WHATSAPP_AS = '5583996327988'

export default function BloqueioInadimplencia({ tenantInfo, assinatura, onAtualizarStatus, onDeslogar }) {
    const [copiado, setCopiado] = useState(false)
    const [verificando, setVerificando] = useState(false)

    const valorMensalidade = parseFloat(assinatura?.valor_mensalidade || 0).toFixed(2).replace('.', ',')
    const qrcodeImg = assinatura?.qrcode_pix_url || '/qrcode-pix.jpg'

    const handleCopiarPix = () => {
        if (!assinatura?.chave_pix) return
        navigator.clipboard.writeText(assinatura.chave_pix)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
    }

    const handleVerificar = async () => {
        setVerificando(true)
        if (onAtualizarStatus) await onAtualizarStatus()
        setTimeout(() => setVerificando(false), 1000)
    }

    const linkWhatsapp = `https://wa.me/${WHATSAPP_AS}?text=${encodeURIComponent(
        `Olá! Estou enviando o comprovante de pagamento da mensalidade de *${tenantInfo?.nome || 'minha loja'}* (Valor: R$ ${valorMensalidade}) para desbloqueio do painel da AS Gestão.`
    )}`

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between p-4 selection:bg-[#C5A059] selection:text-white">
            
            {/* Header Mínimo */}
            <header className="w-full max-w-xl flex justify-between items-center py-4">
                <div className="flex items-center gap-2">
                    <img src={AlbertSalesLogo} alt="AS Gestão" className="h-8 w-auto object-contain" />
                    <span className="font-cinzel font-bold text-sm text-gray-900 tracking-wider">AS GESTÃO</span>
                </div>
                <button 
                    onClick={onDeslogar}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                </button>
            </header>

            {/* Card Central de Cobrança */}
            <main className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-gray-100 flex flex-col items-center text-center my-auto">
                <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600 mb-4 shadow-2xs">
                    <ShieldAlert className="w-7 h-7" />
                </div>

                <h1 className="text-xl font-cinzel font-bold text-gray-900 tracking-wide">
                    Acesso ao Painel Temporariamente Suspenso
                </h1>
                
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                    Identificamos uma pendência na mensalidade do estabelecimento <strong className="text-gray-800">{tenantInfo?.nome || 'sua loja'}</strong>.
                </p>

                {/* Banner de Tranquilidade para a Loja */}
                <div className="w-full bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 mt-4 text-left flex items-start gap-3">
                    <span className="text-emerald-700 text-base">🌸</span>
                    <div className="text-[11px] text-emerald-900 leading-relaxed">
                        <strong className="block text-emerald-950 font-bold">Sua Vitrine Pública continua no ar!</strong>
                        Seus clientes continuam acessando o catálogo na bio do Instagram e enviando pedidos no WhatsApp normalmente. Apenas este painel administrativo requer a regularização.
                    </div>
                </div>

                {/* Seção de Pagamento Pix */}
                <div className="w-full mt-6 bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Valor Pendente</span>
                        <span className="text-3xl font-cinzel font-bold text-gray-900 mt-0.5">
                            R$ {valorMensalidade}
                        </span>
                    </div>

                    {/* QR Code */}
                    <div className="w-44 h-44 bg-white p-2.5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center">
                        <img 
                            src={qrcodeImg} 
                            alt="QR Code Pix" 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.target.src = '/qrcode-pix.jpg'
                            }}
                        />
                    </div>

                    {/* Chave Pix Copia e Cola */}
                    <div className="w-full flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-600 text-left">
                            Chave Pix (Copia e Cola):
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={assinatura?.chave_pix || ''}
                                className="w-full bg-white px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl text-gray-700 select-all focus:outline-none"
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
                </div>

                {/* Botões de Ação */}
                <div className="w-full flex flex-col gap-2.5 mt-6">
                    <a 
                        href={linkWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        <span>Enviar Comprovante no WhatsApp da AS</span>
                    </a>

                    <button 
                        onClick={handleVerificar}
                        disabled={verificando}
                        className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${verificando ? 'animate-spin' : ''}`} />
                        <span>{verificando ? 'Verificando...' : 'Já fiz o pagamento (Atualizar status)'}</span>
                    </button>
                </div>
            </main>

            {/* Footer Mínimo */}
            <footer className="w-full text-center py-4 text-[11px] text-gray-400">
                AS Gestão • Ecossistema Digital de Vendas e Links na Bio
            </footer>
        </div>
    )
}
