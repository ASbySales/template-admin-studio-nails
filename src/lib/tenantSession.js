import { supabase } from './supabase'

export function lerVinculosEmCache() {
  try {
    const salvo = JSON.parse(localStorage.getItem('as_user_tenants') || '[]')
    return Array.isArray(salvo) ? salvo : []
  } catch {
    return []
  }
}

export async function resolverTenantAtivo(tenantSolicitado = null) {
  let currentTenant = tenantSolicitado || localStorage.getItem('as_active_tenant')
  const { data: vinculos } = await supabase
    .from('tenants_usuarios')
    .select('tenant_id, role, tenants(id, nome, segmento)')

  if (Array.isArray(vinculos) && vinculos.length > 0) {
    localStorage.setItem('as_user_tenants', JSON.stringify(vinculos))
    const valido = vinculos.some((v) => v.tenant_id === currentTenant)
    if (!valido) {
      currentTenant = vinculos[0].tenant_id
    }
    localStorage.setItem('as_active_tenant', currentTenant)
    return { tenantId: currentTenant, vinculos }
  }

  if (!currentTenant) {
    currentTenant = import.meta.env.VITE_TENANT_ID || 'demo'
    localStorage.setItem('as_active_tenant', currentTenant)
  }

  return { tenantId: currentTenant, vinculos: lerVinculosEmCache() }
}

export async function deslogarAdmin(navigate) {
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.error('Erro ao encerrar sessão Supabase:', err)
  }
  localStorage.removeItem('admin_demo_auth')
  localStorage.removeItem('as_active_tenant')
  localStorage.removeItem('as_auth_user')
  localStorage.removeItem('as_user_tenants')
  navigate('/login')
}
