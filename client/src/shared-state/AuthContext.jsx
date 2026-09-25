// Who is signed in, shared with every screen through useAuth().
//
// Nothing about the visitor is trusted from the browser: on load the app asks the server
// (/api/auth/me), which answers from the session cookie. `permissions` is a Set of codes such as
// 'course.create', used to show or hide controls. Hiding is only a courtesy; the server checks
// the same codes again on every request.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api-client/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null); // { user, permissions } or null when signed out
  const [loading, setLoading] = useState(true);

  const forget = useCallback(() => setAccount(null), []);

  const acceptSession = useCallback(({ user, permissions }) => {
    setAccount({ user, permissions: new Set(permissions) });
  }, []);

  // Asks the server who is signed in, on first load and whenever a screen needs fresh details
  const refresh = useCallback(async () => {
    try {
      acceptSession(await api.me());
    } catch (error) {
      // Only "not signed in" ends the session here; a network hiccup leaves it for the next try
      if (error.status === 401 || error.status === 403) forget();
    } finally {
      setLoading(false);
    }
  }, [acceptSession, forget]);

  useEffect(() => {
    setUnauthorizedHandler(forget);
    refresh();
  }, [forget, refresh]);

  const value = useMemo(
    () => ({
      user: account?.user ?? null,
      permissions: account?.permissions ?? new Set(),
      can: (code) => Boolean(account?.permissions.has(code)),
      loading,
      signIn: async (email, password) => acceptSession(await api.login(email, password)),
      signOut: async () => {
        // The session may already have ended on the server; either way the visitor is now out
        await api.logout().catch(() => {});
        forget();
      },
      refresh,
    }),
    [account, loading, acceptSession, forget, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
