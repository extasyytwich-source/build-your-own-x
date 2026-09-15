import { useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Botón oficial de Google (Google Identity Services). El script se agrega
// una sola vez en index.html; acá solo se inicializa con nuestro Client ID
// y se renderiza el botón dentro de este div.
export default function GoogleSignInButton({ onCredential }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return undefined;

    let cancelled = false;

    function render() {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      // El script se carga con "defer" en index.html; si todavía no está
      // listo, se reintenta hasta que aparezca.
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
}
