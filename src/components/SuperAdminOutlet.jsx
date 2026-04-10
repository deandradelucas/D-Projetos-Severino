import { Navigate, Outlet } from 'react-router-dom'
import { canAccessAdminPanelSession } from '../lib/superAdmin'

/**
 * Rotas /admin/*: conta SUPER_ADMIN ou perfil com role ADMIN.
 */
export default function SuperAdminOutlet() {
  if (!canAccessAdminPanelSession()) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
