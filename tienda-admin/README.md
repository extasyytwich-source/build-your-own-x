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
- **Lector de código de barras**: en Productos, escanear el código de un
  producto (usando su SKU) abre directo el modal de "Registrar movimiento" —
  no hace falta buscarlo a mano. Funciona con cualquier lector USB/Bluetooth
  común, que se comporta como un teclado.
- **Respaldo y exportación** (en Ajustes): descarga una copia completa de la
  base de datos, restaura un respaldo anterior, o exporta productos,
  movimientos y caja a CSV para revisarlos en Excel. La app de escritorio
  además guarda respaldos automáticos cada 6 horas (conserva los últimos 14).
- **Actualizaciones automáticas** (app de escritorio): revisa sola si hay una
  versión nueva publicada y ofrece instalarla, sin que el dueño tenga que
  descargar nada manualmente.
- **App de escritorio**: se puede empaquetar como programa instalable de
  Windows/Mac/Linux (doble clic para abrir, sin terminal ni Node.js instalado).
- Interfaz visual con animaciones (React + Tailwind + Framer Motion).

## Estructura del proyecto

```
tienda-admin/
  server/   API en Node.js + Express + SQLite (better-sqlite3)
  client/   Interfaz en React + Vite + Tailwind + Framer Motion
  desktop/  Empaquetado como programa de escritorio (Electron)
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

## Entregarlo como programa de escritorio (recomendado)

Esta es la forma más simple de dárselo al dueño de la tienda: un instalador
que abre con doble clic, sin instalar Node.js ni usar la terminal. Por dentro
sigue siendo el mismo backend (Express + SQLite) corriendo dentro de la app
de Electron, con su base de datos guardada en la carpeta de datos del sistema
operativo (sobrevive si reinstalas o actualizas el programa).

### Opción A: generar el instalador con GitHub Actions (no necesitas Windows ni Mac)

El repositorio incluye el workflow `.github/workflows/tienda-admin-desktop-build.yml`,
que compila el instalador para Windows, Mac y Linux en máquinas de GitHub:

1. En GitHub, ve a la pestaña **Actions** del repositorio.
2. Abre **"Empaquetar Panel de la Tienda (escritorio)"** y presiona **Run workflow**
   (o simplemente haz push a la rama — el workflow también corre solo cuando
   cambia algo dentro de `tienda-admin/`).
3. Cuando termine (unos minutos), entra a esa ejecución y descarga el artefacto
   que necesites: `panel-tienda-windows-installer` (`.exe`), `panel-tienda-mac-installer`
   (`.dmg`) o `panel-tienda-linux-installer` (`.AppImage`).
4. Manda ese archivo al dueño de la tienda (USB, correo, Drive, WhatsApp…) y
   que lo abra como cualquier instalador.

### Opción B: generarlo tú mismo en tu computadora

```bash
cd tienda-admin/desktop
npm install                # instala Electron y recompila better-sqlite3 para su motor
npm run dist:win           # o dist:mac / dist:linux, según en qué SO lo corras
```

El instalador queda en `tienda-admin/desktop/release/`. Los instaladores de
Windows y Mac solo se pueden generar corriendo el comando en esa misma
plataforma (o usando la Opción A), por eso conviene el workflow de GitHub
Actions si tú trabajas en otro sistema operativo.

### Primer uso por el dueño de la tienda

Al abrir el programa por primera vez, el PIN por defecto es `1234` — pídele
que lo cambie de inmediato desde **Ajustes**. Si quiere el análisis con IA,
también puede pegar ahí su propia API key de Anthropic (no requiere editar
ningún archivo).

### Publicar una actualización (para que las apps ya instaladas se actualicen solas)

La app de escritorio revisa sola si hay una versión nueva (ver
`desktop/main.cjs`, `setupAutoUpdater`). Para publicar una:

1. Sube el número de versión en `tienda-admin/desktop/package.json`.
2. Haz commit de ese cambio.
3. Crea y empuja un tag con el formato `tienda-admin-vX.Y.Z`, por ejemplo:

   ```bash
   git tag tienda-admin-v1.1.0
   git push origin tienda-admin-v1.1.0
   ```

4. El workflow `.github/workflows/tienda-admin-desktop-release.yml` compila
   los instaladores de Windows/Mac/Linux y los publica como GitHub Release.
   Los programas ya instalados la detectan sola (revisan cada 6 horas y al
   abrir) y ofrecen instalarla.

Ese tag solo dispara este workflow — no interfiere con el resto del
contenido del repositorio ni con el workflow de compilación normal.

## Seguridad

- El PIN se guarda con hash (scrypt) en la base de datos, nunca en texto plano.
- Todas las rutas de productos, movimientos y estadísticas requieren una
  sesión válida obtenida con el PIN.
- Cambia el PIN por defecto (`1234`) antes de usar la app con datos reales,
  desde `server/.env` (primer arranque) o desde la sección **Ajustes** del
  panel.
