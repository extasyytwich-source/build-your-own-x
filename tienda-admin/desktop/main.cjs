const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

let mainWindow = null;
let backendPort = null;
let backendProtocol = 'https';

const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 horas
const BACKUPS_TO_KEEP = 14;

function getServerSrcDir() {
  return app.isPackaged
    ? path.join(__dirname, 'server', 'src')
    : path.join(__dirname, '..', 'server', 'src');
}

// El backend (Express + SQLite) corre dentro de este mismo proceso de
// Electron, en vez de requerir Node.js instalado por separado en la
// computadora de la tienda. Así el programa es un solo instalador de
// doble clic.
async function startBackend() {
  const serverEntry = path.join(getServerSrcDir(), 'index.js');
  const serverModule = await import(pathToFileURL(serverEntry).href);
  return serverModule.startServer({ port: 0 });
}

// El servidor embebido usa HTTPS (necesario para que el navegador del
// teléfono dé acceso a la cámara al escanear códigos de barras) con un
// certificado autofirmado propio. Esta ventana es la única que carga esa
// URL, así que en vez de debilitar la verificación de certificados en
// general, se acepta puntualmente solo ESTE certificado (comparando el PEM
// exacto) y todo lo demás sigue la verificación normal de Chromium.
async function pinOwnHttpsCertificate() {
  const certModule = await import(pathToFileURL(path.join(getServerSrcDir(), 'https-cert.js')).href);
  const { cert: ownCertPem } = await certModule.getOrCreateHttpsCert();

  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    const isOwnCert =
      request.hostname === 'localhost' && request.certificate.data.trim() === ownCertPem.trim();
    callback(isOwnCert ? 0 : -3); // -3: usar la verificación normal de Chromium para todo lo demás
  });
}

function rotateBackups(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { name } of files.slice(BACKUPS_TO_KEEP)) {
    fs.rmSync(path.join(dir, name));
  }
}

// Respaldo automático silencioso: además del botón "Descargar respaldo" en
// Ajustes, guarda copias periódicas dentro de los datos del programa, para
// que exista una red de seguridad aunque el dueño nunca use ese botón.
async function runScheduledBackup() {
  try {
    const backupsDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const backupModule = await import(pathToFileURL(path.join(getServerSrcDir(), 'backup.js')).href);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupModule.createBackupCopy(path.join(backupsDir, `tienda-${stamp}.db`));

    rotateBackups(backupsDir);
  } catch (err) {
    console.error('No se pudo crear el respaldo automático:', err);
  }
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f8fafc',
    title: 'Panel de la Tienda',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`${backendProtocol}://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Revisa actualizaciones publicadas como GitHub Release del repositorio y,
// si hay una nueva, la descarga en segundo plano y ofrece instalarla. Solo
// funciona en la app empaquetada (necesita app-update.yml, que electron-builder
// genera al construir el instalador).
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  const { autoUpdater } = require('electron-updater');
  const { dialog } = require('electron');
  autoUpdater.autoDownload = true;

  autoUpdater.on('error', (err) => {
    console.error('No se pudo revisar actualizaciones:', err);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Actualización lista',
      message: `Hay una nueva versión (${info.version}) del Panel de la Tienda lista para instalarse.`,
      detail: 'Se instalará sola la próxima vez que cierres el programa, o puedes reiniciar ahora.',
      buttons: ['Reiniciar ahora', 'Después'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('No se pudo revisar actualizaciones:', err);
    });
  };

  setTimeout(checkForUpdates, 10_000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  try {
    // Se fija antes de importar cualquier módulo del servidor: db.js lo lee
    // al cargarse para decidir dónde guardar la base de datos y el certificado.
    process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');

    // Otras rutas del servidor embebido (como restaurar un respaldo) necesitan
    // reiniciar el programa completo, algo que solo Electron puede hacer.
    global.__tiendaAdminRelaunch = () => {
      app.relaunch();
      app.exit(0);
    };

    await pinOwnHttpsCertificate();

    const started = await startBackend();
    backendPort = started.port;
    backendProtocol = started.protocol;
    createWindow(backendPort);

    setTimeout(runScheduledBackup, 15_000);
    setInterval(runScheduledBackup, BACKUP_INTERVAL_MS);

    setupAutoUpdater();
  } catch (err) {
    console.error('No se pudo iniciar el servidor interno del programa:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // En macOS, cerrar todas las ventanas no cierra la app: si el dueño vuelve
  // a abrirla desde el dock, el backend de este proceso ya sigue corriendo,
  // así que solo hace falta una ventana nueva apuntando al mismo puerto.
  if (BrowserWindow.getAllWindows().length === 0 && backendPort) {
    createWindow(backendPort);
  }
});
