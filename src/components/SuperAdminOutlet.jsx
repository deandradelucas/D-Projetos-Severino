import { Navigate, Outlet } from 'react-router-dom'
import { isSuperAdminSession } from '../lib/superAdmin'

/**
 * Só mestredamente@mestredamente.com acessa rotas /admin/*.
 */
export default function SuperAdminOutlet() {
  if (!isSuperAdminSession()) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
