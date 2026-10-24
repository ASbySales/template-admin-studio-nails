import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, X, CheckCircle2 } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [erroLogin, setErroLogin] = useState('')
    const [carregando, setCarregando] = useState(false)
    const [modalEsqueciSenha, setModalEsqueciSenha] = useState(false)
    const [emailRecuperacao, setEmailRecuperacao] = useState('')
    const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false)
    const [msgRecuperacao, setMsgRecuperacao] = useState('')
    const [erroRecuperacao, setErroRecuperacao] = useState('')
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        if (e) e.preventDefault()
        setErroLogin('')

        if (!email.trim() || !password) {
            setErroLogin('Por favor, informe seu e-mail e senha de acesso.')
            return
        }

        setCarregando(true)

        try {
            // 1. Autenticação nativa oficial no Supabase Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            })

            if (error) {
                throw error
            }

            if (data?.user) {
                // Autenticado com sucesso!
                // O tenant_id vem amarrado de forma segura no app_metadata do usuário
                const tenantId = data.user.app_metadata?.tenant_id || data.user.user_metadata?.tenant_id || 'demo'
                const tenantNome = data.user.app_metadata?.nome || data.user.user_metadata?.nome || tenantId

                localStorage.setItem('as_active_tenant', tenantId)
                localStorage.setItem('as_auth_user', JSON.stringify({
                    id: data.user.id,
                    email: data.user.email,
                    tenant_id: tenantId,
                    tenant_nome: tenantNome
                }))
                localStorage.setItem('admin_demo_auth', 'true')

                navigate('/')
                return
            }
        } catch (err) {
            console.error('Erro na autenticação nativa Supabase:', err)

            // Mensagens amigáveis em português
            if (err.message?.includes('Invalid login credentials')) {
                setErroLogin('E-mail ou senha incorretos.')
            } else if (err.message?.includes('Email not confirmed')) {
                setErroLogin('E-mail cadastrado, mas ainda não confirmado no Supabase.')
            } else {
                setErroLogin(err.message || 'Erro ao realizar login no Supabase.')
            }
        } finally {
            setCarregando(false)
        }
    }

    const handleEnviarRecuperacao = async (e) => {
        if (e) e.preventDefault()
        setErroRecuperacao('')
        setMsgRecuperacao('')

        if (!emailRecuperacao.trim()) {
            setErroRecuperacao('Por favor, informe seu e-mail cadastrado.')
            return
        }

        setEnviandoRecuperacao(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao.trim(), {
                redirectTo: 'https://adm.asales.online/redefinir-senha'
            })

            if (error) throw error

            setMsgRecuperacao('Link de recuperação enviado com sucesso! Verifique sua caixa de entrada e pasta de spam.')
        } catch (err) {
            console.error('Erro ao solicitar redefinição:', err)
            setErroRecuperacao(err.message || 'Falha ao enviar e-mail de recuperação.')
        } finally {
            setEnviandoRecuperacao(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#050814] via-[#0B1233] to-[#1E293B] p-4 text-gray-800">
            <div className="w-full max-w-[420px] rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center gap-6 border border-white/30">
                
                {/* Cabeçalho da Marca AS Gestão */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="relative w-16 h-16 rounded-2xl border-2 border-[#C5A059]/50 bg-[#0F172A] shadow-xl overflow-hidden flex justify-center items-center">
                        <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="Logo AS Gestão" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    </div>
                    
                    <div>
                        <h1 className="text-2xl font-cinzel font-bold text-gray-900 tracking-wider flex items-center justify-center gap-1.5">
                            <span>AS GESTÃO</span>
                        </h1>
                        <p className="text-[10px] font-sans font-bold text-[#C5A059] uppercase tracking-widest mt-0.5">
                            Painel de Controle Central
                        </p>
                    </div>
                </div>

                {/* Formulário de Acesso */}
                <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
                    {erroLogin && (
                        <div className="w-full bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{erroLogin}</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            E-mail de Acesso
                        </label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seuemail@empresa.com"
                            autoComplete="email"
                            required
                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50 transition-all"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                                Senha
                            </span>
                            <span className="text-[10px] text-gray-400 font-normal">Protegido por SSL</span>
                        </label>
                        <div className="relative">
                            <input 
                                type={mostrarSenha ? "text" : "password"} 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50 transition-all pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarSenha(!mostrarSenha)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end -mt-2">
                        <button 
                            type="button"
                            onClick={() => {
                                setEmailRecuperacao(email)
                                setModalEsqueciSenha(true)
                                setErroRecuperacao('')
                                setMsgRecuperacao('')
                            }}
                            className="text-xs text-[#C5A059] hover:underline font-semibold cursor-pointer"
                        >
                            Esqueceu a senha?
                        </button>
                    </div>

                    <button 
                        type="submit"
                        disabled={carregando}
                        className="w-full py-3.5 bg-gradient-to-r from-[#C5A059] to-[#DFB76C] hover:from-[#B88E3E] hover:to-[#C5A059] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex justify-center items-center gap-2 mt-2"
                    >
                        <span>{carregando ? 'Autenticando...' : 'Acessar Painel'}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                {/* Rodapé Seguro */}
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Autenticação Nativa AS Cloud • Criptografia de ponta a ponta</span>
                </div>
            </div>

            {/* Modal de Esqueci Minha Senha */}
            {modalEsqueciSenha && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-[400px] bg-white rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 relative animate-scaleIn text-gray-800">
                        <button 
                            onClick={() => setModalEsqueciSenha(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <h2 className="text-base font-cinzel font-bold text-gray-900">Recuperar Senha</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Digite o e-mail da sua conta para receber um link de redefinição seguro.
                            </p>
                        </div>

                        {erroRecuperacao && (
                            <div className="w-full bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{erroRecuperacao}</span>
                            </div>
                        )}

                        {msgRecuperacao ? (
                            <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl p-4 flex flex-col items-center gap-2 text-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                <span className="font-semibold">{msgRecuperacao}</span>
                            </div>
                        ) : (
                            <form onSubmit={handleEnviarRecuperacao} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 text-left">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                        Seu E-mail
                                    </label>
                                    <input 
                                        type="email"
                                        value={emailRecuperacao}
                                        onChange={(e) => setEmailRecuperacao(e.target.value)}
                                        placeholder="seuemail@empresa.com"
                                        required
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={enviandoRecuperacao}
                                    className="w-full py-3 bg-gradient-to-r from-[#C5A059] to-[#DFB76C] hover:from-[#B88E3E] hover:to-[#C5A059] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex justify-center items-center gap-2"
                                >
                                    <span>{enviandoRecuperacao ? 'Enviando link...' : 'Enviar Link de Redefinição'}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
