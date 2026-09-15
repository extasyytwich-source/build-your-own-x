import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // 'owner' (el dueño, ve todo) o 'cajero' (un empleado, solo ve Caja).
  const [role, setRole] = useState(null);
  const [name, setName] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  function clearSession() {
    setIsAuthenticated(false);
    setRole(null);
    setName(null);
    setSubscriptionStatus(null);
  }

  // La sesión vive en una cookie httpOnly: este cliente no puede leerla, así
  // que al cargar la página la única forma de saber si ya había una sesión
  // (y con qué rol) es preguntarle al servidor.
  useEffect(() => {
    api
      .getMe()
      .then((me) => {
        setIsAuthenticated(true);
        setRole(me.role);
        setName(me.name);
        return api.getBillingStatus();
      })
      .then((status) => setSubscriptionStatus(status.subscriptionStatus))
      .catch(clearSession)
      .finally(() => setCheckingSubscription(false));
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      role,
      name,
      subscriptionStatus,
      checkingSubscription,
      async signup(businessName, email, password) {
        const result = await api.signup(businessName, email, password);
        setIsAuthenticated(true);
        setRole(result.role);
        setName(null);
        setSubscriptionStatus(result.subscriptionStatus);
      },
      async login(identifier, password) {
        const result = await api.login(identifier, password);
        setIsAuthenticated(true);
        setRole(result.role);
        setName(result.name ?? null);
        setSubscriptionStatus(result.subscriptionStatus);
      },
      // Devuelve needsBusinessName cuando es una cuenta de Google nueva y
      // todavía no sabemos el nombre del negocio (ver LoginGate.jsx).
      async loginWithGoogle(credential, businessName) {
        const result = await api.loginWithGoogle(credential, businessName);
        if (result.needsBusinessName) return result;
        setIsAuthenticated(true);
        setRole(result.role);
        setName(null);
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
        clearSession();
      },
      handleUnauthorized() {
        clearSession();
      },
    }),
    [isAuthenticated, role, name, subscriptionStatus, checkingSubscription]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
