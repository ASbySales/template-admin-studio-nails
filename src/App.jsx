import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './paginas/Login'
import Dashboard from './paginas/Dashboard'
import CatalogoManager from './paginas/CatalogoManager'
import './App.css'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verifica se há uma sessão de usuário ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user || null)
      setLoading(false)
    })

    // 2. Ouve alterações de autenticação em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Componente de Rota Protegida
  const RotaProtegida = ({ children }) => {
    if (loading) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-3">
          <div className="w-10 h-10 border-4 border-[#C08A89]/20 border-t-[#C08A89] rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 font-semibold font-cinzel">Verificando permissões...</p>
        </div>
      )
    }

    if (!usuario) {
      return <Navigate to="/login" replace />
    }

    return children
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
