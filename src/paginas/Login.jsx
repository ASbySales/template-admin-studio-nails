import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import JKStudioNailsOnlyLogo from '../assets/JKStudioNailsOnlyLogo.png'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setErro('')
        setCarregando(true)

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            })

            if (error) throw error

            // Login bem-sucedido! Redireciona para o dashboard
            navigate('/')
        } catch (error) {
            console.error('Erro de login:', error)
            setErro('E-mail ou senha inválidos. Verifique suas credenciais!')
        } finally {
            setCarregando(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#E6C2C1]/40 via-[#D9A09E]/20 to-[#E6C2C1]/30 p-4">
            <div className="w-full max-w-[400px] rounded-3xl bg-white/80 backdrop-blur-md ring-1 ring-[#D9A09E]/50 shadow-2xl p-6 flex flex-col items-center gap-6">
                
                {/* Logo da Joyce Kayane */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-[100px] h-[100px] rounded-full border-b-4 border-[#D9A09E] bg-white shadow-md overflow-hidden flex justify-center items-center">
                        <img className="w-[90%] h-[90%] object-contain" src={JKStudioNailsOnlyLogo} alt="Logo Joyce Kayane" />
                    </div>
                    <h1 className="text-2xl font-cinzel font-bold text-gray-800 tracking-wide mt-2 text-center">
                        JOYCE KAYANE
                        <span className="text-xs block font-sans font-normal text-[#C08A89]">PAINEL ADMINISTRATIVO</span>
                    </h1>
                </div>

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700">E-mail de Acesso</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="exemplo@gmail.com"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white/70"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700">Senha</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C08A89] bg-white/70"
                            required
                        />
                    </div>

                    {erro && (
                        <p className="text-xs font-bold text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100 mt-1">
                            ⚠️ {erro}
                        </p>
                    )}

                    <button 
                        type="submit"
                        disabled={carregando}
                        className="w-full py-3 bg-[#C08A89] text-white font-bold text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2 mt-2"
                    >
                        {carregando ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                Autenticando...
                            </>
                        ) : 'Entrar no Sistema'}
                    </button>
                </form>
            </div>
        </div>
    )
}
