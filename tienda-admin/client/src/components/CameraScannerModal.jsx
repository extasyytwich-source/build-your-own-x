import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import { IconX, IconCamera, IconFlash } from './icons.jsx';

const ERROR_MESSAGES = {
  NotAllowedError: 'Diste el permiso de cámara a "No permitir". Actívalo en los ajustes del navegador para escanear.',
  NotFoundError: 'No se encontró ninguna cámara en este dispositivo.',
  NotReadableError: 'La cámara está siendo usada por otra aplicación.',
  OverconstrainedError: 'No se pudo usar la cámara trasera; probando con la disponible.',
};

// Pedir más resolución y enfoque continuo desde el arranque: con la cámara
// por defecto (baja resolución, enfoque fijo) un código de barras real de un
// producto —chico e impreso, no un QR grande en pantalla— casi nunca se lee
// bien, aunque el video se vea "normal". Son "advanced": los navegadores que
// no los soportan simplemente los ignoran, no fallan.
const VIDEO_CONSTRAINTS = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: 'continuous' }],
};

export default function CameraScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const trackRef = useRef(null);
  const [error, setError] = useState('');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    setTorchAvailable(false);
    setTorchOn(false);
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints(
        { video: VIDEO_CONSTRAINTS },
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

        // Reforzar enfoque continuo ya con el stream andando: algunos
        // navegadores solo aceptan este ajuste después de iniciada la
        // cámara, no en la petición inicial.
        try {
          controls.streamVideoConstraintsApply?.({ advanced: [{ focusMode: 'continuous' }] });
        } catch {
          // Sin soporte: sigue funcionando con el enfoque que haya dado la cámara.
        }

        const stream = videoRef.current?.srcObject;
        const track = stream?.getVideoTracks?.()[0];
        if (track && BrowserCodeReader.mediaStreamIsTorchCompatibleTrack(track)) {
          trackRef.current = track;
          setTorchAvailable(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(ERROR_MESSAGES[err?.name] || 'No se pudo acceder a la cámara.');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      trackRef.current = null;
    };
  }, [open, onDetected]);

  async function toggleTorch() {
    if (!trackRef.current) return;
    const next = !torchOn;
    try {
      await BrowserCodeReader.mediaStreamSetTorch(trackRef.current, next);
      setTorchOn(next);
    } catch {
      // Algunos dispositivos anuncian soporte de torch pero lo rechazan en
      // los hechos; no hay mucho más que hacer que dejarlo como estaba.
    }
  }

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
            <div className="flex items-center gap-2">
              {torchAvailable && (
                <button
                  onClick={toggleTorch}
                  className={`rounded-full p-2 text-white hover:bg-white/20 ${
                    torchOn ? 'bg-amber-400/80' : 'bg-white/10'
                  }`}
                  aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                >
                  <IconFlash className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Cerrar"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
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
            Apunta al código de barras o QR del producto (SKU), bien de cerca
            y firme — si está borroso o hay poca luz{torchAvailable ? ', prueba la linterna' : ''}.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
