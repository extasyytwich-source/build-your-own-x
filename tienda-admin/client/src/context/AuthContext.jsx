import { createContext, useContext, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      async login(pin) {
        const { token: newToken } = await api.login(pin);
        setToken(newToken);
        setTokenState(newToken);
      },
      logout() {
        setToken(null);
        setTokenState(null);
      },
      handleUnauthorized() {
        setToken(null);
        setTokenState(null);
      },
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
