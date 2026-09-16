import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const WORDS = ['INVENTARIO', 'VENTAS', 'CLIENTES', 'REPORTES'];
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REVEAL_STEP_MS = 45;
const HOLD_MS = 1600;

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

// Palabra en JetBrains Mono que se "decodifica": empieza en caracteres al
// azar y se va resolviendo de izquierda a derecha, letra por letra, antes
// de pasar a la siguiente. Con prefers-reduced-motion, salta directo al
// texto final sin el efecto de scramble.
export default function DecodeText() {
  const reduceMotion = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);
  const [display, setDisplay] = useState(reduceMotion ? WORDS[0] : '');

  useEffect(() => {
    const target = WORDS[wordIndex];
    if (reduceMotion) {
      setDisplay(target);
      return;
    }

    let revealed = 0;
    const scrambleInterval = setInterval(() => {
      revealed += 1;
      setDisplay(
        target
          .split('')
          .map((ch, i) => (i < revealed ? ch : randomChar()))
          .join('')
      );
      if (revealed >= target.length) clearInterval(scrambleInterval);
    }, REVEAL_STEP_MS);

    const advance = setTimeout(
      () => setWordIndex((i) => (i + 1) % WORDS.length),
      target.length * REVEAL_STEP_MS + HOLD_MS
    );

    return () => {
      clearInterval(scrambleInterval);
      clearTimeout(advance);
    };
  }, [wordIndex, reduceMotion]);

  return (
    <span className="font-jetbrains text-sm font-medium uppercase tracking-[0.3em] text-iris sm:text-base">
      {display}
      <span className="ml-1 inline-block h-[1em] w-[2px] animate-blink bg-iris align-middle" aria-hidden="true" />
    </span>
  );
}
