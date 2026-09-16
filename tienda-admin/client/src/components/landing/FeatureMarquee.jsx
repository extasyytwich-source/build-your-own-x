// Cinta horizontal infinita — la técnica que pide el brief para la sección
// de "clientes", pero con las funciones reales de Mostrador en vez de logos
// de tiendas: un producto nuevo mostrando logos que no tiene autorización
// de usar restaría más confianza de la que sumaría. El día que haya casos
// reales, esto se reemplaza por esos logos.
const FEATURES = [
  'Multi-sucursal',
  'Boleta electrónica',
  'Reportes con IA',
  'Código de barras',
  'Devoluciones',
  'Descuentos y promociones',
  'Proveedores y compras',
  'Roles: dueño y cajero',
];

function Track({ ariaHidden = false }) {
  return (
    <div className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={ariaHidden}>
      {FEATURES.map((label) => (
        <span
          key={label}
          className="whitespace-nowrap rounded-full border border-night-border bg-night-card px-4 py-2 text-xs font-medium text-white/70"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export default function FeatureMarquee() {
  return (
    <div
      className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      role="list"
      aria-label="Funciones incluidas en Mostrador"
    >
      <div className="flex motion-safe:animate-marquee motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-3">
        <Track />
        <Track ariaHidden />
      </div>
    </div>
  );
}
