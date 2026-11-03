import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './paginas/Login'
import RedefinirSenha from './paginas/RedefinirSenha'
import Dashboard from './paginas/Dashboard'
import CatalogoManager from './paginas/CatalogoManager'
import './App.css'

function App() {
  const [autenticado, setAutenticado] = useState(() => {
    return localStorage.getItem('admin_demo_auth') === 'true'
  })
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Se a URL contiver token de recuperação do Supabase, força navegação para /redefinir-senha
    if (window.location.hash.includes('type=recovery') || window.location.href.includes('type=recovery')) {
      navigate('/redefinir-senha')
      return
    }

    const sincronizarTenant = async () => {
      try {
        const { data: vinculos } = await supabase
          .from('tenants_usuarios')
          .select('tenant_id, role, tenants(id, nome, segmento)')

        if (vinculos && vinculos.length > 0) {
          localStorage.setItem('as_user_tenants', JSON.stringify(vinculos))
          const salvo = localStorage.getItem('as_active_tenant')
          const valido = vinculos.some(v => v.tenant_id === salvo)
          const tenantId = valido ? salvo : vinculos[0].tenant_id
          localStorage.setItem('as_active_tenant', tenantId)
        }
      } catch (err) {
        console.error('Erro ao sincronizar tenant do usuário:', err)
      }
    }

    // 1. Verifica sessão nativa existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAutenticado(true)
        localStorage.setItem('admin_demo_auth', 'true')
        sincronizarTenant()
      }
    })

    // 2. Escuta eventos de login/logout em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/redefinir-senha')
        return
      }

      if (session?.user) {
        setAutenticado(true)
        localStorage.setItem('admin_demo_auth', 'true')
        sincronizarTenant()
      } else if (event === 'SIGNED_OUT') {
        setAutenticado(false)
        localStorage.removeItem('as_active_tenant')
        localStorage.removeItem('as_user_tenants')
        localStorage.removeItem('as_auth_user')
        localStorage.removeItem('admin_demo_auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  // Sincroniza estado com location
  useEffect(() => {
    setAutenticado(localStorage.getItem('admin_demo_auth') === 'true')
  }, [location])

  // Componente de Rota Protegida
  const RotaProtegida = ({ children }) => {
    const isAuth = autenticado || localStorage.getItem('admin_demo_auth') === 'true'
    
    if (!isAuth) {
      return <Navigate to="/login" replace />
    }

    return children
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route 
        path="/" 
        element={
          <RotaProtegida>
            <Dashboard />
          </RotaProtegida>
        } 
      />
      <Route 
        path="/servicos" 
        element={
          <RotaProtegida>
            <CatalogoManager />
          </RotaProtegida>
        } 
      />
      {/* Fallback de redirecionamento */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
