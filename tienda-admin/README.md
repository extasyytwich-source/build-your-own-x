# Panel de la Tienda (Tienda Admin)

Programa privado de escritorio/local para que el dueño de una tienda administre
su catálogo de productos y lleve control de todo lo que entra y sale del
inventario (ventas, uso, reposiciones y ajustes). No es un sitio público: está
pensado para correr en la computadora de la tienda y solo se accede con un PIN.

## ¿Qué incluye?

- **Panel general**: valor del inventario, productos con stock bajo y los
  productos más usados/vendidos.
- **Productos**: alta, edición y baja de productos (nombre, SKU, categoría,
  precio, costo, stock mínimo, unidad).
- **Movimientos de stock**: registra entradas (compras/reposición), salidas
  (uso/venta) y ajustes manuales; el stock del producto se actualiza solo.
- **Historial**: bitácora completa de todos los movimientos con fecha, tipo,
  cantidad y nota.
- **Reportes mensuales**: por cada mes muestra las ganancias (calculadas con
  el precio/costo vigente al momento de cada venta), el gasto en reposición,
  qué productos hay que reponer y las alertas críticas de inventario.
- **Control de caja**: registra aparte cuánto dinero realmente ingresó y
  cuánto falta, para contrastarlo contra las ventas que calcula el sistema y
  detectar diferencias.
- **Análisis con IA**: un botón en Reportes genera (con la API de Claude) un
  resumen en español del mes — ganancias, qué reponer con urgencia, alertas
  críticas y si el efectivo registrado coincide con las ventas — y lo guarda
  para no tener que regenerarlo cada vez que abres la página.
- **Acceso con PIN**: pantalla de bloqueo antes de entrar al panel, con
  posibilidad de cambiar el PIN desde Ajustes.
- Interfaz visual con animaciones (React + Tailwind + Framer Motion).

## Estructura del proyecto

```
tienda-admin/
  server/   API en Node.js + Express + SQLite (better-sqlite3)
  client/   Interfaz en React + Vite + Tailwind + Framer Motion
```

## Requisitos

- Node.js 18 o superior

## Cómo correr el programa localmente

### 1. Backend (API)

```bash
cd tienda-admin/server
cp .env.example .env   # ajusta ADMIN_PIN con el PIN que quieras usar
npm install
npm start               # o "npm run dev" para reinicio automático
```

La API queda escuchando en `http://localhost:4000`. La base de datos SQLite se
crea automáticamente en `server/data/tienda.db` la primera vez que arranca.

Para habilitar el botón **"Generar análisis"** de la sección Reportes, agrega
tu API key de Anthropic en `server/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Consíguela en <https://console.anthropic.com/>. Si la dejas vacía, el resto
del panel (productos, movimientos, reportes, caja) funciona igual; solo el
botón de análisis con IA mostrará un aviso pidiendo configurarla.

### 2. Frontend (panel)

En otra terminal:

```bash
cd tienda-admin/client
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador e ingresa el PIN configurado en
`server/.env` (por defecto `1234`, cámbialo antes de usarlo en la tienda real).

### Uso en producción / todos los días

Para dejarlo corriendo como un programa de la tienda:

```bash
cd tienda-admin/client && npm run build   # genera client/dist
cd ../server && npm start                 # deja la API corriendo
```

Sirve los archivos de `client/dist` con cualquier servidor estático (o ábrelos
detrás de la misma API) y dale al dueño de la tienda solo el acceso a esa
máquina o red local — el panel no debe exponerse a internet público.

## Seguridad

- El PIN se guarda con hash (scrypt) en la base de datos, nunca en texto plano.
- Todas las rutas de productos, movimientos y estadísticas requieren una
  sesión válida obtenida con el PIN.
- Cambia el PIN por defecto (`1234`) antes de usar la app con datos reales,
  desde `server/.env` (primer arranque) o desde la sección **Ajustes** del
  panel.
