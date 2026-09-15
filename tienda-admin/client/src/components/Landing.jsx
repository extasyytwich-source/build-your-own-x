import { motion } from 'framer-motion';
import {
  IconStore,
  IconBox,
  IconReceipt,
  IconTrendingUp,
  IconWifi,
  IconBarcode,
  IconFileText,
} from './icons.jsx';

const FEATURES = [
  {
    Icon: IconBox,
    title: 'Inventario siempre al día',
    body: 'Productos, stock y precios en un solo lugar. Alertas automáticas cuando algo está por agotarse.',
  },
  {
    Icon: IconReceipt,
    title: 'Cada venta, registrada',
    body: 'Entradas, salidas y ajustes de stock quedan en un historial completo, con recibo en PDF por venta.',
  },
  {
    Icon: IconTrendingUp,
    title: 'Reportes con IA',
    body: 'Un resumen mensual en español: ganancias, qué reponer con urgencia y si la caja cuadra con las ventas.',
  },
  {
    Icon: IconWifi,
    title: 'Todo conectado en vivo',
    body: 'La caja, el teléfono y tu computadora ven los mismos datos al instante, sin recargar nada.',
  },
  {
    Icon: IconBarcode,
    title: 'Lector de código de barras',
    body: 'Con un lector USB/Bluetooth o con la cámara del teléfono, para vender rápido sin buscar productos a mano.',
  },
  {
    Icon: IconFileText,
    title: 'Respaldo y exportación',
    body: 'Descarga tus datos cuando quieras, o expórtalos a CSV para revisarlos en Excel.',
  },
];

export default function Landing({ onGetStarted, onLogin }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
            <IconStore className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Mostrador</span>
        </div>
        <button onClick={onLogin} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Iniciar sesión
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-12 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
        >
          El panel para que tu tienda no pierda de vista ni un producto
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-slate-500"
        >
          Mostrador es el panel en línea para administrar el inventario, las ventas y la caja de
          tu tienda — desde la computadora o el teléfono, en tiempo real, con reportes que hace la
          IA por ti.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button onClick={onGetStarted} className="btn-primary px-6 py-3 text-base">
            Crear cuenta
          </button>
          <button onClick={onLogin} className="btn-secondary px-6 py-3 text-base">
            Ya tengo cuenta
          </button>
        </motion.div>
        <p className="mt-4 text-xs text-slate-400">$20.000 CLP al mes, sin contratos ni letra chica.</p>
      </section>

      <section className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              className="card p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3>
              <p className="text-sm text-slate-500">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="card mx-auto max-w-sm p-8">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Suscripción mensual
          </p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">$20.000</p>
          <p className="mt-1 text-sm text-slate-500">CLP por mes, todo incluido</p>
          <button onClick={onGetStarted} className="btn-primary mt-6 w-full py-3 text-base">
            Crear cuenta
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        Mostrador — el panel para tiendas y almacenes.
      </footer>
    </div>
  );
}
