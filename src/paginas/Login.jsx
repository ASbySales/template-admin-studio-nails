import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'

export default function Login() {
    const [email, setEmail] = useState('demo@albertsales.com')
    const [password, setPassword] = useState('123456')
    const navigate = useNavigate()

    const handleLogin = (e) => {
        if (e) e.preventDefault()
        
        // Login demonstrativo liberado: salva o acesso no cache local e entra direto
        localStorage.setItem('admin_demo_auth', 'true')
        navigate('/')
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#0B1233] via-[#0F172A] to-[#1E293B] p-4">
            <div className="w-full max-w-[400px] rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl p-6 flex flex-col items-center gap-6 border border-white/20">
                
                {/* Logo da Albert Sales */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-[100px] h-[100px] rounded-full border-4 border-[#C5A059]/40 bg-[#0F172A] shadow-lg overflow-hidden flex justify-center items-center">
                        <img className="w-full h-full object-cover" src={AlbertSalesLogo} alt="Logo Albert Sales" />
                    </div>
                    <div className="text-center mt-1">
                        <h1 className="text-2xl font-cinzel font-bold text-gray-900 tracking-wider">
                            ALBERT SALES
                        </h1>
                        <span className="text-[10px] block font-sans font-bold text-[#C5A059] uppercase tracking-widest mt-0.5">
                            PAINEL ADMINISTRATIVO (MODELO)
                        </span>
                    </div>
                </div>

                <div className="w-full bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-700 font-semibold">
                        ✨ Acesso Demonstrativo Liberado
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        Clique no botão abaixo para testar o painel em tempo real.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700">E-mail (Demonstração )</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="exemplo@gmail.com"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700">Senha</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] bg-white"
                        />
                    </div>

                    <button 
                        type="submit"
                        className="w-full py-3 bg-[#C5A059] hover:bg-[#B88E3E] text-white font-bold text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2 mt-1"
                    >
                        <span>Entrar no Painel Demo</span>
                        <span>🚀</span>
                    </button>
                </form>
            </div>
        </div>
    )
}
