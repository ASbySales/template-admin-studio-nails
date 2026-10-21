import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AlbertSalesLogo from '../assets/AlbertSalesLogo.png'
import { ShieldCheck, Lock, Mail, Store, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('contato@asales.online')
    const [password, setPassword] = useState('••••••••')
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [selectedTenantId, setSelectedTenantId] = useState('demo')
    const [tenants, setTenants] = useState([
        { id: 'demo', nome: 'Studio Nails Demo', segmento: 'nail_design', cor_primaria: '#C5A059' },
        { id: 'flora_haste', nome: 'Flora Haste Floricultura', segmento: 'floricultura', cor_primaria: '#2E7D32' }
    ])
    const [carregando, setCarregando] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Carrega os tenants cadastrados no Supabase da AS Cloud
        const carregarTenants = async () => {
            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('id, nome, segmento, cor_primaria')
                
                if (data && data.length > 0) {
                    setTenants(data)
                    // Se já tiver um tenant salvo anteriormente, mantém selecionado
                    const salvo = localStorage.getItem('as_active_tenant')
                    if (salvo && data.some(t => t.id === salvo)) {
                        setSelectedTenantId(salvo)
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar tenants no login:', err)
            }
        }

        carregarTenants()
    }, [])

    const handleLogin = (e) => {
        if (e) e.preventDefault()
        setCarregando(true)

        const tenantSelecionado = tenants.find(t => t.id === selectedTenantId) || tenants[0]

        // Salva a sessão do estabelecimento selecionado
        localStorage.setItem('as_active_tenant', tenantSelecionado.id)
        localStorage.setItem('as_auth_user', JSON.stringify({
            email,
            tenant_id: tenantSelecionado.id,
            tenant_nome: tenantSelecionado.nome
        }))
        localStorage.setItem('admin_demo_auth', 'true') // Mantém retrocompatibilidade de rota

        setTimeout(() => {
            navigate('/')
        }, 300)
    }

    const tenantAtivo = tenants.find(t => t.id === selectedTenantId) || tenants[0]

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#050814] via-[#0B1233] to-[#1E293B] p-4 text-gray-800">
            <div className="w-full max-w-[430px] rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center gap-6 border border-white/30">
                
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

                {/* Seletor de Estabelecimento / Loja */}
                <div className="w-full flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-[#C5A059]" />
                            Estabelecimento / Empresa
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">Ambiente ativo</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                        {tenants.map((t) => {
                            const isSelected = t.id === selectedTenantId
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setSelectedTenantId(t.id)}
                                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 relative overflow-hidden ${
                                        isSelected 
                                            ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-sm' 
                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs">
                                            {t.segmento === 'nail_design' ? '💅' : '🌸'}
                                        </span>
                                        {isSelected && (
                                            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-gray-900 truncate">
                                        {t.nome}
                                    </span>
                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                                        {t.id}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Formulário de Acesso */}
                <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            E-mail do Gestor
                        </label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="gestao@empresa.com"
                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-gray-50/50 transition-all"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                                Senha de Acesso
                            </span>
                            <span className="text-[10px] text-gray-400 font-normal">Protegido por SSL</span>
                        </label>
                        <div className="relative">
                            <input 
                                type={mostrarSenha ? "text" : "password"} 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
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

                    <button 
                        type="submit"
                        disabled={carregando}
                        className="w-full py-3.5 bg-gradient-to-r from-[#C5A059] to-[#DFB76C] hover:from-[#B88E3E] hover:to-[#C5A059] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex justify-center items-center gap-2 mt-2"
                    >
                        <span>{carregando ? 'Entrando no Painel...' : `Acessar Painel (${tenantAtivo?.nome || 'Loja'})`}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                {/* Rodapé Seguro */}
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Conexão criptografada de ponta a ponta</span>
                </div>
            </div>
        </div>
    )
}
