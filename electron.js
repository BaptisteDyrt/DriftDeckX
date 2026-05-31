const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icons/Logo.png'))

// Chemin du fichier de données
const DATA_PATH = path.join(app.getPath('userData'), 'presets.json')

// Helpers fichier
function readFile() {
  try {
    if (!fs.existsSync(DATA_PATH)) return []
    const raw = fs.readFileSync(DATA_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[main] Erreur lecture fichier :', err)
    return []
  }
}

function writeFile(presets) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(presets, null, 2), 'utf-8')
}

// IPC handlers
ipcMain.handle('storage:read', () => readFile())
ipcMain.handle('storage:write', (_, presets) => {
  writeFile(presets)
  return true
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1632,
    height: 918,
    minWidth: 1200,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icons/Logo.png'),
    title: 'DriftDeckX'
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'DriftDeckX',
    applicationVersion: '1.0.0',
    version: '1.0.0',
    copyright: '© 2026 Baptiste Dayraut\nDiscord : Clevess_',
    iconPath: path.join(__dirname, 'assets/icons/Logo.png')
  })

  app.dock.setIcon(icon)

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})