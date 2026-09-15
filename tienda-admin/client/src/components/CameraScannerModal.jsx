import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { IconX, IconCamera } from './icons.jsx';

const ERROR_MESSAGES = {
  NotAllowedError: 'Diste el permiso de cámara a "No permitir". Actívalo en los ajustes del navegador para escanear.',
  NotFoundError: 'No se encontró ninguna cámara en este dispositivo.',
  NotReadableError: 'La cámara está siendo usada por otra aplicación.',
  OverconstrainedError: 'No se pudo usar la cámara trasera; probando con la disponible.',
};

export default function CameraScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, err) => {
          if (cancelled) return;
          if (result) {
            controlsRef.current?.stop();
            onDetected(result.getText());
          }
          // err aquí es "no encontré nada en este cuadro todavía": es normal
          // en casi cada frame mientras se busca el código, no es un error real.
        }
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(ERROR_MESSAGES[err?.name] || 'No se pudo acceder a la cámara.');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCamera className="h-4 w-4" />
              Escanear código de barras
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Cerrar"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {!error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="h-40 w-72 max-w-[80vw] rounded-2xl border-2 border-white/80"
                />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center">
                <p className="max-w-xs text-sm text-white">{error}</p>
              </div>
            )}
          </div>

          <p className="px-4 py-4 text-center text-xs text-white/60">
            Apunta la cámara al código de barras del producto (SKU).
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
