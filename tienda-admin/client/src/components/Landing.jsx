import { motion, useReducedMotion } from 'framer-motion';
import StickyNav from './landing/StickyNav.jsx';
import DemoShowcase from './landing/DemoShowcase.jsx';
import AnimatedStat from './landing/AnimatedStat.jsx';
import Faq from './landing/Faq.jsx';
import {
  IconBox,
  IconWifi,
  IconSparkles,
  IconAlertTriangle,
  IconCheckCircle,
  IconShieldCheck,
  IconLock,
  IconStore,
  IconCoins,
  IconGrid,
  IconCheck,
  IconArrowRight,
} from './icons.jsx';

const PROBLEMS = [
  {
    before: 'No sabes cuánto stock te queda hasta que se te acaba.',
    after: 'Alertas automáticas de stock bajo, en tiempo real.',
    Icon: IconBox,
  },
  {
    before: 'Cada uno anota las ventas por su lado (o no las anota).',
    after: 'Todo el equipo conectado en vivo: caja, teléfono y computadora.',
    Icon: IconWifi,
  },
  {
    before: 'Cierras el mes sin saber si realmente ganaste.',
    after: 'Reportes con IA: ganancias, qué reponer y si la caja cuadra.',
    Icon: IconSparkles,
  },
];

const STATS = [
  { icon: <IconCoins className="h-5 w-5" />, value: 20000, label: 'al mes, todo incluido', formatter: (n) => `$${Math.round(n).toLocaleString('es-CL')}` },
  { icon: <IconGrid className="h-5 w-5" />, value: 6, label: 'funciones clave en un solo panel' },
  { icon: <IconCheckCircle className="h-5 w-5" />, value: 100, label: '% en la nube, sin instalar nada', formatter: (n) => `${Math.round(n)}%` },
  { icon: <IconWifi className="h-5 w-5" />, value: 24, label: 'horas al día, siempre disponible', formatter: (n) => `${Math.round(n)}/7` },
];

const STEPS = [
  { title: 'Crea tu cuenta', body: 'Nombre de tu negocio, tu correo y una contraseña.' },
  { title: 'Activa tu suscripción', body: '$20.000 CLP al mes, pago seguro con tarjeta vía Flow.' },
  { title: 'Carga tus productos', body: 'Nombre, precio, costo y stock inicial de cada uno.' },
  { title: 'Vende y controla todo', body: 'Registra movimientos, genera recibos y revisa tus reportes.' },
];

const TRUST = [
  {
    Icon: IconShieldCheck,
    title: 'Tus datos, aislados',
    body: 'Cada negocio tiene su información completamente separada de los demás.',
  },
  {
    Icon: IconLock,
    title: 'Pago seguro con Flow',
    body: 'Tu tarjeta nunca pasa por nuestro servidor: Flow procesa el cobro directamente.',
  },
  {
    Icon: IconStore,
    title: 'Hecho para tiendas chilenas',
    body: 'Pensado para almacenes y tiendas de barrio en Chile, en pesos chilenos.',
  },
  {
    Icon: IconWifi,
    title: 'Siempre disponible',
    body: 'Tu panel vive en la nube, accesible desde cualquier navegador.',
  },
];

const PRICING_ITEMS = [
  'Inventario y productos ilimitados',
  'Reportes mensuales con IA',
  'Todo conectado en tiempo real',
  'Recibos de venta en PDF',
  'Respaldo y exportación de datos',
  'Lector de código de barras (USB o cámara)',
];

const FAQ_ITEMS = [
  {
    question: '¿Cómo funciona el cobro?',
    answer:
      '$20.000 CLP al mes, procesado por Flow. Ingresas tu tarjeta directamente en la página de Flow — nunca pasa por nuestro servidor.',
  },
  {
    question: '¿Qué pasa si cancelo?',
    answer:
      'Se bloquea el acceso al panel, pero tus datos no se borran. Puedes reactivar la suscripción cuando quieras y todo sigue donde lo dejaste.',
  },
  {
    question: '¿Mis datos están separados de otras tiendas?',
    answer: 'Sí. Cada negocio tiene su información completamente aislada — nadie más puede verla ni tocarla.',
  },
  {
    question: '¿Puedo usarlo desde el teléfono?',
    answer:
      'Sí, Mostrador funciona en cualquier navegador. Incluye escaneo de código de barras con la cámara del teléfono.',
  },
  {
    question: '¿Necesito instalar algo?',
    answer: 'No. Todo funciona desde el navegador, sin instalar programas ni mantener un servidor propio.',
  },
  {
    question: '¿Qué pasa si tengo un problema o una duda?',
    answer: 'Puedes escribirle directamente al equipo de Mostrador — sin bots ni tickets eternos.',
  },
];

function FadeUp({ children, delay = 0, className = '', as: Component = motion.div, ...rest }) {
  const reduceMotion = useReducedMotion();
  return (
    <Component
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: reduceMotion ? 0.2 : 0.45, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Component>
  );
}

const HEADLINE = 'El panel para que tu tienda no pierda de vista ni un producto';

function Headline() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl" style={{ textWrap: 'balance' }}>
        {HEADLINE}
      </h1>
    );
  }
  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.035 } } }}
      className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
      style={{ textWrap: 'balance' }}
    >
      {HEADLINE.split(' ').map((word, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="inline-block"
        >
          {word}
          {i < HEADLINE.split(' ').length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function CtaArrow({ className = '' }) {
  return <IconArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${className}`} />;
}

export default function Landing({ onGetStarted, onLogin }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <StickyNav onGetStarted={onGetStarted} onLogin={onLogin} />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <motion.div
            className="absolute left-1/2 top-[-160px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-slate-200/50 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, 14, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="mx-auto max-w-3xl">
        <Headline />
        <motion.p
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-slate-500"
        >
          Mostrador es el panel en línea para administrar el inventario, las ventas y la caja de
          tu tienda — desde la computadora o el teléfono, en tiempo real, con reportes que hace la
          IA por ti.
        </motion.p>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button onClick={onGetStarted} className="btn-primary group px-6 py-3 text-base">
            Crear cuenta
            <CtaArrow />
          </button>
          <a href="#producto" className="btn-secondary px-6 py-3 text-base">
            Ver cómo funciona
          </a>
        </motion.div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400"
        >
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="h-3.5 w-3.5" /> Datos aislados por negocio
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconLock className="h-3.5 w-3.5" /> Pago seguro con Flow
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconStore className="h-3.5 w-3.5" /> Hecho para tiendas en Chile
          </span>
        </motion.div>
        </div>
      </section>

      {/* Producto en movimiento */}
      <section id="producto" className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <FadeUp className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Tu tienda, de un vistazo
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Así se ve Mostrador funcionando de verdad — sin maquetas, sin relleno.
            </p>
          </FadeUp>
          <DemoShowcase />
        </div>
      </section>

      {/* Problema → Solución */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <FadeUp className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Lo que te está pasando ahora
          </h2>
        </FadeUp>
        <div className="space-y-4">
          {PROBLEMS.map(({ before, after, Icon }, i) => (
            <FadeUp
              key={before}
              delay={i * 0.05}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="card flex flex-col items-stretch gap-4 p-5 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-center gap-3 text-slate-500">
                <IconAlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-sm">{before}</p>
              </div>
              <IconArrowRight className="h-4 w-4 shrink-0 rotate-90 text-slate-300 sm:rotate-0" />
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-slate-800">{after}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Beneficios */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <FadeUp className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Lo que te llevas
            </h2>
          </FadeUp>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <AnimatedStat key={stat.label} {...stat} delay={i * 0.05} />
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <FadeUp className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Cómo funciona
          </h2>
        </FadeUp>
        <div className="relative space-y-8 border-l border-slate-200 pl-8">
          {STEPS.map((step, i) => (
            <FadeUp key={step.title} delay={i * 0.06} className="relative">
              <span className="absolute -left-[calc(2rem+5px)] flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{step.body}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Confianza */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ Icon, title, body }, i) => (
            <FadeUp
              key={title}
              delay={i * 0.05}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-xl p-2 text-center"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500">{body}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <FadeUp className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Un solo plan, sin letra chica
          </h2>
        </FadeUp>
        <FadeUp
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="card mx-auto max-w-sm p-8 text-left"
        >
          <p className="text-center text-sm font-medium uppercase tracking-wide text-slate-400">
            Suscripción mensual
          </p>
          <p className="mt-2 text-center text-4xl font-semibold text-slate-900">$20.000</p>
          <p className="mb-6 text-center text-sm text-slate-500">CLP por mes, todo incluido</p>
          <ul className="mb-6 space-y-2.5">
            {PRICING_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
          <button onClick={onGetStarted} className="btn-primary group w-full py-3 text-base">
            Crear cuenta
            <CtaArrow />
          </button>
        </FadeUp>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <FadeUp className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Preguntas frecuentes
            </h2>
          </FadeUp>
          <FadeUp>
            <Faq items={FAQ_ITEMS} />
          </FadeUp>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <FadeUp>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            ¿Listo para ordenar tu tienda?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
            Crea tu cuenta ahora y ten tu inventario, ventas y reportes bajo control desde hoy.
          </p>
          <button onClick={onGetStarted} className="btn-primary group mt-6 px-8 py-3 text-base">
            Crear cuenta
            <CtaArrow />
          </button>
        </FadeUp>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        Mostrador — el panel para tiendas y almacenes.
      </footer>
    </div>
  );
}
