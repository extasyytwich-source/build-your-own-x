import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(() => Boolean(getToken()));

  // Al recargar la página con una sesión ya guardada, no sabemos todavía si
  // la suscripción sigue activa hasta preguntarle al servidor. Mientras eso
  // no responde, no hay que mostrar el panel ni la pantalla de suscripción.
  useEffect(() => {
    if (!token) {
      setCheckingSubscription(false);
      return;
    }
    setCheckingSubscription(true);
    api
      .getBillingStatus()
      .then((status) => setSubscriptionStatus(status.subscriptionStatus))
      .catch(() => {})
      .finally(() => setCheckingSubscription(false));
  }, [token]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      subscriptionStatus,
      checkingSubscription,
      async signup(businessName, email, password) {
        const { token: newToken, subscriptionStatus: status } = await api.signup(
          businessName,
          email,
          password
        );
        setToken(newToken);
        setTokenState(newToken);
        setSubscriptionStatus(status);
      },
      async login(email, password) {
        const { token: newToken, subscriptionStatus: status } = await api.login(email, password);
        setToken(newToken);
        setTokenState(newToken);
        setSubscriptionStatus(status);
      },
      async refreshSubscriptionStatus() {
        const status = await api.getBillingStatus();
        setSubscriptionStatus(status.subscriptionStatus);
        return status.subscriptionStatus;
      },
      logout() {
        setToken(null);
        setTokenState(null);
        setSubscriptionStatus(null);
      },
      handleUnauthorized() {
        setToken(null);
        setTokenState(null);
        setSubscriptionStatus(null);
      },
    }),
    [token, subscriptionStatus, checkingSubscription]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
