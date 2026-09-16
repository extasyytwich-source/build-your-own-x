import { motion, useReducedMotion } from 'framer-motion';
import StickyNav from './landing/StickyNav.jsx';
import DemoShowcase from './landing/DemoShowcase.jsx';
import AnimatedStat from './landing/AnimatedStat.jsx';
import Faq from './landing/Faq.jsx';
import RotatingWord from './landing/RotatingWord.jsx';
import DecodeText from './landing/DecodeText.jsx';
import BentoGrid from './landing/BentoGrid.jsx';
import MiniBars from './landing/MiniBars.jsx';
import FeatureMarquee from './landing/FeatureMarquee.jsx';
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
  IconReceipt,
  IconUsers,
  IconBarcode,
  IconTruck,
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
  {
    icon: <IconCoins className="h-5 w-5" />,
    value: 20000,
    label: 'al mes, todo incluido',
    formatter: (n) => `$${Math.round(n).toLocaleString('es-CL')}`,
    accent: '#F0997B',
  },
  { icon: <IconGrid className="h-5 w-5" />, value: 10, label: 'funciones en un solo panel', accent: '#5DCAA5' },
  {
    icon: <IconCheckCircle className="h-5 w-5" />,
    value: 100,
    label: '% en la nube, sin instalar nada',
    formatter: (n) => `${Math.round(n)}%`,
    accent: '#FAC775',
  },
  {
    icon: <IconWifi className="h-5 w-5" />,
    value: 24,
    label: 'horas al día, siempre disponible',
    formatter: (n) => `${Math.round(n)}/7`,
    accent: '#ED93B1',
  },
];

const BENTO_ITEMS = [
  {
    Icon: IconStore,
    title: 'Multi-sucursal',
    body: 'Cada sucursal lleva su propio stock, con un total agregado siempre a la vista.',
    span: 2,
    accent: '#7F77DD',
  },
  {
    Icon: IconBarcode,
    title: 'Código de barras',
    body: 'Lector USB o la cámara del teléfono — lo que tengas a mano.',
    accent: '#F0997B',
  },
  {
    Icon: IconUsers,
    title: 'Dueño y cajero',
    body: 'El cajero solo ve Caja; tú ves todo el panel.',
    accent: '#5DCAA5',
  },
  {
    Icon: IconSparkles,
    title: 'Reportes con IA',
    body: 'Neto, IVA, impuestos y análisis del mes, generados solos.',
    span: 2,
    accent: '#FAC775',
    extra: <MiniBars />,
  },
  {
    Icon: IconTruck,
    title: 'Proveedores',
    body: 'Órdenes de compra que actualizan tu stock y tu costo al recibirlas.',
    accent: '#ED93B1',
  },
  {
    Icon: IconReceipt,
    title: 'Boleta electrónica',
    body: 'Estructura lista para el SII: folios, CAF y borrador en PDF.',
    accent: '#7F77DD',
  },
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
    accent: '#7F77DD',
  },
  {
    Icon: IconLock,
    title: 'Pago seguro con Flow',
    body: 'Tu tarjeta nunca pasa por nuestro servidor: Flow procesa el cobro directamente.',
    accent: '#F0997B',
  },
  {
    Icon: IconStore,
    title: 'Hecho para tiendas chilenas',
    body: 'Pensado para almacenes y tiendas de barrio en Chile, en pesos chilenos.',
    accent: '#5DCAA5',
  },
  {
    Icon: IconWifi,
    title: 'Siempre disponible',
    body: 'Tu panel vive en la nube, accesible desde cualquier navegador.',
    accent: '#FAC775',
  },
];

const PRICING_ITEMS = [
  'Inventario y productos ilimitados',
  'Multi-sucursal y multi-usuario',
  'Reportes mensuales con IA',
  'Todo conectado en tiempo real',
  'Recibos de venta en PDF',
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

// Subrayado en degradé que se dibuja de izquierda a derecha al entrar en
// pantalla — el mismo pequeño gesto debajo de cada título de sección, para
// que la página se sienta de una sola pieza sin repetir literalmente el
// mismo componente de encabezado en todos lados.
function SectionKicker({ children }) {
  const reduceMotion = useReducedMotion();
  return (
    <FadeUp className="mx-auto mb-12 max-w-xl text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{children}</h2>
      <motion.span
        initial={reduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ transformOrigin: 'left' }}
        className="mx-auto mt-3 block h-[3px] w-14 rounded-full bg-gradient-to-r from-iris via-coral to-aqua"
      />
    </FadeUp>
  );
}

function CtaArrow({ className = '' }) {
  return <IconArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${className}`} />;
}

export default function Landing({ onGetStarted, onLogin }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-night-bg font-display text-white/80">
      <StickyNav onGetStarted={onGetStarted} onLogin={onLogin} />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-10 pt-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <motion.div
            className="absolute left-1/2 top-[-200px] h-[460px] w-[680px] -translate-x-1/2 rounded-full bg-iris/25 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 30, 0], y: [0, 18, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -left-24 top-40 h-64 w-64 rounded-full bg-coral/15 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 20, 0], y: [0, -16, 0] }}
            transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-16 top-24 h-56 w-56 rounded-full bg-aqua/15 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="mx-auto max-w-3xl">
          <motion.h1
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            <span className="whitespace-nowrap">Tu tienda con</span> <RotatingWord />
          </motion.h1>
          <motion.p
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-base text-white/55"
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
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onGetStarted}
              className="group flex items-center gap-2 rounded-xl bg-iris px-6 py-3 text-base font-medium text-white shadow-glow"
            >
              Pruébalo gratis
              <CtaArrow />
            </motion.button>
            <motion.a
              whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.06)' }}
              whileTap={{ scale: 0.97 }}
              href="#producto"
              className="rounded-xl border border-night-border px-6 py-3 text-base font-medium text-white/80"
            >
              Ver cómo funciona
            </motion.a>
          </motion.div>

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40"
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

      {/* Texto que se decodifica */}
      <div className="flex justify-center pb-16">
        <DecodeText />
      </div>

      {/* Producto en movimiento */}
      <section id="producto" className="border-t border-night-border bg-night-card/20 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionKicker>Tu tienda, de un vistazo</SectionKicker>
          <p className="-mt-8 mb-10 text-center text-sm text-white/50">
            Así se ve Mostrador funcionando de verdad — sin maquetas, sin relleno.
          </p>
          <DemoShowcase />
        </div>
      </section>

      {/* Resultados */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionKicker>Lo que te llevas</SectionKicker>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <AnimatedStat key={stat.label} {...stat} delay={i * 0.05} />
            ))}
          </div>
        </div>
      </section>

      {/* Problema → Solución */}
      <section className="border-t border-night-border bg-night-card/20 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionKicker>Lo que te está pasando ahora</SectionKicker>
          <div className="space-y-4">
            {PROBLEMS.map(({ before, after, Icon }, i) => (
              <FadeUp
                key={before}
                delay={i * 0.05}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="flex flex-col items-stretch gap-4 rounded-2xl border border-night-border bg-night-card p-5 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3 text-white/50">
                  <IconAlertTriangle className="h-5 w-5 shrink-0 text-golden" />
                  <p className="text-sm">{before}</p>
                </div>
                <IconArrowRight className="h-4 w-4 shrink-0 rotate-90 text-white/20 sm:rotate-0" />
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-iris text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-white">{after}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionKicker>Lo que incluye</SectionKicker>
          <BentoGrid items={BENTO_ITEMS} />
        </div>
      </section>

      {/* Funciones (cinta infinita) */}
      <section className="border-y border-night-border bg-night-card/20 py-10">
        <FeatureMarquee />
      </section>

      {/* Cómo funciona */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <SectionKicker>Cómo funciona</SectionKicker>
          <div className="relative space-y-8 pl-8">
            <motion.div
              initial={reduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              style={{ transformOrigin: 'top' }}
              className="absolute bottom-0 left-0 top-0 w-px bg-gradient-to-b from-iris via-coral to-aqua"
            />
            {STEPS.map((step, i) => (
              <FadeUp key={step.title} delay={i * 0.06} className="relative">
                <span className="absolute -left-[calc(2rem+5px)] flex h-6 w-6 items-center justify-center rounded-full bg-iris text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-white/55">{step.body}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Confianza */}
      <section className="border-t border-night-border bg-night-card/20 py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ Icon, title, body, accent }, i) => (
            <FadeUp
              key={title}
              delay={i * 0.05}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-xl p-2 text-center"
            >
              <div
                className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}26`, color: accent }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs text-white/50">{body}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="py-20 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <SectionKicker>Un solo plan, sin letra chica</SectionKicker>
          <FadeUp
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="relative mx-auto max-w-sm rounded-2xl border border-iris/50 bg-night-card p-8 text-left shadow-glow"
          >
            <p className="text-center text-sm font-medium uppercase tracking-wide text-white/40">
              Suscripción mensual
            </p>
            <p className="font-display mt-2 text-center text-4xl font-semibold text-white">$20.000</p>
            <p className="mb-6 text-center text-sm text-white/50">CLP por mes, todo incluido</p>
            <ul className="mb-6 space-y-2.5">
              {PRICING_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-aqua" />
                  {item}
                </li>
              ))}
            </ul>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onGetStarted}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-iris py-3 text-base font-medium text-white"
            >
              Pruébalo gratis
              <CtaArrow />
            </motion.button>
          </FadeUp>
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="border-t border-night-border bg-night-card/20 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <SectionKicker>Preguntas frecuentes</SectionKicker>
          <FadeUp>
            <Faq items={FAQ_ITEMS} />
          </FadeUp>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <FadeUp>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
            ¿Listo para ordenar tu tienda?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/55">
            Empieza hoy y ten tu inventario, ventas y reportes bajo control desde el primer día.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onGetStarted}
            className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-iris px-8 py-3 text-base font-medium text-white shadow-glow"
          >
            Empieza hoy
            <CtaArrow />
          </motion.button>
        </FadeUp>
      </section>

      <footer className="border-t border-night-border py-8 text-center text-xs text-white/35">
        Mostrador — el panel para tiendas y almacenes.
      </footer>
    </div>
  );
}
