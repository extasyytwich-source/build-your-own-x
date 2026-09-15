import { useAnimation } from 'framer-motion';

// Retroalimentación breve (no exagerada) para errores: un pequeño
// movimiento lateral en vez de solo texto en rojo.
export function useShake() {
  const controls = useAnimation();

  function shake() {
    controls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.4 },
    });
  }

  return [controls, shake];
}
