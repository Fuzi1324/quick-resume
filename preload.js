const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('processControl', {
    suspendProcess: (processName) => ipcRenderer.invoke('suspend-process', processName),
    resumeProcess: (processName) => ipcRenderer.invoke('resume-process', processName),
    getAllProcesses: () => ipcRenderer.invoke('get-all-processes')
})
