import { useEffect, useRef } from 'react';

// Un lector de código de barras se comporta como un teclado: escribe cada
// carácter del código en unos pocos milisegundos y termina con Enter. Esa
// velocidad es lo que lo distingue de alguien tecleando a mano, así no
// interfiere con el tipeo normal en inputs de la página.
//
// 50ms era demasiado ajustado: algunos lectores (sobre todo por Bluetooth,
// o si el navegador está ocupado renderizando algo) meten más de 50ms entre
// una tecla y la siguiente, así que el buffer se reiniciaba a mitad del
// código y nunca llegaba a completarse (confirmado con un lector real que
// promedia ~60ms/tecla: el código jamás se armaba entero). 150ms sigue
// siendo mucho más rápido que cualquier persona tecleando a mano un código
// largo sin querer, pero le da margen a lectores más lentos.
const MAX_INTERVAL_MS = 150;
const MIN_CODE_LENGTH = 3;

function isEditableTarget(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

export function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(e) {
      if (isEditableTarget(e.target)) return;

      const now = Date.now();
      const elapsed = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= MIN_CODE_LENGTH) onScanRef.current(code);
        return;
      }

      if (e.key.length !== 1) return; // ignora Shift, Tab, flechas, etc.

      if (elapsed > MAX_INTERVAL_MS) bufferRef.current = ''; // tecleo humano: reinicia el buffer
      bufferRef.current += e.key;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
