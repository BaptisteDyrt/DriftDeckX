const { app, BrowserWindow, ipcMain, nativeImage, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

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
    icon: process.platform === 'darwin'
      ? path.join(__dirname, 'assets/Logo.icns')
      : path.join(__dirname, 'assets/Logo.png'),
    title: 'DriftDeckX'
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/Logo.icns'))

    app.setAboutPanelOptions({
      applicationName: 'DriftDeckX',
      applicationVersion: app.getVersion(),
      version: app.getVersion(),
      copyright: '© 2026 Baptiste Dayraut\nDiscord : Clevess_',
      iconPath: path.join(__dirname, 'assets/Logo.icns')
    })

    app.dock.setIcon(icon)
  }

  createWindow()

  // Auto-update
  if (process.platform === 'win32') {
    // Auto-update complet sur Windows
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Mise à jour disponible',
        message: 'Une nouvelle version de DriftDeckX est disponible.',
        detail: 'Elle sera téléchargée en arrière-plan et installée au prochain redémarrage.',
        buttons: ['OK']
      })
    })

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Mise à jour prête',
        message: 'La mise à jour a été téléchargée.',
        detail: 'Redémarre l\'app pour installer la nouvelle version.',
        buttons: ['Redémarrer maintenant', 'Plus tard']
      }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
    })

  } else {
    // Notification manuelle sur macOS
    autoUpdater.checkForUpdates().then(result => {
      if (result && result.updateInfo) {
        const latest = result.updateInfo.version
        const current = app.getVersion()
        if (latest !== current) {
          dialog.showMessageBox({
            type: 'info',
            title: 'Mise à jour disponible',
            message: `Une nouvelle version de DriftDeckX est disponible (v${latest}).`,
            detail: 'Télécharge la dernière version sur GitHub pour mettre à jour.',
            buttons: ['Ouvrir GitHub', 'Plus tard']
          }).then(r => {
            if (r.response === 0) {
              shell.openExternal('https://github.com/BaptisteDyrt/DriftDeckX/releases/latest')
            }
          })
        }
      }
    }).catch(() => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})