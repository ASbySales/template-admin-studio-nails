import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

export default function RedefinirSenha() {
    const [novaSenha, setNovaSenha] = useState('')
    const [confirmarSenha, setConfirmarSenha] = useState('')
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState('')
    const [sucesso, setSucesso] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Verifica se há sessão ativa vinda do link do e-mail
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // Se não houver sessão ou hash na URL, aguarda evento PASSWORD_RECOVERY
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        setErro('')
                    }
                })
                return () => subscription.unsubscribe()
            }
        })
    }, [])

    const handleAtualizarSenha = async (e) => {
        e.preventDefault()
        setErro('')

        if (novaSenha.length < 6) {
            setErro('A nova senha deve ter no mínimo 6 caracteres.')
            return
        }

        if (novaSenha !== confirmarSenha) {
            setErro('As senhas digitadas não coincidem.')
            return
        }

        setCarregando(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: novaSenha
            })

            if (error) throw error

            setSucesso(true)
            await supabase.auth.signOut()
            localStorage.removeItem('as_active_tenant')
            localStorage.removeItem('as_auth_user')
            localStorage.removeItem('admin_demo_auth')
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err) {
            console.error('Erro ao redefinir senha:', err)
            setErro(err.message || 'Falha ao atualizar senha. O link pode ter expirado.')
        } finally {
            setCarregando(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#050814] via-[#0B1233] to-[#1E293B] p-4 text-gray-800">
            <div className="w-full max-w-[420px] rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center gap-6 border border-white/30">
                
                {/* Header */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="relative w-16 h-16 rounded-2xl border-2 border-[#C5A059]/50 bg-[#0F172A] shadow-xl overflow-hidden flex justify-center items-center">
                        <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="Logo AS Gestão" />
                    </div>
                    <div>
                        <h1 className="text-xl font-cinzel font-bold text-gray-900 tracking-wider">REDEFINIR SENHA</h1>
                        <p className="text-[10px] font-sans font-bold text-[#C5A059] uppercase tracking-widest mt-0.5">
                            Crie sua nova senha de acesso
                        </p>
                    </div>
                </div>

                {sucesso ? (
                    <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 animate-bounce" />
                        <span className="font-bold text-sm">Senha redefinida com sucesso!</span>
                        <span className="text-gray-600">Redirecionando para o login em instantes...</span>
                    </div>
                ) : (
                    <form onSubmit={handleAtualizarSenha} className="w-full flex flex-col gap-4 text-left">
                        {erro && (
                            <div className="w-full bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{erro}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                                Nova Senha
                            </label>
                            <div className="relative">
                                <input 
                                    type={mostrarSenha ? "text" : "password"} 
                                    value={novaSenha}
                                    onChange={(e) => setNovaSenha(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMostrarSenha(!mostrarSenha)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                                Confirmar Nova Senha
                            </label>
                            <input 
                                type={mostrarSenha ? "text" : "password"} 
                                value={confirmarSenha}
                                onChange={(e) => setConfirmarSenha(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={carregando}
                            className="w-full py-3.5 bg-gradient-to-r from-[#C5A059] to-[#DFB76C] hover:from-[#B88E3E] hover:to-[#C5A059] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex justify-center items-center gap-2 mt-2"
                        >
                            <span>{carregando ? 'Atualizando...' : 'Gravar Nova Senha'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors text-center cursor-pointer -mt-1"
                        >
                            Voltar ao Painel
                        </button>
                    </form>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Criptografia ponta a ponta • AS Gestão</span>
                </div>
            </div>
        </div>
    )
}
