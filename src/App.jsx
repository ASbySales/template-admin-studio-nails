import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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

  useEffect(() => {
    // 1. Verifica sessão nativa existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAutenticado(true)
        localStorage.setItem('admin_demo_auth', 'true')
        const tenantId = session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id
        if (tenantId) localStorage.setItem('as_active_tenant', tenantId)
      }
    })

    // 2. Escuta eventos de login/logout em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAutenticado(true)
        localStorage.setItem('admin_demo_auth', 'true')
        const tenantId = session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id
        if (tenantId) localStorage.setItem('as_active_tenant', tenantId)
      } else if (event === 'SIGNED_OUT') {
        setAutenticado(false)
        localStorage.removeItem('as_active_tenant')
        localStorage.removeItem('as_auth_user')
        localStorage.removeItem('admin_demo_auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
