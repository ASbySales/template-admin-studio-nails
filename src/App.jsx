import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './paginas/Login'
import Dashboard from './paginas/Dashboard'
import CatalogoManager from './paginas/CatalogoManager'
import './App.css'

function App() {
  const [autenticado, setAutenticado] = useState(() => {
    return localStorage.getItem('admin_demo_auth') === 'true'
  })
  const location = useLocation()

  // Atualiza o estado de autenticação sempre que a rota mudar
  useEffect(() => {
    setAutenticado(localStorage.getItem('admin_demo_auth') === 'true')
  }, [location])

  // Componente de Rota Protegida (Modo Demonstração Desanexado)
  const RotaProtegida = ({ children }) => {
    const isAuth = localStorage.getItem('admin_demo_auth') === 'true'
    
    if (!isAuth) {
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
