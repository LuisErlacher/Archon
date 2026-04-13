import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser, refreshSession, setApiToken, type UserResponse } from '@/lib/api';

interface AuthContextValue {
  user: UserResponse | null;
  accessToken: string | null;
  login: (accessToken: string, refreshToken: string, user: UserResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const REFRESH_TOKEN_KEY = 'archon-refresh-token';

const authContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenState, setRefreshTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  function clearTokens(): void {
    setAccessToken(null);
    setRefreshTokenState(null);
    setUser(null);
    setApiToken(null);
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      /* best-effort */
    }
  }

  // On mount, try to restore session via refresh token
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!refreshTokenState) {
      setIsLoading(false);
      return;
    }
    refreshSession(refreshTokenState)
      .then(data => {
        setAccessToken(data.accessToken);
        setRefreshTokenState(data.refreshToken);
        setApiToken(data.accessToken);
        try {
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        } catch {
          /* best-effort */
        }
      })
      .catch(() => {
        clearTokens();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [refreshTokenState]);

  // Fetch user profile once access token is set
  useEffect(() => {
    if (!accessToken) return;
    getCurrentUser(accessToken)
      .then(u => {
        setUser(u);
      })
      .catch(() => {
        clearTokens();
      });
  }, [accessToken]);

  // Listen for 401 events from fetchJSON
  useEffect(() => {
    const handler = (): void => {
      clearTokens();
    };
    window.addEventListener('archon:unauthorized', handler);
    return (): void => {
      window.removeEventListener('archon:unauthorized', handler);
    };
  }, []);

  const login = useCallback((at: string, rt: string, u: UserResponse): void => {
    setAccessToken(at);
    setRefreshTokenState(rt);
    setUser(u);
    setApiToken(at);
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, rt);
    } catch {
      /* best-effort */
    }
  }, []);

  const logout = useCallback((): void => {
    clearTokens();
  }, []);

  return (
    <authContext.Provider
      value={{ user, accessToken, login, logout, isAuthenticated: !!accessToken, isLoading }}
    >
      {children}
    </authContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(authContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
