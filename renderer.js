let statusTimeout;
let processFilter = '';
let isRefreshing = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 500; // Minimale Zeit zwischen Aktualisierungen in ms
let showOnlyGames = true; // Standard: Nur Spiele anzeigen

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

// Hilfsfunktion zur Erkennung von Spielen
function isGameProcess(process) {
    const gameDirectories = [
        'steam',
        'steamapps',
        'epic games',
        'games',
        'origin games',
        'gog galaxy',
        'xbox games',
        'program files (x86)\\steam',
        'program files\\steam'
    ];

    // Liste bekannter Spiele-Executables
    const knownGames = [
        'theescapists2',
        'minecraft',
        'rocketleague',
        'csgo',
        'dota2',
        'gta5',
        'gtav',
        'ark',
        'shootergame'  // ARK's executable name
    ];

    // Spiele-typische Wörter
    const gameKeywords = [
        'game',
        'play',
        'player',
        'score',
        'level',
        'mission',
        'survival',
        'evolved'
    ];

    const path = (process.Path || '').toLowerCase();
    const name = (process.Name || process.ProcessName || '').toLowerCase();
    const title = (process.WindowTitle || '').toLowerCase();

    // Prüfe auf bekannte Spiele
    if (knownGames.some(game => name.includes(game))) {
        return true;
    }

    // Prüfe auf Spiel-Verzeichnisse
    if (gameDirectories.some(dir => path.toLowerCase().includes(dir))) {
        // Wenn der Pfad ein Spieleverzeichnis enthält und es eine .exe ist,
        // ist es wahrscheinlich ein Spiel
        if (name.endsWith('.exe')) {
            return true;
        }
    }

    // Prüfe auf Spiele-typische Wörter im Fenstertitel oder Namen
    if (gameKeywords.some(keyword => title.includes(keyword) || name.includes(keyword))) {
        return true;
    }

    return false;
}

// Hilfsfunktion zum Filtern von Prozessen
function matchesFilter(process, filter) {
    if (!filter) {
        // Wenn der Games-Only Filter aktiv ist, zeige nur Spiele
        if (showOnlyGames) {
            return isGameProcess(process);
        }
        return true;
    }
    
    filter = filter.toLowerCase();
    const name = (process.Name || process.ProcessName || '').toLowerCase();
    const title = (process.WindowTitle || '').toLowerCase();
    
    const matchesSearchFilter = name.includes(filter) || title.includes(filter);
    
    // Wenn der Games-Only Filter aktiv ist, muss der Prozess auch ein Spiel sein
    if (showOnlyGames) {
        return matchesSearchFilter && isGameProcess(process);
    }
    
    return matchesSearchFilter;
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
    
    // Zuerst den WindowTitle anzeigen (falls vorhanden)
    if (process.WindowTitle) {
        const titleSpan = document.createElement('div');
        titleSpan.className = 'process-name';
        titleSpan.textContent = process.WindowTitle;
        infoDiv.appendChild(titleSpan);
    }
    
    // Dann den Prozessnamen und die PID
    const detailsSpan = document.createElement('div');
    detailsSpan.className = 'process-details';
    detailsSpan.textContent = `${process.Name || process.ProcessName} (PID: ${process.Id || 'N/A'})`;
    infoDiv.appendChild(detailsSpan);
    
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
    
    // Event Listener für den Games-Only Toggle
    const gamesOnlyToggle = document.getElementById('gamesOnlyToggle');
    if (gamesOnlyToggle) {
        gamesOnlyToggle.addEventListener('change', (e) => {
            showOnlyGames = e.target.checked;
            refreshListsImmediate();
        });
    }
    
    // Erste Aktualisierung
    refreshListsImmediate();
    
    // Auto-refresh alle 2 Sekunden, aber nur wenn keine andere Aktualisierung läuft
    setInterval(refreshLists, 2000);
});
