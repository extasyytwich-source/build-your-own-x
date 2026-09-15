const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let mainWindow = null;
let backendPort = null;

// El backend (Express + SQLite) corre dentro de este mismo proceso de
// Electron, en vez de requerir Node.js instalado por separado en la
// computadora de la tienda. Así el programa es un solo instalador de
// doble clic.
async function startBackend() {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');

  const serverSrcDir = app.isPackaged
    ? path.join(__dirname, 'server', 'src')
    : path.join(__dirname, '..', 'server', 'src');
  const serverEntry = path.join(serverSrcDir, 'index.js');

  const serverModule = await import(pathToFileURL(serverEntry).href);
  const { port } = await serverModule.startServer({ port: 0 });
  return port;
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

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    backendPort = await startBackend();
    createWindow(backendPort);
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
