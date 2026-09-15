# Desplegar Mostrador en producción (Render.com)

Esta guía deja el sitio accesible desde internet, con HTTPS y dominio reales,
usando [Render](https://render.com) (tiene plan gratuito para empezar). Se
puede adaptar a otro proveedor que soporte Docker + PostgreSQL (Railway,
Fly.io, un VPS propio, etc.) — los pasos específicos de "conectar el repo" y
"agregar variables de entorno" cambian, pero las variables y el Dockerfile
son los mismos.

## 1. Crear la base de datos PostgreSQL

1. En el dashboard de Render, **New → PostgreSQL**.
2. Elige un nombre (ej. `mostrador-db`) y la región más cercana a tus
   usuarios (ej. Oregon si tus clientes están en Chile, es la más cercana de
   las que ofrece el plan gratuito).
3. Cuando termine de crearse, copia el **Internal Database URL** (se ve como
   `postgresql://usuario:clave@host/basededatos`) — se usa como
   `DATABASE_URL` en el paso 3.

## 2. Crear el servicio web

1. **New → Web Service** → conecta este repositorio de GitHub.
2. **Root Directory**: `tienda-admin` (el Dockerfile vive ahí).
3. **Runtime**: Docker (Render lo detecta solo al ver el `Dockerfile`).
4. Plan: el gratuito alcanza para empezar y probar con clientes reales;
   sube de plan cuando el tráfico lo pida.

## 3. Variables de entorno

En la sección **Environment** del servicio web, agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | el Internal Database URL del paso 1 |
| `JWT_SECRET` | un valor largo y aleatorio (ej. genera uno con `openssl rand -hex 32`) |
| `PUBLIC_URL` | la URL que Render te asigna, ej. `https://mostrador.onrender.com` (o tu dominio propio si ya lo conectaste) |
| `NODE_ENV` | `production` |
| `FLOW_API_KEY` | tu llave de Flow (sandbox primero, producción cuando quieras cobrar de verdad) |
| `FLOW_SECRET_KEY` | tu llave secreta de Flow |
| `FLOW_BASE_URL` | `https://sandbox.flow.cl/api` en pruebas, `https://www.flow.cl/api` en producción |
| `ANTHROPIC_API_KEY` | opcional — cada negocio también puede pegar la suya propia desde Ajustes |
| `GOOGLE_CLIENT_ID` | opcional — habilita "Iniciar sesión con Google" (ver más abajo) |
| `VITE_GOOGLE_CLIENT_ID` | opcional — mismo valor que `GOOGLE_CLIENT_ID`, pero para el cliente (ver más abajo) |

`PORT` no hace falta configurarlo: Render lo define solo y el servidor ya lo
respeta (`process.env.PORT`).

**Sobre Google Sign-In:** si ya lo configuraste en desarrollo (ver
`README.md`), agrega el mismo Client ID acá, en **ambas** variables
(`GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` — el servidor y el cliente lo
leen por separado). Además, en [Google Cloud
Console](https://console.cloud.google.com/) → **APIs & Services →
Credentials**, edita ese OAuth client y agrega el dominio real de producción
(ej. `https://mostrador.onrender.com` o tu dominio propio) a **Authorized
JavaScript origins** — si no, el botón de Google funciona en `localhost` pero
falla en el sitio publicado.

`VITE_GOOGLE_CLIENT_ID` es especial: Vite la incrusta en el bundle al
**compilar** el cliente, no al arrancar el servidor, así que no basta con
que quede seteada como variable de entorno del contenedor en ejecución. El
`Dockerfile` ya está preparado para esto (recibe `VITE_GOOGLE_CLIENT_ID`
como build arg); Render pasa automáticamente las variables de entorno del
servicio como build args al construir la imagen Docker, así que con
agregarla en la tabla de arriba alcanza — no hace falta ningún paso extra.
Sin esta variable, el botón de Google simplemente no aparece — el resto de
la app funciona igual.

**Importante sobre Flow:** el código firma y llama a la API de Flow
siguiendo su esquema de autenticación documentado (HMAC-SHA256), usando el
endpoint clásico de pago único (`payment/create` / `payment/getStatus`), que
es el más estable de su API. No tuve forma de probarlo contra una cuenta
Flow real (necesita RUT/datos bancarios tuyos), así que antes de cobrar
dinero real: crea la cuenta en [flow.cl](https://flow.cl), consigue las
llaves de **sandbox**, configúralas aquí, y prueba el flujo completo
(`Ajustes → Suscripción → Pagar y activar`) con una tarjeta de prueba de
Flow. Si algún endpoint cambió de nombre en su documentación actual,
avísame para ajustar `server/src/billing.js` — el resto de la app
(productos, movimientos, reportes, facturas) no depende de esto.

Sin `FLOW_API_KEY` configurada y con `NODE_ENV` distinto de `production`,
el botón "Pagar y activar" activa la suscripción directo (modo de
desarrollo) para poder probar todo lo demás sin esperar la cuenta de Flow.
Esto **nunca ocurre en producción** (queda bloqueado por
`NODE_ENV=production`).

## 4. Desplegar

Con el repo conectado y las variables cargadas, Render construye la imagen
y la despliega solo. Al terminar:

- Las migraciones (`server/migrations/*.sql`) corren automáticamente al
  arrancar el servidor — no hay un paso manual de "crear las tablas".
- Abre la URL que te dio Render: deberías ver la pantalla de registro.

## 5. Dominio propio (opcional)

Si compraste un dominio (ej. `mostrador.cl`), en el servicio web de Render
ve a **Settings → Custom Domains**, agrégalo y sigue las instrucciones para
apuntar tu DNS. Actualiza también la variable `PUBLIC_URL` para que coincida
con el dominio final (Flow necesita esa URL para el aviso de pago).

## Actualizar la app ya desplegada

Cada `git push` a la rama conectada dispara un nuevo build y despliegue
automático en Render. Las migraciones nuevas que agregues en
`server/migrations/` se aplican solas la próxima vez que el servidor
arranque.
