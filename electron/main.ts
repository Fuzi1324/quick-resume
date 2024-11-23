import { app, BrowserWindow, ipcMain } from 'electron';
import { exec } from 'child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function executePowerShell(command: string, processName = ''): Promise<any> {
  let scriptPath: string;
  if (app.isPackaged) {
    scriptPath = path.join(process.resourcesPath, 'Quick-Resume.ps1');
  } else {
    scriptPath = path.join(process.env.APP_ROOT || '', 'Quick-Resume.ps1');
  }

  const fullCommand = `powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -NoLogo -File "${scriptPath}" -Command "${command}" ${processName ? `-ProcessName "${processName}"` : ''}`;

  console.log('Executing PowerShell command:', fullCommand);

  return new Promise((resolve, reject) => {
    exec(fullCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('PowerShell execution error:', error);
        reject({ Success: false, Message: error.message });
        return;
      }

      if (stderr) {
        console.error('PowerShell stderr:', stderr);
      }

      try {
        const cleanOutput = stdout.trim();
        console.log('PowerShell raw output:', cleanOutput);

        if (!cleanOutput) {
          resolve({ Success: true });
          return;
        }

        const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in output');
        }

        const result = JSON.parse(jsonMatch[0]);
        console.log('Parsed PowerShell result:', result);

        if (!result.Success && !result.Message) {
          result.Message = 'Operation failed';
        }

        resolve(result);
      } catch (e) {
        console.error('JSON parse error:', e, 'Raw output:', stdout);
        reject({ Success: false, Message: 'Failed to process PowerShell output' });
      }
    });
  });
}

app.whenReady().then(() => {
  createWindow();

  // IPC-Handler
  ipcMain.handle('suspend-process', async (_event, processName: string) => {
    try {
      console.log('Suspending process:', processName);
      const result = await executePowerShell(`Suspend-Process -Name "${processName}"`, processName);
      return { Success: true, Data: result };
    } catch (error: any) {
      console.error('Suspend process error:', error);
      return { Success: false, Message: error.message };
    }
  });

  ipcMain.handle('resume-process', async (_event, processName: string) => {
    try {
      console.log('Resuming process:', processName);
      const result = await executePowerShell(`Resume-Process -Name "${processName}"`, processName);
      return { Success: true, Data: result };
    } catch (error: any) {
      console.error('Resume process error:', error);
      return { Success: false, Message: error.message };
    }
  });

  ipcMain.handle('get-all-processes', async () => {
    try {
      console.log('Getting all processes');
      const result = await executePowerShell('Get-AppsStatus');
      return result;
    } catch (error: any) {
      console.error('Get all processes error:', error);
      return { Success: false, Message: `Failed to get processes: ${error.message || 'Unknown error'}` };
    }
  });

  // Event Listener für macOS
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
