import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { configureHttp, setAuthFailureHandler } from '../api/httpClient';
import { loadStoredToken, login as loginApi, storeSession, logout as logoutApi, type LoginUser } from '../api/authApi';
import { getDefaultRouteForRole, getUserRole } from '../routes/roleMap';

interface AuthState {
  token: string | null;
  user: LoginUser | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<{ ok: boolean; message?: string; redirectTo?: string }>;
  logout: () => void;
  defaultRoute: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Boot: hydrate from localStorage
  useEffect(() => {
    const stored = loadStoredToken();
    if (stored.token) {
      configureHttp({ token: stored.token });
      setToken(stored.token);
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(status => {
      if (status === 401) {
        logoutApi();
        setToken(null);
        setUser(null);
        window.location.assign('/login');
      }
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    token,
    user,
    loading,
    defaultRoute: getDefaultRouteForRole(getUserRole(user)),
    async login(loginId: string, password: string) {
      const res = await loginApi({ login_id: loginId, password });
      if (!res.ok) {
        return { ok: false, message: res.message };
      }
      storeSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user ?? null);
      return { ok: true, redirectTo: getDefaultRouteForRole(getUserRole(res.user)) };
    },
    logout() {
      logoutApi();
      setToken(null);
      setUser(null);
    },
  }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
