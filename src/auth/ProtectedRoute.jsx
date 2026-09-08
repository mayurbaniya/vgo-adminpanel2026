import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/**
 * Route-level permission gate — replaces the old blanket <SuperOnly>. Bounces
 * to `fallback` (default: the leads workspace, the one page every staff role
 * has always had) when the signed-in account can't view this module. The
 * backend enforces the real boundary on every request regardless — this is
 * UX only, so a scoped staff member never lands on a page that immediately
 * 403s every request it fires.
 */
export function RequirePermission({ module, action = 'view', fallback = '/leads', children }) {
  const { can } = useAuth();
  if (!can(module, action)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}
