import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconStore, IconMenu, IconX } from '../icons.jsx';
import ScrollProgress from './ScrollProgress.jsx';

const LINKS = [
  { href: '#producto', label: 'Producto' },
  { href: '#precios', label: 'Precios' },
  { href: '#preguntas', label: 'Preguntas' },
];

export default function StickyNav({ onGetStarted, onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-night-bg/80 backdrop-blur transition-shadow duration-300 ${
        scrolled ? 'border-night-border shadow-[0_4px_30px_-10px_rgba(0,0,0,0.6)]' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris text-white">
            <IconStore className="h-4 w-4" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-white">Mostrador</span>
        </a>

        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-white/60 hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <button onClick={onLogin} className="text-sm font-medium text-white/70 hover:text-white">
            Iniciar sesión
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onGetStarted}
            className="rounded-xl bg-iris px-4 py-2 text-sm font-medium text-white shadow-glow"
          >
            Pruébalo gratis
          </motion.button>
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 sm:hidden"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-night-border sm:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-white/70 hover:bg-night-card hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onLogin();
                }}
                className="rounded-lg px-2 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-night-card hover:text-white"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onGetStarted();
                }}
                className="mt-2 rounded-xl bg-iris px-4 py-2.5 text-sm font-medium text-white"
              >
                Pruébalo gratis
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollProgress />
    </header>
  );
}
