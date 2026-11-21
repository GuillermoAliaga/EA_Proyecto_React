import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { request, setAccessToken, refreshAccessToken, setOnSessionExpired } from '../services/http';
import type { User } from '../models';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  canPublishActivities: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // true mientras se restaura la sesión

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnSessionExpired(clearSession);
    (async () => {
      const token = await refreshAccessToken();      // POST /auth/refresh con la cookie
      if (token) {
        try { setUser(await request<User>('/users/me')); }
        catch { clearSession(); }
      }
      setLoading(false);
    })();
  }, [clearSession]);

  const login = async (email: string, password: string) => {
    const data = await request<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try { await request('/auth/logout', { method: 'POST' }); } finally { clearSession(); }
  };

  const value: AuthState = {
    user, loading, login, logout,
    isAdmin: user?.role === 'ADMIN',
    canPublishActivities: user?.role === 'ADMIN' || user?.role === 'STORE_HOST',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}