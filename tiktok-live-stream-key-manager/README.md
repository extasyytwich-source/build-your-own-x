# TikTok Live — Stream Key Manager

Una pequeña aplicación web (HTML/CSS/JS puro, sin backend ni dependencias)
para organizar los datos de conexión de tus transmisiones en vivo de TikTok
y generar la configuración lista para usar en OBS Studio u otro software de
streaming.

## ¿Por qué no "genera" una clave de TikTok válida?

TikTok emite el **Server URL** y el **Stream Key** reales exclusivamente
desde [TikTok Live Center](https://livecenter.tiktok.com)
(`Configuración → Iniciar transmisión con software de terceros`), ligados a
tu cuenta y a permisos de transmisión en vivo. Ninguna aplicación externa
puede generar una clave válida para transmitir en TikTok.

Lo que esta app sí hace:

- Guarda varios **perfiles de transmisión** (nombre, servidor RTMP, stream key)
  en el almacenamiento local del navegador (`localStorage`), sin enviarlos a
  ningún servidor.
- Genera un **archivo de configuración descargable** listo para pegar en OBS
  (`Ajustes → Emisión → Personalizado`).
- Permite **copiar** el servidor y la clave con un clic.
- Incluye un generador de **claves de prueba** (prefijo `TEST-`) para probar
  tu flujo de configuración local sin exponer tu clave real, antes de salir
  en vivo.

## Uso

No requiere instalación ni build. Basta con abrir `index.html` en el
navegador, o servirlo con cualquier servidor estático:

```bash
cd tiktok-live-stream-key-manager
python3 -m http.server 8000
# abre http://localhost:8000
```

1. Obtén tu Server URL y Stream Key reales desde TikTok Live Center.
2. Crea un perfil con un nombre descriptivo (por ejemplo, el nombre del canal).
3. Pega la clave, o usa "Generar clave de prueba" mientras pruebas la app.
4. Descarga la configuración de OBS o copia los valores directamente.

## Estructura

- `index.html` — estructura de la página y formulario.
- `styles.css` — estilos (soporta modo claro/oscuro automático).
- `app.js` — lógica: almacenamiento local, enmascarado de claves, generación
  de claves de prueba y exportación de configuración OBS.

## Privacidad

Todos los datos (perfiles, claves) se guardan únicamente en el
`localStorage` de tu navegador. La app no realiza ninguna llamada de red ni
envía información a servidores externos.
