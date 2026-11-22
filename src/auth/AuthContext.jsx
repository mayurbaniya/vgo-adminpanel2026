import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AuthService } from '@/api/endpoints.js';

const AuthContext = createContext(null);

const ACCESS_KEY = 'admin.access_token';
const USER_KEY = 'admin.user';

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Any account with a dynamic Role assigned may enter the panel — accessRoleName
// is only ever set for those (see SignInService#applyPermissions). What the
// account can actually reach once inside is decided by `can()`/isSuperAdmin
// below, not by this gate.
function hasPanelRole(userData) {
  return Boolean(userData?.accessRoleName);
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem(ACCESS_KEY),
  );
  const [user, setUser] = useState(readUser);

  // Shared by login() and AcceptInvite (staff-invite/accept returns the exact
  // same UserRespDTO shape, auto-logged-in) — one place builds the slim user
  // and writes it to storage so the two call sites can't drift.
  const setSession = useCallback((userData) => {
    const accessToken = userData?.accessToken;
    if (!accessToken) {
      throw new Error('Response missing access token.');
    }

    const slimUser = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      city: userData.city,
      cityID: userData.cityID,
      accessRoleName: userData.accessRoleName,
      bypassAll: Boolean(userData.bypassAll),
      scopeType: userData.scopeType,
      // { MODULE_NAME: { canView, canEdit, canDelete } }, resolved server-side
      // from the account's Role. A bypass-all (super admin) role gets every
      // module true here too, but `can()` below checks `isSuperAdmin` first
      // regardless, so this stays correct even against a stale/legacy login
      // response that didn't send permissions at all.
      permissions: userData.permissions || {},
    };

    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(slimUser));
    setAccessToken(accessToken);
    setUser(slimUser);
    return slimUser;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const resp = await AuthService.login({ email, password });
    const body = resp?.data;

    // Backend always returns 200; success/failure is in body.status.
    if (body?.status !== 'SUCCESS') {
      const err = new Error(body?.msg || 'Login failed.');
      err.status = body?.status;
      throw err;
    }

    const userData = body.data || {};

    if (!hasPanelRole(userData)) {
      throw new Error(
        'This account is not authorized to access the admin panel.',
      );
    }

    return setSession(userData);
  }, [setSession]);

  const logout = useCallback(async () => {
    // Clear local state first so the UI reflects logout immediately, even if
    // the backend call is slow or fails. Backend logout is best-effort.
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
    try {
      await AuthService.logout();
    } catch {
      // ignore — local cleanup is already done
    }
  }, []);

  const isSuperAdmin = Boolean(user?.bypassAll);

  // Module permission check — 'view' | 'edit' | 'delete'. isSuperAdmin is
  // still the fast-path bypass (mirrors the backend's Role.bypassAll) so a
  // super admin never depends on the permissions map having every module
  // populated correctly.
  const can = useCallback(
    (module, action = 'view') => {
      if (isSuperAdmin) return true;
      const flags = user?.permissions?.[module];
      if (!flags) return false;
      if (action === 'edit') return Boolean(flags.canEdit);
      if (action === 'delete') return Boolean(flags.canDelete);
      return Boolean(flags.canView);
    },
    [isSuperAdmin, user],
  );

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(accessToken),
      accessToken,
      user,
      // Scoped staff (CITY_MANAGER / SALES_EXEC) only get the leads/sales
      // workspace; everything else in the panel is super-admin territory.
      isSuperAdmin,
      can,
      login,
      logout,
      setSession,
    }),
    [accessToken, user, isSuperAdmin, can, login, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
