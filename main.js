const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { exec } = require('child_process')

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
  win.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// PowerShell execution functions
function executePowerShell(command, processName = '') {
  const scriptPath = path.join(__dirname, 'Quick-Resume.ps1')
  const fullCommand = `powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -NoLogo -File "${scriptPath}" -Command "${command}" ${processName ? `-ProcessName "${processName}"` : ''}`
  
  console.log('Executing PowerShell command:', fullCommand)
  
  return new Promise((resolve, reject) => {
    exec(fullCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('PowerShell execution error:', error)
        reject({ Success: false, Message: error.message })
        return
      }

      if (stderr) {
        console.error('PowerShell stderr:', stderr)
      }

      // Clean up the output and find the JSON object
      const cleanOutput = stdout.trim()
      console.log('PowerShell raw output:', cleanOutput)

      try {
        // Find the last JSON object in the output
        const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in output');
        }
        
        const result = JSON.parse(jsonMatch[0]);
        console.log('Parsed result:', result)
        
        if (!result.Success && !result.Message) {
          result.Message = 'Operation failed';
        }
        
        if (result.Logs) {
          result.Logs.forEach(log => {
            console.log(`[${log.Type}] ${log.Message}`)
          })
        }
        
        resolve(result)
      } catch (e) {
        console.error('JSON parse error:', e, 'Raw output:', cleanOutput)
        reject({ Success: false, Message: 'Failed to process PowerShell output' })
      }
    })
  })
}

// IPC handlers
ipcMain.handle('suspend-process', async (event, processName) => {
  try {
    console.log('Suspending process:', processName)
    const result = await executePowerShell('Suspend-Process', processName)
    return result
  } catch (error) {
    console.error('Suspend process error:', error)
    return { Success: false, Message: `Failed to suspend process: ${error.Message || 'Unknown error'}` }
  }
})

ipcMain.handle('resume-process', async (event, processName) => {
  try {
    console.log('Resuming process:', processName)
    const result = await executePowerShell('Resume-Process', processName)
    return result
  } catch (error) {
    console.error('Resume process error:', error)
    return { Success: false, Message: `Failed to resume process: ${error.Message || 'Unknown error'}` }
  }
})

ipcMain.handle('get-all-processes', async () => {
  try {
    console.log('Getting all processes')
    const result = await executePowerShell('Get-AppsStatus')
    return result
  } catch (error) {
    console.error('Get all processes error:', error)
    return { Success: false, Message: `Failed to get processes: ${error.Message || 'Unknown error'}` }
  }
})
