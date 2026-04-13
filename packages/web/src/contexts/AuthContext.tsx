import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';

const AUTH_TOKEN_KEY = 'archon-auth-token';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isEnabled: boolean;
  isInitializing: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const authContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // Read token SYNCHRONOUSLY — prevents redirect-on-refresh race condition.
  // Pattern mirrors ProjectContext.tsx:19-25 (localStorage in useState initializer).
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  // One-time check: is auth enabled on the server?
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json() as Promise<{ enabled: boolean }>)
      .then(({ enabled }) => {
        setIsEnabled(enabled);
      })
      .catch(() => {
        // Server unreachable — keep existing token, let API calls surface the error.
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  const login = useCallback(async (password: string): Promise<void> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      throw new Error('Invalid password');
    }
    const { token: newToken } = (await res.json()) as { token: string };
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    } catch {
      // best-effort persistence
    }
    setToken(newToken);
  }, []);

  const logout = useCallback((): void => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    navigate('/login');
  }, [navigate]);

  const isAuthenticated = !isEnabled || token !== null;

  return (
    <authContext.Provider
      value={{ token, isAuthenticated, isEnabled, isInitializing, login, logout }}
    >
      {children}
    </authContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(authContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
