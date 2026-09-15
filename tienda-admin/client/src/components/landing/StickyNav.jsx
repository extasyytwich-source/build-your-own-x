import { useEffect, useState } from 'react';
import { IconStore } from '../icons.jsx';
import ScrollProgress from './ScrollProgress.jsx';

const LINKS = [
  { href: '#producto', label: 'Producto' },
  { href: '#precios', label: 'Precios' },
  { href: '#preguntas', label: 'Preguntas' },
];

export default function StickyNav({ onGetStarted, onLogin }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/80 backdrop-blur transition-shadow duration-300 ${
        scrolled ? 'border-slate-200 shadow-sm' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
            <IconStore className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">Mostrador</span>
        </a>

        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Iniciar sesión
          </button>
          <button onClick={onGetStarted} className="btn-primary px-4 py-2 text-sm">
            Crear cuenta
          </button>
        </div>
      </div>
      <ScrollProgress />
    </header>
  );
}
