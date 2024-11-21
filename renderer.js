let statusTimeout;
let processFilter = '';
let isRefreshing = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 500; // Minimale Zeit zwischen Aktualisierungen in ms

function showStatus(message, isError = false) {
    if (!message) return; // Keine leeren Nachrichten anzeigen
    
    console.log('Status:', message, 'Error:', isError);
    const status = document.getElementById('status');
    if (!status) return;

    status.textContent = message;
    status.className = isError ? 'error' : 'success';
    
    if (statusTimeout) {
        clearTimeout(statusTimeout);
    }
    statusTimeout = setTimeout(() => {
        status.textContent = '';
        status.className = '';
    }, 3000);
}

// Hilfsfunktion zum Filtern von Prozessen
function matchesFilter(process, filter) {
    if (!filter) return true;
    filter = filter.toLowerCase();
    
    const name = (process.Name || process.ProcessName || '').toLowerCase();
    const title = (process.WindowTitle || '').toLowerCase();
    
    return name.includes(filter) || title.includes(filter);
}

async function suspendProcess() {
    const processName = document.getElementById('processName').value.trim();
    if (!processName) {
        showStatus('Bitte geben Sie einen Prozessnamen ein', true);
        return;
    }

    try {
        const result = await window.processControl.suspendProcess(processName);
        if (result.Success) {
            showStatus(`Prozess "${processName}" wurde erfolgreich suspendiert`, false);
            await refreshListsImmediate();
        } else {
            showStatus(result.Message || `Fehler beim Suspendieren von "${processName}"`, true);
        }
    } catch (error) {
        showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
}

async function resumeProcess() {
    const processName = document.getElementById('processName').value.trim();
    if (!processName) {
        showStatus('Bitte geben Sie einen Prozessnamen ein', true);
        return;
    }

    try {
        const result = await window.processControl.resumeProcess(processName);
        if (result.Success) {
            showStatus(`Prozess "${processName}" wurde erfolgreich fortgesetzt`, false);
            await refreshListsImmediate();
        } else {
            showStatus(result.Message || `Fehler beim Fortsetzen von "${processName}"`, true);
        }
    } catch (error) {
        showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
}

async function resumeProcessById(processName) {
    try {
        const result = await window.processControl.resumeProcess(processName);
        if (result.Success) {
            showStatus(`Prozess "${processName}" wurde erfolgreich fortgesetzt`, false);
            await refreshListsImmediate();
        } else {
            showStatus(result.Message || `Fehler beim Fortsetzen von "${processName}"`, true);
        }
    } catch (error) {
        showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
}

async function suspendProcessById(processName) {
    try {
        const result = await window.processControl.suspendProcess(processName);
        if (result.Success) {
            showStatus(`Prozess "${processName}" wurde erfolgreich suspendiert`, false);
            await refreshListsImmediate();
        } else {
            showStatus(result.Message || `Fehler beim Suspendieren von "${processName}"`, true);
        }
    } catch (error) {
        showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
}

function createProcessElement(process) {
    const div = document.createElement('div');
    div.className = 'process-item';
    if (process.IsSuspended) {
        div.classList.add('suspended');
    }
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'process-info';
    
    const nameSpan = document.createElement('div');
    nameSpan.className = 'process-name';
    nameSpan.textContent = process.Name || process.ProcessName;
    
    const detailsSpan = document.createElement('div');
    detailsSpan.className = 'process-details';
    detailsSpan.textContent = `PID: ${process.Id || 'N/A'} | ${process.WindowTitle || ''}`;
    
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'process-actions';
    
    const actionButton = document.createElement('button');
    if (process.IsSuspended) {
        actionButton.className = 'resume';
        actionButton.textContent = 'Resume';
        actionButton.onclick = () => resumeProcessById(process.Name || process.ProcessName);
    } else {
        actionButton.className = 'suspend';
        actionButton.textContent = 'Suspend';
        actionButton.onclick = () => suspendProcessById(process.Name || process.ProcessName);
    }
    
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(detailsSpan);
    buttonDiv.appendChild(actionButton);
    div.appendChild(infoDiv);
    div.appendChild(buttonDiv);
    
    return div;
}

async function refreshAllProcesses() {
    console.log('Refreshing all processes...'); 
    const container = document.getElementById('all-processes');
    if (!container) return;

    try {
        console.log('Calling getAllProcesses...'); 
        const result = await window.processControl.getAllProcesses();
        console.log('Get all processes result:', result); 
        
        if (result.Success && result.Data) {
            const processes = Array.isArray(result.Data) ? result.Data : [result.Data];
            const activeProcesses = processes.filter(process => 
                !process.IsSuspended && 
                process.Name && 
                matchesFilter(process, processFilter)
            );

            container.innerHTML = '';
            activeProcesses.forEach(process => {
                container.appendChild(createProcessElement(process));
            });
        }
    } catch (error) {
        console.error('Error refreshing processes:', error); 
        showStatus('Fehler beim Laden der Prozesse', true);
    }
}

async function refreshSuspendedList() {
    console.log('Refreshing suspended processes...'); 
    const container = document.getElementById('suspended-processes');
    if (!container) return;

    try {
        console.log('Calling getAllProcesses for suspended list...'); 
        const result = await window.processControl.getAllProcesses();
        console.log('Get suspended processes result:', result); 
        
        if (result.Success && result.Data) {
            const processes = Array.isArray(result.Data) ? result.Data : [result.Data];
            const suspendedProcesses = processes.filter(process => 
                process.IsSuspended && 
                matchesFilter(process, processFilter)
            );
            
            console.log('Filtered suspended processes:', suspendedProcesses);
            
            container.innerHTML = '';
            suspendedProcesses.forEach(process => {
                container.appendChild(createProcessElement(process));
            });
        }
    } catch (error) {
        console.error('Error refreshing suspended processes:', error); 
        showStatus('Fehler beim Laden der suspendierten Prozesse', true);
    }
}

// Sofortige Aktualisierung nach Aktionen
async function refreshListsImmediate() {
    isRefreshing = true;
    try {
        await Promise.all([
            refreshAllProcesses(),
            refreshSuspendedList()
        ]);
    } finally {
        isRefreshing = false;
        lastRefreshTime = Date.now();
    }
}

// Periodische Aktualisierung mit Cooldown
async function refreshLists() {
    if (isRefreshing) return;
    
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN) {
        return;
    }
    
    await refreshListsImmediate();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded'); 
    
    // Prozessfilter
    const processFilterInput = document.getElementById('processFilter');
    if (processFilterInput) {
        processFilterInput.addEventListener('input', (e) => {
            processFilter = e.target.value.trim();
            refreshListsImmediate();
        });
    }
    
    // Erste Aktualisierung
    refreshListsImmediate();
    
    // Auto-refresh alle 2 Sekunden, aber nur wenn keine andere Aktualisierung läuft
    setInterval(refreshLists, 2000);
});
