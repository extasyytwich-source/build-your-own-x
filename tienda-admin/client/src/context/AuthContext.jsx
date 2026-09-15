import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // La sesión vive en una cookie httpOnly: este cliente no puede leerla, así
  // que al cargar la página la única forma de saber si ya había una sesión
  // es preguntarle al servidor (reaprovecha /billing/status, que de paso
  // trae el estado de la suscripción).
  useEffect(() => {
    api
      .getBillingStatus()
      .then((status) => {
        setIsAuthenticated(true);
        setSubscriptionStatus(status.subscriptionStatus);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setSubscriptionStatus(null);
      })
      .finally(() => setCheckingSubscription(false));
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      subscriptionStatus,
      checkingSubscription,
      async signup(businessName, email, password) {
        const { subscriptionStatus: status } = await api.signup(businessName, email, password);
        setIsAuthenticated(true);
        setSubscriptionStatus(status);
      },
      async login(email, password) {
        const { subscriptionStatus: status } = await api.login(email, password);
        setIsAuthenticated(true);
        setSubscriptionStatus(status);
      },
      // Devuelve needsBusinessName cuando es una cuenta de Google nueva y
      // todavía no sabemos el nombre del negocio (ver LoginGate.jsx).
      async loginWithGoogle(credential, businessName) {
        const result = await api.loginWithGoogle(credential, businessName);
        if (result.needsBusinessName) return result;
        setIsAuthenticated(true);
        setSubscriptionStatus(result.subscriptionStatus);
        return result;
      },
      async refreshSubscriptionStatus() {
        const status = await api.getBillingStatus();
        setSubscriptionStatus(status.subscriptionStatus);
        return status.subscriptionStatus;
      },
      async logout() {
        try {
          await api.logout();
        } catch {
          // Si falla el pedido igual cerramos la sesión del lado del cliente.
        }
        setIsAuthenticated(false);
        setSubscriptionStatus(null);
      },
      handleUnauthorized() {
        setIsAuthenticated(false);
        setSubscriptionStatus(null);
      },
    }),
    [isAuthenticated, subscriptionStatus, checkingSubscription]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
