# Mostrador

Mostrador es un panel en línea (SaaS) para que el dueño de una tienda
administre su catálogo de productos, controle todo lo que entra y sale del
inventario, lleve el control de caja, genere recibos de venta en PDF y
reciba un análisis mensual de su negocio con IA — todo desde el navegador,
en cualquier computadora o teléfono, sin instalar nada.

Cada negocio que se registra tiene sus propios datos, completamente
separados de los demás (multi-tenant): nadie ve ni puede tocar la
información de otra tienda. El acceso requiere una suscripción mensual de
**$20.000 CLP**, cobrada con [Flow](https://flow.cl).

## ¿Qué incluye?

- **Cuenta propia por negocio**: registro con nombre del negocio, correo y
  contraseña (o con **Iniciar sesión con Google**), sesión en una cookie
  httpOnly.
- **Suscripción de pago**: $20.000 CLP/mes vía Flow. Sin pago al día, el
  panel se bloquea (los datos nunca se borran).
- **Panel general**: valor del inventario, productos con stock bajo y los
  productos más usados/vendidos.
- **Productos**: alta, edición y baja de productos (nombre, SKU, categoría,
  precio, costo, stock mínimo, unidad).
- **Movimientos de stock**: registra entradas (compras/reposición), salidas
  (uso/venta) y ajustes manuales; el stock del producto se actualiza solo.
- **Recibos en PDF**: cada venta puede generar un recibo simple en PDF
  (nombre del negocio, producto, cantidad, precio, total) desde el
  Historial. No reemplaza una boleta/factura electrónica formal ante el SII.
- **Reportes mensuales**: ganancias, gasto en reposición, qué reponer con
  urgencia, alertas críticas de inventario, y análisis con IA (API de
  Claude) que resume todo eso en español.
- **Control de caja**: registra cuánto dinero realmente ingresó y cuánto
  falta, para contrastarlo contra las ventas que calcula el sistema.
- **Todo conectado en tiempo real**: la computadora del dueño, la de la
  caja y el teléfono pueden estar abiertos al mismo tiempo. Cuando
  cualquiera registra un movimiento, las demás pantallas lo ven aparecer
  solo, sin recargar.
- **Lector de código de barras**: por teclado (lector USB/Bluetooth común)
  o con la cámara del teléfono, abriendo el mismo panel desde ahí.
- **Respaldo y exportación**: descarga un respaldo en JSON de los datos del
  negocio, restáuralo, o exporta productos/movimientos/caja a CSV.

## Estructura del proyecto

```
tienda-admin/
  server/   API en Node.js + Express + PostgreSQL
  client/   Interfaz en React + Vite + Tailwind + Framer Motion
  desktop/  Empaquetado como programa de escritorio (Electron) — ver nota abajo
```

> **Sobre `desktop/`**: antes de convertirse en un producto en línea
> multi-negocio, este proyecto era una herramienta privada de escritorio con
> SQLite local. Ese empaquetado de Electron queda en el repositorio tal
> cual, pero **ya no funciona** contra el backend actual (que requiere
> PostgreSQL y cuentas multi-negocio) — quedó fuera del alcance de este
> pivote. Se puede retomar más adelante como un empaquetado liviano que solo
> abra la URL real del sitio ya desplegado, si hace falta.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior (local para desarrollo, o el que dé tu hosting)

## Cómo correr el proyecto localmente

### 1. Base de datos

Crea una base Postgres local vacía (ejemplo con la CLI de `psql`):

```bash
createdb tienda_admin_dev
```

### 2. Backend (API)

```bash
cd tienda-admin/server
cp .env.example .env   # ajusta DATABASE_URL, JWT_SECRET, etc.
npm install
npm start               # o "npm run dev" para reinicio automático
```

La API queda escuchando en `http://localhost:4000` y aplica sola las
migraciones (`server/migrations/*.sql`) contra la base indicada en
`DATABASE_URL` la primera vez que arranca.

Sin `FLOW_API_KEY` configurada, y con `NODE_ENV` distinto de `production`,
el botón "Pagar y activar" activa la suscripción directo (modo desarrollo)
para poder probar todo el panel sin necesitar una cuenta de Flow todavía.
Ver `.env.example` para el resto de las variables (incluida la API key de
Anthropic para el análisis con IA, opcional).

### 3. Frontend (panel)

En otra terminal:

```bash
cd tienda-admin/client
cp .env.example .env   # opcional: VITE_GOOGLE_CLIENT_ID para el botón de Google
npm install
npm run dev
```

Abre `http://localhost:5173`, crea una cuenta y activa la suscripción
(modo desarrollo si no configuraste Flow todavía).

### Iniciar sesión con Google (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Credentials → Create Credentials → OAuth client ID → Web
   application**.
2. En **Authorized JavaScript origins** agrega `http://localhost:5173`
   (desarrollo) y el dominio real cuando despliegues. No hace falta
   configurar un "redirect URI" ni generar un client secret — el botón usa
   verificación de ID token, no necesita ninguno de los dos.
3. Copia el Client ID a **ambos** `.env`: `GOOGLE_CLIENT_ID` en
   `server/.env` y `VITE_GOOGLE_CLIENT_ID` en `client/.env` (mismo valor).
4. Sin esto configurado, el botón de Google simplemente no aparece — el
   resto del panel funciona igual con correo y contraseña.

### Build de producción local

```bash
cd tienda-admin/client && npm run build   # genera client/dist
cd ../server && npm start                 # sirve la API + el cliente compilado
```

## Desplegar en internet

Ver [`DEPLOY.md`](./DEPLOY.md) para la guía paso a paso (Render.com,
incluye Dockerfile listo para usar).

## Seguridad

- Las contraseñas se guardan con hash (scrypt), nunca en texto plano; una
  cuenta creada con Google puede no tener contraseña hasta que decida
  ponerse una.
- La sesión es un JWT firmado con `JWT_SECRET`, guardado en una **cookie
  httpOnly** (el navegador se la manda solo al servidor; JavaScript de la
  página —propio o inyectado por un XSS— no puede leerla). En producción,
  el servidor **rehúsa arrancar** si no configuraste `JWT_SECRET` en vez de
  usar el valor de desarrollo por defecto.
- **Iniciar sesión con Google**: el ID token se verifica contra las llaves
  públicas de Google (`google-auth-library`) y contra nuestro propio
  `GOOGLE_CLIENT_ID`. Si el correo ya tenía cuenta con contraseña, se
  vincula automático (Google ya confirmó que ese correo es de esa persona).
- `helmet` agrega los headers de seguridad estándar (CSP, no-sniff, etc.), y
  `express-rate-limit` frena intentos repetidos de login/registro por IP.
- Todos los datos de negocio (productos, movimientos, caja, reportes,
  eventos en tiempo real) están aislados por `business_id`: ninguna consulta
  cruza esa frontera.
- El pago de la suscripción nunca pasa por este servidor: Flow redirige al
  dueño a su propia página para ingresar la tarjeta, y solo nos avisa el
  resultado (verificado contra la API de Flow, no confiando ciegamente en
  el aviso).
